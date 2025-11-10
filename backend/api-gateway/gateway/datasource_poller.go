package main

import (
	"api-gateway/redis"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/wundergraph/graphql-go-tools/execution/engine"
)

type ServiceConfig struct {
	Name         string
	URL          string
	SchemaURL    string
	Method       string
	ResponseType string
	WS           string
	Fallback     func(*ServiceConfig) (string, error)
}

type DatasourcePollerConfig struct {
	Services        []ServiceConfig
	PollingInterval time.Duration
}

const ServiceDefinitionQuery = `
	{
		"query": "query __ApolloGetServiceDefinition__ { _service { sdl } }",
		"operationName": "__ApolloGetServiceDefinition__",
		"variables": {}
	}`

type GQLErr []struct {
	Message string `json:"message"`
}

func (g GQLErr) Error() string {
	var builder strings.Builder
	for _, m := range g {
		_ = builder.WriteByte('\t')
		_, _ = builder.WriteString(m.Message)
	}

	return builder.String()
}

func NewDatasourcePoller(
	httpClient *http.Client,
	config DatasourcePollerConfig,
	cacheService *redis.CacheService,
	cbManager *CircuitBreakerManager,
	retryManager *redis.RetryManager,
) *DatasourcePollerPoller {
	return &DatasourcePollerPoller{
		httpClient:   httpClient,
		config:       config,
		sdlMap:       make(map[string]string),
		cacheService: cacheService,
		cbManager:    cbManager,
		retryManager: retryManager,
	}
}

type DatasourcePollerPoller struct {
	httpClient   *http.Client
	cacheService *redis.CacheService
	cbManager    *CircuitBreakerManager
	retryManager *redis.RetryManager

	config DatasourcePollerConfig
	sdlMap map[string]string

	updateDatasourceObservers []DataSourceObserver
}

func (d *DatasourcePollerPoller) Register(updateDatasourceObserver DataSourceObserver) {
	d.updateDatasourceObservers = append(d.updateDatasourceObservers, updateDatasourceObserver)
}

func (d *DatasourcePollerPoller) Run(ctx context.Context) {
	d.updateSDLs(ctx)

	if d.config.PollingInterval == 0 {
		<-ctx.Done()
		return
	}

	ticker := time.NewTicker(d.config.PollingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.updateSDLs(ctx)
		}
	}
}

