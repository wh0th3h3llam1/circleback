# Orbit: your career brain

**The jobs you want are one or two people away. Orbit finds them.**

Orbit is a personal career agent. It keeps one memory graph per person (a Cognee "brain") built from your LinkedIn connections, the events you go to (Luma and Partiful), and quick notes you send by Telegram, voice or the web. It then recommends the opportunities that matter right now:

- **Referral paths:** "Ask Maya for an intro to Lena Park (Head of Voice AI, Sonance, hiring product people)."
- **Events worth your evening:** the Partiful or Luma events whose hosts are hiring for your goal, and who in your graph can introduce you there.
- **Reach out and reconnect:** people who fit your goal, and career contacts you're drifting away from.

Every recommendation shows its path, its evidence, and the agent's full trail. You approve the intro message and it's sent on Telegram.

Built during the Personal Agents Hackathon (SF, Nov 20, 2026).

## How the sponsors are used

| Sponsor | What it does in Orbit |
|---|---|
| **Cognee Cloud** | **One brain per user** (`circleback_brain_me`). Every memory is added with **node sets** (`source:linkedin`, `source:luma`, `source:partiful`, `source:telegram`, `pillar:career`, `kind:event`, ...). `cognify` runs with a **custom career extraction prompt** that defines the node types (Person, Company, Role, Opportunity, Event, Skill) and relations (`works_at`, `hiring_for`, `can_introduce`, `interested_in`, `hosts`, ...). The agent's `recall` (GRAPH_COMPLETION) is **scoped by node set**, so family notes are never read for career answers. The **Brain** page renders the real Cognee graph (`/datasets/{id}/graph`). |
| **Superlinked SIE** | `extract` (GLiNER2 entities from notes), `chat` (Qwen3.8-27B: structured extraction and intro drafts), `encode` (bge-m3, 1024-dim, for notes, events and contacts, in batches), `score` (Qwen3-Reranker-4B ranks people against the goal on profile and notes, and ranks events against the goal). **Decision-model routing:** `GLiNER2.5-Decide` classifies every question. Simple lookups take a fast path (small Qwen3.5-4B, about 4s) and recommendations or intro planning take the deep path (Cognee graph + Qwen3.8-27B, about 13s). |
| **SingleStore** | Hybrid search over every note, event and contact (`DOT_PRODUCT` on `VECTOR(1024)` plus `MATCH AGAINST` full-text v2), people, promises, nudge SQL, `audit_log`, and the **landing zone for Airbyte syncs**. |
| **Airbyte** | Self-hosted Airbyte 2.5. The LinkedIn Connections export (via Google Sheets or CSV) syncs into SingleStore through Airbyte's MySQL connector. **Sync now** starts the job through the Airbyte API, then Orbit maps the rows straight to people (one batch embed, no LLM per row) and adds them to the brain. |
| **Telegram** | Capture notes on the go (`/me`) and send approved intro messages (`/iam <name>` links a contact). |

## Pages

- **Opportunities** (home): your goal, what the brain says, and ranked opportunity cards with "Send intro request".
- **Brain**: the live Cognee graph in 3D. Search and click any entity to see its relations.
- **Ask**: ask your brain anything ("Who can get me into Atlas Retail?").
- **People**: your circle by closeness tier, with editable profiles.
- **Sources**: LinkedIn via Airbyte, Luma and Partiful link import, Telegram, and quick notes.

## Run it

```bash
pnpm install
cp .env.example .env.local     # SIE, Cognee, SingleStore, Telegram, Airbyte
pnpm dev                       # http://localhost:3000
pnpm bot                       # Telegram poller
curl -X POST "localhost:3000/api/seed?cognee=1"   # demo data into SingleStore and the Cognee brain (cognify takes a few minutes)
```

## Demo (2 minutes)

1. **Opportunities**: the goal is "Land a product role building AI agents". The top card: **Ask Maya for an intro to Lena Park**. Open "How the agent decided" to see Cognee recall (scoped by node sets), the SingleStore hybrid search, and SIE rerank and draft.
2. Click **Send intro request**. The message arrives on Telegram.
3. **Sources**: paste a real Luma link (for example this hackathon's page). It's imported, embedded, and added to the brain with the `source:luma` node set.
4. **Brain**: the real Cognee graph with typed entities (Person, Company, Role, Opportunity, Event) and relations such as `Me → interested_in → voice agents` and `Marcus Wu → hiring_for → PM role`.
5. **Sources → Airbyte → Sync now**: LinkedIn connections land in SingleStore and then in the brain. A new contact's note ("works with Lena Park") creates a new referral path.

## Roadmap

- **Hive brain**: each user keeps one private brain. Opt-in shared "commons" (public hiring signals and events per field, such as AI or software engineering) would be separate Cognee datasets that the agent can read alongside the personal brain, using Cognee's dataset permissions.
