output "sqs_queue_url" {
  value = aws_sqs_queue.orders_queue.id
  description = "The URL of the SQS queue"
}