#!/bin/bash
# Weekly pg_dump of the auth_everline schema. Runs via cron.
# Keeps the most recent 8 backups (~2 months of weekly snapshots).

set -euo pipefail

BACKUP_DIR=/root/everline-api/backups
RETAIN=8

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/auth_everline-$TS.sql.gz"

# Read secrets from the same env file the Swarm service uses.
# shellcheck disable=SC1091
set -a
. /root/everline-api/.env.production
set +a

# Extract password from DATABASE_URL (postgresql://user:pass@host:port/db)
PG_PASS=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')

# Use the postgres:16 docker image to match the server version exactly
# (VPS apt only ships pg_dump 15, which refuses to dump a PG 16 server).
docker run --rm --network=host \
  -e PGPASSWORD="$PG_PASS" \
  postgres:16-alpine \
  pg_dump -h 127.0.0.1 -U everline_api -d postgres \
    -n auth_everline --no-owner --no-privileges \
  | gzip -9 > "$OUT"

echo "[backup] wrote $OUT ($(du -h "$OUT" | cut -f1))"

# Retention: delete all but the newest $RETAIN files
ls -1t "$BACKUP_DIR"/auth_everline-*.sql.gz 2>/dev/null \
  | tail -n +$((RETAIN + 1)) \
  | xargs -r rm -v
