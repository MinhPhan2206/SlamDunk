# 06 — Transaction Rules

> **Project:** SlamDunk  
> **Database:** PostgreSQL  
> **Purpose:** Protect ownership and economy integrity under concurrency.

---

## 1. Transaction Principle

Any operation that changes more than one piece of valuable game state must be atomic.

Atomic means:

```text
all changes commit
OR
no changes commit
```

Never allow a partially completed economy operation.

---

## 2. Transaction-Critical Operations

Must use database transactions:

```text
Market Purchase
Direct Trade Execution
Card Fusion
Quicksell
Paid Pack Purchase
Upgrade Item Usage
Claim / Daily credit
Battle reward credit
Admin balance/card correction
```

Simple read-only commands do not require write transactions.

---

## 3. General Transaction Pattern

```text
BEGIN

Lock required rows
Validate current state
Apply state changes
Write audit/history records
Update counters
Validate invariants

COMMIT
```

On error:

```text
ROLLBACK
```

---

## 4. Row Locking Principle

For state that may be changed concurrently, use PostgreSQL locking such as:

```text
SELECT ... FOR UPDATE
```

Exact SQL/ORM syntax depends on implementation.

Typical rows requiring lock:

```text
Wallet
MarketListing
CardInstance
Trade
Cooldown
Mint Counter
Inventory Item
```

---

# 5. Market Purchase

## Goal

Prevent:

```text
double purchase
negative buyer balance
duplicate ownership
seller being paid twice
```

## Transaction

```text
BEGIN

1. Lock MarketListing
2. Verify listing.status = ACTIVE

3. Lock CardInstance
4. Verify seller still owns card
5. Verify card is market-locked for this listing

6. Lock buyer Wallet
7. Lock seller Wallet

8. Verify buyer.gold >= listing.price

9. Debit buyer full price
10. Credit seller full price

11. Transfer Card ownership to buyer
12. Increment ownership_cycles
13. Create ownership history

14. Mark listing SOLD
15. Set buyer_player_id
16. Clear market lock

17. Write buyer EconomyTransaction
18. Write seller EconomyTransaction

COMMIT
```

Fee:

```text
0%
```

Seller receives full price.

---

# 6. Direct Trade Execution

## Preconditions

```text
Trade OPEN
Exactly intended participants
Both sides confirmed final offer
No offer changed after confirmation
All offered cards still valid
All offered Gold still available
```

## Transaction

```text
BEGIN

1. Lock Trade
2. Revalidate confirmations

3. Lock all offered CardInstances
4. Verify ownership and trade locks

5. Lock both Wallets
6. Verify Gold offers

7. Apply Gold transfers
8. Apply Card ownership transfers

9. Create ownership histories
10. Create EconomyTransactions

11. Clear all trade locks
12. Mark Trade COMPLETED

COMMIT
```

Any change to a trade offer before execution must clear confirmations.

Fee:

```text
0%
```

---

# 7. Card Fusion

## Preconditions

```text
same owner
same Card Template
different Card Instances
both ACTIVE
both unlocked
```

## Calculation

```text
result_level = min(levelA + levelB, 5)
```

## Transaction

```text
BEGIN

1. Lock source Card A
2. Lock source Card B
3. Revalidate owner/status/template

4. Lock CardMintCounter for template

5. Allocate next serial
6. Mark A DESTROYED_FUSION
7. Mark B DESTROYED_FUSION

8. current_circulation -= 2

9. Create new CardInstance
   level = result_level
   status = ACTIVE
   owner = player
   obtained_method = FUSION

10. total_minted += 1
11. current_circulation += 1

12. Create Fusion record
13. Create FusionSource records
14. Create ownership history for result card

COMMIT
```

Net circulation:

```text
-1
```

---

# 8. Upgrade Item Usage

## Preconditions

```text
card ACTIVE
card owned by player
card unlocked
card_level < 5
Upgrade Item available
```

## Transaction

```text
BEGIN

1. Lock CardInstance
2. Lock inventory/item row
3. Revalidate state

4. Consume one Upgrade Item
5. card_level += 1

6. Write UpgradeItemUsage audit record

COMMIT
```

If level = 5:

```text
reject before consuming item
```

---

# 9. Quicksell

## Transaction

```text
BEGIN

1. Lock CardInstance
2. Verify owner
3. Verify ACTIVE and unlocked

4. Determine Shard reward from configuration

5. Lock Wallet
6. Mark card DESTROYED_QUICKSELL
7. Decrement current_circulation

8. Credit Shards
9. Write EconomyTransaction
10. Write card lifecycle/audit event

COMMIT
```

