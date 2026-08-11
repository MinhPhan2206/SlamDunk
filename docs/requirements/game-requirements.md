# Game Requirements

## Supporting Balance Documents

- [Economy, Pack Odds, and Progression Baseline](economy-pack-baseline.md) —
  provisional values for simulation and playtesting; not final production
  requirements.

## Confirmed Claim Rules

- `/claim` has a 10-minute cooldown.
- Each successful claim awards a uniformly random integer from 300 through 500
  Gold, inclusive.
- Cooldown state, Wallet credit, and EconomyTransaction history must be updated
  atomically in PostgreSQL.
- Retrying the same Discord interaction must not award Gold twice.

## Supporting Commands

- `/cooldowns` reports cooldown availability using PostgreSQL time as the source
  of truth. It currently reports `CLAIM` and `FREE_DROP`; Daily and Weekly can
  be added when those reward systems exist.
- `/rarity` accepts a named rarity choice and lists Card Templates in that
  rarity. The current names are Base, Common, Uncommon, Alpha, All-Star,
  Superstar, and Goat.
- `/rarity` lists template definitions, not Card Instances owned by a Player.
- `/sort` persists each Player's `/collection` ordering. If `sort_by` is
  omitted, it defaults to Rarity. Supported choices are oldest, newest, rarity,
  Card Level, player name, position, and implemented Card stats.
- A Player without a saved preference uses oldest-first order so newly obtained
  Drop/Pack cards appear at the end of `/collection`.
- `/profile`, `/collection`, and `/lineup view` accept an optional Discord
  `user`. Omitting it views the caller. Viewing another Discord user is
  read-only and does not create a Player record for someone who has never used
  SlamDunk. `/lineup set` and `/lineup remove` remain self-only. Collection
  pagination remains controlled by the user who opened the response.

## M9 Free Drop Behavior

- `/drop` creates a persisted Free Drop offer containing three distinct,
  packable, non-retired Card Templates.
- The Player chooses one candidate; only that candidate becomes a Card Instance.
- The new Card Instance receives a weighted initial Card Level: Level 1 45%,
  Level 2 28%, Level 3 14%, Level 4 8%, and Level 5 5%. Drop and each Pack
  product keep separate configuration for these weights.
- Candidate selection, Card Instance minting, ownership history, mint counters,
  DropSession completion, and cooldown update are atomic in PostgreSQL.
- Replaying the same selection must return the existing result and must not mint
  another Card Instance.
- An open offer is reused when `/drop` is called again until it is resolved.
- The current playtest configuration uses a 10-minute Free Drop cooldown, three
  candidates, and the provisional named-rarity weights in
  `economy-pack-baseline.md`. These remain adjustable simulation values rather
  than finalized production balance.
- Three candidates is the production candidate count.
- The selection window lasts 10 seconds. When it expires, candidate 1 is
  selected automatically and the Player cannot select another candidate.
- Free Drop has no pity system.

## Drop and Pack Odds

- Free Drop and Pack are separate modules and separate product sources.
- `/odds pack_type:<code>` displays Free Drop or configured Pack odds through
  one command. Omitting `pack_type` defaults to Free Drop. Current choices are
  Free Drop and Standard Pack; future Pack catalog entries become additional
  choices.
- Standard Pack odds are: Base 13.95031%, Common 44.16792%, Uncommon
  38.25376%, Alpha 3.451062%, All-Star 0.166945%, Superstar 0.008334%, and
  Goat 0.001667%.
- Pack definitions are keyed by stable Pack codes so each future Pack can own
  an independent name and rarity distribution.
- This iteration exposes Pack catalog odds only. Buying or opening Packs remains
  a separate module from Free Drop.

## Pack Purchase

- `/pack pack_type:<code>` buys and opens the selected Pack immediately.
- Standard Pack costs 1,000 Gold, grants one random Card, and has a one-second
  anti-spam cooldown with no purchase limit.
- Gold debit, ledger entry, rarity roll, Card mint, PackOpening completion, and
  cooldown update are one PostgreSQL transaction.
- Discord interaction ID provides idempotency. A retry returns the existing
  Pack result and cannot charge Gold or mint another Card.
- Eligible Card Templates within each of the current seven rarities have
  equal probability after the rarity roll.
- Future Premium, Event, and Shard Packs own separate catalog definitions and odds.

## Card Stat Derivation

- Card Template stats represent the Card at Level 5.
- Runtime Actual Stat is `Template Stat - (5 - Card Level)` for every displayed
  battle stat.
- Card Instances store only their Level; derived stats are not duplicated.
- Battle calculations, lineup averages, and stat sorting use Actual Stats.
- `overall` is temporarily retained only for current Battle AI selection. It is
  hidden from Player-facing UI and is not a Collection sort option.

## Discord Presentation

- Titles, colors, status states, Card rows, artwork fallback, and pagination
  follow the shared bot UI modules.
- Player-facing Card rows omit OVR and serial number.
- Collection displays 10 Cards per page with icon-only Previous/Next controls
  and the viewed Discord user's avatar.
- Lineup displays a five-Card artwork strip, Actual Stat averages, and Battle
  record/win rate. Profile omits Collection size and Lineup status.
- Drop and Pack results are artwork-led. Odds use aligned text columns.
- Interactive messages disable their controls and show `Interaction Expired`
  after their configured inactivity timeout.

