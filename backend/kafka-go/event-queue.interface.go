package main

import (
	"net"
	"sync"
	"sync/atomic"
)

type EventQueue interface {
	Connect(args interface{}) error
	Publish(args ...interface{}) error
	Subscribe(topic string) error
	Close() error
}

type EventQueueOptions struct {
	URL       string
	Topic     string
	Partition int
}

type EventQueueMessage struct {
	Key   string
	Value string
}

type EventQueueConnection struct {
	// base network connection
	conn net.Conn

	// number of inflight requests on the connection.
	inflight int32

	// offset management (synchronized on the mutex field)
	mutex  sync.Mutex
	offset int64

	// // read buffer (synchronized on rlock)
	// rlock sync.Mutex
	// rbuf  bufio.Reader

	// // write buffer (synchronized on wlock)
	// wlock sync.Mutex
	// wbuf  bufio.Writer
	// wb    writeBuffer

	// // deadline management
	// wdeadline connDeadline
	// rdeadline connDeadline

	// immutable values of the connection object
	clientID      string
	topic         string
	partition     int32
	fetchMaxBytes int32
	fetchMinSize  int32
	broker        int32
	rack          string

	// correlation ID generator (synchronized on wlock)
	correlationID int32

	// number of replica acks required when publishing to a partition
	requiredAcks int32

	// lazily loaded API versions used by this connection
	apiVersions atomic.Value // apiVersionMap

	transactionalID *string
}