Card destruction and currency credit must never be separate commits.

---

# 10. Paid Pack Purchase

Exact paid pack product rules are TBD.

Required transaction structure:

```text
BEGIN

1. Lock player Wallet
2. Verify Gold balance
3. Debit pack price
4. Create EconomyTransaction
5. Create PackSession / entitlement

COMMIT
```

Card selection/mint may occur in a second transaction if the player must choose among revealed candidates.

The paid entitlement must be persisted so a process crash cannot charge the player without allowing pack completion.

---

# 11. Free Pack Selection

Recommended design uses a persisted PackSession.

PackSession stores:

```text
player
candidate templates
expiration
selection status
pack source/type
```

Only the selected candidate becomes a Card Instance.

Selection transaction:

```text
BEGIN

1. Lock PackSession
2. Verify OPEN and not expired
3. Verify selected candidate belongs to session
4. Lock template MintCounter
5. Roll initial level 1–5
6. Mint selected Card Instance
7. Mark session COMPLETED
8. Update FREE_PACK cooldown

COMMIT
```

This prevents duplicate button clicks from minting multiple cards.

---

# 12. Claim / Daily Reward

```text
BEGIN

1. Lock PlayerCooldown row
2. Verify available_at <= now
3. Lock Wallet
4. Credit reward
5. Update next available_at
6. Write EconomyTransaction

COMMIT
```

Cooldown and reward credit must commit together.

---

# 13. Battle Reward

The battle result should be finalized before reward credit.

```text
BEGIN

1. Lock Match
2. Verify Match not already rewarded
3. Lock Wallet(s)
4. Credit rewards
5. Write EconomyTransactions
6. Mark reward status COMPLETE

COMMIT
```

This prevents retry/restart from paying the same battle twice.

---

# 14. Idempotency

Discord may retry interactions or users may double-click buttons.

Critical operations need idempotency.

Possible keys:

```text
Discord interaction ID
PackSession ID
MarketListing ID
Trade ID
Match ID
Fusion request ID
```

A completed operation must return the existing result instead of executing again.

---

# 15. Lock Ordering

To reduce deadlock risk, define consistent lock order.

Recommended general order:

```text
1. Parent operation row
   MarketListing / Trade / Match / PackSession

2. CardInstances
   ordered by card_instance_id ascending

3. Wallets
   ordered by player_id ascending

4. Counters / Inventory
```

When locking multiple cards or wallets, always sort IDs before locking.

---

# 16. Database Constraints as Final Defense

Transactions must be reinforced with database constraints.

Examples:

```text
wallet >= 0
card_level between 1 and 5
active listing unique per card
serial unique per template
trade offered card unique within active trade
```

Application checks improve errors but do not replace constraints.

---

# 17. Retry Policy

Automatically retry only errors known to be transient, such as selected serialization/deadlock failures.

Do not blindly retry:

```text
INSUFFICIENT_GOLD
CARD_NOT_OWNED
LISTING_SOLD
CARD_LOCKED
TRADE_CHANGED
```

These are domain-state failures.

---

# 18. Domain Error Codes

Recommended examples:

```text
PLAYER_NOT_FOUND
INSUFFICIENT_GOLD
INSUFFICIENT_SHARDS

CARD_NOT_FOUND
CARD_NOT_OWNED
CARD_NOT_ACTIVE
CARD_LOCKED
CARD_ALREADY_LISTED
CARD_LEVEL_MAX

FUSION_TEMPLATE_MISMATCH
FUSION_SAME_INSTANCE

LISTING_NOT_FOUND
LISTING_NOT_ACTIVE
LISTING_ALREADY_SOLD

TRADE_NOT_FOUND
TRADE_NOT_CONFIRMED
TRADE_OFFER_CHANGED

PACK_COOLDOWN_ACTIVE
PACK_SESSION_EXPIRED
PACK_ALREADY_COMPLETED

DAILY_COOLDOWN_ACTIVE
CLAIM_COOLDOWN_ACTIVE
```

Discord-specific messages are created in the Interaction Layer.

---

# 19. Logging Requirements

Critical transaction logs should include:

```text
operation type
request/interaction ID
player IDs
card IDs
listing/trade/fusion ID
amount/currency
success/failure
error code
timestamp
```

Never log:

```text
Discord bot token
database password
other secrets
```

---

# 20. Integrity Rule

For economy/card-changing flows:

> A Discord success response must only be sent **after** the database transaction commits successfully.

If the transaction rolls back, the user must receive a failure/domain error response.
