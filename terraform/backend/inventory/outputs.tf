output "sqs_queue_url" {
  value       = aws_sqs_queue.inventory_queue.id
  description = "The URL of the SQS queue"
}


output "inventory_db_endpoint" {
  value = aws_db_instance.inventory-db.endpoint
}

output "inventory_service_url" {
  value = aws_db_instance.inventory-db.endpoint
}
