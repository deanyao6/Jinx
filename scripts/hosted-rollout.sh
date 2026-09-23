#!/usr/bin/env bash
# Rolls the backend out to the hosted Supabase project, and proves each step
# by reading what actually happened rather than trusting an exit code.
#
#   bash scripts/hosted-rollout.sh            # everything, in order
#   bash scripts/hosted-rollout.sh verify     # only the read-only checks at the end
#
# Safe to rerun: migrations are applied once, vault secrets are replaced rather than duplicated,
# function deploys are idempotent, and the only user it ever touches is a throwaway it creates and
# deletes itself (scripts/verify-privacy-functions.mjs). It never resets or drops anything.
#
# Secrets: read from /tmp/hosted.env (mode 600, written by the TestFlight session) when present,
# otherwise fetched with the Supabase CLI. Nothing secret is printed, and the one SQL file that has
# to contain them lives in a private temp directory that is removed on exit.
set -euo pipefail

REF="vekdufflzklfxljqufbq"
URL="https://${REF}.supabase.co"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WORK="$(mktemp -d)"
chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT

say() { printf '\n== %s\n' "$*"; }
# The CLI prints a bare array in a terminal and {"rows": [...]} when it detects an agent. Normalise
# to the second so every caller can read .rows either way.
sql() { npx supabase db query --linked -o json "$1" | jq '{rows: (if type == "array" then . else .rows end)}'; }

# ---------------------------------------------------------------------------------------------
# Keys. The gateway wants the LEGACY service role JWT; the new sb_secret_ format is refused by it.
# ---------------------------------------------------------------------------------------------
load_keys() {
  if [ -f /tmp/hosted.env ]; then
    # shellcheck disable=SC1091
    . /tmp/hosted.env
  fi
  local keys
  keys="$(npx supabase projects api-keys --project-ref "$REF" -o json)"
  ANON_KEY="$(printf '%s' "$keys" | jq -r '.[] | select(.name == "anon") | .api_key')"
  if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    SUPABASE_SERVICE_ROLE_KEY="$(printf '%s' "$keys" | jq -r '.[] | select(.name == "service_role") | .api_key')"
  fi
  case "$SUPABASE_SERVICE_ROLE_KEY" in
    eyJ*) ;;
    *) echo "service role key is not a legacy JWT; the gateway will refuse it" >&2; exit 1 ;;
  esac
  if [ -z "${CRON_SECRET:-}" ]; then
    say "CRON_SECRET not found in /tmp/hosted.env: rotating it"
    CRON_SECRET="$(openssl rand -hex 32)"
    npx supabase secrets set "CRON_SECRET=${CRON_SECRET}" --project-ref "$REF" >/dev/null
    umask 077
    {
      echo "export SUPABASE_URL=${URL}"
      echo "export SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
      echo "export CRON_SECRET=${CRON_SECRET}"
    } >/tmp/hosted.env
  fi
  export SUPABASE_URL="$URL" SUPABASE_SERVICE_ROLE_KEY CRON_SECRET ANON_KEY
}

# ---------------------------------------------------------------------------------------------
rollout() {
  say "1. Migrations"
  npx supabase db push --linked --yes

  say "2. Vault secrets for pg_cron (project_url, service_role_key as the legacy JWT, cron_secret)"
  umask 077
  cat >"$WORK/vault.sql" <<SQL
do \$\$
declare
  pair record;
  existing uuid;
begin
  for pair in
    select * from (values
      ('project_url', '${URL}'),
      ('service_role_key', '${SUPABASE_SERVICE_ROLE_KEY}'),
      ('cron_secret', '${CRON_SECRET}')
    ) as t(name, secret)
  loop
    select id into existing from vault.secrets where name = pair.name;
    if existing is null then
      perform vault.create_secret(pair.secret, pair.name);
    else
      perform vault.update_secret(existing, pair.secret);
    end if;
  end loop;
end
\$\$;
SQL
  npx supabase db query --linked -f "$WORK/vault.sql" >/dev/null
  sql "select name from vault.decrypted_secrets where name in ('project_url','service_role_key','cron_secret') order by name" | jq -c '.rows'

  say "3. Edge Functions"
  npm run --silent functions:sync
  # inbound-email stays undeployed until a domain exists (STATE.md section 5).
  # evaluate-social recomputes leaderboards, counts, streaks and badges; process_game_final calls
  # it through call_edge_function. It was missing from this list on 2026-09-23, so the first
  # social rollout left pg_net answering 404 and nothing on hosted ever recomputed.
  npx supabase functions deploy cleanup-imports delete-account mlb-sync mlb-live nba-sync nba-live send-push \
    evaluate-goals evaluate-social storylines parse-ticket --project-ref "$REF"
  # The one public function: the signed-out welcome screen reads it with no session.
  npx supabase functions deploy welcome-wall --no-verify-jwt --project-ref "$REF"
}

