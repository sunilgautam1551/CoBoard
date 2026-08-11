# CoBoard

A real-time, multiplayer infinite-canvas whiteboard. Create a board, share the
link, and draw together instantly — no signup required. Built to run entirely
on free tiers: **Next.js on Vercel Hobby**, **real-time + persistence on
Supabase's free tier**.

Two browser tabs on a deployed board draw together with live cursors, and the
board reloads exactly as it was left after a refresh.

## Features

### Drawing tools

- **Select (`V`)** — click to select one element, Shift+click to add/remove
  from the selection, drag on empty canvas for a marquee (rubber-band)
  selection, drag a selected element to move it, use the transform handles to
  resize/rotate.
- **Hand (`H`)** — pan the canvas by dragging (same as holding Space or using
  a middle-mouse drag with any other tool active).
- **Pen (`P`)** — freehand drawing, smoothed with `perfect-freehand` into a
  clean stroked path rather than a raw polyline.
- **Rectangle (`R`) / Diamond (`D`) / Ellipse (`O`)** — click-drag to draw.
  Double-click inside any of them to attach a text label (see "Container
  text" below).
- **Line (`L`) / Arrow (`A`)** — two ways to draw:
  - **Click-drag** for a simple straight 2-point segment.
  - **Click, click, click, …** to build a multi-point polyline — each click
    locks in a vertex and starts rubber-banding the next segment. Finish with
    **Enter**, **Escape**, or a **second click near the last vertex**
    (a real double-click).
  
  Arrows additionally support **binding**: drop an endpoint on or near a
  rectangle/diamond/ellipse and it snaps to that shape's edge and stays
  attached — move, resize, or delete the shape and the arrow follows (or
  cleanly unbinds if the shape is deleted). Each end also has an independent
  **arrowhead style** — none, arrow, triangle outline, bar, or dot — set from
  the style panel.
- **Text (`T`)** — click anywhere for a free-floating text box that grows
  with its content and never wraps; double-click any existing text to edit it
  again. Multi-line text is supported (Enter inserts a real newline).
- **Eraser (`E`)** — click or drag over an element to delete it.

### Container text

Double-clicking inside a rectangle/diamond/ellipse doesn't drop an unrelated
text box on top of it — it attaches a **bound label**: the text centers
itself, word-wraps to the shape's usable width (a diamond and ellipse both
have a smaller usable area than their bounding box, since text has to stay
inside the sloped/curved edge, not the corners), and the shape **grows
automatically** to keep fitting it as you type or change the font size. The
label moves and rotates with its shape for free (it's rendered as a child of
the shape's own Konva node) and is never independently selectable, marquee-
selectable, or draggable — exactly like clicking on a label in most diagram
tools selects the box it's attached to, not the words.

### Style panel

A left-side floating panel shows only the controls relevant to the active
tool or current selection: stroke color (with a recent-colors row), fill
color and fill style (hachure / cross-hatch / solid), stroke width and style
(solid / dashed / dotted), sloppiness (architect / artist / cartoonist —
these map to different `roughness` values passed to `rough.js`), corner
style (sharp / round), arrowheads (arrow only), font size and text alignment
(text elements and bound labels), opacity, layer order (bring to
front / send to back), and duplicate/delete. Every control edits the current
selection live and broadcasts the change immediately — it isn't just a
"default for the next shape you draw."

### Selection & editing

- Multi-select via Shift+click or marquee-drag, then move/delete/duplicate/
  restyle the whole group at once.
- A single selected 2-point line/arrow gets dedicated **endpoint-drag
  handles** instead of a generic bounding-box Transformer, since dragging one
  of 8 resize handles is fiddly for "just move one end of a line." A
  multi-point line or anything else uses the standard Transformer
  (resize + rotate).
- **Undo/redo** (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`) over the full element
  history for this browser tab.
- **Duplicate** (`Ctrl/Cmd+D`, or the toolbar/context-menu button) and
  **copy/paste** (`Ctrl/Cmd+C` / `Ctrl/Cmd+V`) both carry a container's bound
  label along with it; paste drops the clone centered on your current cursor
  position instead of a fixed offset.
- **Right-click context menu** on any element: duplicate, bring to front,
  send to back, delete.
- **Clear board** asks for confirmation through a real dialog (not the
  browser's blocking `window.confirm()`) before wiping every element for
  everyone.

### Multiplayer

- Live element sync: every draw/move/resize/delete appears on every other
  open tab within the Supabase Realtime broadcast latency (typically well
  under a second).
- Remote cursors with name labels, an avatar stack showing who's currently on
  the board, and click-your-own-avatar to rename yourself.
- Auto-reconnect with exponential backoff and full state re-hydration if a
  connection drops.
- Shareable board URLs (`/board/{id}`) that persist across refreshes and
  reconnects — the "Share" button copies the current URL to the clipboard.

### Accessibility & polish

- Keyboard shortcuts for every tool and action (press `?` on a board to see
  the full list).
- Roving-tabindex toolbar (WAI-ARIA toolbar pattern), visible focus rings,
  ARIA labels/roles on every interactive control, `prefers-reduced-motion`
  support.
- Usable down to ~360px mobile widths, with touch drawing and pinch-zoom; the
  style panel's vertical position is measured against the toolbar's actual
  rendered height (which can wrap to multiple rows on narrow screens) instead
  of a guessed fixed offset.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript (strict) | Vercel-native, SSR for the initial board load |
| Styling | Tailwind CSS v4 | Utility-first, no runtime cost |
| Canvas | react-konva (Konva) | Scene-graph canvas: shapes, drag, transform, hit-testing |
| Sketchy rendering | rough.js | Hand-drawn-style shape/line outlines and fills |
| Freehand strokes | perfect-freehand | Smooth pressure-style pen strokes |
| Local UI state | Zustand | Lightweight store for tool/selection/element state |
| Real-time transport | Supabase Realtime — Broadcast | Browser↔Supabase channels, no self-hosted socket server |
| Presence / cursors | Supabase Realtime — Presence | Built-in ephemeral presence |
| Persistence | Supabase Postgres | Board snapshot storage, 500 MB free |
| IDs | nanoid | Short URL-safe board/element ids |
| Deploy | Vercel Hobby | Free, one-push deploy |
| Keep-alive | Vercel Cron → `/api/keepalive` | Prevents the Supabase free-tier 7-day pause |


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

**Bound text and arrow binding** (`src/features/canvas/lib/boundText.ts`,
`binding.ts`) are both modeled as plain references by id (`Element.containerId`
on a label, `Element.startBinding`/`endBinding` on a line/arrow) rather than
nested data structures, so they flow through the exact same upsert/delete
sync path as everything else — no special-casing in the realtime layer. A
container's bound text is looked up by scanning for `containerId === id`
rather than the container holding a reverse pointer, which keeps a
duplicate/paste from needing to keep two ids in sync by hand.

## Project structure

```
src/
  app/                       Routes: landing page, /board/[id], /api/keepalive
  components/                App-wide UI shared outside the canvas (toasts, confirm dialog)
  features/
    canvas/                  The board itself
      Canvas.tsx               Konva Stage + all pointer/keyboard/touch gesture handling
      ElementRenderer.tsx      Turns one element into Konva nodes (shapes, arrows, text)
      Toolbar.tsx               Tool picker, undo/redo, share/clear/shortcuts
      StylePanel.tsx            Context-sensitive style controls
      TextEditor.tsx            The DOM <textarea> overlay used while editing text
      ContextMenu.tsx           Right-click menu
      LineEndpointHandles.tsx   Drag handles for a selected 2-point line/arrow
      ShortcutsOverlay.tsx      "?" keyboard shortcuts modal
      ZoomIndicator.tsx         Bottom-right zoom controls
      styleIcons.tsx            Small inline SVG icons used by the style panel
      lib/                      Pure logic, no React: rough.js wrappers, freehand
                                 smoothing, transform math, marquee bounds, text
                                 measurement/wrapping, bound-text layout, arrow
                                 binding math, clipboard, and shared element actions
                                 (duplicate/delete/reorder/copy/paste)
      hooks/                    Global keyboard shortcut wiring
    board/                    Board create/share, SSR snapshot load, debounced save
    sync/                     Realtime channel, LWW merge, throttled broadcast bus
    presence/                 Remote cursors, avatar stack, name editor, presence store
  store/                      Zustand stores (board state — elements/selection/style/
                               history, and toast notifications)
  lib/                        Supabase clients, config.ts (tunables), identity/name
                               persistence, throttle helper, misc utils
  types/                      Shared Element/op/presence types — the single source of
                               truth both the store and the sync layer serialize against
supabase/
  schema.sql                  boards table + RLS policies — run this once
```

## Setup

### 1. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com).

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

## What's not built yet

1. No accounts
2. No comments/chat
3. No image uploads
4. No permissions/roles
5. No native app
6. No AI features.
7. No Curved and elbow-routed arrows (only straight/multi-point-straight are implemented)
