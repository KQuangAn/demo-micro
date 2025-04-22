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
resource "aws_sqs_queue_policy" "orders_sqs_policy" {
  queue_url = aws_sqs_queue.orders_queue.id
  policy    = data.aws_iam_policy_document.orders_sqs_policy.json
}


resource "aws_db_instance" "postgres" {
  identifier          = "orders-db"
  engine              = "postgres"
  engine_version      = "17"
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  username            = var.orders_db_username
  password            = var.orders_db_password
  db_name             = var.orders_db_name
  skip_final_snapshot = true
  publicly_accessible = true

  tags = {
    Name = "orders_db"
  }
}

resource "aws_lambda_function" "init_orders_lambda" {
  filename         = "../lambda/lambda.zip"
  function_name    = "init-orders-db"
  handler          = "handler.lambda_handler"
  runtime          = "python3.9"
  role             = aws_iam_role.lambda_exec.arn
  source_code_hash = filebase64sha256("../lambda/lambda.zip")

  environment {
    variables = {
      DB_HOST     = aws_db_instance.postgres.address
      DB_NAME     = var.orders_db_name
      DB_USER     = var.orders_db_username
      DB_PASSWORD = var.orders_db_password
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name = "lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "null_resource" "init_orders_lambda" {
  depends_on = [aws_lambda_function.init_orders_lambda]

  provisioner "local-exec" {
    command = "aws lambda invoke --function-name init-orders-db out.json"
  }
}