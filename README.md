# Basketball Discord Bot — Game Requirements Draft v0.1

> **Status:** Draft for review  
> **Purpose:** Khóa các requirement cốt lõi trước khi thiết kế database và architecture.  
> **Theme Direction:** Basketball card collecting game sử dụng **cầu thủ NBA thật** làm nhân vật/thẻ bài. Không sử dụng phong cách cyberpunk/futuristic.  
> **Important:** Đây là tài liệu thiết kế sản phẩm, không phải tư vấn pháp lý. Phần IP bên dưới nhằm giảm rủi ro, không thể đảm bảo “100% không bị claim”.

---

# 1. Product Vision

Xây dựng một Discord game kết hợp:

- Collectible Card Game (CCG)
- Gacha / card collecting
- Team building
- Basketball auto-battler
- Player-to-player marketplace
- Progression / upgrade
- Seasonal economy

Core loop:

```text
Claim / Daily / Pack
        ↓
Acquire Card
        ↓
Collection
        ↓
Build Lineup
        ↓
Battle
        ↓
Earn Rewards
        ↓
Upgrade / Market / Open More Packs / Trade
        ↓
Repeat
```

Game ưu tiên:

1. Thu thập cầu thủ.
2. Săn card hiếm.
3. Xây dựng đội hình.
4. Thi đấu với AI hoặc người chơi.
5. Giao dịch card trên market/trade.
6. Tạo giá trị cho những card hiếm hoặc serial thấp.

---

# 2. Player Data

Mỗi Discord user có một `Player Account`.

## 2.1 Core Player Data

```text
player_id
discord_user_id
username_snapshot
created_at
last_active_at
```

## 2.2 Economy Data

```text
gold_balance
shard_balance
```

> Khuyến nghị: balance có thể cache trong Player/Wallet table, nhưng mọi thay đổi tiền đều phải có Economy Transaction Log.

## 2.3 Progression Data

Draft:

```text
level
xp
games_played
games_won
games_lost
current_win_streak
highest_win_streak
```

### Draft Rule

- Player Level ban đầu không ảnh hưởng trực tiếp tới card stats.
- Level dùng để:
  - unlock features;
  - reward progression;
  - mở một số pack;
  - cosmetic/status rewards sau này.

## 2.4 Cooldown Data

```text
last_claim_at
last_daily_at
last_free_pack_at
```

Không nên dựa hoàn toàn vào Discord message timestamp.

Server/database phải là source of truth.

---

# 3. Card System

Card system được chia thành:

```text
Card Template
       ↓
Card Instance
```

Đây là hai entity khác nhau.

---

# 4. Card Template

`Card Template` mô tả một phiên bản cầu thủ có thể xuất hiện trong game.

Ví dụ:

```text
LeBron James
2026 Base Edition
Legendary
SF/PF
```

Không đại diện cho một card cụ thể thuộc sở hữu của user.

## 4.1 Proposed Fields

```text
card_template_id

player_name

edition
season
team_reference

primary_position
secondary_position

rarity

overall

inside_scoring
mid_range
three_point
playmaking
perimeter_defense
interior_defense
rebounding
athleticism

height
weight

traits

packable
release_date
retired_at
```

## 4.2 Stats

Draft sử dụng các nhóm stat:

| Stat | Meaning |
|---|---|
| Inside Scoring | Finishing gần rổ |
| Mid Range | Khả năng ghi điểm trung bình |
| Three Point | Ném 3 |
| Playmaking | Passing + ball handling |
| Perimeter Defense | Phòng thủ perimeter |
| Interior Defense | Phòng thủ trong paint |
| Rebounding | Rebound |
| Athleticism | Speed / strength / explosiveness |

`overall` không nhất thiết phải là trung bình cộng đơn giản.

OVR sẽ được tính theo position weighting.

Ví dụ:

```text
PG:
Playmaking có trọng số cao hơn Interior Defense.

C:
Interior Defense + Rebounding có trọng số cao hơn Playmaking.
```

Công thức cụ thể sẽ được khóa trong Battle System Design.

---

# 5. Card Instance

Mỗi lần một Card Template được pack/drop, hệ thống tạo một `Card Instance`.

Ví dụ:

```text
card_instance_id: 78329518
template: LeBron James — 2026 Base
owner: DiscordUser123
serial_number: 184
obtained_from: PACK
obtained_at: ...
```

