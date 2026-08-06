# Card Rating Data

## Rating Contract

Battle-facing ratings use integer values from 0 through 99:

```text
3 POINT
MID RANGE
FINISHING
PLAYMAKING
INTERIOR DEFENDING
PERIMETER DEFENDING
STRENGTH
HEIGHT (physical centimeters, not a rating)
```

`FINISHING` maps directly to the database field `finishing`. Rebounding is
derived from height, strength, and interior defense.

## 2026 Playtest Catalog

`data/card-templates.json` contains:

```text
5 Goat
10 Superstar
10 All-Star
7 Alpha
12 Uncommon
12 Common
12 Base
```

The 25 Goat/Superstar/All-Star profiles start from the user-provided
`Stats players - Trang tính1.csv`. Missing ratings and all lower-rarity
playtest profiles are editorial gameplay ratings inferred from the most recent
2025-26 regular-season production, shooting profile, defensive role, position,
and physical measurements.

These are not official NBA or video-game ratings. Source statistics inform the
ratings, but the conversion to 0–99 is a SlamDunk balancing decision.

## Research Sources

- NBA traditional player statistics (2025-26):
  https://www.nba.com/stats/players/traditional?Season=2025-26&SeasonType=Regular%20Season
- NBA player shooting by zone (2025-26):
  https://www.nba.com/stats/players/shooting?Season=2025-26&SeasonType=Regular%20Season&DistanceRange=By%20Zone
- NBA player defense dashboard (2025-26):
  https://www.nba.com/stats/players/defense?Season=2025-26&SeasonType=Regular%20Season
- NBA roster height and weight directory:
  https://www.nba.com/players

## Data Maintenance

The current schema allows one Card Template per case-insensitive player name and
rarity pair. The same player may appear in different rarities, but not twice in
one rarity. `npm run db:seed:cards` upserts by player name plus rarity. Multiple
variants inside the same rarity later require an explicit `variant_code` or
`card_set` schema change.