## Daily Reward

- `/daily` has a 24-hour cooldown.
- A successful Daily grants 1,500–2,000 Gold and 20–30 Shards, inclusive.
- Both rewards, ledger entries, and cooldown are atomic and idempotent.

## Shard Exchange

- `/exchange item:shard` displays an interactive Exchange menu.
- One Level Up item costs 500 Shards.
- Shard debit, exchange audit record, and item grant are atomic and idempotent.

## M12 Battle MVP Behavior

- `/battle` runs a persisted `PVE_5V5` simulation using the Player's complete
  active lineup against an AI lineup selected from the Card catalog.
- Match and player snapshots preserve historical results, and the Discord
  interaction ID prevents duplicate matches and counter updates.
- Each new Match uses its persisted random seed to select an AI lineup from
  position-eligible candidates near the Player lineup's Actual Stat strength.
  AI Card Level matches the opposing Player Card Level in each slot.
- Candidate-pool size, rating tolerance, offense/defense formulas, and score
  variance are centralized playtest configuration, not final balance.
- M12 stores Trait snapshots but does not apply Trait effects. It has no reward,
  cooldown, play-by-play, fatigue, substitutions, or PvP.

Tài liệu yêu cầu trò chơi cho dự án SlamDunk Discord Bot.

## Confirmed Card Level and Fusion Rules

- Card Level nằm trong khoảng từ 1 đến 5.
- Card Instance nhận từ Pack có level khởi tạo ngẫu nhiên từ 1 đến 5.
- Chỉ hai Card Instance thuộc cùng một Card Template mới có thể Fusion.
- Level của Card Instance mới được tính bằng:

```text
newLevel = min(cardA.level + cardB.level, 5)
```

Ví dụ:

```text
Level 1 + Level 2 → Level 3
Level 4 + Level 2 → Level 5
Level 5 + Level 1 → Level 5
```

Hai Card Instance nguồn được giữ lại trong lịch sử với trạng thái
`DESTROYED_FUSION`. Fusion tạo một Card Instance mới có ID và serial mới.

## M14 Upgrade Item Behavior

- Upgrade Item có tên hiển thị `Level Up` và mã nội bộ `LEVEL_UP`.
- Mỗi lần sử dụng tăng Card Level thêm 1, giữ nguyên Card Instance ID và serial.
- Card Level tối đa là 5; thẻ Level 5 bị từ chối trước khi tiêu hao item.
- Không có Gold fee.
- Trong M14, Level Up chỉ được cấp bằng công cụ admin cục bộ; nguồn gameplay
  hoặc shop vẫn chưa được triển khai.

## M15 Market Behavior

- Market dùng fixed Gold price; listing fee và Market fee đều bằng 0.
- Seller nhận toàn bộ giá bán.
- Mỗi Card Instance chỉ có tối đa một listing `ACTIVE`.
- Listing khoá thẻ khỏi Quicksell, Fusion, Direct Trade và listing trùng.
- Mua listing chuyển Gold, ownership và trạng thái listing trong một transaction.
- Battle eligibility của thẻ đang được listing vẫn là TBD.

- Market actions are separate slash commands: `/market`, `/sell`, `/unlist`,
  and `/buy`.
- `/market` shows Player name and Gold price on the first line, then rarity,
  positions, Card Level, and public Card ID. Listing ID and seller name are not
  displayed.
- `/buy` and `/unlist` identify the active listing by public Card ID.

## M16 Direct Trade Behavior

- Direct Trade có đúng hai Player và có thể chứa Card cùng Gold tuỳ chọn.
- Trade fee bằng 0.
- Card được thêm vào offer sẽ bị trade-lock cho đến khi remove, cancel hoặc
  Trade hoàn tất.
- Mọi thay đổi Card hoặc Gold offer đều xoá confirmation của cả hai bên.
- Khi cả hai xác nhận final offer, Gold và Card ownership được chuyển trong
  cùng một PostgreSQL transaction.
- Mỗi người có thể offer tối đa 10 Card và 20.000.000 Gold.
- Trade hết hạn sau 3 phút, chuyển sang `EXPIRED` và mở khóa Card.
- `/trade user:<user>` dùng buttons và modal để sửa Card, Gold, confirm hoặc cancel;
  không dùng các subcommand riêng cho từng thao tác.
- Market fee luôn bằng 0. Card đang được listing không thể vào Lineup hoặc Battle;
  Card đang trong Lineup phải được tháo trước khi listing.

- A new Trade starts as an invitation. Both participants must press Accept
  before Card or Gold offers can be edited.
- Card and Gold modals require an `add` or `remove` action. Offer changes remain
  atomic and clear both final confirmations.
- Trade controls remain active for the Trade's three-minute lifetime instead
  of using the shared ten-second component timeout.

## Compact Reward Responses

- Successful `/claim` and `/daily` responses are one English text line stating
  only the resources received.
- Active cooldown responses are plain English text with Discord's relative
  availability timestamp.

## Future Card Stats Direction

The proposed future Card stat set is Three Point, Mid Range, Finishing,
Playmaking, Interior Defending, Perimeter Defending, and Strength. The current
database schema and Battle implementation remain unchanged until Card data and
Battle formulas are ready for a coordinated migration.
