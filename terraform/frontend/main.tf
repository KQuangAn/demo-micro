resource "aws_amplify_app" "my_amplify_app" {
  name        = "my-amplify-app"
  repository  = "https://github.com/your-username/your-repo" 
  environment_variables = {
    NODE_ENV = "production"
  }

  build_spec = <<-EOF
  version: 1
  frontend:
    phases:
      preBuild:
        commands:
          - npm install
      build:
        commands:
          - npm run build
    artifacts:
      baseDirectory: build
      files:
        - '**/*'
    cache:
      paths:
        - node_modules/**/*
  EOF
}

resource "aws_amplify_branch" "main_branch" {
  app_id            = aws_amplify_app.my_amplify_app.id
  branch_name       = "master"
  enable_auto_build = true
}
