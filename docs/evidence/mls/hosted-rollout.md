# Hosted MLS rollout — 2026-09-22

Target: Jinx `vekdufflzklfxljqufbq` only. User authorized hosted MLS rollout and simulator.

- Five MLS migrations applied, ending in `20260922000100_mls_preserve_venue_timezones.sql`.
- Existing hosted timezone/search migration recovered locally and applied without reset.
- Local pgTAP: 371 assertions / 21 files pass after timezone fix.
- `parse-ticket` deployed after functions sync; no other functions deployed.
- Hosted SQL confirms 30 MLS teams, 4,962 matches (2016–2026), 4,817 finals.
- 2026: 510 matches, 387 finals.
- All finals have venue rows; 12 cancelled/postponed entries lack venue rows.
- Shared Lumen Field/Gillette Stadium timezones verified after deployment.
- Concurrent history worker hit partial-cache JSON read; main worker completed that range.
  Final SQL totals match local. Avoid overlapping import ranges sharing this disk cache.
- No user favorites or attendance created for verification. No TestFlight release or git push.
- Scheduled ingestion is still gated/unpublished; venue reconciliation remains incomplete.
- Metro points to hosted via environment overrides; local `.env` unchanged. Local Colima
  `jinx` VM stopped to free memory (data preserved); restart with `colima start --profile jinx`.
- Simulator app successfully bundled (3,023 modules) and rendered the hosted sign-in screen.
  Metro remains running on 8081 with two workers. Authenticated UI journey awaits user login.
