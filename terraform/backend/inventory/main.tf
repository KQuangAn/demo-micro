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

resource "aws_sqs_queue" "inventory_queue" {
  name                        = "inventory-queue.fifo"
  delay_seconds               = 0
  visibility_timeout_seconds  = 30
  max_message_size            = 2048
  message_retention_seconds   = 86400
  receive_wait_time_seconds   = 5
  sqs_managed_sse_enabled     = true
  fifo_queue                  = true
  content_based_deduplication = true
}

data "aws_iam_policy_document" "inventory_sqs_policy" {
  statement {
    sid    = "inventorysqstatement"
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
      aws_sqs_queue.inventory_queue.arn
    ]
  }
}



resource "aws_sqs_queue_policy" "inventory_sqs_policy" {
  queue_url = aws_sqs_queue.inventory_queue.id
  policy    = data.aws_iam_policy_document.inventory_sqs_policy.json
}


# resource "aws_security_group" "allow_all" {
#   name        = "allow-all-traffic"
#   description = "Allow all inbound traffic"
#   vpc_id      = var.vpc_id # You need to pass in or reference your VPC ID

#   ingress {
#     from_port   = 0
#     to_port     = 0
#     protocol    = "-1"     
#     cidr_blocks = ["0.0.0.0/0"] 
#   }

#   egress {
#     from_port   = 0
#     to_port     = 0
#     protocol    = "-1"
#     cidr_blocks = ["0.0.0.0/0"]
#   }

#   tags = {
#     Name = "allow_all_sg"
#   }
# }


resource "aws_db_instance" "inventory-db" {
  identifier          = "inventory-db"
  engine              = "postgres"
  engine_version      = "17"
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  username            = var.inventory_db_username
  password            = var.inventory_db_password
  db_name             = var.inventory_db_name
  skip_final_snapshot = true
  publicly_accessible = true

  tags = {
    Name = "inventory_db"
  }
}