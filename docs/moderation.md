# Moderation policy

Jinx has user-generated content in handles, display names, placeholder companion names, notes, and feed reactions. This is how it is handled (App Store Guideline 1.2).

- **Filtering**: handles and display names are checked against a profanity list in the app before saving; the database rejects handles outside `[a-z0-9_]{3,20}`.
- **Reporting**: any profile, attendance, feed event, or person can be reported from the overflow menu. Reports land in `public.reports` with the reporter, target, and reason.
- **Blocking**: blocking removes follows in both directions and hides both users from each other everywhere (profiles, feed, overlap, rivalries, tags).
- **Response**: reports are reviewed within 24 hours. Actions: content removal (rename or delete the offending row), a warning notification, or account deletion for repeat or severe abuse. Resolution and notes are recorded on the report row (`resolved_at`, `resolution`).
- **Contact**: support email is listed on the About screen and in the App Store listing.
- **Age**: sign-up requires a birth date of 13 or older; under-13 dates are rejected by the database.
