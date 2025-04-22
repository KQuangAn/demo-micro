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

resource "aws_sqs_queue" "orders_queue" {
  name                        = "orders-queue.fifo"
  delay_seconds               = 0
  visibility_timeout_seconds  = 30
  max_message_size            = 2048
  message_retention_seconds   = 86400
  receive_wait_time_seconds   = 5
  sqs_managed_sse_enabled     = true
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

data "aws_iam_policy_document" "notification_queue_policy" {
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

resource "aws_sqs_queue_policy" "notification_queue_policy" {
  queue_url = aws_sqs_queue.notification_queue.id
  policy    = data.aws_iam_policy_document.notification_queue_policy.json
}

resource "aws_sqs_queue_policy" "orders_sqs_policy" {
  queue_url = aws_sqs_queue.orders_queue.id
  policy    = data.aws_iam_policy_document.orders_sqs_policy.json
}

module "eventbridge" {
  source  = "terraform-aws-modules/eventbridge/aws"
  version = "~> 3.16"

  bus_name = "evbus"

  rules = {
    //to notificaiton
    order_created = {
      description = "Capture OrderCreated events"
      event_pattern = jsonencode({
        "source" : ["com.orderservice"],
        "detail-type" : ["OrderCreated"]
      })
      enabled = true
    }

    //to orders
    inventory_saved_success = {
      description = "Capture inventory_saved_success events"
      event_pattern = jsonencode({
        "source" : ["com.inventory"],
        "detail-type" : ["inventory.confirmed"]
      })
      enabled = true
    }
  }

  targets = {
    order_created = [
      {
        name = "send-to-notification-sqs"
        # input_transformer = local.order_input_transformer
        arn              = aws_sqs_queue.notification_queue.arn
        message_group_id = "mgs"
      }
    ],
    inventory_saved_success = [
      {
        name = "send-to-orders-sqs"
        # input_transformer = local.order_input_transformer
        arn              = aws_sqs_queue.orders_queue.arn
        message_group_id = "msg"
      }
    ]
  }

  tags = {
    Name = "evbus"
  }
}

locals {
  order_input_transformer = {
    input_paths = {
      order_id = "$.detail.order_id"
    }
    input_template = <<-EOF
    {
      "id": <order_id>
    }
    EOF
  }
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

# Create a new VPC
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"

  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "my-vpc"
  }
}

# Create a new Internet Gateway
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "my-internet-gateway"
  }
}

# Create a public subnet in multiple AZs
resource "aws_subnet" "public_subnet_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-southeast-1a"
  map_public_ip_on_launch = true
  tags = {
    Name = "Public Subnet A"
  }
}

resource "aws_subnet" "public_subnet_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "ap-southeast-1b"
  map_public_ip_on_launch = true
  tags = {
    Name = "Public Subnet B"
  }
}

# Create a route table for the public subnet
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name = "public-route-table"
  }
}

# Associate subnets to route table
resource "aws_route_table_association" "a" {
  subnet_id      = aws_subnet.public_subnet_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "b" {
  subnet_id      = aws_subnet.public_subnet_b.id
  route_table_id = aws_route_table.public.id
}

# Create a security group for PostgreSQL RDS
resource "aws_security_group" "postgres_sg" {
  name        = "postgres-sg"
  description = "Allow all IPv4 inbound traffic to PostgreSQL (port 5432)"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Allow all IPv4 addresses to connect
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"] # Allow all outbound traffic
  }

  tags = {
    Name = "postgres-sg"
  }
}

# Create a DB subnet group for RDS
resource "aws_db_subnet_group" "postgres_subnet_group" {
  name = "postgres-subnet-group"
  subnet_ids = [
    aws_subnet.public_subnet_a.id,
    aws_subnet.public_subnet_b.id
  ]

  tags = {
    Name = "postgres-subnet-group"
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "orders-db"
  engine                 = "postgres"
  engine_version         = "17"
  instance_class         = "db.t4g.micro"
  allocated_storage      = 20
  username               = var.orders_db_username
  password               = var.orders_db_password
  db_name                = var.orders_db_name
  skip_final_snapshot    = true
  publicly_accessible    = true
  vpc_security_group_ids = [aws_security_group.postgres_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres_subnet_group.name

  tags = {
    Name = "orders_db"
  }
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.endpoint
}
