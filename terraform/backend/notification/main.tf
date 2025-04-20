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

resource "aws_sqs_queue" "notification_queue" {
  name                        = "notification-queue.fifo"
  delay_seconds               = 0
  visibility_timeout_seconds  = 30
  max_message_size            = 2048
  message_retention_seconds   = 86400
  receive_wait_time_seconds   = 5
  sqs_managed_sse_enabled     = true
  fifo_queue                  = true
  content_based_deduplication = true
}

data "aws_iam_policy_document" "notification_sqs_policy" {
  statement {
    sid    = "notificationsqstatement"
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
      aws_sqs_queue.notification_queue.arn
    ]
  }
}



resource "aws_sqs_queue_policy" "notification_sqs_policy" {
  queue_url = aws_sqs_queue.notification_queue.id
  policy    = data.aws_iam_policy_document.notification_sqs_policy.json
}


resource "aws_db_instance" "postgres" {
  identifier          = "notification-db"
  engine              = "postgres"
  engine_version      = "17"
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  username            = var.notification_db_username
  password            = var.notification_db_password
  db_name             = var.notification_db_name
  skip_final_snapshot = true
  publicly_accessible = true

  tags = {
    Name = "notification_db"
  }
}