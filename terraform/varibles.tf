variable "aws_access_key" {
  description = "The IAM public access key"
}

variable "aws_secret_key" {
  description = "IAM secret access key"
}


variable "aws_region" {
  description = ""
  default     = "ap-southeast-1"
}
variable "vpc_name" {
  description = ""
  type        = string
  default     = "vpc"
}

variable "cidr" {
  description = ""
  type        = string
  default     = "10.0.0.0/16"
}

variable "order_queue" {
  type      = string
  sensitive = true
}
variable "github_token" {
  type      = string
  sensitive = true
}
variable "notification_db_username" {
  type      = string
  sensitive = true
}
variable "notification_db_password" {
  type      = string
  sensitive = true
}
variable "notification_db_name" {
  type      = string
  sensitive = true
}

variable "inventory_db_username" {
  type      = string
  sensitive = true
}
variable "inventory_db_password" {
  type      = string
  sensitive = true
}
variable "inventory_db_name" {
  type      = string
  sensitive = true
}

variable "orders_db_username" {
  type      = string
  sensitive = true
}
variable "orders_db_password" {
  type      = string
  sensitive = true
}
variable "orders_db_name" {
  type      = string
  sensitive = true
}

variable "ec2_task_execution_role_name" {
    description = "ECS task execution role name"
    default = "myEcsTaskExecutionRole"
}

variable "ecs_auto_scale_role_name" {
    description = "ECS auto scale role name"
    default = "myEcsAutoScaleRole"
}

variable "az_count" {
    description = "Number of AZs to cover in a given region"
    default = "2"
}

variable "app_image" {
    description = "Docker image to run in the ECS cluster"
    default = "bradfordhamilton/crystal_blockchain:latest"
}

variable "app_port" {
    description = "Port exposed by the docker image to redirect traffic to"
    default = 3000

}

variable "app_count" {
    description = "Number of docker containers to run"
    default = 2
}

variable "health_check_path" {
  default = "/"
}

variable "fargate_cpu" {
    description = "Fargate instance CPU units to provision (1 vCPU = 1024 CPU units)"
    default = "256"
}

variable "fargate_memory" {
    description = "Fargate instance memory to provision (in MiB)"
    default = "512"
}