package main

import (
	appHandler "api-gateway/handler"
	redis "api-gateway/redis"
	"api-gateway/utils"
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gobwas/ws"
	log "github.com/jensneuse/abstractlogger"
	"go.uber.org/zap"

	gatewayHttp "github.com/wundergraph/graphql-go-tools/examples/federation/gateway/http"
	"github.com/wundergraph/graphql-go-tools/execution/engine"
	"github.com/wundergraph/graphql-go-tools/execution/graphql"
	"github.com/wundergraph/graphql-go-tools/v2/pkg/playground"
)

func logger() log.Logger {
	logger, err := zap.NewDevelopmentConfig().Build()
	if err != nil {
		panic(err)
	}

	return log.NewZapLogger(logger, log.DebugLevel)
}

func fallback(sc *ServiceConfig) (string, error) {
	dat, err := os.ReadFile(sc.Name + "/graph/schema.graphqls")
	if err != nil {
		return "", err
	}

	return string(dat), nil
}

func startServer() {
	logger := logger()
	logger.Info("logger initialized")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	utils.LoadEnvFile()

	upgrader := &ws.DefaultHTTPUpgrader
	upgrader.Header = http.Header{}
	upgrader.Header.Add("Sec-Websocket-Protocol", "graphql-ws")

	graphqlEndpoint := "/query"
	playgroundURLPrefix := "/playground"
	playgroundURL := ""

	httpClient := http.DefaultClient

	mux := http.NewServeMux()

	datasourceWatcher := NewDatasourcePoller(httpClient, DatasourcePollerConfig{
		Services: []ServiceConfig{
			{Name: "order", URL: os.Getenv("ORDER_URL"), SchemaURL: os.Getenv("ORDER_URL"), Fallback: fallback},
			{Name: "inventory", URL: os.Getenv("INVENTORY_URL"), SchemaURL: os.Getenv("INVENTORY_URL")},
			{Name: "notification", URL: os.Getenv("NOTIFICATION_URL"), SchemaURL: os.Getenv("NOTIFICATION_GET"), Method: "GET", ResponseType: "string"},
		},
		PollingInterval: 30 * time.Second,
	})

	p := playground.New(playground.Config{
		PathPrefix:                      "",
		PlaygroundPath:                  playgroundURLPrefix,
		GraphqlEndpointPath:             graphqlEndpoint,
		GraphQLSubscriptionEndpointPath: graphqlEndpoint,
	})

	handlers, err := p.Handlers()
	if err != nil {
		logger.Fatal("configure handlers", log.Error(err))
		return
	}

	for i := range handlers {
		mux.Handle(handlers[i].Path, handlers[i].Handler)
	}

	enableART := true

	var gqlHandlerFactory HandlerFactoryFn = func(schema *graphql.Schema, engine *engine.ExecutionEngine) http.Handler {
		return gatewayHttp.NewGraphqlHTTPHandler(schema, engine, upgrader, logger, enableART)
	}

	gateway := NewGateway(ctx, gqlHandlerFactory, httpClient, logger)

	datasourceWatcher.Register(gateway)
	go datasourceWatcher.Run(ctx)

	gateway.Ready()
	//Initialize Redis
	if err := redis.Init(); err != nil {
		panic("Failed to connect to Redis: " + err.Error())
	}

	mux.HandleFunc("/login", appHandler.LoginHandler)
	mux.HandleFunc("/register", appHandler.RegisterHandler)

	mux.Handle("/query", JWTMiddleware(gateway))

	addr := "0.0.0.0:8080"
	logger.Info("Listening",
		log.String("add", addr),
	)
	fmt.Printf("Access Playground on: http://%s%s%s\n", prettyAddr(addr), playgroundURLPrefix, playgroundURL)
	err = http.ListenAndServe(addr, mux)
	if err != nil {
		logger.Fatal("failed listening", log.Error(err))
	}
}

func prettyAddr(addr string) string {
	return strings.Replace(addr, "0.0.0.0", "localhost", -1)
}

func main() {
	startServer()
}
