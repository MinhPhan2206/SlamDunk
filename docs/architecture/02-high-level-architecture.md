# 02. High-Level Architecture

## 1. Technology Stack

- Runtime: Node.js
- Discord SDK: discord.js
- Database: PostgreSQL

---

## 2. Architecture Style

SlamDunk uses a **Modular Monolith** architecture.

The system is deployed as a single application, while business logic is separated into independent domain modules such as:

- Player
- Economy
- Card
- Trait
- Pack
- Reward
- Upgrade
- Market
- Trade
- Lineup
- Battle

Detailed module responsibilities are defined in `03-domain-modules.md`.

---

## 3. Layered Architecture

```text
Discord Interaction
        ↓
Command / Interaction Layer
        ↓
Service / Domain Layer
        ↓
Repository Layer
        ↓
PostgreSQL