package class

type Node struct {
	name     interface{}
	priority int
	index    int
}

type Heap interface {
	getNode() Node
	len() int
	push() Node
	pop() Node
}

type PriorityQueue []Node

// defining methods
func (h PriorityQueue) Len() int {
	return len(h)
}

func (h PriorityQueue) Less(i, j int) bool {
	return h[i].priority < h[j].priority
}

// i.(Node) type conversion
func (h *PriorityQueue) Push(i any) {
	*h = append(*h, i.(Node))
}
