terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.95.0"
    }
  }
}

provider "aws" {
  region                   = "ap-southeast-1"
  shared_config_files      = ["~/.aws/config"]
  shared_credentials_files = ["~/.aws/credentials"]
  profile                  = "default"
}

resource "aws_sqs_queue" "orders_queue"{
  name                       = "orders-queue.fifo"
  delay_seconds              = 10
  visibility_timeout_seconds = 30
  max_message_size           = 2048
  message_retention_seconds  = 86400
  receive_wait_time_seconds  = 2
  sqs_managed_sse_enabled = true
  fifo_queue                  = true
  content_based_deduplication = true
}

data "aws_iam_policy_document" "orders_sqs_policy" {
  statement {
    sid    = "orderssqstatement"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    actions = [
      "sqs:SendMessage",
      "sqs:ReceiveMessage"
    ]
    resources = [
      aws_sqs_queue.orders_queue.arn
    ]
  }
}

resource "aws_sqs_queue_policy" "orders_sqs_policy" {
  queue_url = aws_sqs_queue.orders_queue.id
  policy    = data.aws_iam_policy_document.orders_sqs_policy.json
}