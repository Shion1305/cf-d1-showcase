locals {
  worker_name = "${var.project_name}-${var.environment}"
}

resource "cloudflare_d1_database" "app" {
  account_id = var.account_id
  name       = "${local.worker_name}-db"

  lifecycle {
    prevent_destroy = true
  }
}

# Wrangler owns Worker code and bindings. SQL files own schema migrations.
# Secret values are created/rotated directly in Secrets Store, outside this state.