## 5.1 Proposed Fields

```text
card_instance_id
card_template_id
owner_player_id

serial_number

level
upgrade_level

ownership_cycles
games_played

obtained_method
obtained_at

locked
listed_on_market
```

## 5.2 Serial Number / Circulation

Mỗi template có circulation count.

Ví dụ:

```text
Stephen Curry — Legendary

#1
#2
#3
...
#384
```

Card Instance sẽ lưu:

```text
serial_number = 384
```

Thay vì chỉ hiển thị:

```text
Amount Packed = 384
```

đề xuất hiển thị:

```text
Serial #384
Circulating: 384
```

Serial thấp có thể tạo giá trị collector nhưng **không mặc định tăng combat stats**.

---

# 6. Rarity System

Draft rarity:

```text
COMMON
UNCOMMON
RARE
EPIC
LEGENDARY
MYTHIC
```

## 6.1 Draft Pack Probability

| Rarity | Base Probability |
|---|---:|
| Common | 42% |
| Uncommon | 28% |
| Rare | 17% |
| Epic | 8% |
| Legendary | 4% |
| Mythic | 1% |

> Đây chỉ là starting balance, sẽ phải simulation economy trước khi final.

## 6.2 Rarity Meaning

Rarity không chỉ quyết định OVR.

Nó có thể ảnh hưởng:

- Base stat range
- Trait count
- Trait tier
- Circulation limit
- Quicksell value
- Upgrade cost
- Visual presentation
- Pack probability

Không nên thiết kế:

```text
Common = luôn yếu
Mythic = luôn mạnh tuyệt đối
```

Một Rare role-player tốt vẫn có thể hữu ích trong một lineup phù hợp.

---

# 7. Pack System

Draft có 4 loại pack.

## 7.1 Free Pack

Command:

```text
/pack
```

Draft:

- Cooldown: **15 phút**
- Cost: Free
- Reveal: **3 cards**
- Player chọn **1 card**
- Hai card còn lại bị discard
- Có timeout để chọn card

Draft timeout:

```text
30 seconds
```

Nếu timeout:

```text
No card awarded
```

> Có thể thay thành auto-pick sau khi playtest.

---

## 7.2 Standard Pack

Purchased bằng Gold.

Draft:

```text
Cost: 2,500 Gold
Cards revealed: 3
Cards kept: 1
```

Rarity odds tốt hơn Free Pack một ít.

---

## 7.3 Premium Pack

Draft:

```text
Cost: 10,000 Gold
Cards revealed: 5
Cards kept: 1
Guaranteed: Rare+
```

---

## 7.4 Event Pack

Chỉ xuất hiện trong:

- Seasonal event
- Special challenge
- Limited release
- Tournament

Có card pool riêng.

---

# 8. Duplicate Cards

User **được phép sở hữu nhiều Card Instance của cùng một Card Template**.

Ví dụ:

```text
LeBron Base #103
LeBron Base #392
LeBron Base #511
```

là ba card khác nhau.

Duplicate có thể được:

- giữ;
- bán Market;
- quicksell;
- dùng làm upgrade material;
- exchange.

Không auto-convert duplicate thành Shards.

---

# 9. Collection Limit

Draft:

```text
Default Collection Capacity: Unlimited
```

Lý do:

Collection limit có thể tạo UX khó chịu không cần thiết trong giai đoạn đầu.

Nếu sau này database/storage hoặc economy yêu cầu:

```text
Base Slots: 500
Expandable Slots: optional
```

nhưng **không implement trong MVP**.

---

# 10. Currency System

Game sử dụng:

```text
Gold
Shards
```

---

# 11. Gold

Gold là currency chính.

## 11.1 Gold Sources

Draft:

```text
/claim
/daily

battle rewards
challenges
achievements
season rewards
selling cards on market
```

## 11.2 Gold Sinks

```text
paid packs
market purchases
upgrade fee
market listing fee
future event entry fee
```

Market transaction cần fee để chống inflation.

Draft:

```text
Market Tax: 5%
```

---

# 12. Shards

Shards là crafting/resource currency.

## 12.1 Shard Sources

Primary source:

```text
/quicksell
```

Secondary sources có thể gồm:

```text
events
battle milestones
duplicate exchange
season rewards
```

