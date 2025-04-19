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
module "orders" {
  source = "./microservice-orders"
  db_password = var.orders_db_password
  vpc_id = module.shared.vpc_id
}

module "inventory" {
  source = "./microservice-inventory"
  db_password = var.inventory_db_password
  vpc_id = module.shared.vpc_id
}