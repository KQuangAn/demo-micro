package main

import (
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

const TIMEOUT = 5 * time.Second

type Choice struct {
	mu     sync.Mutex
	choice rune
}

func (c *Choice) chose(val rune) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.choice = val
}

func doTask(id int, wg *sync.WaitGroup, channel chan<- string) {
	defer wg.Done()
	fmt.Printf("Worker %d starting", id)
	time.Sleep(time.Second)
	fmt.Printf("Worker %d end", id)
	channel <- "done"
}
func callApi(wg *sync.WaitGroup, channel chan<- string) string { //accept sending to this channel only
	wg.Add(1)
	defer wg.Done()
	resp, err := http.Get("https://jsonplaceholder.typicode.com/posts")
	if err != nil {
		log.Fatal(err)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalln(err)
	}

	sb := string(body)
	channel <- sb
	channel <- "api done"
	return sb
}

func double(id int, jobs <-chan int, result chan<- int) {
	for j := range jobs {
		result <- j * 2
		fmt.Println(j)
	}
}

func main1() {
	var point *int

	choi := Choice{
		choice: '1',
	}
	i := 0
	for i <= 100 {
		go func() {
			choi.chose(rune(i))
			point = &i
		}()
		i++
	}
	fmt.Println(choi.choice, point, *point)

}

func findMaxAverage(nums []int, k int) float64 {
	maxAvg := math.Inf(-1)

	n := len(nums)
	for i := range n - k - 1 {
		crrSum := 0
		for j := range k {
			crrSum += nums[i+j]
		}
		avg := crrSum / k
		if float64(avg) >= maxAvg {
			maxAvg = float64(avg)
		}
	}
	return maxAvg
}

type Counter struct {
	val int
	mu  sync.Mutex
}

func (c *Counter) Increment() {
	c.mu.Lock()         // Acquire the mutex lock // if another try to accquire the lock , it will block
	defer c.mu.Unlock() // Ensure the mutex is unlocked after the function completes
	c.val++
}

func concurenyUsingMutex() {
	counter := Counter{}
	var wg sync.WaitGroup

	for i := 0; i <= 400; i++ {
		wg.Add(1)

		go func() {
			defer wg.Done()
			counter.Increment()
		}()
	}
	wg.Wait() // wait for all go routine to finsih runnnign before running
	fmt.Printf("Final counter value: %d\n", counter.val)

}

// fastest concurent
func atomicOp() {
	var counter int64
	var wg sync.WaitGroup
	const numGoroutines = 100

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			atomic.AddInt64(&counter, 1) // Atomic increment
		}()
	}

	wg.Wait()
	fmt.Printf("Final counter value: %d\n", counter)
}

// limit  access for a limited resoruce
// use case database pool
// ex allow n number of reader but only one writer ?
func countingSemaphore() {

	maxGoroutines := dbPool
	semaphore := make(chan struct{}, maxGoroutines)
	//bufferedchannel , max count for semaphore
	//each access to a shared resource , acquire a semaphore ( count --)
	//if none available , block until one release
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			semaphore <- struct{}{}        //get a lock (send a message to channel, fill one buffer )
			defer func() { <-semaphore }() //release a lock

			// Simulate a task
			fmt.Printf("Running task %d\n", i)
			time.Sleep(2 * time.Second)
		}(i)
	}
	wg.Wait()
}

func main() {
	ch := make(chan int)
	//exit when channle close
	for val := range ch {
		
	}
}