## 12.2 Shard Sinks

```text
/exchange
upgrade materials
special packs
trait-related items
event items
```

Gold và Shards không convert trực tiếp hai chiều trong MVP.

---

# 13. Reward Commands

## 13.1 /claim

Draft:

```text
Cooldown: 15 minutes
Reward: Gold
```

Starting reward:

```text
250–400 Gold
```

Có thể random trong range.

Không reward Card trực tiếp.

---

## 13.2 /daily

Draft:

```text
Cooldown: 20 hours
```

Không dùng đúng 24h để giảm việc reward time bị trôi dần.

Draft reward:

```text
2,000 Gold
+
small chance of Shards
```

Future:

```text
Daily Streak
```

không implement ở MVP.

---

## 13.3 /pack

Draft:

```text
Cooldown: 15 minutes
```

`/claim` và `/pack` là **hai cooldown độc lập**.

Ví dụ:

```text
12:00 /claim
12:03 /pack

12:15 /claim available
12:18 /pack available
```

---

# 14. Quicksell

Command:

```text
/quicksell
```

Quicksell phá hủy Card Instance vĩnh viễn và trả Shards.

## 14.1 Draft Value

| Rarity | Shards |
|---|---:|
| Common | 5 |
| Uncommon | 12 |
| Rare | 30 |
| Epic | 75 |
| Legendary | 200 |
| Mythic | 500 |

Có thể thêm bonus dựa trên:

```text
upgrade_level
special edition
```

Nhưng **không thêm bonus theo market price**, tránh exploitable feedback loop.

## 14.2 Confirmation

Rare+ yêu cầu confirmation trước khi quicksell.

Legendary/Mythic có thể yêu cầu:

```text
/quicksell confirm
```

hoặc Discord confirmation button.

---

# 15. Upgrade System

Card Instance có:

```text
upgrade_level
```

Draft:

```text
+0
+1
+2
+3
+4
+5
```

## 15.1 Upgrade Cost

Upgrade cần:

```text
Gold
+
Duplicate Card hoặc Upgrade Material
```

Draft flow:

```text
Main Card
+
same Card Template duplicate
+
Gold
↓
Upgrade
```

Ví dụ:

```text
LeBron #103 +0
+
LeBron #392
+
5,000 Gold
↓
LeBron #103 +1
```

Card #392 bị destroy.

## 15.2 Upgrade Effect

Upgrade tăng một lượng stat nhỏ.

Không nên:

```text
+1 = +5 tất cả stats
```

Draft:

```text
mỗi level tăng effective battle rating khoảng 1–2%
```

Mục tiêu:

Upgrade có giá trị nhưng không làm base rarity mất ý nghĩa.

---

# 16. Marketplace

MVP sử dụng:

```text
Fixed-price marketplace
```

Chưa implement auction trong v1.

Commands conceptually:

```text
/market
/sell
/buy
/cancel
```

## 16.1 Sell Flow

```text
Seller selects Card Instance
        ↓
Choose price
        ↓
Card is locked
        ↓
Market Listing created
```

Card đã list:

```text
cannot quicksell
cannot upgrade
cannot battle
cannot transfer
```

cho tới khi listing bị cancel hoặc sold.

## 16.2 Buy Flow

Purchase phải chạy trong **database transaction**.

Atomic operation:

```text
check listing ACTIVE
check buyer gold

debit buyer
credit seller
change ownership
mark listing SOLD
create economy logs
```

Nếu một bước fail:

```text
rollback everything
```

## 16.3 Market Fee

Draft:

```text
5%
```

Ví dụ:

```text
Sale price = 10,000 Gold
Seller receives = 9,500 Gold
500 Gold removed from economy
```

---

# 17. Lineup

Primary competitive mode:

```text
5v5
```

Lineup có 5 slots:

```text
PG
SG
SF
PF
C
```

## 17.1 Position Eligibility

Card có:

```text
primary_position
secondary_position
```

Draft:

Player có thể chơi:

```text
Primary Position → no penalty
Secondary Position → no penalty
Other Position → not allowed
```

MVP không implement out-of-position penalty.

## 17.2 Bench

MVP:

```text
No bench
```

Future:

```text
5 starters
+
3–5 bench cards
```

---

# 18. Battle System

Battle là auto-simulation.

Initial modes:

