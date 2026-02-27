variable "name" {
  description = "value"
  type = string
  default = "my vpc name"
}

variable "cidr" {
  description = "cidr"
  type = string
  default = "10.0.0.0/16"
}

variable "azs" {
   description = "list of az"
  type = list(string)
  default = ["ap-southest-1", "ap-southest-2"]
}

variable "public_subnets" {
  description = "A list of public subnets inside the VPC"
  type        = list(string)
  default     = []
}