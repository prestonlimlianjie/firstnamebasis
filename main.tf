variable "site_name" {}
variable "recaptcha_site_key" {}

provider "aws" {
  region = "ap-southeast-1"
}

# Lambda

resource "aws_lambda_function" "fnb_lambda" {
  filename      = "build/lambda.zip"
  function_name = "FirstNameBasis"

  handler = "index.handle"
  runtime = "nodejs10.x"
  timeout = 15

  role = aws_iam_role.lambda_exec.arn
}

resource "aws_iam_role" "lambda_exec" {
  name = "fnb_lambda_exec_role"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
 EOF
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fnb_lambda.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.fnb.execution_arn}/*/*"
}

# API Gateway

resource "aws_api_gateway_rest_api" "fnb" {
  name        = "FirstNameBasis"
  description = "API Gateway for FirstNameBasis"
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.fnb.id
  parent_id   = aws_api_gateway_rest_api.fnb.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.fnb.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.fnb.id
  resource_id = aws_api_gateway_method.proxy.resource_id
  http_method = aws_api_gateway_method.proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.fnb_lambda.invoke_arn
}

resource "aws_api_gateway_method" "proxy_root" {
  rest_api_id   = aws_api_gateway_rest_api.fnb.id
  resource_id   = aws_api_gateway_rest_api.fnb.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = aws_api_gateway_rest_api.fnb.id
  resource_id = aws_api_gateway_method.proxy_root.resource_id
  http_method = aws_api_gateway_method.proxy_root.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.fnb_lambda.invoke_arn
}

resource "aws_api_gateway_deployment" "fnb_v1_deployment" {
  depends_on = [
    aws_api_gateway_integration.lambda,
    aws_api_gateway_integration.lambda_root,
  ]

  rest_api_id = aws_api_gateway_rest_api.fnb.id
  stage_name  = "v1"
}

# Site S3

resource "aws_s3_bucket" "site_bucket" {
  bucket = "${var.site_name}"
  acl    = "public-read"
  website {
    index_document = "index.html"
    error_document = "error.html"
  }
}

resource "aws_s3_bucket_policy" "site_bucket_policy" {
  bucket = aws_s3_bucket.site_bucket.id

  policy = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${aws_s3_bucket.site_bucket.bucket}/*"
        }
    ]
}
POLICY
}

resource "null_resource" "upload" {
  provisioner "local-exec" {
    working_dir = path.module
    command     = "make upload"

    environment = {
      ENDPOINT           = aws_api_gateway_deployment.fnb_v1_deployment.invoke_url
      BUCKET_URL         = aws_s3_bucket.site_bucket.bucket
      RECAPTCHA_SITE_KEY = var.recaptcha_site_key
    }

    interpreter = ["/bin/bash", "-c"]
  }
}

# Output

output "base_url" {
  value = aws_api_gateway_deployment.fnb_v1_deployment.invoke_url
}

output "bucket_url" {
  value = "http://${aws_s3_bucket.site_bucket.website_endpoint}"
}