```text
5v5 vs AI
5v5 PvP asynchronous
```

3v3 có thể implement sau.

---

# 19. Battle Stats

Battle sử dụng:

```text
Inside Scoring
Mid Range
Three Point
Playmaking
Perimeter Defense
Interior Defense
Rebounding
Athleticism
```

Ngoài ra:

```text
position
height
traits
upgrade level
```

có thể ảnh hưởng probability.

---

# 20. Battle Possession Model

Một possession conceptually:

```text
Select offensive player
        ↓
Select offensive action
        ↓
Determine defender
        ↓
Calculate matchup
        ↓
Calculate shot / turnover probability
        ↓
Resolve result
        ↓
If miss → rebound
        ↓
Next possession
```

Possible actions:

```text
Drive
Layup
Dunk
Mid-range
Three-pointer
Post-up
Pass
Isolation
Pick-and-roll
```

Không cần implement tất cả ngay MVP.

Initial action set:

```text
Inside Shot
Mid-range Shot
Three-pointer
Pass
```

---

# 21. Battle Formula Principles

Không dùng pure OVR comparison.

Bad:

```text
Team OVR 90 > Team OVR 85
→ Team 90 automatically wins
```

Preferred:

```text
player attributes
+
defender attributes
+
lineup composition
+
traits
+
small controlled randomness
```

Draft:

```text
Outcome =
Skill Component
+
Matchup Component
+
Trait Modifier
+
Small RNG Component
```

RNG phải đủ để tạo upset nhưng không biến battle thành coin flip.

Target:

```text
Stronger team should win most,
but not all, matches.
```

---

# 22. Battle Output

Battle trả:

## 22.1 Score

```text
Team A 92
Team B 87
```

## 22.2 Play-by-play

Ví dụ Cyperdunk/Basketball Bot tự viết:

```text
Curry creates separation beyond the arc.
The defender closes late.
Curry fires from three.
GOOD — 3 points.
```

Không copy narration/string từ Basketbot.

## 22.3 Box Score

Per card:

```text
PTS
REB
AST
STL
BLK
TOV
FG
3PT
```

Future:

```text
+/-
minutes
fouls
```

---

# 23. Battle Rewards

Draft PvE rewards:

### Loss

```text
100 Gold
10 XP
```

### Win

```text
250 Gold
25 XP
```

### Upset / Difficult AI

Có thể modifier:

```text
x1.2
x1.5
x2.0
```

Không reward card trực tiếp sau mỗi game để tránh card inflation.

Cards nên chủ yếu đi vào economy thông qua:

```text
packs
events
special rewards
```

---

# 24. Traits

Trait là passive mechanic ảnh hưởng battle.

Ví dụ generic:

```text
Sharpshooter
Rim Protector
Floor General
Clutch Scorer
Glass Cleaner
Lockdown Defender
Slasher
Sixth Sense
```

> Tên trait và description phải do project tự thiết kế; tránh copy naming/wording đặc trưng của Basketbot.

Trait có thể có tier:

```text
I
II
III
```

Draft:

```text
Common: 0–1 trait
Uncommon: 1
Rare: 1–2
Epic: 2
Legendary: 2–3
Mythic: 3+
```

---

# 25. Card Ownership History

Card Instance có thể đổi chủ nhiều lần.

Cần lưu:

```text
card_ownership_history
```

Ví dụ:

```text
Card #89322

Packed by Player A
↓
Sold to Player B
↓
Sold to Player C
```

Card details có thể hiển thị:

```text
Original owner
Current owner
Ownership cycles
Date first packed
```

---

# 26. Economy Ledger

Mọi thay đổi currency phải tạo immutable transaction.

Example:

```text
transaction_id
player_id
currency
amount
transaction_type
reference_id
created_at
```

Example records:

```text
+300 GOLD     CLAIM
+2000 GOLD    DAILY
-2500 GOLD    PACK_PURCHASE
+9500 GOLD    MARKET_SALE
-10000 GOLD   MARKET_PURCHASE
```

Không chỉ update:

```text
users.gold = users.gold + 300
```

mà không có ledger.

---

# 27. MVP Feature Scope

MVP Phase 1:

```text
/player
/profile

/claim
/daily

/pack

/card
/collection

/lineup

/challenge-ai

/quicksell
```

Phase 2:

```text
/market
/sell
/buy

/upgrade
```

