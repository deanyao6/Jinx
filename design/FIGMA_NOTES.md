# Figma notes for Jinx

These three screens were designed in Figma and have been recreated in `design/reference.html` with every correction below already applied. **Build from the reference, not from Figma or the screenshot.** `design/figma/passport-games-pick-side.png` is the original export, kept for context only. This file records what came from Figma and why the reference differs from it.

## Screens that came from Figma

### Passport (light mode frame)
- Header: "APPNAME" wordmark (replace with **Jinx**) and a small "FAN PASSPORT" label; circular notifications and profile buttons.
- Team pills with counts: All Teams (48, selected, dark fill), Phillies (17, count in team red), Eagles (8).
- Dark lifetime record hero with a subtle texture: "LIFETIME RECORD" label, "48 GAMES ATTENDED" badge, large "31 – 17", "WIN RATE .646", "+3 game win streak", and a "Last Game: PHI 4 – 2 NYM" row with a status dot and arrow.
- Three record cards: Phillies 12–5 (.706 pct), Eagles 6–2 (.750 pct), Neutral 10–9 (.526 pct). Each has a team-colored label and dot.
- Stadium Stamps with "View All (8)": circular engraved seal-style stamps with a dashed outer ring, name, and city (Citizens Bank, Philadelphia; Lincoln Financial, Philadelphia; Madison Square, New York).
- Fan Superlatives card list: icon, small label, large value, right context chip (Coldest Recorded Game −2 °F, Linc Jan 2024; Most Seen Player Bryce Harper, 11 Games; Loudest Stadium Visited 98.4 dB, Citizens Bank).
- Tab bar: Passport, Games, Plan, Profile.

### Games (dark mode frame)
- Large "Games" title with a circular add button; search field ("Search attended games, stadiums, teams…"); History, Upcoming, Imports segments.
- Card rows: square thumbnail, matchup and score with a verified check, venue and date, companion avatars with "w/ names", filled W or L circle.
- Tab bar: Passport, Games, Stats, Profile.

### Pick a side (dark mode frame)
- Green "LIVE" pill, "At {venue}", amber "LOCKS IN 12:34" pill.
- Title "Pick a side" with explainer text.
- Circular team badges with initials, team fill, and team-color ring (NYM, SD), names and records, "vs" between.
- Win probability bar split in team colors with "58% Win Prob" and "42%".
- Full-width buttons "Root for NY Mets" and "Root for SD Padres" in team colors.
- Storylines section with a book icon and cards showing a one-line storyline and a source label.

## Corrections (already applied in the reference)

1. **Name.** Replace "APPNAME" with "Jinx" everywhere.
2. **Tab bar mismatch.** Passport shows "Plan" as the third tab; Games shows "Stats". Use **Plan** on every screen until Dean decides otherwise (spec open question 1c).
3. **Storyline source "From Elias Sports."** Jinx doesn't license Elias Sports Bureau data, so this label can't ship. Allowed sources are the ones in spec 6.18: "From results", "Official injury report", "Probable starters".
4. **Storyline about a named player's debut.** Storylines must only state facts present in Jinx's own data. Replace the sample with a fact-based one, e.g., "Mets probable starter makes his first start of the season."
5. **Sample matchup venue.** Pick a side shows Mets vs Padres "At Citizens Bank Park", which can't happen. In demo data use a venue that matches the home team (Petco Park if the Padres are home, Citi Field if the Mets are).
6. **Loudest Stadium Visited.** No data source exists. Show only in demo mode; see spec 6.8.
7. **Game thumbnails.** Use the user's own photo from that game if one exists, otherwise stadium stamp art. No stock or scraped stadium photos (spec open question 1d).
8. **Stamp artwork.** Stamps are generated vector art (SVG) in the engraved seal style shown in Figma, built from each venue's shape data (spec 8.5), not raster images. If Figma contains the stamp as vectors, export those as the template.
9. **Team logos.** Circular team badges use initials in team colors. Never replace them with official logos.
10. **Sample data consistency.** Demo mode must use one coherent dataset, taken from the reference.
11. **Out-of-scope sports in sample data.** Figma's Games list included an NBA game (Celtics vs Heat at Kaseya Center) and the stamps included Madison Square Garden. v1 covers MLB and NFL only, so the reference uses Phillies at Dodgers (Dodger Stadium) and Citi Field instead.
12. **Middle dots in metadata.** Figma used "Venue • Date" and "Linc • Jan 2024". The reference uses commas ("Citizens Bank Park, Oct 12, 2024").
13. **Selection states.** Figma showed only the default state for the root buttons and pills. The reference defines selected states: the chosen root button gets a check and an outer ring in the team's secondary color while the other dims; a selected pill fills with the team color.
