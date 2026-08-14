# Economy, Pack Odds, and Progression Baseline

> **Status:** Approved F2P production baseline; paid progression remains TBD.
>
> This document records economy and card-supply hypotheses for simulation and
> playtesting. It does not finalize production balance values and does not, by
> itself, authorize implementation of a later milestone.

Approved production decisions override historical simulation values in this
document. The authoritative F2P configuration is recorded below.

## 0. Approved F2P Production Baseline

This section supersedes conflicting cooldown, reward, Battle economy, Free
Drop, and Standard Pack values elsewhere in this document.

| System | Approved rule |
| --- | --- |
| Claim | Up to 2 charges; recover 1 every 15 minutes; 80-120 Gold |
| Daily | 24-hour cooldown; 1,500-2,000 Gold and 20-30 Shards |
| Weekly | 168-hour cooldown; 3,000-4,000 Gold and 200-300 Shards |
| Free Drop | Up to 2 charges; recover 1 every 15 minutes; 3 independent candidates; choose 1 |
| Standard Pack | 3,000 Gold; 3 independent Cards; 1-second anti-spam cooldown |
| Super Pack | 1,300 Shards; 1 Card; Alpha or higher; 1-second anti-spam cooldown |
| Battle | 60-minute cooldown; Player selects an eligible opponent bracket |

Free Drop per-candidate odds:

| Rarity | Probability |
| --- | ---: |
| Base | 52.495346% |
| Common | 32.010504% |
| Uncommon | 15.393089% |
| Alpha | 0.075132% |
| All-Star | 0.025013% |
| Superstar | 0.000833% |
| Goat | 0.0000833% |

These are per-candidate odds. With three independent candidates, the chance
that a rarity appears at least once is approximately 1/444 Drops for Alpha,
1/1,333 for All-Star, 1/40,000 for Superstar, and 1/400,000 for Goat. The
Player still keeps only one selected candidate.

Standard Pack odds:

| Rarity | Probability |
| --- | ---: |
| Base | 13.877323% |
| Common | 43.936835% |
| Uncommon | 38.053618% |
| Alpha | 3.451062% |
| All-Star | 0.671161% |
| Superstar | 0.008334% |
| Goat | 0.001667% |

Every Standard Pack performs three independent Card rolls. The approximate
per-Pack appearance frequencies are 1/10 for Alpha, 1/50 for All-Star,
1/4,000 for Superstar, and 1/20,000 for Goat.

Super Pack odds:

| Rarity | Probability |
| --- | ---: |
| Base | 0% |
| Common | 0% |
| Uncommon | 0% |
| Alpha | 75.000000% |
| All-Star | 24.153846% |
| Superstar | 0.769231% |
| Goat | 0.076923% |

Super Pack costs 1,300 Shards and grants one independently rolled Card.

Battle Gold uses these base formulas:

```text
Loss = 250 + Player Score * 15
Win  = 950 + Score Difference * 45
```

Opponent brackets are Street, Pro, All-Star, and Legend. Their reward
multipliers are 0.85, 1.00, 1.20, and 1.40. Required lineup strength is 0,
70, 80, and 88 respectively. The Player selects the bracket before Battle;
the AI lineup remains seeded and randomized inside that bracket.

A win adds 5% per win through streak 5, 3% per win from streak 6 through 10,
and 2% per win after streak 10. The accumulated streak bonus has no cap and a
loss resets it. Battle reward has no per-match cap and is never reduced by a
daily Battle count or Gold threshold. The balance target is approximately
17,000-19,000 Battle Gold over 16 competitive matches, depending on results,
margin, bracket, and streak. Every reward is ledgered idempotently by public
Match ID.

## 1. Design Goals

SlamDunk should combine retention, pack-opening anticipation, meaningful
long-term progression, server-level scarcity, useful recycling of unwanted
cards, strategic value beyond rarity, and a sustainable Gold/Shards economy.

The preferred progression loop combines random and deterministic progression:

