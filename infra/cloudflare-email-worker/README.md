# Inbound email worker

Forwarded ticket confirmations arrive at `u-{token}@in.<domain>` and are handed to the `inbound-email` Edge Function.

1. Add the domain to Cloudflare and enable Email Routing. Add the subdomain `in` (MX records are created by Cloudflare).
2. `npm install`, set `SUPABASE_FUNCTIONS_URL` in `wrangler.toml`, then `wrangler secret put INBOUND_EMAIL_SECRET` (same value as the Supabase function secret).
3. `npm run deploy`.
4. In Email Routing, create a catch-all rule for `in.<domain>` with action "Send to a Worker" pointing at `appname-inbound-email`.
5. Set the same secret on Supabase: `supabase secrets set INBOUND_EMAIL_SECRET=...` and `ANTHROPIC_API_KEY=...`.
