# Orbit

**Your network gets smarter as you move.**

Orbit is a personal career agent. It keeps one memory graph of your professional life: LinkedIn connections, events, emails, meetings, research and quick notes. It tells you **who to meet, who to reconnect with, and why they matter right now.** Every recommendation shows its reason and the path to the person, and comes with an intro message you approve before it's sent.

Built at the **Personal Agents Hackathon** (San Francisco, Nov 20, 2026).

---

## The problem

At one event you can meet ten people. Weeks later you remember the names, but not where you met, what they work on, or why they mattered to you. That context is scattered across LinkedIn, email, calendars, event pages and your own head.

## What Orbit does

1. **Captures context from what you already do:** LinkedIn connections, Luma and Partiful events, Gmail and calendar (through Airbyte), meeting notes, voice notes, and Telegram messages to the Orbit bot.
2. **Builds one brain per person.** Everything lands in a single Cognee knowledge graph, typed as Person, Company, Role, Opportunity, Event and Skill, and tagged by source.
3. **Answers in context.** Tell Orbit what you're doing ("I'm going to the Personal Agents Hackathon today") and it lights up what you already share with the people there:
   - **Opportunity:** Michael Moyo (CEO, Ocular AI) is judging today, and you applied to Ocular's Founding ML Engineer role on Nov 18.
   - **Reconnect:** Veljko, Daniel and Rahul judged Hive Mind, where you placed 2nd.
   - **Research match:** Sam Fraser's long-running agent work overlaps your SJSU inference research.
4. **Acts with you.** Orbit drafts the intro (directly, or through the friend who can introduce you), you approve it, and it sends on Telegram. Promises from your conversations are tracked so you keep them.

## Product tour

| Page | What you see |
|---|---|
| **Home** | Your goal, a one-line summary from your brain, and Best moves, Events, Keep warm and Reconnect, each with a detail drawer, the path and a draft |
| **Ask** | Ask anything about your network. Each answer shows its route (fast or deep), the people with labels (Opportunity, Reconnect, Research match), the evidence, and the full agent trail |
| **Brain** | Your live Cognee graph in 3D: thousands of entities and relations. Search or focus any person and see their relations |
| **People** | Everyone by closeness tier. Each person page is a full relationship timeline (LinkedIn, Luma, Gmail, calendar, meeting notes, voice notes, promises) with a link to their LinkedIn |
| **Sources** | LinkedIn via Airbyte, Luma/Partiful event import, Telegram, and quick notes |
| **/landing** | Product landing page |

---

## Sponsors and how Orbit uses them

### Cognee: the brain
- **One brain per user** (a single Cognee dataset), so every connection lives in one graph.
- **Node sets:** every memory is added with tags such as `source:linkedin`, `source:luma`, `source:gmail`, `source:meeting`, `source:voice`, `source:telegram` and `pillar:career`. Recall is scoped by node set, so personal notes never leak into career answers.
- **Custom extraction prompt:** `cognify` runs with a career-specific prompt. It defines the node types (Person, Company, Role, Opportunity, Event, Skill) and relations (`works_at`, `hiring_for`, `can_introduce`, `interested_in`, `hosts`, `judged`, ...). Hiring signals become Opportunity nodes.
- **GRAPH_COMPLETION recall** powers the agent's "your brain says" reasoning. The **Brain** page renders the real graph from `/datasets/{id}/graph`.

### Superlinked SIE: all of the AI
| Model | Job |
|---|---|
| `fastino/GLiNER2.5-Decide` | **Decision-model router.** It classifies every question: lookups go to a fast path, intro planning and strategy go to a deep path |
| `fastino/gliner2-large-v1` | Pulls people, companies, roles and topics out of every note |
| `BAAI/bge-m3` | 1024-dimension embeddings for notes, events and contacts, batched 64 at a time |
| `Qwen/Qwen3-Reranker-4B` | Ranks people against the question or your goal (on profile and notes), and ranks events |
| `Qwen/Qwen3.5-4B` | Fast-path answers (~4 s) |
| `Qwen/Qwen3.8-27B-FP8` | Structured extraction and intro drafts on the deep path |

### SingleStore: real-time search and state
- **Hybrid search** over every note, email, meeting and contact, in one query: `DOT_PRODUCT` on `VECTOR(1024)` plus `MATCH AGAINST` full-text (version 2).
- Tables for people and closeness tiers, promises (with nudge SQL for what's due and who's drifting) and an `audit_log` of every ask, ingest and send.
- **The landing zone for Airbyte syncs:** connector data lands in SingleStore, and Orbit maps it into people and memories.

### Airbyte: the doors in
- Self-hosted Airbyte 2.5, driven through its API: login, connection status, and **Sync now**.
- A SingleStore destination (through Airbyte's MySQL connector, since SingleStore speaks the MySQL protocol). Sources: LinkedIn connections (sheet or CSV), Gmail, Google Calendar, Slack.
- A structured-row importer maps synced contact tables straight to people: one batch embedding, no model call per row, and safe to re-sync.

### Firedrill: agent drills
- Orbit ships a drill suite (`pnpm drill`) of adversarial scenarios against the live agent, set up to run as a Firedrill campaign through the Firedrill MCP (`.mcp.json` → `https://mcp.firedrill.run`).
- The current drills, **6 of 6 passing**:

| Drill | Checks that |
|---|---|
| Privacy | family notes never reach a career answer |
| Routing | lookups take the fast path |
| Routing | intro planning takes the deep path |
| Second-degree paths | come with a real connector |
| Event context | today's judges with shared history come first |
| Drafts | only use known facts |

### Telegram
- Capture notes on the go (send `/me` to link your chat).
- Send approved intro messages (a contact sends `/iam <name>` to receive intros directly).

---

## Architecture

```
 Sources ─ LinkedIn · Luma/Partiful · Gmail/Calendar (Airbyte) · meetings · voice · Telegram
     │
     ▼
 Capture ── SIE extract (GLiNER2) + SIE chat (structured facts, promises)
     │
     ├──► SingleStore  : vectors + full-text, people, promises, audit log
     └──► Cognee       : one brain per user, node sets, career extraction prompt
     │
 Ask / Home agent
     1. SIE GLiNER2.5-Decide routes: fast lookup  or  deep reasoning
     2. SingleStore hybrid search  +  Cognee graph recall (scoped by node set)
     3. Today's event context (who is on the event page) + shared history → labels
     4. SIE rerank + tie strength + reachability (direct or via a connector)
     5. SIE draft → you approve → Telegram
```

## Run it

```bash
pnpm install
cp .env.example .env.local        # SIE, Cognee, SingleStore, Telegram, Airbyte
pnpm dev                          # http://localhost:3000
pnpm bot                          # Telegram bot
curl -X POST "localhost:3000/api/seed?cognee=1"   # demo data into SingleStore and Cognee
pnpm drill                        # agent drills
```

Deploy on Render with the included `render.yaml`: a web service with a persistent disk, plus the Telegram bot worker. Setting `ACCESS_KEY` puts the app behind a password; the landing page stays public.

## Roadmap
- **Hive brain:** an opt-in shared "commons" per field (AI, software engineering) that your private brain can read, using Cognee dataset permissions.
- Live Gmail and Calendar sync on a schedule, and transcription of Telegram voice notes with SIE Whisper.
- A morning brief: who you'll see today and what you promised them.
