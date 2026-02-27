module "s3" {
    source  = "terraform-aws-modules/s3/aws"
    version = "~> 3.0"

    name = var.name
    env = var.env
}