FROM golang:1.24.2-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

RUN go install github.com/99designs/gqlgen@v0.17.72 

RUN go mod tidy

COPY . .

RUN /go/bin/gqlgen generate

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/api-gateway ./gateway/

FROM alpine:latest

WORKDIR /app

RUN apk --no-cache add ca-certificates

COPY --from=builder /out/api-gateway .

EXPOSE 8080

ENTRYPOINT ["./api-gateway"]