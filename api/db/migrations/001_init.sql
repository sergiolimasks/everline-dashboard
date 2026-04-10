-- Everline auth schema — replaces Supabase auth + user management
-- Lives alongside the data schemas (bd_ads_clientes, uelicon_database) in the everline database

CREATE SCHEMA IF NOT EXISTS auth_everline;

DO $$ BEGIN
  CREATE TYPE auth_everline.app_role AS ENUM ('user', 'gestor', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth_everline.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_everline.user_roles (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES auth_everline.users(id) ON DELETE CASCADE,
  role     auth_everline.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS auth_everline.user_campaign_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth_everline.users(id) ON DELETE CASCADE,
  offer_slug  text NOT NULL,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, offer_slug)
);

CREATE TABLE IF NOT EXISTS auth_everline.clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_everline.client_offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES auth_everline.clients(id) ON DELETE CASCADE,
  offer_slug  text NOT NULL,
  label       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, offer_slug)
);

-- Seed: Uelicon Venâncio with its dashboards (mirrors the Supabase seed)
INSERT INTO auth_everline.clients (name, slug)
VALUES ('Uelicon Venâncio', 'uelicon')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO auth_everline.client_offers (client_id, offer_slug, label)
SELECT c.id, 'uelicon', 'Check-up da Vida Financeira'
FROM auth_everline.clients c WHERE c.slug = 'uelicon'
ON CONFLICT (client_id, offer_slug) DO NOTHING;