Phase 3:

```text
PvP
Traits expansion
Events
Exchange
Season system
Leaderboards
```

---

# 28. Intellectual Property Strategy

## 28.1 Objective

Mục tiêu không phải là:

> “đổi UI để Basketbot không thể copyright strike.”

Mục tiêu đúng phải là:

> **Xây dựng một implementation độc lập của cùng thể loại/game mechanics, không copy copyrightable expression của Basketbot.**

Gameplay idea hoặc method of play nhìn chung không được copyright bảo hộ theo U.S. Copyright Office.

Tuy nhiên các phần như:

- source code;
- artwork;
- photographs;
- text;
- rule text có tính sáng tạo;
- custom battle narration;
- custom card visual;
- UI artwork;
- original assets;

có thể được bảo hộ.

---

# 29. Basketbot Clean-Room Rules

Để giảm khả năng Basketbot có claim hợp lý, project áp dụng các rule sau.

## Rule 1 — Never copy source code

Không:

```text
copy repository
copy decompiled code
copy leaked code
translate code line-by-line sang language khác
```

Toàn bộ implementation phải viết từ requirement của project này.

---

## Rule 2 — Mechanics may inspire requirements, not implementation

Allowed example:

```text
Observed:
Basketbot cho user chọn 1 trong 3 cards.

Requirement:
Our free pack reveals 3 candidate cards and allows one selection.
```

Không copy:

```text
exact timing
exact probability
exact strings
exact interaction flow
exact data structure
```

một cách máy móc chỉ vì Basketbot đang dùng chúng.

---

## Rule 3 — Independent UI

Không chỉ đổi:

```text
blue → red
Basketbot → OurBot
```

UI phải có information hierarchy riêng.

Thiết kế riêng:

```text
card detail
collection
pack reveal
market
lineup
battle result
```

---

## Rule 4 — Independent Copywriting

Không copy:

```text
battle narration
error text
help commands
tooltips
trait descriptions
market descriptions
card descriptions
```

Ngay cả khi mechanic tương tự.

---

## Rule 5 — Independent Trait System

Không lấy nguyên:

```text
trait names
trait tiers
trait descriptions
trait formulas
```

nếu chúng là hệ thống đặc trưng do Basketbot tự thiết kế.

Có thể dùng basketball archetype generic như:

```text
Sharpshooter
Rim Protector
Playmaker
Slasher
```

nhưng wording/formula phải tự thiết kế.

---

## Rule 6 — Do not copy proprietary balancing tables

Không cố clone chính xác:

```text
pack rates
quicksell values
cooldowns
battle coefficients
rarity thresholds
upgrade costs
```

nếu chỉ lấy bằng cách reverse-engineer Basketbot.

Có thể dùng Basketbot làm benchmark UX/game design, sau đó tự balance bằng simulation/playtesting.

---

## Rule 7 — Preserve development evidence

Dùng Git từ ngày đầu.

Commit history giúp thể hiện independent development:

```text
requirements
design
schema
implementation
tests
balance changes
```

Lưu:

```text
Game Requirements
Architecture Decision Records
ERD versions
formula drafts
Git commits
```

Nếu có tranh chấp, lịch sử development độc lập hữu ích hơn rất nhiều so với việc chỉ nói “tôi tự code”.

---

# 30. Important: Using Real NBA Players

Project hiện muốn sử dụng **cầu thủ NBA thật**.

Điều này tạo một nhóm risk **khác hoàn toàn** với Basketbot.

Basketbot không sở hữu:

```text
LeBron James
Stephen Curry
Victor Wembanyama
```

chỉ vì họ đưa những cầu thủ đó vào bot trước.

Nhưng điều đó **không đồng nghĩa chúng ta tự động có quyền sử dụng mọi thứ liên quan tới NBA/cầu thủ.**

---

# 31. NBA Player Name vs Photo vs Logo

Cần tách riêng:

## A. Player factual information

Ví dụ:

```text
Stephen Curry
Position: PG
Height: ...
```

Facts và tên đơn thuần không được copyright bảo hộ theo cách một tác phẩm sáng tạo được bảo hộ.

Tuy nhiên việc khai thác tên/likeness của người thật trong sản phẩm thương mại có thể liên quan tới **right of publicity / personality rights**, tùy jurisdiction.

---

