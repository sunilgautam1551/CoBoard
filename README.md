# CoBoard

A real-time, multiplayer infinite-canvas whiteboard. Create a board, share the
link, and draw together instantly — no signup required. Built to run entirely
on free tiers: **Next.js on Vercel Hobby**, **real-time + persistence on
Supabase's free tier**. Zero paid services, no license keys, no watermarks.

Two browser tabs on a deployed board draw together with live cursors, and the
board reloads exactly as it was left after a refresh.

## Features

- Infinite canvas: pan (space-drag / middle-mouse), zoom (wheel / pinch /
  buttons)
- Tools: select, pen (freehand), rectangle, ellipse, line, arrow, text, eraser
- Style controls (stroke, fill, width) with a recent-colors palette
- Select → move, resize/rotate (transform handles), multi-select, delete
- Undo / redo, clear board
- Live multiplayer: element sync, remote cursors with name labels, an avatar
  stack of who's online, and auto-reconnect with re-hydration
- Shareable board URLs (`/board/{id}`) that persist across refreshes and
  reconnects
- Keyboard shortcuts (press `?` on a board to see them), roving-tabindex
  toolbar, focus rings, ARIA labels, `prefers-reduced-motion` support
- Usable down to ~360px mobile widths, with touch drawing and pinch-zoom

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript (strict) | Vercel-native, SSR for the initial board load |
| Styling | Tailwind CSS v4 | Utility-first, no runtime cost |
| Canvas | react-konva (Konva) | Scene-graph canvas: shapes, drag, transform, hit-testing |
| Freehand strokes | perfect-freehand | Smooth pressure-style pen strokes |
| Local UI state | Zustand | Lightweight store for tool/selection/element state |
| Real-time transport | Supabase Realtime — Broadcast | Browser↔Supabase channels, no self-hosted socket server |
| Presence / cursors | Supabase Realtime — Presence | Built-in ephemeral presence |
| Persistence | Supabase Postgres | Board snapshot storage, 500 MB free |
| IDs | nanoid | Short URL-safe board/element ids |
| Deploy | Vercel Hobby | Free, one-push deploy |
| Keep-alive | Vercel Cron → `/api/keepalive` | Prevents the Supabase free-tier 7-day pause |

**Explicitly not used:** tldraw (requires a production license key and
watermark — fails the zero-cost constraint). Liveblocks, PartyKit, Ably, and
Pusher are all reasonable alternatives with their own free tiers, but this
project deliberately stays on a single vendor (Supabase) for both real-time
and persistence, to keep the whole app inside one free-tier budget instead of
juggling two. If you outgrow Supabase Realtime's limits, any of those are a
drop-in swap for the `src/features/sync` layer.

## Architecture

```
┌─────────────┐         Supabase Realtime          ┌─────────────┐
│  Browser A  │◀──── Broadcast + Presence  ────────▶│  Browser B  │
│ (react-konva│        channel: board:{id}          │ (react-konva│
│  + Zustand) │                                     │  + Zustand) │
└──────┬──────┘                                     └──────┬──────┘
       │  debounced snapshot write / initial load          │
       └───────────────┬───────────────────────────────────┘
                        ▼
              ┌───────────────────┐
              │ Supabase Postgres │   boards(id, snapshot jsonb, updated_at)
              └───────────────────┘
                        ▲
        Vercel Cron (every 3 days) ── keep-alive ping
```

Real-time edits and cursors flow **peer-to-peer through the Supabase
channel** (client → Supabase → all subscribers) — Vercel isn't in the sync
hot path. Persistence is a **debounced full-board snapshot** written to
Postgres by whichever client last changed something; new joiners load the
latest snapshot server-side, then subscribe to live ops. Next.js server
components/actions only handle initial page render, creating a board row, and
loading the snapshot for SSR.

**Sync protocol** (`src/features/sync/`): operation-based with **last-write-
wins per element id** — on receiving an `element:upsert`/`element:delete`, a
client applies it only if `incoming.updatedAt >= local.updatedAt`, tie-broken
by `updatedBy`. This keeps merges deterministic across clients without a full
CRDT. Ops that arrive before local hydration finishes are buffered and
replayed after.

**Message-budget discipline** (protects Supabase's 2M msg/month + 256 KB/msg
limits): cursors are sent via Presence throttled to ~1 update/50ms and only
when the pointer moved; freehand/drag/resize broadcast throttled intermediate
`upsert`s (~50ms) plus one immediate authoritative `upsert` on gesture end;
outgoing messages over 256 KB are dropped with a console warning rather than
sent. All the intervals live in `src/lib/config.ts`.

## Project structure

```
src/
  app/                    Routes: landing page, /board/[id], /api/keepalive
  features/
    canvas/                react-konva Stage, toolbar, tools, freehand/transform math
    board/                 Board create/share, SSR snapshot load, debounced save
    sync/                  Realtime channel, LWW merge, throttled broadcast bus
    presence/              Remote cursors, avatar stack, presence store
  store/                   Zustand stores (board state, toasts)
  lib/                     Supabase clients, config.ts (tunables), utils
  types/                   Shared Element/op/presence types
supabase/
  schema.sql               boards table + RLS policies — run this once
```

## Setup

### 1. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com). No credit card
required.

### 2. Run the schema

In the Supabase dashboard, open **SQL Editor → New query**, paste the
contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This
creates the `boards` table and its Row Level Security policies.

### 3. Get your keys

In **Project Settings → API**, copy the **Project URL** and the **anon
public** key.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
CRON_SECRET=any-random-string
```

`CRON_SECRET` protects `/api/keepalive` — generate one with, e.g.,
`openssl rand -hex 32`.

### 5. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Add the three environment variables from `.env.local` to the Vercel
   project (Production and Preview).
3. Deploy. `vercel.json` already declares the keep-alive cron
   (`/api/keepalive` every 3 days) — Vercel Hobby includes cron jobs, and
   Vercel automatically sends `CRON_SECRET` as a Bearer token, so no extra
   setup is needed.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also type-checks and lints) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier, writes changes |

## Free-tier trade-offs (read before you scale this up)

These are deliberate v1 decisions, not oversights:

1. **RLS is intentionally open.** Anyone with a board's URL can read and
   write it — there's no auth in v1 (anonymous-by-link, per the product
   spec). Locking this down with real accounts is the natural Phase 6 stretch
   (Supabase Auth + per-board permissions).
2. **Supabase free projects pause after 7 days of inactivity** and take up to
   ~30s to wake on the next request. The Vercel Cron keep-alive ping (every 3
   days) prevents the pause under normal use; `loading.tsx` on the board
   route explains the cold-start delay if you hit it anyway.
3. **200 concurrent Realtime connections** is the scaling ceiling on the free
   tier — fine for a demo or small team, not for a public launch.
4. **2,000,000 messages/month and 256 KB/message** are why every draw/drag/
   resize gesture is throttled instead of broadcasting on every pointer
   event — see "Message-budget discipline" above. Watch actual usage in the
   Supabase dashboard if you have several people using a board regularly.
5. **500 MB Postgres storage** — boards store a single JSON snapshot, not a
   full operation history, so this comfortably covers a large number of
   boards, but very large boards (thousands of elements) will eventually run
   into it.

## What's not built (see PRD for the full v1 scope)

No accounts, no comments/chat, no image uploads, no permissions/roles, no
native app, no AI features — all deliberately out of scope for v1. PNG/SVG
export, sticky notes, a "follow participant" viewport, and an optional
Yjs-CRDT sync layer are noted as Phase 6 stretch goals.
