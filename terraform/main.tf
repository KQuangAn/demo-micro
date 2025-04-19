provider "aws" {
  region = "ap-southeast-1"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "4.0.2"

  name = "microservice-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-southeast-1a", "ap-southeast-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true

  tags = {
    Terraform = "true"
    Environment = "dev"
  }
}

resource "aws_sqs_queue" "order_event_queue" {
  name = "order-event-queue"
}

resource "aws_cloudwatch_event_bus" "main_bus" {
  name = "main-event-bus"
}

resource "aws_cloudwatch_event_rule" "order_placed_rule" {
  name           = "order-placed-rule"
  event_bus_name = aws_cloudwatch_event_bus.main_bus.name
  event_pattern  = jsonencode({
    source      = ["order.service"],
    detail-type = ["OrderPlaced"]
  })
}

resource "aws_cloudwatch_event_target" "send_to_sqs" {
  rule      = aws_cloudwatch_event_rule.order_placed_rule.name
  event_bus_name = aws_cloudwatch_event_bus.main_bus.name
  target_id = "send-to-sqs"
  arn       = aws_sqs_queue.order_event_queue.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = "<replace-if-you-use-lambda>"
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.order_placed_rule.arn
}

resource "aws_ecs_cluster" "main" {
  name = "microservices-cluster"
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "ecsTaskExecutionRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        },
        Effect = "Allow",
        Sid    = ""
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

module "rds_inventory" {
  source = "terraform-aws-modules/rds/aws"
  identifier = "inventory-db"

  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t4g.micro"
  allocated_storage = 20

  name     = "inventory"
  username = "postgres"
  password = "postgrespass"
  port     = 5432

  vpc_security_group_ids = [module.vpc.default_security_group_id]
  subnet_ids             = module.vpc.private_subnets

  publicly_accessible = false
  skip_final_snapshot = true
}

module "rds_orders" {
  source = "terraform-aws-modules/rds/aws"
  identifier = "orders-db"

  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t4g.micro"
  allocated_storage = 20

  name     = "orders"
  username = "postgres"
  password = "postgrespass"
  port     = 5432

  vpc_security_group_ids = [module.vpc.default_security_group_id]
  subnet_ids             = module.vpc.private_subnets

  publicly_accessible = false
  skip_final_snapshot = true
}

module "rds_notification" {
  source = "terraform-aws-modules/rds/aws"
  identifier = "notification-db"

  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t4g.micro"
  allocated_storage = 20

  name     = "notification"
  username = "postgres"
  password = "postgrespass"
  port     = 5432

  vpc_security_group_ids = [module.vpc.default_security_group_id]
  subnet_ids             = module.vpc.private_subnets

  publicly_accessible = false
  skip_final_snapshot = true
}

output "inventory_db_endpoint" {
  value = module.rds_inventory.db_instance_endpoint
}

output "orders_db_endpoint" {
  value = module.rds_orders.db_instance_endpoint
}

output "notification_db_endpoint" {
  value = module.rds_notification.db_instance_endpoint
}
