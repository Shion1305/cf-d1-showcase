-- Synthetic, local-only fixtures. Remote deployments never run this file.
INSERT OR IGNORE INTO checkpoints (id, title, status) VALUES
  ('seed-bindings', 'Read and write through the D1 binding', 'verified'),
  ('seed-runtime', 'Run the production build in workerd', 'open'),
  ('seed-secrets', 'Retrieve an API key from Secrets Store', 'open');
