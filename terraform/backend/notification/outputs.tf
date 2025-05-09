output "sqs_queue_url" {
  value = aws_sqs_queue.notification_queue.id
  description = "The URL of the SQS queue"
}


output "notification_db_endpoint" {
  value = aws_db_instance.postgres.endpoint
}
output "notification_queue_arn" {
  value =  aws_sqs_queue.notification_queue.arn
}