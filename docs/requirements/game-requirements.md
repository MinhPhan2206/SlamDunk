# Game Requirements

## Supporting Balance Documents

- [Economy, Pack Odds, and Progression Baseline](economy-pack-baseline.md) —
  provisional values for simulation and playtesting; not final production
  requirements.

## Confirmed Claim Rules

- `/claim` has a 30-minute cooldown.
- Each successful claim awards a uniformly random integer from 300 through 500
  Gold, inclusive.
- Cooldown state, Wallet credit, and EconomyTransaction history must be updated
  atomically in PostgreSQL.
- Retrying the same Discord interaction must not award Gold twice.

## Supporting Commands

- `/cooldowns` reports cooldown availability using PostgreSQL time as the source
  of truth. It currently reports `CLAIM` and `FREE_PACK`; Daily and Weekly can
  be added when those reward systems exist.
- `/rarity` accepts a numeric rarity tier from 1 through 7 and lists Card
  Templates in that tier. Tier 7 is Hall of Fame. Names for Tiers 1 through 6
  remain TBD.
- `/rarity` lists template definitions, not Card Instances owned by a Player.

## M9 Free Drop Behavior

- `/pack` creates a persisted Free Drop offer containing three distinct,
  packable, non-retired Card Templates.
- The Player chooses one candidate; only that candidate becomes a Card Instance.
- The new Card Instance receives a random initial Card Level from 1 through 5.
- Candidate selection, Card Instance minting, ownership history, mint counters,
  PackSession completion, and cooldown update are atomic in PostgreSQL.
- Replaying the same selection must return the existing result and must not mint
  another Card Instance.
- An open offer is reused when `/pack` is called again. M9 does not expire or
  reroll an abandoned offer because timeout behavior remains TBD.
- The current playtest configuration uses a 15-minute Free Drop cooldown, three
  candidates, and the provisional Tier 1–7 weights in
  `economy-pack-baseline.md`. These remain adjustable simulation values rather
  than finalized production balance.

## M12 Battle MVP Behavior

- `/battle` runs a persisted `PVE_5V5` simulation using the Player's complete
  active lineup against an AI lineup selected from the Card catalog.
- Match and player snapshots preserve historical results, and the Discord
  interaction ID prevents duplicate matches and counter updates.
- The current offense/defense rating formula, AI Card Level 3, Level bonus, and
  score variance are centralized playtest configuration, not final balance.
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

## M16 Direct Trade Behavior

- Direct Trade có đúng hai Player và có thể chứa Card cùng Gold tuỳ chọn.
- Trade fee bằng 0.
- Card được thêm vào offer sẽ bị trade-lock cho đến khi remove, cancel hoặc
  Trade hoàn tất.
- Mọi thay đổi Card hoặc Gold offer đều xoá confirmation của cả hai bên.
- Khi cả hai xác nhận final offer, Gold và Card ownership được chuyển trong
  cùng một PostgreSQL transaction.
- Giới hạn số Card, giới hạn Gold/Card cuối cùng và trade expiry vẫn là TBD.
