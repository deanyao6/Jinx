/**
 * Legal and attribution copy shown in the About screens. Source of truth: docs/attribution.md,
 * docs/terms.md and docs/privacy.md. Keep these in sync when the docs change (Markdown-lite:
 * paragraphs, "- " bullets, "1. " numbered items, **bold** lead-ins, _italic_ lines).
 */
export const ATTRIBUTION_MD = `# Data attribution (shown on the About screen)

**MLB game data** is retrieved from the MLB Stats API (statsapi.mlb.com) and is the property of MLB Advanced Media, L.P. Used for personal, non-commercial purposes. Jinx is not affiliated with, endorsed by, or sponsored by Major League Baseball or any of its clubs.

Venue coordinates are compiled from public sources: OpenStreetMap (© OpenStreetMap contributors, Open Database License, via Nominatim) and Wikipedia. Elevations are from the USGS 3D Elevation Program, Natural Resources Canada's Canadian Digital Elevation Model and Open-Elevation. Timezones are resolved from OpenStreetMap boundaries through timezonefinder.
Team and league names appear as plain text for identification only. No logos, wordmarks, or other marks are used.

Venue coordinates are compiled from public sources: OpenStreetMap (OpenStreetMap contributors, Open Database License, via Nominatim) and Wikipedia. Elevations are from the USGS 3D Elevation Program, Natural Resources Canada's Canadian Digital Elevation Model and Open-Elevation. Timezones are resolved from OpenStreetMap boundaries through timezonefinder.
`;

export const TERMS_MD = `# Terms of use (draft)

_Last updated 2026-09-15._

By using Jinx you agree to these terms.

1. You must be 13 or older.
2. Log games you actually attended. Records are for fun; there is no wagering, prizes, or money involved.
3. Be decent: no harassment, impersonation, or offensive names. We may remove content or accounts that break this (see the moderation policy).
4. Do not upload tickets that are not yours. Ticket images are private to you and deleted after processing.
5. The service is provided as-is, without warranty. Game data may contain errors; we correct what we can.
6. We may change or discontinue features. You can delete your account at any time.
7. Team and league names are used descriptively. Jinx is not affiliated with or endorsed by any team or league.
`;

export const PRIVACY_MD = `# Privacy policy (draft)

_Last updated 2026-09-15. Replace Jinx with the final name before publishing._

Jinx is a passport for sports fans. This policy explains what we collect and why.

**What we collect**
- Account: your email address (or Apple ID relay address), handle, display name, optional home city, an optional profile photo (shown to signed-in users, and hidden from anyone you block or who blocks you), birth date (used only to confirm you are 13 or older).
- Games you log: the games, venues, seats and notes you enter, companions you tag, teams you follow, goals and lists you create.
- Check-ins: when you tap Check in, your device sends only the distance and accuracy relative to the venue. We never receive or store your coordinates.
- Ticket imports: screenshots, PDFs, or forwarded emails you choose to import. Files are stored privately, sent to an AI model to read the ticket fields, and deleted 7 days after the import is resolved. Extracted fields (teams, date, seat) are kept.
- Device: a push notification token if you enable notifications, and crash reports.

**How we use it**: to compute your records, stamps, moments and other passport features; to show your activity to people you allow; to send the notifications you turn on.

**Sharing**: profiles are public by default and can be made private. Seat details are hidden unless you opt in. We do not sell data. Service providers: Supabase (hosting and database), Anthropic (ticket reading), Cloudflare (inbound email), Expo (push notifications), Apple (sign-in).

**Your controls**: export everything from Settings as JSON, delete your account from Settings (removes all data and files), block and report users.

**Data sources**: game data comes from MLB Advanced Media, nflverse (CC-BY-4.0), NBA.com's public feeds and ESPN. Jinx is not affiliated with MLB, the NFL, the NBA, MLS or ESPN.

**Contact**: support email on the About screen.
`;