## B. Player photographs

Không lấy ảnh từ:

```text
Google Images
NBA.com
ESPN
Getty
Basketbot
sports news websites
```

rồi assume là free.

Photograph thường có copyright riêng của photographer/agency/rightsholder.

Basketbot sử dụng một ảnh không làm ảnh đó trở thành public domain.

---

## C. NBA/team logos

Không sử dụng:

```text
NBA logo
Lakers logo
Warriors logo
official team marks
official card branding
```

nếu không có license phù hợp.

Trademark là một issue khác với copyright.

---

## D. Jerseys

Ảnh/illustration có:

```text
official team logos
sponsor marks
NBA branding
```

có thể tăng trademark/licensing risk.

---

# 32. Recommended Asset Strategy

Nếu vẫn sử dụng NBA players, risk-reduction strategy tốt hơn là:

### MVP

Dùng **text-first card presentation**:

```text
STEPHEN CURRY
PG
OVR 94

3PT      99
PLAY     94
INSIDE   82
...
```

Không cần player photograph ở phiên bản đầu.

### Later

Nếu muốn có hình cầu thủ:

```text
obtain appropriate licensed assets
```

hoặc kiểm tra legal/licensing strategy trước khi public/monetize.

Không lấy hình trực tiếp từ Basketbot.

---

# 33. Real Player Likeness Risk

Nếu dùng illustration tự vẽ nhưng vẫn mô tả rõ một cầu thủ thật, điều đó có thể giải quyết copyright của **photograph**, nhưng không tự động giải quyết mọi vấn đề liên quan tới **name/likeness/publicity rights**.

Đặc biệt khi game:

```text
sells packs
has premium currency
runs ads
has subscriptions
```

risk profile sẽ cao hơn một hobby/test project.

Trước khi commercial release nên review IP/licensing với luật sư phù hợp jurisdiction.

---

# 34. Branding Strategy

Bot phải có identity riêng.

Không dùng tên hoặc logo dễ tạo impression rằng project liên quan tới:

```text
Basketbot
NBA official product
NBA 2K
Panini
Topps
```

Project cần:

```text
unique bot name
unique logo
unique card design
unique terminology
unique help pages
unique visual language
```

Không sử dụng:

```text
"Official NBA..."
```

nếu không có authorization.

---

# 35. What Basketbot Can and Cannot Reasonably Be Treated As

## We may take inspiration from:

```text
card collection concept
3-card choice concept
rarity system concept
marketplace concept
lineup concept
auto-battle concept
box score concept
serial/circulation concept
ownership history concept
```

Các concept này sẽ được thiết kế và implement lại độc lập.

## We must not copy:

```text
Basketbot source code
Basketbot database
Basketbot images
Basketbot logo
Basketbot card frames
Basketbot original text
Basketbot exact battle narration
Basketbot custom icons/assets
Basketbot unique trait descriptions
Basketbot UI pixel-for-pixel
```

---

# 36. Practical Risk Model

Có ba nhóm risk khác nhau:

```text
A. Basketbot IP
B. NBA/team IP
C. Player/photo/likeness rights
```

Việc tránh nhóm A **không tự động giải quyết B và C**.

Ví dụ:

```text
100% independently coded
+
NBA photograph used without appropriate rights
```

vẫn có thể tạo IP issue.

Ngược lại:

```text
licensed player photo
+
Basketbot source code copied
```

vẫn tạo Basketbot copyright issue.

Hai vấn đề độc lập.

---

# 37. Initial Technical Milestones

Sau khi document này được final:

```text
M0 — Discord Bot Online
M1 — Project Architecture
M2 — PostgreSQL + Player
M3 — Economy Ledger
M4 — Card Template / Instance
M5 — Pack
M6 — Collection
M7 — Claim / Daily
M8 — Lineup
M9 — Battle MVP
M10 — Quicksell
M11 — Market
M12 — Upgrade
M13 — Advanced Battle / Traits
M14 — Events / Seasons
M15 — Production Security / Anti-abuse
```

---

# 38. Decisions Still To Finalize

Các câu hỏi cần review ở version tiếp theo:

### Card

- [ ] Giữ 8 stats hay giảm xuống 4–6?
- [ ] OVR scale 1–99?
- [ ] Có Season/Edition riêng cho cùng cầu thủ?
- [ ] Có hard circulation cap cho card hiếm?
- [ ] Serial thấp có bonus hay chỉ collector value?

