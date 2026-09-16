#!/usr/bin/env bash
# Reports which external-service credentials are in place. Read-only: it never prints a secret
# value and never changes anything. Exit code is 1 if a required item is missing, 0 otherwise.
# See docs/deploy.md for what each item is and where to set it.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

missing=0
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33m--\033[0m    %s\n' "$1"; }
bad()  { printf '  \033[31mMISS\033[0m  %s\n' "$1"; missing=$((missing+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Reads a KEY=value from a dotenv file without sourcing it.
envval() { [ -f "$1" ] && sed -n "s/^$2=//p" "$1" | head -1 || true; }

head_ "App bundle (apps/mobile/.env)"
ENVF="apps/mobile/.env"
if [ ! -f "$ENVF" ]; then
  bad "$ENVF does not exist (copy apps/mobile/.env.example)"
else
  for v in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY; do
    [ -n "$(envval "$ENVF" "$v")" ] && ok "$v" || bad "$v is empty in $ENVF"
  done
  [ -n "$(envval "$ENVF" EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN)" ] \
    && ok "EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN" \
    || warn "EXPO_PUBLIC_INBOUND_EMAIL_DOMAIN unset (email ticket import disabled)"
  [ -n "$(envval "$ENVF" EXPO_PUBLIC_SENTRY_DSN)" ] \
    && ok "EXPO_PUBLIC_SENTRY_DSN" \
    || warn "EXPO_PUBLIC_SENTRY_DSN unset (crash reporting disabled)"
fi

head_ "Ingest jobs (current shell)"
[ -n "${SUPABASE_URL:-}" ] && ok "SUPABASE_URL" \
  || warn "SUPABASE_URL unset (only needed when running ingest against a hosted project)"
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && ok "SUPABASE_SERVICE_ROLE_KEY" \
  || warn "SUPABASE_SERVICE_ROLE_KEY unset (same)"

head_ "Supabase Edge Function secrets"
if ! command -v npx >/dev/null 2>&1; then
  warn "npx not found, skipping"
elif [ ! -f supabase/.temp/project-ref ]; then
  warn "no linked project (run: npx supabase link --project-ref <ref>)"
else
  secrets="$(npx --no-install supabase secrets list 2>/dev/null || true)"
  if [ -z "$secrets" ]; then
    warn "could not list secrets (are you logged in? run: npx supabase login)"
  else
    for s in ANTHROPIC_API_KEY INBOUND_EMAIL_SECRET CRON_SECRET; do
      grep -q "^ *$s " <<<"$secrets" && ok "$s" || bad "$s not set on the linked project"
    done
    grep -q "^ *EXPO_ACCESS_TOKEN " <<<"$secrets" && ok "EXPO_ACCESS_TOKEN" \
      || warn "EXPO_ACCESS_TOKEN unset (only needed with enhanced push security)"
  fi
fi

head_ "GitHub Actions secrets"
if ! command -v gh >/dev/null 2>&1; then
  warn "gh not found, skipping"
else
  # Empty output with exit 0 means "listed fine, none set", which is different from "cannot list".
  ghs="$(gh secret list 2>/dev/null)"
  if [ $? -ne 0 ]; then
    warn "could not list repository secrets (check: gh auth status)"
  else
    for s in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
      grep -q "^$s" <<<"$ghs" && ok "$s" || bad "$s not set (nfl-ingest and daily-jobs will fail)"
    done
  fi
fi

head_ "Cloudflare email worker"
WR=infra/cloudflare-email-worker/wrangler.toml
if grep -q 'REPLACE' "$WR" 2>/dev/null; then
  bad "$WR still has the placeholder SUPABASE_FUNCTIONS_URL"
else
  ok "SUPABASE_FUNCTIONS_URL looks set in $WR"
fi

head_ "Summary"
if [ "$missing" -eq 0 ]; then
  printf '  Nothing required is missing.\n\n'
else
  printf '  %d required item(s) missing. See docs/deploy.md.\n\n' "$missing"
fi
exit $(( missing > 0 ? 1 : 0 ))