```text
Open Pack
├── Useful Card   → Lineup / Market / Trade
└── Unwanted Card → Quicksell → Shards → Exchange → New opportunity
```

A bad pull should still contribute to another progression path.

## 2. External Reference Data

Basketbot is an economy-design reference only. Its values are not automatically
SlamDunk requirements.

### Basketbot Free Drop Reference

```text
Cooldown: 12 minutes
Cost: FREE
```

| Result | Approximate probability | Approximate frequency |
| --- | ---: | ---: |
| Very Common | 52.484801% | 1 / 1.9 |
| Common | 31.990720% | 1 / 3.1 |
| Uncommon | 15.385885% | 1 / 6.5 |
| Rare | 0.099996% | 1 / 1,000 |
| Special | 0.010000% | 1 / 10,000 |
| Exclusive v2 | 0.000500% | 1 / 200,000 |
| One of a Kind | 0.000100% | 1 / 1,000,000 |

The reference pattern is frequent low-rarity results plus extremely rare
jackpot results.

### Basketbot Paid Pack References

Pack3 reference cost: 1,000 Gold.

| Result | Approximate probability |
| --- | ---: |
| Very Common | 14.194678% |
| Common | 44.947979% |
| Uncommon | 38.920568% |
| Rare | 1.500600% |
| Special | 0.100040% |
| Exclusive v2 | 0.005002% |
| One of a Kind | 0.001000% |
| Historic | 0.080032% |
| Finals '26 | 0.250100% |

Promo Pack reference cost: 4,000 Gold.

| Result | Approximate probability |
| --- | ---: |
| Very Common | 0% |
| Common | 0% |
| Uncommon | 94.598012% |
| Rare | 3.793531% |
| Special | 0.278192% |
| Exclusive v2 | 0.012645% |
| One of a Kind | 0.002529% |
| Historic | 0.252902% |
| Finals '26 | 1.062189% |

Rare+ Card Key reference:

| Result | Approximate probability |
| --- | ---: |
| Rare | 75.002142% |
| Special | 7.930214% |
| Exclusive v2 | 0.793021% |
| One of a Kind | 0.079302% |
| Historic | 4.300000% |
| Finals '26 | 11.895321% |

The resulting product direction is:

```text
Free Drop
→ Standard Gold Pack
→ Premium / Promo Pack
→ Shard Key / Special Source
```

Each source should have a distinct purpose and probability distribution.

### Basketbot Economy References

```text
Claim:     15-minute cooldown, 100–200 Gold, 150 Gold EV
Challenge: 60-minute cooldown, score margin × 60 Gold
Streak:    +10% earnings per challenge win streak
```

Basketbot quicksell reference values:

```text
Very Common     0 Shards
Common          1 Shard
Uncommon        2 Shards
Rare           20 Shards
Special       400 Shards
Exclusive  ~1,600–2,000 Shards
One of a Kind 7,000 Shards
```

These figures are comparative inputs, not SlamDunk balance decisions.

## 3. Pack Probability Model

If a pack shows `n` independently rolled candidates and the per-candidate
probability of a target is `p`:

```text
P(at least one target) = 1 - (1 - p)^n
```

Increasing candidate count is therefore an economy and card-supply buff, not
only a user-interface benefit. Candidate-count perks must be included in supply
simulations.

SlamDunk may use a two-stage scarcity model:

```text
Roll Rarity
→ Roll Card Template within that Rarity
```

```text
P(Card) = P(Rarity) × P(Card | Rarity)
```

Cards in one rarity may have different internal weights. An event may contain
20–30 cards while only approximately 5–6 are strong chase cards with lower
within-rarity weights. Exact internal weights remain TBD.

## 4. Practical Card Value

Card value should not depend on rarity alone:

```text
Market Value ≈
Rarity + Circulation + Battle Effectiveness + Meta Demand
+ Player Popularity + Traits + Card Level + Lineup Fit
```

Expected collection progression:

```text
Beginner:     mainly Tier 4–5
Intermediate: Tier 5–6 plus strong practical cards from other rarities
Advanced:     Tier 6–7 plus high-value/meta cards regardless of rarity
```

