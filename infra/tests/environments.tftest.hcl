mock_provider "cloudflare" {}

variables {
  account_id       = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  secrets_store_id = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}

run "dev" {
  command = plan
  variables { environment = "dev" }
  assert {
    condition     = cloudflare_d1_database.app.name == "cf-d1-showcase-dev-db"
    error_message = "Dev must use its own D1 database."
  }
  assert {
    condition     = output.deployment.api_key_secret_name == "cf-d1-showcase-dev-admin-api-key"
    error_message = "Dev must use its own secret name."
  }
}

run "staging" {
  command = plan
  variables { environment = "staging" }
  assert {
    condition     = cloudflare_d1_database.app.name == "cf-d1-showcase-staging-db"
    error_message = "Staging must use its own D1 database."
  }
}

run "production" {
  command = plan
  variables { environment = "production" }
  assert {
    condition     = output.deployment.api_key_secret_name == "cf-d1-showcase-production-admin-api-key"
    error_message = "Production must use its own secret name."
  }
  assert {
    condition     = cloudflare_d1_database.app.name == "cf-d1-showcase-production-db"
    error_message = "Production must use its own D1 database."
  }
}

run "reject_local" {
  command = plan
  variables { environment = "local" }
  expect_failures = [var.environment]
}
