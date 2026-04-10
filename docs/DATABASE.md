# Database Reference

Schemas e tabelas usadas pelo Everline Dashboard. O backend fala com um único
PostgreSQL 16 (database `postgres`) que é **compartilhado com outros projetos**
(CC360, Revenda Leads). Por isso trabalhamos em schemas isolados.

## Schemas

| Schema | Ownership | Acesso Everline | Descrição |
|---|---|---|---|
| `auth_everline` | `everline_api` (user dedicado) | RW full | Auth, users, roles, access, clients, offers |
| `bd_ads_clientes` | `postgres` | SELECT | Tabelas de ads (Meta) e leads importadas via ETL externa |
| `uelicon_database` | `postgres` | SELECT | Controle Green (vendas principais) e TMB (Total Mega Bundle) |
| `public` | `postgres` | USAGE + SELECT/INSERT em `schema_migrations` | Só pra rodar o migration runner |

O ETL que popula `bd_ads_clientes` e `uelicon_database` **não é parte deste
projeto** — vem de outra stack (provavelmente CC360 ou pipeline separada).
A API Everline é estritamente consumidora dessas tabelas.

## User: `everline_api`

Criado em 2026-04-10 durante o security cleanup para evitar que o Everline
rode com credenciais do superuser `postgres`.

```sql
-- Create role with strong random password
CREATE ROLE everline_api LOGIN PASSWORD '<ver reference_everline_prod.md>';

-- Own schema: transfer ownership of auth_everline + its tables/sequences
ALTER SCHEMA auth_everline OWNER TO everline_api;
-- + loop ALTER TABLE / ALTER SEQUENCE ... OWNER TO everline_api

-- Read-only dashboards data
GRANT USAGE ON SCHEMA bd_ads_clientes TO everline_api;
GRANT SELECT ON ALL TABLES IN SCHEMA bd_ads_clientes TO everline_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA bd_ads_clientes
  GRANT SELECT ON TABLES TO everline_api;

GRANT USAGE ON SCHEMA uelicon_database TO everline_api;
GRANT SELECT ON ALL TABLES IN SCHEMA uelicon_database TO everline_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA uelicon_database
  GRANT SELECT ON TABLES TO everline_api;

-- Migration runner needs to read/write public.schema_migrations,
-- and CREATE privilege on public (PG15+ revoked default)
GRANT USAGE, CREATE ON SCHEMA public TO everline_api;
GRANT SELECT, INSERT ON public.schema_migrations TO everline_api;
```

**Por que o user é OWNER do `auth_everline`** (em vez de só GRANT ALL)?

Porque migrations fazem DDL (`ALTER TABLE`, `CREATE INDEX`) e PG só permite
isso ao dono da tabela. Se deixássemos ownership no `postgres` e só concedêssemos
privilégios, a API rebentava em qualquer migration nova que mexesse em tabela
existente. OWNER resolve de uma vez.

## `auth_everline` — tabelas

### `app_role` (enum)

Valores válidos: `user`, `gestor`, `admin`, `super_admin`.

