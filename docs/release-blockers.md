# SlamDunk — Release Blockers trước Public Release

> Trạng thái: audit đang hoạt động
>
> Cập nhật gần nhất: 2026-08-25

SlamDunk đã có nền tảng gameplay và transaction tương đối hoàn chỉnh, nhưng chưa
nên public release khi các blocker P0 dưới đây còn mở. Việc đã có code không được
xem là hoàn thành cho đến khi có bằng chứng kiểm thử trong môi trường gần production.

## Quy ước trạng thái

- `OPEN`: chưa triển khai hoặc chưa chốt quyết định cần thiết.
- `VERIFY`: đã có nền tảng nhưng chưa được xác minh trong môi trường gần production.
- `DONE`: đã hoàn thành và lưu bằng chứng nghiệm thu.

## 1. Economy hiện vẫn là môi trường test

**Trạng thái:** `OPEN` — P0

Daily hiện trả `1,000,000 Gold` và `500,000 Shards` tại
[game-config.js](../src/config/game-config.js). Đây là giá trị phục vụ thử nghiệm
mở Pack, không phải balance production. Nếu cấu hình này lọt vào production,
Gold và Shards sẽ mất giá gần như ngay lập tức.

Database test cũng đã nhiều lần được cấp tài nguyên hàng loạt. Không được dùng
nguyên database hiện tại làm production database.

Cần:

- tách database `development`, `test`, `staging` và `production`;
- tách balance config theo môi trường;
- khi `NODE_ENV=production`, bot phải từ chối khởi động nếu phát hiện test rewards;
- production database phải bắt đầu sạch hoặc có kế hoạch reset/import economy được duyệt;
- gắn `economy_config_version` cho Pack, Drop và reward;
- mô phỏng và theo dõi nguồn, sink, lạm phát Gold/Shards và lượng Card theo rarity;
- dùng mức Daily production đã chốt khi cân bằng: `1,500–2,000 Gold` và
  `20–30 Shards`.

## 2. Slash command chỉ được đăng ký vào một Guild

**Trạng thái:** `VERIFY` — P0

Nền tảng đăng ký command đã được tách theo môi trường:

- `register:commands:dev` dùng `Routes.applicationGuildCommands` cho development Guild;
- `register:commands:global` dùng `Routes.applicationCommands` cho production;
- alias `register:commands` tiếp tục trỏ về development để giữ tương thích;
- global registration từ chối chạy nếu `NODE_ENV` không phải `production`;
- command registration vẫn là deployment step riêng, không chạy khi bot khởi động;
- unit test xác minh development và production sử dụng đúng route và cùng payload.

