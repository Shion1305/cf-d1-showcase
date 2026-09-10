-- Expand: existing rows receive the default; the previous application still works.
ALTER TABLE checkpoints ADD COLUMN status TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'verified'));

CREATE INDEX checkpoints_created_at_idx ON checkpoints(created_at DESC, id DESC);