# ---------------------------------------------------------------------------------------------
verify() {
  say "4. cleanup-imports and delete-account really delete (throwaway user only)"
  SUPABASE_ANON_KEY="$ANON_KEY" node scripts/verify-privacy-functions.mjs

  say "5. A scheduled call arrives. Judged by net._http_response, never by the cron status"
  local id
  id="$(sql "select public.call_edge_function('mlb-sync') as id" | jq -r '.rows[0].id')"
  echo "pg_net request ${id}; waiting for the response (mlb-sync takes up to two minutes)"
  local status=""
  for _ in $(seq 1 30); do
    status="$(sql "select status_code, timed_out, error_msg, left(content, 600) as content from net._http_response where id = ${id}" | jq -c '.rows[0] // empty')"
    [ -n "$status" ] && break
    sleep 5
  done
  echo "${status:-no response after 150s}"
  case "$status" in
    *'"status_code":200'*) echo "PASS  scheduled call authenticated and ran" ;;
    *) echo "FAIL  scheduled call did not return 200" >&2; exit 1 ;;
  esac

  say "6. The other scheduled functions answer an authenticated call"
  local fn code
  # evaluate-social is here so a missing deploy shows up as a FAIL line rather than as two
  # silent 404s in net._http_response, which is how it hid on 2026-09-23.
  for fn in send-push evaluate-goals evaluate-social mlb-live cleanup-imports; do
    code="$(curl -s -o "$WORK/out" -w '%{http_code}' -X POST "${URL}/functions/v1/${fn}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "x-cron-secret: ${CRON_SECRET}" \
      -H 'Content-Type: application/json' -d "$([ "$fn" = evaluate-social ] && echo '{"user_ids":[]}' || echo '{}')")"
    printf '%s  %-16s HTTP %s  %s\n' "$([ "$code" = 200 ] && echo PASS || echo FAIL)" "$fn" "$code" "$(head -c 200 "$WORK/out")"
  done

  say "7. Relive: rebuild stories made before the RBI fix, then build any that are missing"
  npx tsx ingest/src/mlb/relive.ts --rebuild
  npx tsx ingest/src/mlb/relive.ts --attended
  npx tsx ingest/src/nfl/relive.ts --attended
  npx tsx ingest/src/nba/relive.ts --attended

  say "8. State"
  sql "select jobname, schedule, active from cron.job order by jobname" | jq -c '.rows[]'
  sql "select status_code, count(*) from net._http_response where created > now() - interval '1 hour' group by 1 order by 1" | jq -c '.rows[]'
  sql "select (select count(*) from public.detail_queue where done_at is null) as queue_open,
              (select count(*) from public.games_needing_relive('mlb', 500)) as mlb_stories_owed,
              (select count(*) from public.games_needing_relive('nflverse', 500)) as nfl_stories_owed,
              (select count(*) from public.games_needing_relive('nba', 500)) as nba_stories_owed,
              (select count(*) from public.ticket_imports where storage_path is not null and image_deleted_at is null
                 and resolved_at < now() - interval '7 days') as overdue_ticket_images" | jq -c '.rows[0]'

  say "8b. The welcome wall answers without a session, and this week's six cards exist"
  code="$(curl -s -o "$WORK/wall" -w '%{http_code}' "${URL}/functions/v1/welcome-wall")"
  printf '%s  welcome-wall     HTTP %s  %s cards, week %s\n' "$([ "$code" = 200 ] && echo PASS || echo FAIL)" "$code" \
    "$(jq -r '.cards | length' "$WORK/wall" 2>/dev/null)" "$(jq -r '.week_start' "$WORK/wall" 2>/dev/null)"
  sql "select rank, payload->>'title' as title, payload->>'date_label' as when_ from public.welcome_wall_cards order by week_start desc, rank limit 6" | jq -c '.rows[]'

  say "9. Both scheduled GitHub workflows"
  gh workflow run daily-jobs.yml
  gh workflow run nfl-ingest.yml
  echo "started; check with: gh run list --limit 4"
}

load_keys
if [ "${1:-}" != "verify" ]; then rollout; fi
verify
say "done"
