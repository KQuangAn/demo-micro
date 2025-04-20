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
  type = string
  sensitive = true
}
variable "github_token" {
  type = string
  sensitive = true
}
variable "notification_db_username" {
  type = string
  sensitive = true
}
variable "notification_db_password" {
  type = string
  sensitive = true
}
variable "notification_db_name" {
  type = string
  sensitive = true
}

variable "inventory_db_username" {
  type = string
  sensitive = true
}
variable "inventory_db_password" {
  type = string
  sensitive = true
}
variable "inventory_db_name" {
  type = string
  sensitive = true
}

variable "orders_db_username" {
  type = string
  sensitive = true
}
variable "orders_db_password" {
  type = string
  sensitive = true
}
variable "orders_db_name" {
  type = string
  sensitive = true
}