Discord khuyến nghị Guild Commands cho phát triển và Global Commands cho public
release. Tham khảo [Discord Application Commands](https://docs.discord.com/developers/docs/interactions/slash-commands).

Còn cần xác minh trước khi chuyển sang `DONE`:

- dùng Discord Application và credentials production riêng;
- chạy `npm run register:commands:global` trong production environment;
- thêm bot production vào một Guild ngoài development Guild và xác nhận slash
  commands xuất hiện, chạy đúng;
- xác minh quy trình cập nhật và gỡ Global Commands khi rollback.

Prefix command đang cần `MessageContent` trong
[discord-client.js](../src/bot/client/discord-client.js). Khi bot đạt quy mô cần
verification, privileged intent này phải được Discord chấp thuận. Tham khảo
[Discord Message Content Intent](https://support-dev.discord.com/hc/en-us/articles/4404772028055-Message-Content-Privileged-Intent-FAQ).

Slash command nên là giao diện chính; prefix command chỉ là tiện ích phụ.

## 3. Rủi ro bản quyền và monetization

**Trạng thái:** `OPEN` — P0

Repository hiện có khoảng 284 asset, tổng dung lượng khoảng 364 MB, bao gồm nhiều
hình ảnh cầu thủ thật. Dữ liệu rating cũng tham khảo NBA tại
[card-rating-data.md](requirements/card-rating-data.md).

Trước khi public hoặc thu tiền, phải xác minh quyền sử dụng:

- hình ảnh và tên thương mại của cầu thủ;
- logo đội và giải đấu;
- thiết kế Card;
- NBA statistics và các nguồn dữ liệu liên quan.

Điều khoản NBA hạn chế việc tái sử dụng nội dung và statistics cho sản phẩm thương
mại nếu không có quyền phù hợp. Tham khảo [NBA Terms of Use](https://www.nba.com/termsofuse).

Discord monetization cũng yêu cầu Terms of Service và Privacy Policy. Tham khảo
[Discord Monetization Eligibility](https://docs.discord.com/developers/monetization/enabling-monetization).

Đây là rủi ro kinh doanh lớn nhất, không chỉ là vấn đề code. Cần tư vấn pháp lý
và licensing trước monetization.

## 4. Chưa có quy trình production hoàn chỉnh

**Trạng thái:** `OPEN` — P0

Hiện chưa có đầy đủ:

- CI pipeline;
- deploy manifest hoặc service definition;
- automated backup;
- restore drill thực tế;
- external alerts và uptime monitoring;
- error tracking;
- privacy/data deletion procedure;
- production runbook và rollback procedure.

[08-deployment-and-operations.md](architecture/08-deployment-and-operations.md)
cũng ghi nhận external alert chưa được triển khai.

## 5. Asset cache có thể làm bot hết RAM

**Trạng thái:** `VERIFY` — P0

Nền tảng xử lý đã hoàn thành:

- 276 Card assets đã chuyển sang WebP, tối đa `480×800`, quality 85;
- dung lượng runtime Card assets giảm từ khoảng 360.1 MB xuống 10.2 MB;
- raw image cache không giới hạn đã được loại bỏ;
- resized image cache dùng LRU với tối đa 128 entry và tổng 64 MB;
- Sharp cache giới hạn 32 MB và tối đa hai render chạy đồng thời;
- health log đã có RSS, heap, external/array-buffer memory, cache và render queue metrics;
- asset optimization có script riêng và chạy lặp lại an toàn.

Còn cần xác minh trước khi chuyển sang `DONE`:

- đo peak RSS khi Pack, Drop, Lineup và Battle render đồng thời trên VPS mục tiêu;
- chạy soak test để bảo đảm RSS không tăng liên tục qua nhiều lượt render;
- đặt cảnh báo theo memory limit thực tế của VPS;
- sau beta, cân nhắc object storage/CDN và nơi lưu ảnh nguồn ngoài runtime repository.

## 6. Pack batch vẫn còn nhiều query tuần tự

**Trạng thái:** `VERIFY` — P1

Nền tảng xử lý đã hoàn thành:

- replay hydrate toàn bộ Templates và Card Instances bằng bulk lookup;
- replay 300 Cards chỉ dùng bốn application queries;
- mint validation dùng một Template query và một Player query;
- serial ranges của mọi Template được cấp bằng một bulk UPSERT có thứ tự;
- Card Instances, ownership histories và opening Cards tiếp tục được bulk insert;
- Pack 100 integration test xác minh 300 Card, debit một lần và replay idempotent;
- query-count test ngăn việc quay lại N+1 hydration/serial allocation.

Còn cần xác minh trước khi chuyển sang `DONE`:

- benchmark Pack `1`, `10`, `50` và `100` với database có network latency thực tế;
- chạy nhiều Pack 100 đồng thời để đo lock wait, pool saturation và deadlock;
- xác lập p95/p99 transaction latency trên VPS và PostgreSQL production-like.

## 7. Anti-abuse mới chỉ phù hợp single-process

**Trạng thái:** `VERIFY` — P0

Rate limit trong [abuse-guard.js](../src/modules/security/abuse-guard.js) sử dụng
`Map` trong memory:

- reset khi bot restart;
- không chia sẻ giữa nhiều instance;
- đây là giới hạn được chấp nhận khi production chỉ chạy đúng một bot instance.

Đã triển khai:

- cleanup expired keys mỗi 60 giây và giới hạn mặc định 50.000 rate-window keys;
- aggregation theo loại lỗi, User, Guild, Command và interaction kind;
- flush tối đa 500 aggregate rows mỗi 60 giây bằng một batch insert, thay vì một
  database write cho mỗi request bị từ chối;
- giới hạn 2.000 aggregate keys đang chờ và công khai dropped/failed counters
  trong `SLAMDUNK_HEALTH`;
- flush phần event còn chờ khi shutdown;
- unit/load test cho burst command, autocomplete, Pack batch, cleanup, capacity
  bound và retry khi batch write lỗi.

Còn cần xác minh trước khi chuyển sang `DONE`:

- chạy `npm run test:abuse-load` và soak test trên VPS production-like;
- đặt cảnh báo nếu `capacityEvictions`, `droppedEvents` hoặc `flushFailures` tăng;
- nếu scale lên nhiều bot instance, thay limiter in-memory bằng PostgreSQL
  coordination hoặc shared limiter trước khi bật instance thứ hai.

## 8. Security profile chưa được thực thi đầy đủ

**Trạng thái:** `VERIFY` — P0

Đã triển khai:

- policy riêng cho `disabled_until`, `earning_frozen_until` và
  `trading_frozen_until`, đọc và khóa profile trong transaction;
- earning freeze chặn Claim, Daily, Weekly, Vote, Free Drop, Battle reward/XP,
  Quicksell, Level Rewards và starter rewards trước khi tạo ledger, cooldown,
  XP, Item hoặc Card;
- disabled account chặn các mutation gameplay quan trọng, bao gồm Pack,
  Contract, Exchange, Upgrade, Lineup, Card lock, Battle và Practice;
- trading freeze được kiểm tra trong Market, mọi bước mutation của Trade và
  wagered Duel; cả hai participant được kiểm tra lại ngay trước settlement;
- Unlist, Trade/Duel Cancel, expiry và refund vẫn được phép để tài sản không bị
  mắc kẹt;
- command/component handler trả thông báo policy an toàn, nhưng domain service
  mới là enforcement boundary chính;
- admin script hỗ trợ `freeze-earning`; mỗi restriction được cập nhật độc lập,
  không vô tình xóa restriction khác;
- `risk_score` là tín hiệu monitoring/manual review và không tự động phạt Player
  trong bản release đầu tiên;
- integration test xác minh policy độc lập, rollback reward và service-level
  enforcement cho Market, Trade, Duel.

Còn cần xác minh trước khi chuyển sang `DONE`:

- chạy thử operator flow `freeze-earning`, `freeze-trading`, `disable`, `clear`
  trên staging database;
- xác minh các session đang mở khi restriction được áp dụng giữa chừng;
- review security events và false-positive workflow trong closed beta.

## 9. Environment production có thể fail-open

**Trạng thái:** `VERIFY` — P0

Startup configuration hiện đã fail-closed:

- `NODE_ENV` chỉ chấp nhận `development | test | production`;
- production bắt buộc dùng economy profile production;
- Daily test reward chỉ tồn tại trong development economy profile;
- production bắt buộc có Community Guild và ít nhất một Trade, Battle, Duel channel;
- production bắt buộc bật PostgreSQL TLS bằng `require` hoặc `verify-full`;
- config được kiểm tra trước khi tạo application, kết nối PostgreSQL hoặc Discord;
- startup log chỉ ghi environment, economy profile, TLS mode, số lượng channel và
  trạng thái security, không chứa token hoặc database URL;
- unit test bao phủ invalid environment, thiếu Community config, test economy,
  database TLS và sanitized log.

Còn cần xác minh trên production-like environment trước khi chuyển sang `DONE`:

- thử từng cấu hình sai và lưu bằng chứng process từ chối khởi động;
- xác nhận `verify-full` với CA certificate của PostgreSQL provider nếu sử dụng;
- khởi động thành công với credentials production và kiểm tra startup log;
- xác nhận Daily production trả đúng `1,500–2,000 Gold` và `20–30 Shards`.

## 10. Test có thể vô tình chạy trên production database

**Trạng thái:** `VERIFY` — P0

Đã triển khai nền tảng cô lập test database:

- toàn bộ integration test chỉ đọc `TEST_DATABASE_URL`;
- thiếu `TEST_DATABASE_URL` làm test dừng ngay;
- test từ chối chạy khi `NODE_ENV=production`;
- test từ chối khi `TEST_DATABASE_URL` và `DATABASE_URL` cùng host, port và database,
  kể cả khi credentials hoặc query parameters khác nhau;
- `db:migrate:test` chỉ migrate database đã qua test guard;
- GitHub Actions tạo PostgreSQL service tạm thời với database/user test riêng,
  migrate, chạy test rồi tự hủy cùng job;
- unit test bao phủ missing URL, trùng runtime database và production environment.

Còn cần xác minh trước khi chuyển sang `DONE`:

- tạo database test local hoặc staging riêng và chạy `npm run db:migrate:test`;
- chạy toàn bộ `npm test` bằng database đó;
- xác nhận GitHub Actions xanh trên push/PR đầu tiên;
- lưu bằng chứng guard từ chối URL production trong môi trường deployment-like.

## 11. Migration runner chưa có checksum và deployment lock

**Trạng thái:** `VERIFY` — P1

Đã triển khai:

- SHA-256 checksum cho từng migration và baseline an toàn cho database cũ;
- từ chối migration đã sửa, migration đã áp dụng nhưng mất khỏi repository hoặc
  checksum metadata bị thiếu;
- PostgreSQL advisory lock giữ xuyên suốt migration run;
- mỗi migration chạy trong transaction riêng và rollback khi thất bại;
- startup schema-version/checksum check trước background jobs và Discord login;
- CI migrate database test trước khi chạy test;
- migration integrity unit test và schema/audit integration test;
- migration/restore/forward-fix runbook trong deployment documentation.

Còn cần xác minh trước khi chuyển sang `DONE`:

- chạy hai deployment migration đồng thời trên production-like PostgreSQL;
- chạy GitHub Actions đầu tiên với PostgreSQL service;
- thực hiện một restore drill thật vào database cô lập và lưu bằng chứng.

## 12. Audit trail chưa đồng đều

**Trạng thái:** `VERIFY` — P1

Đã triển khai:

- immutable `item_transactions` tự động ghi mọi thay đổi `player_items`, kể cả
  repository hoặc admin script update trực tiếp;
- baseline ledger cho Item balance hiện có;
- immutable triggers cho Item, XP, Card ownership và security audit records;
- reconciliation Wallet, Inventory, XP, Card mint counter/circulation, ownership
  state/chain và Card lock;
- reconciliation liên kết Pack, Contract, completed Trade và sold Market listing
  với ownership history;
- non-zero reconciliation trả failure status để monitoring/deployment cảnh báo;
- database development đã áp dụng migration và reconciliation trả `0` issue.

Còn cần xác minh trước khi chuyển sang `DONE`:

- chạy audit integration test trên database test riêng;
- cấu hình scheduler và external alert cho reconciliation production;
- thử fault injection tạo mismatch trên database cô lập và xác nhận cảnh báo;
- xác định retention/archival policy nhưng không cho phép sửa audit records.

## 13. Pack/Drop audit chưa đủ cho gacha monetization

**Trạng thái:** `OPEN` — P1

Battle đã được version hóa tốt hơn, nhưng Pack odds chưa lưu đủ version/snapshot.
Sau khi đổi odds, hệ thống khó chứng minh một Pack cũ đã dùng bảng tỷ lệ nào.

Cần lưu:

- `pack_definition_version`;
- odds snapshot hoặc hash;
- price và currency snapshot;
- roll audit metadata đủ để điều tra nhưng không tiết lộ dữ liệu có thể bị lợi dụng;
- dashboard so sánh actual drop rate với configured odds theo version;
- retention policy cho audit dữ liệu gacha.

## 14. Documentation đang lệch code

**Trạng thái:** `OPEN` — P1

README và `PROJECT_CONTEXT.md` đang chứa một số balance, roadmap và flow cũ trong
khi runtime đã thay đổi. Một tài liệu vừa đóng vai trò lịch sử vừa là source of
truth sẽ tiếp tục tạo conflict.

Cần chuyển sang:

- một current product specification ngắn và có version;
- ADR cho quyết định kiến trúc quan trọng;
- balance changelog;
- command reference được generate hoặc kiểm tra từ command registry;
- tài liệu lịch sử được đánh dấu archive, không dùng làm source of truth;
- CI check cho link, command name và các giá trị cấu hình quan trọng.

## 15. Một số file đã quá lớn

**Trạng thái:** `OPEN` — P2

Số liệu kiểm tra hiện tại:

- `battle-engine.js`: khoảng 1,441 dòng;
- `battle.service.js`: khoảng 1,341 dòng;
- `trade.service.js`: khoảng 906 dòng;
- `card-instance.service.js`: khoảng 732 dòng.

Chưa cần microservice. Nên tách theo use case:

- Battle preparation, simulation và settlement;
- Duel invitation, escrow và settlement;
- Card mint, transfer và locking;
- Trade invitation, drafting, review và settlement.

Việc refactor chỉ nên thực hiện sau khi có characterization tests để tránh thay đổi
gameplay hoặc transaction behavior ngoài ý muốn.

## 16. Onboarding chưa tự động

**Trạng thái:** `OPEN` — P1

Starter lineup hiện chỉ được grant qua `/welcome`; chưa được gọi tự động từ lần
tương tác đầu tiên. Người chơi mới không biết lệnh này có thể không đủ đội hình để Battle.

Cần:

- tự động provision Player, 5 Base Cards đúng vị trí và starter Lineup ở lần tương tác đầu;
- đảm bảo operation idempotent khi người chơi gửi nhiều interaction đồng thời;
- giữ `/welcome` để xem lại hướng dẫn, không grant lặp;
- theo dõi onboarding completion và lỗi provision.

## Thứ tự triển khai đề xuất

### P0 — trước closed/public beta

1. Production economy guard và database riêng.
2. Global slash command registration.
3. Giảm/nén asset và giới hạn cache RAM.
4. CI, pinned Node version và clean `npm ci`.
5. Backup tự động và test restore.
6. External alerts và error monitoring.
7. Sửa anti-abuse DB amplification và cleanup memory.
8. Bắt buộc `TEST_DATABASE_URL`.
9. Hoàn thiện security policy tại service boundary.
10. Privacy Policy, Terms, data deletion/export.
11. Kiểm tra licensing hình ảnh và NBA content.

### P1 — trong closed beta

1. Bulk-optimize Pack 100.
2. Load/soak test Pack, Battle playback và autocomplete.
3. Version hóa economy và Pack/Drop odds.
4. Mở rộng reconciliation và immutable audit.
5. Tự động onboarding.
6. Economy telemetry: Gold/Shards source, sink, inflation và rarity circulation.
7. Migration checksum, advisory lock và schema-version check.
8. Đồng bộ tài liệu với runtime.

### P2 — sau khi có số liệu tải thật

1. Object storage/CDN.
2. Worker thread cho image rendering hoặc Battle nếu CPU trở thành bottleneck.
3. Discord sharding hoặc multi-instance khi thực sự cần.
4. Durable interactive session recovery.
5. Keyset pagination cho Market/Collection rất lớn.
6. Refactor các service lớn theo use case.

## Validation đã ghi nhận

```text
npm test: PASS — lần chạy đầy đủ gần nhất 202/202
node --test --experimental-test-coverage: PASS — kết quả audit đã ghi nhận
npm audit --omit=dev --audit-level=moderate: PASS — 0 vulnerabilities tại lần audit
npm run audit:reconcile: PASS — 0 issues tại lần audit
git diff --check: PASS — chỉ có cảnh báo chuyển đổi LF/CRLF
npm ls --depth=0: dependencies chính hợp lệ; Sharp-related extraneous packages cần được kiểm tra
```

Các kết quả trên là nền tảng tốt nhưng không thay thế load test, failure test,
restore drill, security test, legal review và production-like validation.

## Điều kiện Go/No-Go cho Public Release

Chỉ được public release khi:

1. toàn bộ blocker P0 đã ở trạng thái `DONE`;
2. reconciliation không còn chênh lệch Gold, Shard, Item, Card, escrow hoặc ownership chưa giải thích;
3. backup restore và incident controls đã được diễn tập thành công;
4. production economy được bảo vệ khỏi test configuration;
5. licensing, Terms, Privacy Policy và data procedures đã được duyệt;
6. không còn lỗi severity 1 hoặc severity 2 chưa xử lý.

## Kết luận

Core gameplay và transaction foundation của SlamDunk tốt hơn mức prototype thông
thường. Rủi ro còn lại tập trung ở production safety, vận hành, asset/licensing,
auditability và release process. Sau khi hoàn thành nhóm P0, dự án có thể bước
vào closed beta nghiêm túc. Chưa nên monetization trước khi giải quyết licensing
và production economy.
