# SlamDunk — Project Handoff and Release Readiness

> Cập nhật: 2026-08-25  
> Mục đích: giúp coding agent mới hiểu nhanh sản phẩm hiện có, các ranh giới kiến trúc
> và công việc còn lại trước public release.

## 1. Cách sử dụng tài liệu này

Đây là tài liệu tổng quan tại một thời điểm, không thay thế các nguồn chi tiết.
Khi có khác biệt, sử dụng thứ tự sau:

1. Runtime code, migrations và automated tests cho hành vi đang chạy.
2. `docs/architecture/` cho ranh giới kiến trúc và transaction rules.
3. `docs/release-blockers.md` cho trạng thái release blocker chi tiết.
4. `docs/requirements/` cho yêu cầu game đã chốt.
5. `PROJECT_CONTEXT.md` cho lịch sử quyết định; một số balance và flow trong đó đã cũ.

Trước khi thay đổi gameplay hoặc persistence, agent phải kiểm tra implementation và
tài liệu trực tiếp liên quan. Không tự ý thiết kế lại kiến trúc hoặc triển khai một
blocker khác ngoài phạm vi được giao.

## 2. Tổng quan sản phẩm

SlamDunk là Discord basketball collectible card game. Người chơi thu thập Card,
xây dựng nhiều Lineup, điều chỉnh Strategy, đấu AI hoặc Duel với người chơi khác,
nâng cấp Card và giao dịch qua Market/Direct Trade.

Tech stack hiện tại:

- Node.js và JavaScript ES Modules;
- `discord.js` cho slash command, component và prefix command;
- PostgreSQL truy cập trực tiếp qua `pg`;
- `dotenv` cho local configuration;
- `sharp` cho Card composite và Battle report image;
- Node built-in test runner, không có ORM hoặc web framework.

Kiến trúc là **Modular Monolith**:

```text
Discord interaction/message
        -> bot command/component/event adapter
        -> domain service
        -> repository
        -> PostgreSQL
```

Discord UI nằm trong `src/bot/`. Domain behavior nằm trong `src/modules/`.
Repository chịu trách nhiệm SQL. Các mutation liên quan tài sản phải chạy trong
transaction, khóa đúng row và giữ idempotency.

## 3. Bề mặt tương tác hiện tại

Slash commands đang được đăng ký từ `src/bot/commands/index.js`. Prefix mặc định
là `sd` và có alias ngắn, ví dụ `sd d`, `sd pk`, `sd col`, `sd b`, `sd pr`,
`sd vs`, `sd cd`, `sd w` và `sd inv`. Slash command vẫn là giao diện chính.

Các nhóm chức năng đã có:

| Nhóm | Chức năng chính |
|---|---|
| Foundation | `/ping`, startup validation, graceful shutdown, guild/global command registration |
| Player | `/welcome`, `/profile`, `/wallet`, `/bag`, Player Level và XP |
| Rewards | `/claim`, `/daily`, `/weekly`, `/level-rewards`, cooldown/charge persistence |
| Gacha | `/drop`, `/pack`, `/odds`, `/contract`, Pack batch 1–100 |
| Cards | `/card`, `/compare`, `/rarity`, `/collection`, `/sort`, `/lock`, `/unlock` |
| Team | `/lineup view/set/remove/swap`, ba saved Lineups, `/strategy` và per-player Tendencies |
| Competition | `/battle`, `/practice`, `/duel`, seeded Battle Engine, playback và PNG postgame report |
| Economy | immutable Gold ledger, Shards/Item inventory audit, `/exchange`, `/quicksell` |
| Upgrade | interactive `/upgrade` Fusion và `/level-up` với review/confirm |
| Trading | `/market`, `/sell`, `/unlist`, `/buy`, interactive `/trade` với Card, Gold và Item escrow |
| Help | `/help` theo tab và prefix command guide |

`/vote` có implementation nhưng hiện không nằm trong active command registry; không
coi Top.gg reward là một chức năng public cho tới khi được bật lại có chủ đích.

## 4. Các hệ thống đã triển khai

### 4.1 Player, economy và progression

- Player/Wallet được persist trong PostgreSQL.
- Gold thay đổi qua immutable economy ledger.
- Shards và Items có immutable transaction audit.
- XP nhận từ Battle, Daily và Weekly; Level bắt đầu từ 0 và yêu cầu thêm
  `1,000 * nextLevel` XP cho cấp kế tiếp.
- Level rewards hiện được định nghĩa đến Level 30.
- Development Daily đang cố ý trả tài nguyên rất lớn để test Pack. Production
  profile dùng Daily `1,500–2,000 Gold` và `20–30 Shards`.
