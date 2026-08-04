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
