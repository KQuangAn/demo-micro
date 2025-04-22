
resource "aws_ecs_cluster" "main" {
  name = "cb-cluster"
}

resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "local"
  description = "Private namespace for services"
  vpc         = aws_vpc.main.id
}

resource "aws_service_discovery_service" "inventory" {
  name = "inventory"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    dns_records {
      type = "A"
      ttl  = 10
    }
    routing_policy = "MULTIVALUE"
  }
  health_check_custom_config {
    failure_threshold = 1
  }
}

resource "aws_service_discovery_service" "order" {
  name = "order"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    dns_records {
      type = "A"
      ttl  = 10
    }
    routing_policy = "MULTIVALUE"
  }
  health_check_custom_config {
    failure_threshold = 1
  }
}

resource "aws_service_discovery_service" "notification" {
  name = "notification"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    dns_records {
      type = "A"
      ttl  = 10
    }
    routing_policy = "MULTIVALUE"
  }
  health_check_custom_config {
    failure_threshold = 1
  }
}


# -------------------
# Order Service
# -------------------
data "template_file" "order_app" {
  template = file("./templates/ecs/order_app.json.tpl")
  vars = {
    app_image      = var.order_app_image
    app_port       = var.order_app_port
    fargate_cpu    = var.fargate_cpu
    fargate_memory = var.fargate_memory
    aws_region     = var.aws_region
  }
}

resource "aws_ecs_task_definition" "order" {
  family                   = "order-task"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  container_definitions    = data.template_file.order_app.rendered
}

resource "aws_ecs_service" "order" {
  name            = "order-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.order.arn
  desired_count   = var.app_count
  launch_type     = "FARGATE"
  service_registries {
    registry_arn = aws_service_discovery_service.order.arn
  }
  network_configuration {
    subnets          = aws_subnet.private.*.id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_alb_target_group.order.id
    container_name   = "order-app"
    container_port   = var.order_app_port
  }

  depends_on = [
    aws_alb_listener.front_end,
    aws_iam_role_policy_attachment.ecs-task-execution-role-policy-attachment
  ]


}

# -------------------
# Inventory Service
# -------------------
data "template_file" "inventory_app" {
  template = file("./templates/ecs/inventory_app.json.tpl")
  vars = {
    app_image      = var.inventory_app_image
    app_port       = var.inventory_app_port
    fargate_cpu    = var.fargate_cpu
    fargate_memory = var.fargate_memory
    aws_region     = var.aws_region
  }
}

resource "aws_ecs_task_definition" "inventory" {
  family                   = "inventory-task"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  container_definitions    = data.template_file.inventory_app.rendered
}

resource "aws_ecs_service" "inventory" {
  name            = "inventory-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.inventory.arn
  desired_count   = var.app_count
  launch_type     = "FARGATE"

  service_registries {
    registry_arn = aws_service_discovery_service.inventory.arn
  }
  network_configuration {
    subnets          = aws_subnet.private.*.id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_alb_target_group.inventory.id
    container_name   = "inventory-app"
    container_port   = var.inventory_app_port
  }

  depends_on = [
    aws_alb_listener.front_end,
    aws_iam_role_policy_attachment.ecs-task-execution-role-policy-attachment
  ]
}

# -------------------
# Notification Service
# -------------------
data "template_file" "notification_app" {
  template = file("./templates/ecs/notification_app.json.tpl")
  vars = {
    app_image      = var.notification_app_image
    app_port       = var.notification_app_port
    fargate_cpu    = var.fargate_cpu
    fargate_memory = var.fargate_memory
    aws_region     = var.aws_region
  }
}

resource "aws_ecs_task_definition" "notification" {
  family                   = "notification-task"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  container_definitions    = data.template_file.notification_app.rendered
}

resource "aws_ecs_service" "notification" {
  name            = "notification-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.notification.arn
  desired_count   = var.app_count
  launch_type     = "FARGATE"

  service_registries {
    registry_arn = aws_service_discovery_service.notification.arn
  }
  network_configuration {
    subnets          = aws_subnet.private.*.id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_alb_target_group.notification.id
    container_name   = "notification-app"
    container_port   = var.notification_app_port
  }

  depends_on = [
    aws_alb_listener.front_end,
    aws_iam_role_policy_attachment.ecs-task-execution-role-policy-attachment
  ]
}