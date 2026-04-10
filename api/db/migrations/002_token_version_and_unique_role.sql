-- 002: token_version for JWT invalidation on password change + one-role-per-user invariant.

-- Token version used to invalidate JWTs issued before a password change.
-- Incremented in the password-change endpoint; checked in requireAuth middleware.
ALTER TABLE auth_everline.users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- A user should have AT MOST one role. Prior schema allowed duplicates and the
-- code worked around it by "picking the highest", which masked a real bug.
-- De-dupe first (keeping the highest role), then enforce.
WITH role_rank AS (
  SELECT
    id,
    user_id,
    role,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY CASE role::text
        WHEN 'super_admin' THEN 4
        WHEN 'admin'       THEN 3
        WHEN 'gestor'      THEN 2
        WHEN 'user'        THEN 1
      END DESC
    ) AS rn
  FROM auth_everline.user_roles
)
DELETE FROM auth_everline.user_roles
WHERE id IN (SELECT id FROM role_rank WHERE rn > 1);

-- Enforce single role per user.
DO $$ BEGIN
  ALTER TABLE auth_everline.user_roles
    ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
