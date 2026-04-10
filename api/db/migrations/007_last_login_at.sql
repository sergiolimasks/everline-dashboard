-- 007: track last login timestamp so the admin panel can show who actually
-- uses the dashboard vs who was created and never touched it.

ALTER TABLE auth_everline.users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