- Claim và Drop tích tối đa hai charge, mỗi charge hồi sau 15 phút.

Mọi balance phải lấy từ `src/config/game-config.js` thông qua economy profile.
Không sao chép giá trị balance sang presenter hoặc command.

### 4.2 Card và collection

- Rarity catalog: Base, Common, Uncommon, Alpha, All-Star, Superstar và GOAT.
- Card Template lưu thông tin cầu thủ, vị trí, chiều cao, Stats và Traits.
- Card Instance có public ID chín chữ số, Level 1–5, owner, lock state, serial và
  ownership history.
- Actual Stat được suy ra từ Template Stat và Card Level; không nhân bản toàn bộ
  Stats vào Card Instance.
- Collection có pagination, persistent sorting và secondary alphabetical sort.
- Một Card không được chiếm nhiều vị trí trong cùng Lineup.
- Market-listed hoặc trade-locked Card không được đưa vào Lineup/gameplay.
- Account-bound Card không thể Market, Trade hoặc Quicksell; trạng thái bound được
  giữ qua Fusion.
- Runtime artwork dùng WebP tối đa 480×800 và fallback `unknown-player.webp`.

### 4.3 Drop, Pack và Contract

- Free Drop sinh ba candidate; người chơi chọn một Card, timeout tự chọn candidate 1.
- Standard Pack dùng Gold, mở ba Card; Super Pack dùng Shards, mở một Card.
- Batch Pack hỗ trợ 1–100 Packs và replay idempotent theo Discord interaction.
- Card Level dùng weighted roll giảm dần từ Level 1 đến Level 5.
- Alpha Contract và All-Star Contract ký một Card đúng rarity với Level ngẫu nhiên.
- Odds được cấu hình bằng integer weights theo từng product.

Giá, odds và test rewards hiện vẫn có thể thay đổi trong balancing. Agent không được
coi giá trị trong tài liệu lịch sử là authoritative.

### 4.4 Battle, Practice và Duel

- Battle Engine hiện là seeded, deterministic, possession-based, first-to-21 và
  phải thắng cách biệt hai điểm.
- Engine có Stats, Traits Level I–V, per-player Tendencies, Strategy, action chains,
  matchup, turnovers, rebounds, box score và play-by-play.
- AI matchup dựa trên Lineup và bracket; Practice không thay record/reward.
- Battle playback hiện từng dòng, có nút Simulate và report PNG sau trận.
- Battle reward/XP và streak được settle trong transaction.
- Duel có invitation, hai Lineup thật và optional Gold bet; wager được escrow và
  settlement an toàn.
- Community Guild áp dụng channel allowlist cho Battle, Practice và Duel. Duel có
  bet chỉ được phép trong Community Server/channel hợp lệ.

Thiết kế chi tiết nằm trong `docs/architecture/09-battle-engine.md` và tài liệu
Battle liên quan. Không refactor engine lớn nếu chưa có characterization tests.

### 4.5 Market, Trade, Quicksell và Upgrade

- Market là fixed-price listing có expiration và tự phục hồi Card về Collection.
- Buy khóa listing, Wallet và ownership trong transaction để tránh double purchase.
- Direct Trade có invitation, edit offer, review delay, confirm/unconfirm, escrow,
  expiry/cancel và final settlement.
- Trade hỗ trợ tối đa 10 Card mỗi bên, Gold và các Item được allowlist.
- Quicksell có review/confirm, hỗ trợ selector và bỏ qua Card không đủ điều kiện.
- Fusion chọn một target và nhiều material cùng Template; Level 5 không được dùng
  làm material. `/level-up` tiêu thụ Item sau bước xác nhận.

### 4.6 Security và vận hành đã có nền tảng

- Fail-closed environment validation cho production.
- Development, test và production dùng credentials/database riêng.
- Test bắt buộc `TEST_DATABASE_URL`, từ chối production hoặc trùng runtime DB.
- In-memory abuse guard có cleanup, bounded capacity, aggregated security events
  và health metrics; thiết kế hiện chỉ dành cho một bot process.
- Security profiles hỗ trợ disable account, freeze earning và freeze trading tại
  service boundary.
- Migration runner có SHA-256 checksum, advisory lock và schema verification.
- Reconciliation kiểm tra Wallet, Inventory, XP, Card, ownership, locks và các flow
  tài sản quan trọng.
- Card image cache dùng bounded LRU; Sharp cache/concurrency được giới hạn.
- Maintenance mode và disabled-command configuration đã tồn tại.

## 5. Environment và quy trình chạy

Ba environment logic được hỗ trợ: `development`, `test`, `production`; staging nên
dùng Discord Application và database riêng, chạy production-like config nhưng không
dùng dữ liệu thật.