### Rarity

- [ ] 6 rarity tiers có quá nhiều?
- [ ] Mythic có nên tồn tại?
- [ ] Rarity odds final?

### Pack

- [ ] `/pack` 15 phút?
- [ ] Reveal 3, chọn 1?
- [ ] Timeout 30 giây?
- [ ] Timeout mất card hay random card?
- [ ] Paid Pack structure?

### Economy

- [ ] `/claim` 15 phút?
- [ ] `/daily` 20 giờ?
- [ ] Claim reward?
- [ ] Daily reward?
- [ ] Market tax 5%?
- [ ] Quicksell values?

### Upgrade

- [ ] Upgrade max +5?
- [ ] Có cần exact duplicate hay chỉ cùng rarity?
- [ ] Upgrade tăng raw stats hay hidden modifier?

### Lineup

- [ ] Chỉ 5 starters hay có bench?
- [ ] Có coach/team chemistry?
- [ ] Có duo/synergy ngay v1 hay để sau?

### Battle

- [ ] 5v5 là mode chính?
- [ ] Game simulated theo possessions hay simplified rounds?
- [ ] Có player fatigue?
- [ ] Có substitutions?
- [ ] PvP live hay asynchronous?
- [ ] Reward win/loss final?

### NBA/IP

- [ ] Project chỉ private/testing hay public?
- [ ] Có monetization?
- [ ] Có sử dụng player images không?
- [ ] Asset source/license strategy?
- [ ] Có sử dụng team names không?
- [ ] Có sử dụng team logos không?

---

# 39. Draft Recommended MVP

Để tránh scope quá lớn, first playable version chỉ cần:

```text
/profile
/claim
/daily
/pack
/collection
/card
/lineup
/challenge-ai
```

Data:

```text
Player
Wallet
Economy Transaction
Card Template
Card Instance
Lineup
Match
```

Không implement ngay:

```text
Market
PvP
Auction
Exchange
Season
Advanced traits
Advanced upgrade
Guild/team system
```

Mục tiêu first playable:

```text
New User
  ↓
Claim
  ↓
Open Pack
  ↓
Receive unique Card Instance
  ↓
View Collection
  ↓
Build 5-player lineup
  ↓
Battle AI
  ↓
Receive Gold/XP
```

Nếu loop này fun và architecture ổn, mới mở rộng economy.

---

# 40. Legal / IP Reference Notes

Các nguyên tắc dùng trong phần IP của draft dựa trên những nguồn sau:

1. **U.S. Copyright Office — Games**  
   Game idea và methods of play nói chung không được copyright bảo hộ; phần text/artistic expression cụ thể có thể được bảo hộ.

2. **U.S. Copyright Office — Computer Programs**  
   Copyright có thể bảo hộ copyrightable expression trong software, nhưng không bảo hộ ideas, program logic, algorithms, systems hoặc methods.

3. **U.S. Copyright Office — What is Copyright?**  
   Copyright bảo hộ original works of authorship; independent creation là yếu tố quan trọng.

4. **USPTO — Trademark Basics / Likelihood of Confusion**  
   Trademark bảo vệ source-identifying names/logos/marks và có thể phát sinh vấn đề khi branding tạo likelihood of confusion.

5. **California Civil Code §3344**  
   Là một ví dụ cho thấy một số jurisdiction có luật riêng về commercial use của name, voice, photograph hoặc likeness của người thật.

> Vì game Discord có thể phục vụ user ở nhiều quốc gia, không nên xem luật của một jurisdiction là câu trả lời toàn cầu.

---

# 41. Draft Conclusion

Project sẽ theo nguyên tắc:

> **Same genre / similar mechanics is acceptable design inspiration; implementation and creative expression must be ours.**

Với Basketbot:

```text
Observe mechanic
      ↓
Document requirement
      ↓
Redesign UX
      ↓
Design own formula
      ↓
Write own architecture
      ↓
Write own source code
      ↓
Create own assets/text
```

Với NBA/player content:

```text
Do not assume:
"Basketbot uses it → we can use it."

Instead:
separately evaluate
player names
photos
logos
team marks
likeness
commercial use
```

Đây là baseline để review trước khi chuyển sang **System Architecture + Database Design**.
