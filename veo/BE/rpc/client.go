package main

import (
    "context"
    "log"
    "time"

    "google.golang.org/grpc"
    pb "rpc-example/greeter" // Update with your actual import path
)

func main() {
    conn, err := grpc.Dial("localhost:50051", grpc.WithInsecure())
    if err != nil {
        log.Fatalf("Did not connect: %v", err)
    }
    defer conn.Close()

    client := pb.NewGreeterClient(conn)

    stream, err := client.Chat(context.Background())
    if err != nil {
        log.Fatalf("Error creating stream: %v", err)
    }

    // Send messages to the server
    for i := 0; i < 5; i++ {
        msg := &pb.Message{Body: "Hello " + string(i)}
        if err := stream.Send(msg); err != nil {
            log.Fatalf("Error sending message: %v", err)
        }
        log.Printf("Sent message: %s", msg.Body)
        
        // Receive the echo response
        reply, err := stream.Recv()
        if err != nil {
            log.Fatalf("Error receiving message: %v", err)
        }
        log.Printf("Received echo: %s", reply.Body)
        time.Sleep(1 * time.Second)
    }

    // Close the stream
    if err := stream.CloseSend(); err != nil {
        log.Fatalf("Error closing stream: %v", err)
    }
}