Các bước local cơ bản:

```text
npm install
npm run db:migrate
npm run db:migrate:test
npm run register:commands:dev
npm test
npm start
```

Production deployment phải đặt tối thiểu:

- `NODE_ENV=production`;
- `ECONOMY_CONFIG_PROFILE=production`;
- Discord Application credentials production;
- PostgreSQL production URL với TLS;
- Community Guild và Trade/Battle/Duel channel IDs;
- secrets qua deployment environment, không qua Git.

Global slash commands được đăng ký thủ công bằng:

```text
npm run register:commands:global
```

Bot startup không tự đăng ký command. Không chạy migration, admin grant, seed/reset
hoặc test command trên production database nếu chưa xác minh target.

## 6. Release readiness hiện tại

Trạng thái dưới đây được tổng hợp từ `docs/release-blockers.md`. `VERIFY` nghĩa là
nền tảng code đã có nhưng chưa có đủ bằng chứng production-like để chuyển sang
`DONE`.

### P0 — bắt buộc trước public release

| RB | Trạng thái | Vấn đề còn lại / hành động kế tiếp |
|---|---|---|
| RB-01 Economy production | OPEN | Chốt production balance, dùng DB production sạch, version economy config, mô phỏng source/sink và xác nhận test rewards không thể lọt production. |
| RB-02 Global commands | VERIFY | Dùng Discord Application production, đăng ký global, test trên Guild ngoài development và diễn tập rollback command. |
| RB-03 Licensing/monetization | OPEN | Xác minh quyền dùng ảnh, player/team/league marks, Card design và statistics; hoàn tất legal review trước thu tiền. |
| RB-04 Production operations | OPEN | CI/CD, service manifest, backup tự động, restore drill, uptime/error alerts, runbook, rollback và privacy operations. |
| RB-05 Asset memory | VERIFY | Load/soak test render trên VPS mục tiêu, đo peak RSS và đặt external memory alert. |
| RB-07 Anti-abuse | VERIFY | Chạy load/soak test, alert eviction/drop/flush failure; chỉ vận hành một bot instance cho tới khi có shared limiter. |
| RB-08 Security profile | VERIFY | Diễn tập admin restriction trên staging, test session đang mở và quy trình xử lý false positive. |
| RB-09 Production fail-closed | VERIFY | Chạy ma trận cấu hình sai trên production-like, xác nhận TLS/CA, startup log và Daily production. |
| RB-10 Test DB isolation | VERIFY | Chạy test với DB riêng, xác nhận CI xanh và lưu bằng chứng guard từ chối production DB. |

Ngoài các RB trên, P0 còn yêu cầu Privacy Policy, Terms, data export/deletion,
external monitoring và không còn lỗi severity 1/2.

### P1 — hoàn tất trong closed beta, trước monetization hoặc scale đáng kể

| RB | Trạng thái | Vấn đề còn lại / hành động kế tiếp |
|---|---|---|
| RB-06 Pack batch | VERIFY | Benchmark Pack 1/10/50/100 với network latency, concurrency, lock wait, pool saturation và p95/p99. |
| RB-11 Migration safety | VERIFY | Test concurrent deploy, CI migration và restore drill trên PostgreSQL production-like. |
| RB-12 Audit consistency | VERIFY | Chạy integration/fault-injection audit, schedule reconciliation, external alert và retention policy. |
| RB-13 Gacha audit | OPEN | Version Pack/Drop definitions; lưu config hash, price/currency snapshot và từng roll; báo cáo actual odds theo version. |
| RB-14 Documentation drift | OPEN | Tách current spec khỏi history, thêm ADR/balance changelog, kiểm tra command docs/config bằng CI. Tài liệu này là bước tổng hợp đầu tiên, chưa tự đóng RB. |
| RB-16 Automatic onboarding | OPEN | Tự provision Player, năm Base Cards đúng vị trí và starter Lineup ở interaction đầu tiên theo cách idempotent. |

### P2 — sau khi có số liệu tải thật

- RB-15: tách các service/engine lớn theo use case sau khi có characterization tests.
- Cân nhắc object storage/CDN, worker thread, Discord sharding/multi-instance,
  durable interactive sessions và keyset pagination khi metrics chứng minh cần thiết.

## 7. Thứ tự công việc đề xuất trước release

1. **Chốt release target:** closed beta hay public release, quy mô VPS, PostgreSQL
   provider và một bot process.
2. **Khóa production economy:** hoàn tất RB-01 và tạo production database sạch.
3. **Hoàn tất pháp lý:** RB-03, Terms, Privacy, data export/deletion và licensing.
4. **Dựng delivery pipeline:** pinned Node version, `npm ci`, CI test/migrate,
   deploy service, secrets, maintenance mode và rollback.