Definido em `001_init.sql:6`. Hierarquia em [`ARCHITECTURE.md`](./ARCHITECTURE.md#roles).

### `users`

```sql
CREATE TABLE auth_everline.users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,        -- bcrypt 10 rounds
  display_name   text,
  token_version  integer NOT NULL DEFAULT 0,  -- added in 002
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz           -- added in 007
);
```

**Notas**:
- `token_version` bumpa em cada mudança de senha. Qualquer JWT com `v` diferente é rejeitado em `requireAuth` (ver `api/src/auth.ts:77`).
- `last_login_at` é atualizado fire-and-forget após login bem-sucedido (não bloqueia a resposta).
- Queries case-insensitive em email usam `lower(email) = lower($1)` — não há índice functional pra isso ainda (débito técnico).

### `user_roles`

```sql
CREATE TABLE auth_everline.user_roles (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES auth_everline.users(id) ON DELETE CASCADE,
  role     auth_everline.app_role NOT NULL,
  UNIQUE (user_id)  -- added in 002, after deduping
);
```

**Invariante**: um user tem no máximo uma role. O schema original (Supabase)
permitia múltiplas e o código contornava com "pick the highest" — virou bug
real. Migration `002` deduplica (preservando a role mais alta por user) e
adiciona a constraint.

### `user_campaign_access`

```sql
CREATE TABLE auth_everline.user_campaign_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth_everline.users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES auth_everline.clients(id) ON DELETE CASCADE,  -- added in 008
  offer_slug  text NOT NULL,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id, offer_slug)  -- was (user_id, offer_slug) until 008
);
```

Quem acessa qual dashboard. Usado pelo frontend pra filtrar quais cards o
user não-admin vê no Panel.

**Por que escopar por `client_id`**: o schema antigo assumia slugs globais
(`uelicon`, `formacao-consultor`). Quando surgir um segundo cliente com slug
igual (ex: dois clientes com `checkup`), o unique constraint antigo
colapsava os acessos. Migration `008` backfilla o `client_id` via lookup em
`client_offers`.

### `clients`

```sql
CREATE TABLE auth_everline.clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Clientes da agência. Hoje só `Uelicon Venâncio` (slug `uelicon`) — seeded em
`001_init.sql:52`. Adicionar novo cliente é via endpoint `POST /clients` ou SQL direto.

### `client_offers`

```sql
CREATE TABLE auth_everline.client_offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES auth_everline.clients(id) ON DELETE CASCADE,
  offer_slug  text NOT NULL,
  label       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, offer_slug)
);
```

Dashboards disponíveis por cliente. Cada `(client, offer_slug)` mapeia pra uma
entrada em `PROJECTS` no `dashboard-config.ts` (ver [`DASHBOARDS.md`](./DASHBOARDS.md)).

Exemplos no Uelicon (seeded + adicionados manualmente):
- `uelicon` — Check-up da Vida Financeira
- `formacao-consultor` — Formação Consultor 360
- `sistema-leads` — Sistema de Leads
- `distribuicao` — Distribuição (posts orgânicos)

## `bd_ads_clientes` — tabelas lidas

```sql
-- Métricas diárias Meta Ads por campanha/conjunto/anúncio
bd_ads_clientes.meta_uelicon_venancio
  (data, conta, campanha, conjunto, anuncio,
   impressoes, alcance, cliques, cliques_link,
   views_pagina, views_3s, checkouts, compras,
   valor_compras, gasto, leads, ...)

-- Links UTM/tracking das campanhas
bd_ads_clientes.meta_uelicon_venancio_links

-- Leads importados de cada frente
bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac
bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter
bd_ads_clientes.leads_uelicon_venancio_presencial
  (Data, telefone, ...)

-- Backup tables (auditoria — criadas por migrations 004, 005)
bd_ads_clientes.views_pagina_fix_log
```

**Aviso sobre inconsistência de colunas**: as tabelas de leads têm coluna de
telefone com nomes variando (`telefone`, `Telefone`, `phone`). O backend
detecta via `information_schema.columns` em `dashboard-helpers.ts:getTableColumns`.
Se adicionar uma nova tabela de leads, garanta que a coluna de telefone está
no array `PHONE_CANDIDATES`.

## `uelicon_database` — tabelas lidas

```sql
-- Vendas aprovadas (principal + bumps)
uelicon_database.controle_green
  ("Data", "Status da venda", "Produto", "Valor Bruto", "Valor Líquido",
   "Co-Produtor", "Email Cliente", "Telefone Cliente", ...)

-- TMB — Total Mega Bundle (produto escalonado)
uelicon_database.controle_tmb
  ("Data", "Status", "Valor", "E-mail", "Parcelas", ...)