The strongest lineup should not automatically be the five highest-rarity or
five highest-OVR cards.

Meaningful chase targets should include favorite players, specific templates,
event cards, strong gameplay cards, matchup counters, Trait combinations,
higher Card Levels, collection completion, market opportunities, and Goat
cards. Goat should not be the only desirable result.

## 5. Gold Economy

Potential Gold faucets:

```text
/claim
/daily
/challenge
battle rewards
achievements
events
```

Market sales and direct trades transfer Gold between players; with the confirmed
0% fees they neither create nor destroy Gold.

Potential real Gold sinks:

```text
Standard Packs
Premium Packs
Promo/Event Packs
future event entries
future crafting/exchange systems
```

```text
Net Gold Creation = Gold Faucets - Gold Sinks
```

## 6. Historical SlamDunk Simulation Baseline (Superseded)

Every value in this historical section is superseded by Section 0 and is
retained only as design history.

| System | Simulation baseline |
| --- | --- |
| Free Drop | 10-minute cooldown, 3 candidates, choose 1, free |
| Claim | **Final:** 10-minute cooldown, random integer 300–500 Gold, 400 Gold EV |
| Daily | 300 Gold + 5 Shards |
| Challenge | 60-minute cooldown |
| Challenge base | point margin × 50 Gold |
| Challenge streak | +5% per win, capped at ×1.5 |
| Standard Pack | 2,000 Gold |
| Premium Pack | 6,000 Gold |
| Promo/Event Pack | 10,000–12,000 Gold |
| Market fee | 0% |
| Trade fee | 0% |
| Quicksell Gold | 0 |
| Quicksell reward | Shards |

Claim income examples:

```text
3 claims/day  ≈ 1,200 Gold
6 claims/day  ≈ 2,400 Gold
12 claims/day ≈ 4,800 Gold
```

Possible future Daily milestones are 3, 7, 14, and 21 claims. Their exact
structure and rewards remain TBD.

The provisional Challenge multiplier is:

```text
M(s) = 1 + 0.05 × min(s, 10)
```

Using an average point margin of 4 and average multiplier of 1.15 gives a
simulation value of approximately 230 Gold per Challenge.

Illustrative daily-income profiles:

| Player profile | Activity assumption | Approximate Gold/day |
| --- | --- | ---: |
| Casual | 3 Claims, 1 Challenge, Daily | 1,730 |
| Core | 6 Claims, 3 Challenges, Daily | 3,390 |
| Hardcore | 12 Claims, 6 Challenges, Daily | 6,480 |

These figures are simulation examples, not guaranteed earnings.

Pack pricing should target realistic saving horizons:

```text
Short-term:  about 1 active day
Medium-term: about 3 active days
Long-term:   about 5–6 active days
```

Premium packs should provide a clearly noticeable probability improvement.

## 7. Historical Free Drop Rarity Baseline (Superseded)

| Rarity tier | Probability | Approximate frequency |
| --- | ---: | ---: |
| Base | 50.0000% | — |
| Common | 32.0000% | — |
| Uncommon | 16.0000% | — |
| Alpha | 1.8000% | 1 / 56 |
| All-Star | 0.1900% | 1 / 526 |
| Superstar | 0.0095% | 1 / 10,526 |
| Goat | 0.0005% | 1 / 200,000 |

The distribution totals 100%. It is a card-supply simulation baseline, not a
final production probability table.

## 7.1 Historical Standard Pack Distribution (Superseded)

The first configured paid Pack product uses the stable code `standard`:

| Rarity tier | Probability |
| --- | ---: |
| Base | 10.0000% |
| Common | 35.0000% |
| Uncommon | 40.0000% |
| Alpha | 12.0000% |
| All-Star | 2.7000% |
| Superstar | 0.2900% |
| Goat | 0.0100% |

The Pack catalog is keyed by Pack code. Future Packs must define their own
display name and rarity distribution instead of changing Standard Pack odds.
Pack buying and opening behavior is defined separately from the odds table.