5. **Dựng reliability:** automated backup, restore drill, external uptime/error,
   memory/database/abuse alerts và scheduled reconciliation.
6. **Production-like verification:** đóng các RB đang `VERIFY` bằng bằng chứng test,
   không chỉ code review.
7. **Closed beta:** hoàn tất RB-06, RB-11–RB-14 và RB-16; theo dõi economy, gacha,
   latency, failure rate, abuse signal và Card circulation.
8. **Go/No-Go review:** chỉ public khi mọi P0 là `DONE`, audit/reconciliation sạch,
   restore/rollback đã diễn tập và không còn severity 1/2.

## 8. Thiết kế đề xuất cho RB-13

Không lưu một bản odds JSON trong mọi Card roll vì gây phình database. Dùng:

1. Bảng definition immutable theo `source_type + product_code + version`, chứa
   normalized config, integer weights, Card/level rules và SHA-256 hash.
2. `pack_openings` và `drop_sessions` tham chiếu definition version, đồng thời lưu
   giá/currency thực trả và economy config version.
3. Mỗi result/candidate lưu roll position, random value, total weight, rolled rarity,
   Template, Level, Card Instance và RNG algorithm version.
4. Drop lưu `USER` hoặc `TIMEOUT_AUTO` selection mode.
5. Dùng `crypto.randomInt`, không `Math.random`; không công khai secret/seed.
6. Debit, rolls, mint, audit và completion chạy trong cùng transaction; retry cùng
   interaction ID trả kết quả cũ.
7. Thêm report/script so sánh actual odds với configured odds theo version và cảnh báo
   missing/impossible results.

Đề xuất giữ detailed gacha audit ít nhất 24 tháng, sau đó archive; giữ aggregate theo
version lâu dài. Thời hạn cuối cùng cần legal/compliance review theo thị trường release.

## 9. Quy tắc bắt buộc cho coding agent

- Dùng JavaScript ES Modules và `pg` trực tiếp; không thêm ORM/framework nếu chưa
  được duyệt.
- Không hard-code hoặc log token, database URL, password hay API secret.
- Không sửa migration đã được áp dụng; tạo forward migration mới.
- Không xóa/reset Card hoặc economy data nếu người dùng chưa yêu cầu rõ target DB và
  compensation.
- Không dựa vào validation ở Discord command; mọi security/ownership/eligibility rule
  phải được enforce lại trong domain service transaction.
- Mọi chuyển Gold, Shards, Item hoặc Card phải idempotent, auditable và concurrency-safe.
- Không cho listed, escrowed, destroyed hoặc không thuộc sở hữu Card tham gia flow
  không hợp lệ.
- Không chạy test bằng `DATABASE_URL`; integration test chỉ dùng `TEST_DATABASE_URL`.
- Giữ production là single-process cho tới khi rate limit/session coordination được
  thiết kế cho multi-instance.
- Sau thay đổi, chạy test liên quan, `npm test`, migration check khi cần và
  `git diff --check`; báo cáo trung thực phần chưa thể test với Discord/production.

## 10. Tài liệu cần đọc theo loại task

| Task | Tài liệu chính |
|---|---|
| Architecture/dependencies | `docs/architecture/02-high-level-architecture.md`, `03-domain-modules.md`, `07-project-structure.md` |
| Data/transactions | `docs/architecture/04-data-model.md`, `05-card-lifecycle.md`, `06-transaction-rules.md` |
| Battle | `docs/architecture/09-battle-engine.md` và Battle design docs liên quan |
| Deployment/security | `docs/architecture/08-deployment-and-operations.md`, `docs/release-blockers.md` |
| Game rules/balance | `docs/requirements/` và `src/config/game-config.js` |
| Historical decisions | `PROJECT_CONTEXT.md` |

## 11. Public release definition of done

SlamDunk chỉ sẵn sàng public khi:

- tất cả P0 trong `docs/release-blockers.md` là `DONE`;
- production economy và database tách biệt hoàn toàn khỏi test data;
- migrations, CI/CD, backup, restore, monitoring và rollback đã được chạy thật;
- Gold, Shards, Item, Card, ownership và escrow reconciliation không có sai lệch;
- abuse/security controls được load-tested và có operator workflow;
- Terms, Privacy, deletion/export và licensing đã được duyệt;
- command registration/global availability được kiểm tra ngoài development Guild;
- không còn lỗi severity 1 hoặc severity 2 chưa xử lý.

Không coi một blocker hoàn tất chỉ vì code đã tồn tại; cần test result hoặc operational
evidence tương ứng và cập nhật trạng thái trong `docs/release-blockers.md`.
