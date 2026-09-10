output "deployment" {
  description = "Non-secret resource references used to generate a complete Wrangler configuration."
  value = {
    environment         = var.environment
    account_id          = var.account_id
    worker_name         = local.worker_name
    database_id         = cloudflare_d1_database.app.id
    database_name       = cloudflare_d1_database.app.name
    secrets_store_id    = var.secrets_store_id
    api_key_secret_name = "${local.worker_name}-admin-api-key"
  }
}