func (d *DatasourcePollerPoller) updateSDLs(ctx context.Context) {
	d.sdlMap = make(map[string]string)

	var wg sync.WaitGroup
	resultCh := make(chan struct {
		name string
		sdl  string
	})

	for _, serviceConf := range d.config.Services {
		serviceConf := serviceConf // Create new instance of serviceConf for the goroutine.
		wg.Add(1)
		go func() {
			defer wg.Done()

			// Get or create circuit breaker for this service
			var breaker *redis.CircuitBreaker
			var retry *redis.Retry
			
			if d.cbManager != nil {
				subgraphConfig := redis.CircuitBreakerConfig{
					MaxFailures:      3,                // More sensitive for subgraphs
					Timeout:          30 * time.Second, // Shorter recovery time
					MaxRequests:      2,                // Only 2 test requests
					ResetTimeout:     20 * time.Second,
					FailureThreshold: 60.0, // 60% failure rate
				}
				breaker = d.cbManager.GetOrCreateBreaker("subgraph-"+serviceConf.Name, subgraphConfig)
			}
			
			if d.retryManager != nil {
				subgraphRetryConfig := redis.RetryConfig{
					MaxAttempts:    2,                      // 2 retries for schema fetching
					InitialDelay:   50 * time.Millisecond,  // Start with 50ms
					MaxDelay:       1 * time.Second,        // Cap at 1 second
					Multiplier:     2.0,                    // Double delay
					Jitter:         0.1,                    // 10% jitter
					RetryOnTimeout: true,
					RetryOn5xx:     true,
				}
				retry = d.retryManager.GetOrCreateRetry("subgraph-"+serviceConf.Name, subgraphRetryConfig)
			}

			// Try to get schema from cache first
			if d.cacheService != nil {
				cachedSDL, hit, err := d.cacheService.GetCachedSchema(ctx, serviceConf.Name)
				if hit && err == nil && cachedSDL != "" {
					log.Printf("Schema cache hit for service: %s", serviceConf.Name)
					select {
					case <-ctx.Done():
					case resultCh <- struct {
						name string
						sdl  string
					}{name: serviceConf.Name, sdl: cachedSDL}:
					}
					return
				}
			}

			// Cache miss - fetch from service with retry + circuit breaker protection
			var sdl string
			var err error
			
			// Wrap everything in retry logic
			if retry != nil {
				fetchErr := retry.ExecuteWithCondition(ctx, func(attempt int) error {
					// Circuit breaker inside retry
					if breaker != nil {
						return breaker.Execute(ctx, func() error {
							fetchedSDL, fetchErr := d.fetchServiceSDL(ctx, serviceConf.SchemaURL, serviceConf.Method, serviceConf.ResponseType)
							if fetchErr != nil {
								return fetchErr
							}
							sdl = fetchedSDL
							return nil
						})
					}
					
					// No circuit breaker, just fetch
					fetchedSDL, fetchErr := d.fetchServiceSDL(ctx, serviceConf.SchemaURL, serviceConf.Method, serviceConf.ResponseType)
					if fetchErr != nil {
						return fetchErr
					}
					sdl = fetchedSDL
					return nil
				}, func(err error, attempt int) bool {
					// Don't retry if circuit is open
					if err == redis.ErrCircuitOpen {
						log.Printf("Circuit breaker OPEN for service %s, stopping retries", serviceConf.Name)
						return false
					}
					return true
				})
				
				if fetchErr != nil {
					err = fetchErr
				}
			} else if breaker != nil {
				// No retry, just circuit breaker
				fetchErr := breaker.Execute(ctx, func() error {
					fetchedSDL, fetchErr := d.fetchServiceSDL(ctx, serviceConf.SchemaURL, serviceConf.Method, serviceConf.ResponseType)
					if fetchErr != nil {
						return fetchErr
					}
					sdl = fetchedSDL
					return nil
				})
				
				if fetchErr != nil {
					if fetchErr == redis.ErrCircuitOpen {
						log.Printf("Circuit breaker OPEN for service %s - using fallback", serviceConf.Name)
					}
					err = fetchErr
				}
			} else {
				// No retry, no circuit breaker
				sdl, err = d.fetchServiceSDL(ctx, serviceConf.SchemaURL, serviceConf.Method, serviceConf.ResponseType)
			}
			
			if err != nil {
				log.Println("Failed to get sdl.", err)

				if serviceConf.Fallback == nil {
					return
				} else {
					sdl, err = serviceConf.Fallback(&serviceConf)
					if err != nil {
						log.Println("Failed to get sdl with fallback.", err)
						return
					}
				}
			}

			// Cache the schema for 5 minutes
			if d.cacheService != nil && sdl != "" {
				if err := d.cacheService.CacheSchema(ctx, serviceConf.Name, sdl, 5*time.Minute); err != nil {
					log.Printf("Failed to cache schema for %s: %v", serviceConf.Name, err)
				} else {
					log.Printf("Cached schema for service: %s", serviceConf.Name)
				}
			}

			select {
			case <-ctx.Done():
			case resultCh <- struct {
				name string
				sdl  string
			}{name: serviceConf.Name, sdl: sdl}:
			}
		}()
	}

	go func() {
		wg.Wait()
		close(resultCh)
	}()

	for result := range resultCh {
		d.sdlMap[result.name] = result.sdl
	}

	d.updateObservers()
}

func (d *DatasourcePollerPoller) updateObservers() {
	subgraphsConfig := d.createSubgraphsConfig()

	for i := range d.updateDatasourceObservers {
		d.updateDatasourceObservers[i].UpdateDataSources(subgraphsConfig)
	}
}

func (d *DatasourcePollerPoller) createSubgraphsConfig() []engine.SubgraphConfiguration {
	subgraphConfigs := make([]engine.SubgraphConfiguration, 0, len(d.config.Services))

	for _, serviceConfig := range d.config.Services {
		sdl, exists := d.sdlMap[serviceConfig.Name]
		if !exists {
			continue
		}

		subgraphConfig := engine.SubgraphConfiguration{
			Name:            serviceConfig.Name,
			URL:             serviceConfig.URL,
			SubscriptionUrl: serviceConfig.WS,
			SDL:             sdl,
		}

		subgraphConfigs = append(subgraphConfigs, subgraphConfig)
	}

	return subgraphConfigs
}

func (d *DatasourcePollerPoller) parseSDL(body io.Reader, responseType string) (string, error) {

	bs, err := io.ReadAll(body)
	if err != nil {
		return "", fmt.Errorf("read bytes: %v", err)
	}

	//if endoint already return sdl string , return (for strawberry)
	if responseType == "string" {
		return string(bs), nil
	}

	var result struct {
		Data struct {
			Service struct {
				SDL string `json:"sdl"`
			} `json:"_service"`
		} `json:"data"`
		Errors GQLErr `json:"errors,omitempty"`
	}

	if err = json.NewDecoder(bytes.NewReader(bs)).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %v", err)
	}

	if result.Errors != nil {
		return "", fmt.Errorf("response error:%v", result.Errors)
	}
	return result.Data.Service.SDL, nil
}

func (d *DatasourcePollerPoller) fetchServiceSDL(ctx context.Context, url string, method string, responseType string) (string, error) {
	var req *http.Request
	var err error
	if method == "GET" {
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	} else {
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader([]byte(ServiceDefinitionQuery)))
	}
	req.Header.Add("Content-Type", "application/json")

	if err != nil {
		return "", fmt.Errorf("create request: %v", err)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("do request: %v", err)
	}

	defer resp.Body.Close()

	return d.parseSDL(resp.Body, responseType)

}