Expected server supply must be calculated across every source:

```text
Expected Goat Instances =
Σ(Open Count by Source × Goat Probability by Source)
```

Inputs should include DAU, opens per player, paid packs, Shard Keys, event
activity, supporter percentage, and desired annual circulation.

As a scale reference only, observed Basketbot data suggested approximately 75
top-rarity instances and 600 instances of the tier below after roughly three
years. SlamDunk must derive its own targets from simulation.

## 8. Shard Economy

Preferred separation:

```text
Gameplay / Rewards → Gold
Unwanted Cards     → Gold + Shards
```

Free Drop should not become another major Gold faucet. Quicksell returns both
currencies according to rarity, while Pack cost remains materially above its
expected Gold return.

Provisional SlamDunk quicksell values:

| Rarity | Gold | Shards |
| --- | ---: | ---: |
| Base | 10 | 2 |
| Common | 20 | 4 |
| Uncommon | 40 | 8 |
| Alpha | 250 | 30 |
| All-Star | 7,000 | 350 |
| Superstar | 15,000 | 1,500 |
| Goat | 50,000 | 10,000 |

```text
Expected Shard Value =
Σ(Rarity Probability × Quicksell Value for that Rarity)
```

Actual realized value may be lower because players keep useful cards.

Shard exchanges should offer short-, medium-, and long-term targets. Exact key
prices and odds remain TBD.

For every Shard Key:

```text
Expected Quicksell Value of Result < Key Cost
```

The provisional target for returned-shard EV divided by key cost is 10%–30%,
preventing an infinite buy/open/quicksell loop.

## 9. Supporter Direction

Basketbot's reference supporter tiers were approximately USD 4.99 and USD
9.99. Reference benefits combined badges and quality-of-life features with
economic advantages such as shorter cooldowns, more candidates, improved
rewards, and exchange discounts. Combining many economic advantages can
compound wealth growth and indirectly inflate market prices.

Supporter benefits should prioritize cosmetics and quality of life:

```text
Supporter Badge
Profile Customization
Additional Saved Lineups
Practice Mode
Advanced Battle Statistics
Collection Filters
Quality-of-Life Features
Additional Stored Cooldown Charges
```

If economic perks exist, keep them moderate. Provisional Challenge cooldown
examples are 60 → 50 minutes at one tier and 60 → 45 minutes at another. Avoid
60 → 30 minutes because it doubles earning opportunities. Final supporter
benefits remain TBD.

## 10. Economy Simulation and Monitoring

Simulate at 100, 500, 1,000, and 5,000 DAU across Casual, Core, and Hardcore
segments for 30 days, 1 year, and 3 years.

Inputs should include activity rates, challenge performance, pack purchases,
Shard Key usage, supporter percentage, and supporter modifiers.

Measure:

```text
Total Gold Supply
Gold Created and Destroyed
Sink Ratio
Shard Generation and Destruction
Supply by Rarity and Card Template
Goat circulation
Duplicate rate
Expected time to Card Level 5
Market purchasing power
```

```text
Sink Ratio = Gold Destroyed / Gold Created
```

Provisional monitoring hypotheses:

```text
Launch economy: ~0.70–0.85
Mature economy: ~0.85–1.00
```

Future market-health metrics should include median/P90/P99 Gold, transaction
volume, representative rarity prices, circulation, listing duration, and
sell-through rate.

## 11. Open Economy Decisions

The following values are still TBD and must be finalized through simulation and
playtesting:

```text
Final Free Drop odds
Premium, Promo/Event, and Shard Key odds
Future Pack prices
Final Shard Key costs
Event-card internal weights
Desired Goat and Superstar annual supply
Supporter economic benefits and cooldown reductions
Final Challenge base Gold and streak multiplier
Additional Gold sinks
Pity system
Event duration and Event Pack availability
```

## 12. Core Economy Principle

Every major activity should contribute to another meaningful progression path.
Final odds and rewards must be reviewed after simulation and playtesting rather
than selected by intuition alone.
