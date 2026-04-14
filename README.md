# WorkStream — Client Web (Business Portal)

Next.js 14 (App Router, TypeScript, Tailwind) business-facing portal for the WorkStream platform. Businesses (task providers) and their supervisors use this portal to create jobs, monitor tasks, manage agents, and handle billing.

## Requirements

- Node.js 18+ (tested on 20/24)
- npm

## Setup

```bash
npm install
cp .env.local .env.local   # already created; edit as needed
npm run dev                # starts on port 3200
```

Open [http://localhost:3200](http://localhost:3200).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port **3200** |
| `npm run build` | Production build |
| `npm run start` | Start production build on port 3200 |
| `npm run lint` | ESLint (Next core-web-vitals) |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

`.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3000
```

- API calls go through `src/lib/api.ts` (axios). Responses are unwrapped from `{success, data, timestamp}`.
- 401 responses redirect to `/login` **except** for `/auth/*` endpoints (so wrong-password errors surface).
- WebSocket namespace: `/notifications` on `NEXT_PUBLIC_WS_URL` (see `src/lib/socket.ts`).

## Pages

Auth (route group `(auth)`):
- `/login`
- `/register`

App (route group `(app)` — sidebar + workspace switcher):
- `/` — Workspace overview (stats, recent jobs, agent activity, live tasks)
- `/jobs` — Jobs list
- `/jobs/new` — 4-step create wizard (info → tasks → SLA → assignment)
- `/jobs/[id]` — Job detail + its tasks
- `/tasks` — Task board (Kanban / list)
- `/tasks/[id]` — Task detail + timeline + chat panel (live via socket)
- `/agents` — Agent pool
- `/team` — Supervisors/admins + invite flow
- `/workspaces` — Multi-workspace management
- `/billing` — Wallet, transactions, plans, invoices
- `/reports` — Performance analytics
- `/settings` — Workspace + SLA config

## Architecture notes

- **Dark mode**: `darkMode: 'class'` in `tailwind.config.js`, toggled by `src/lib/theme.tsx` (localStorage key `ws-client-theme`). No `next-themes`.
- **Auth token** stored under `ws-client-token`; workspace id under `ws-client-workspace` (sent as `X-Workspace-Id`).
- **Mocks**: every page falls back to `src/lib/mock.ts` when the backend is not reachable so UI renders immediately.
- **Components**: shadcn-style inline primitives in `src/components/ui.tsx` (`Button`, `Input`, `Card`, `Badge`, etc.) plus `StatCard`, `DataTable`, `TaskCard`, `AgentCard`, `Shell`.

## Build & type check

```bash
npm run build
npm run typecheck
```