-- Backup table criada por migration 006
uelicon_database.controle_tmb_cleanup_log
```

Convenção das colunas: nomes com espaços e acentos entre aspas duplas (vieram
de planilhas). O backend sempre referencia como `"Nome Coluna"` nas queries.

## Migrations

Todas em `api/db/migrations/`, numeradas e idempotentes. Rodam automaticamente
no boot do container (via `runMigrations()` em `api/src/index.ts:67`).

| Arquivo | Objetivo |
|---|---|
| `001_init.sql` | Cria schema `auth_everline`, enum `app_role`, tabelas base, seed do Uelicon |
| `002_token_version_and_unique_role.sql` | Adiciona `token_version` em `users`; deduplica e força `UNIQUE(user_id)` em `user_roles` |
| `003_uelicon_real_dashboards.sql` | Popula `client_offers` com os 4 dashboards reais do Uelicon |
| `004_fix_broken_pixel_views_apr_02_08.sql` | Corrige dados históricos de `views_pagina` em Meta Ads (2026-04-02 a 2026-04-08) — cria backup em `views_pagina_fix_log` |
| `005_fix_broken_pixel_views_mar_19.sql` | Mesmo fix pra 2026-03-19 |
| `006_tmb_telefone_backfill.sql` | Backfilla coluna `telefone` em `controle_tmb` a partir do CSV em `api/db/dumps/` — cria `controle_tmb_cleanup_log` |
| `007_last_login_at.sql` | Adiciona `last_login_at` em `users` |
| `008_user_campaign_access_client_id.sql` | Escopa `user_campaign_access` por `client_id` — remove o unique antigo, backfilla via lookup, adiciona o novo constraint |

### Convenções de migration

1. **Idempotente sempre**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL END $$`. Rodar 2x deve ser no-op.
2. **Backfills destrutivos geram backup table**: ex. `views_pagina_fix_log` antes de reescrever dados. Reverter = `INSERT ... SELECT row_snapshot`.
3. **Arquivo numerado com zero-padding**: `001_…sql`, `002_…sql`, …, `010_…sql`. Numeração determina ordem de execução.
4. **Nome descritivo**: `008_user_campaign_access_client_id.sql` é melhor que `008_fix_access.sql`.
5. **Não apaga dados sem backup**: mesmo migrations de limpeza salvam o estado anterior antes de `DELETE`.

### Rodar migrations manualmente

Normalmente não é necessário — elas rodam no boot do container. Mas em casos
especiais:

```bash
# local
cd api && npm run migrate

# VPS
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" \
  "docker exec -it \$(docker ps -q -f name=everline-api_api) npm run migrate"
```

### Reverter uma migration

Não há rollback automatizado. Processo manual:

1. Achar a `backup table` criada pela migration (ex: `views_pagina_fix_log`)
2. `INSERT INTO bd_ads_clientes.meta_uelicon_venancio SELECT row_snapshot FROM bd_ads_clientes.views_pagina_fix_log WHERE ...`
3. Remover a linha correspondente de `public.schema_migrations` (pra rerunar se quiser)
4. Documentar o rollback no commit message

## Conexão

**Produção**:
```
postgresql://everline_api:<pass>@host.docker.internal:5432/postgres
```

O container roda com `extra_hosts: host.docker.internal:host-gateway` pra
alcançar o PG do host (que é o próprio Postgres 16 da VPS, não outro container).

**Dev local**:
```
postgresql://srglimasks@localhost:5432/everline
```

User do macOS sem senha, database `everline` separado (não compartilha com
a VPS). Clone de tabelas reais da VPS foi feito em 2026-04-10 pra ter dados de
teste (via `pg_dump` → arquivo em `api/db/dumps/`, gitignored).

## Backup operacional

```bash
# Backup semanal do schema auth_everline
PGPASSWORD="$PG_PASS" pg_dump -h "$VPS_HOST" -U postgres \
  -n auth_everline postgres > everline-backup-$(date +%F).sql
```

Não há automação hoje — roda manualmente. Débito técnico: cron job na VPS ou
GitHub Actions com secrets.

## Queries úteis pra debug

```sql
-- Quem acessa o que?
SELECT u.email, c.name AS client, uca.label, uca.offer_slug
FROM auth_everline.user_campaign_access uca
JOIN auth_everline.users u ON u.id = uca.user_id
JOIN auth_everline.clients c ON c.id = uca.client_id
ORDER BY u.email, c.name;

-- Users e roles
SELECT u.email, u.display_name, ur.role, u.last_login_at
FROM auth_everline.users u
LEFT JOIN auth_everline.user_roles ur ON ur.user_id = u.id
ORDER BY u.last_login_at DESC NULLS LAST;

-- Migrations aplicadas
SELECT id, applied_at FROM public.schema_migrations ORDER BY id;

-- Vendas aprovadas do dia
SELECT COUNT(*), SUM(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric)
FROM uelicon_database.controle_green
WHERE "Data"::date = CURRENT_DATE
  AND "Status da venda" IN ('paid','approved','Aprovada','Completa');
```
