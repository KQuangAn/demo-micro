package main

import (
    "io"
    "log"
    "net"

    "google.golang.org/grpc"
    pb "rpc-example/greeter" // Update with your actual import path
)

type server struct {
    pb.UnimplementedGreeterServer
}

func (s *server) Chat(stream pb.Greeter_ChatServer) error {
    for {
        msg, err := stream.Recv()
        if err == io.EOF {
            break // Client has finished sending
        }
        if err != nil {
            return err
        }
        log.Printf("Received message: %s", msg.Body)

        // Echo the message back to the client
        reply := &pb.Message{Body: "Echo: " + msg.Body}
        if err := stream.Send(reply); err != nil {
            return err
        }
    }
    return nil
}

func main() {
    lis, err := net.Listen("tcp", ":50051")
    if err != nil {
        log.Fatalf("Failed to listen: %v", err)
    }
    s := grpc.NewServer()
    pb.RegisterGreeterServer(s, &server{})
    log.Println("Server is running on port 50051...")
    if err := s.Serve(lis); err != nil {
        log.Fatalf("Failed to serve: %v", err)
    }
}