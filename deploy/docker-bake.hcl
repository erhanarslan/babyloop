variable "REGISTRY" {
  default = "ghcr.io"
}
variable "IMAGE_NAMESPACE" {
  default = "replace-me"
}
variable "GIT_SHA" {
  default = "dev"
}
variable "NEXT_PUBLIC_API_BASE_URL" {
  default = "https://api.staging.babyloop.example"
}
variable "NEXT_PUBLIC_SITE_URL" {
  default = "https://staging.babyloop.example"
}
variable "NEXT_PUBLIC_BACKOFFICE_BASE_URL" {
  default = "https://admin.staging.babyloop.example"
}
variable "NEXT_PUBLIC_LEGAL_OPERATOR_NAME" {
  default = "Replace before build"
}
variable "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL" {
  default = "replace@example.invalid"
}
variable "NEXT_PUBLIC_LEGAL_RELEASE_MODE" {
  default = "non_commercial_beta"
}
variable "NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED" {
  default = "false"
}
variable "NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION" {
  default = "Replace with public city and country"
}
variable "NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS" {
  default = ""
}

group "default" {
  targets = ["api", "web", "backoffice"]
}

target "common" {
  context = "."
  dockerfile = "deploy/docker/Dockerfile"
  platforms = ["linux/amd64", "linux/arm64"]
}

target "api" {
  inherits = ["common"]
  target = "api"
  tags = ["${REGISTRY}/${IMAGE_NAMESPACE}/babyloop-api:${GIT_SHA}"]
}

target "web" {
  inherits = ["common"]
  target = "web"
  tags = ["${REGISTRY}/${IMAGE_NAMESPACE}/babyloop-web:${GIT_SHA}"]
  args = {
    NEXT_PUBLIC_API_BASE_URL = NEXT_PUBLIC_API_BASE_URL
    NEXT_PUBLIC_SITE_URL = NEXT_PUBLIC_SITE_URL
    NEXT_PUBLIC_BACKOFFICE_BASE_URL = NEXT_PUBLIC_BACKOFFICE_BASE_URL
    NEXT_PUBLIC_LEGAL_OPERATOR_NAME = NEXT_PUBLIC_LEGAL_OPERATOR_NAME
    NEXT_PUBLIC_LEGAL_CONTACT_EMAIL = NEXT_PUBLIC_LEGAL_CONTACT_EMAIL
    NEXT_PUBLIC_LEGAL_RELEASE_MODE = NEXT_PUBLIC_LEGAL_RELEASE_MODE
    NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED = NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED
    NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION = NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION
    NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS = NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS
  }
}

target "backoffice" {
  inherits = ["common"]
  target = "backoffice"
  tags = ["${REGISTRY}/${IMAGE_NAMESPACE}/babyloop-backoffice:${GIT_SHA}"]
  args = {
    NEXT_PUBLIC_API_BASE_URL = NEXT_PUBLIC_API_BASE_URL
  }
}
