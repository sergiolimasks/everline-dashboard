#!/bin/bash
# Pre-deploy sanity check. Run before any production deploy to catch the
# class of bugs that bit us in the 2026-04-10 lost-frontend incident
# (see docs/POSTMORTEM-2026-04-10-lost-frontend.md).
#
# Exits non-zero if anything's off — pipe through `&&` for safe deploy:
#   ./scripts/pre-deploy-check.sh && npm run build && deploy.sh

set -euo pipefail

# Resolve repo root regardless of where the script is called from
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
RESET=$'\033[0m'

ok()    { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
fail()  { printf '  %s✗%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }
warn()  { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$1"; }

printf '\n→ Pre-deploy check (Everline)\n\n'

# 1. Working tree must be clean. Uncommitted work is the #1 cause of "I can't
#    rebuild what's in production" — same root cause as the 2026-04-10 incident.
printf '%s%s%s\n' "$YELLOW" "git state" "$RESET"
DIRTY=$(git status --short | wc -l | tr -d ' ')
if [ "$DIRTY" != "0" ]; then
  git status --short
  fail "working tree has $DIRTY uncommitted change(s) — commit or stash before deploying"
fi
ok "working tree clean"

STASH_COUNT=$(git stash list | wc -l | tr -d ' ')
if [ "$STASH_COUNT" != "0" ]; then
  warn "$STASH_COUNT stash(es) present — those are NOT in the deploy artifact"
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  fail "not on main (current: $CURRENT_BRANCH) — production deploys ship from main"
fi
ok "on main"

# Refuse to deploy if local main is behind origin
git fetch --quiet origin main
LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  fail "local main is out of sync with origin/main — pull first"
fi
ok "main is in sync with origin"

# 2. Frontend
printf '\n%s%s%s\n' "$YELLOW" "frontend" "$RESET"
npx tsc --noEmit 2>&1 | tail -3
ok "frontend typecheck"

npm run build > /tmp/everline-build.log 2>&1 || {
  cat /tmp/everline-build.log >&2
  fail "frontend build failed"
}
ok "frontend build"

# 3. Backend
printf '\n%s%s%s\n' "$YELLOW" "backend" "$RESET"
(cd api && npx tsc --noEmit) 2>&1 | tail -3
ok "backend typecheck"

# 4. Built bundle sanity check — must talk to Express API, not Supabase.
#    This is the exact regression that happened in the 2026-04-10 incident:
#    the source compiled but produced a bundle pointing at the wrong backend.
printf '\n%s%s%s\n' "$YELLOW" "bundle integrity" "$RESET"
BUNDLE=$(ls -1t dist/assets/index-*.js 2>/dev/null | head -1)
if [ -z "$BUNDLE" ]; then
  fail "no bundle found in dist/assets/"
fi

if grep -q "/auth/login" "$BUNDLE"; then
  ok "bundle references /auth/login (Express API)"
else
  fail "bundle is missing /auth/login — frontend might be talking to the wrong backend"
fi

if grep -q "supabase" "$BUNDLE"; then
  fail "bundle still references supabase — migration regression"
fi
ok "bundle has no supabase references"

# 5. No leaked secrets staged. Catches the case where someone added a real
#    credential to a tracked file by accident.
printf '\n%s%s%s\n' "$YELLOW" "secrets scan" "$RESET"
LEAK_PATTERNS='wJpDF3KZ|EdAvBOwn|h3w0Ur|Rodomoto|2408#Yasmin|P5JRE2Cp|PmClHel6cKK'
LEAKS=$(git ls-files | xargs grep -lE "$LEAK_PATTERNS" 2>/dev/null || true)
if [ -n "$LEAKS" ]; then
  printf '  files with leaked credentials:\n'
  printf '    %s\n' $LEAKS
  fail "tracked files contain known credentials"
fi
ok "no known credentials in tracked files"

printf '\n%sAll checks passed.%s Safe to deploy.\n\n' "$GREEN" "$RESET"
