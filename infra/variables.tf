variable "account_id" {
  description = "Cloudflare account ID. The provider token comes from CLOUDFLARE_API_TOKEN."
  type        = string
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.account_id))
    error_message = "account_id must be a 32-character hexadecimal ID."
  }
}

variable "project_name" {
  description = "Prefix used for Worker, database, and secret names."
  type        = string
  default     = "cf-d1-showcase"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,34}$", var.project_name))
    error_message = "Use 3–35 lowercase letters, numbers, or hyphens, starting with a letter."
  }
}

variable "environment" {
  description = "A separate backend key is mandatory for each environment (scripts/infra.mjs enforces this)."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Choose dev, staging, or production."
  }
}

variable "secrets_store_id" {
  description = "Existing account-level Secrets Store ID. This is a reference, never a secret value."
  type        = string
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.secrets_store_id)) && var.secrets_store_id != "00000000000000000000000000000000"
    error_message = "Supply the real account Secrets Store ID."
  }
}
