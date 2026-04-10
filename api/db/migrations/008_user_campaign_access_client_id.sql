-- 008: Scope user_campaign_access rows by client_id.
-- Before: UNIQUE (user_id, offer_slug) — two clients with same slug would
--         collapse into a single access row per user.
-- After:  UNIQUE (user_id, client_id, offer_slug) — same user can now have
--         the same slug across different clients.
--
-- Backfill joins on offer_slug → client_offers. Today there's only one client
-- (Uelicon), so the backfill is unambiguous.

ALTER TABLE auth_everline.user_campaign_access
  ADD COLUMN IF NOT EXISTS client_id uuid;

UPDATE auth_everline.user_campaign_access uca
   SET client_id = (
     SELECT co.client_id
     FROM auth_everline.client_offers co
     WHERE co.offer_slug = uca.offer_slug
     LIMIT 1
   )
 WHERE client_id IS NULL;

-- Any row without a corresponding client_offer stays orphan — delete them so
-- the NOT NULL constraint below succeeds cleanly.
DELETE FROM auth_everline.user_campaign_access WHERE client_id IS NULL;

ALTER TABLE auth_everline.user_campaign_access
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE auth_everline.user_campaign_access
  ADD CONSTRAINT user_campaign_access_client_id_fk
  FOREIGN KEY (client_id) REFERENCES auth_everline.clients(id) ON DELETE CASCADE;

ALTER TABLE auth_everline.user_campaign_access
  DROP CONSTRAINT IF EXISTS user_campaign_access_user_id_offer_slug_key;

DO $$ BEGIN
  ALTER TABLE auth_everline.user_campaign_access
    ADD CONSTRAINT user_campaign_access_user_client_offer_unique
    UNIQUE (user_id, client_id, offer_slug);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
