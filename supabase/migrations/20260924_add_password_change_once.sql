-- Ganti sandi hanya 1x (self-service) — track di profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_changed_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_last_changed TIMESTAMPTZ;
