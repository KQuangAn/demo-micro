FROM golang:1.24.2-alpine AS builder

WORKDIR /app

# Install required packages
RUN apk add --no-cache git

# Copy and download Go dependencies
COPY go.mod go.sum ./
RUN go mod download

# Install gqlgen binary
RUN go install github.com/99designs/gqlgen@v0.17.72

COPY . .

# Run gqlgen generate (now that source and config are available)
RUN /go/bin/gqlgen generate

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/order-service ./cmd/server

# Minimal runtime image
FROM alpine:latest

WORKDIR /app

RUN apk --no-cache add ca-certificates

COPY --from=builder /out/order-service .

EXPOSE 9001

ENTRYPOINT ["/app/order-service"]
