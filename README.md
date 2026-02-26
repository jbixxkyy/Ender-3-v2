# PrintPilot (working name)

Local-first multi-printer 3D print dashboard for Klipper/Moonraker with CuraEngine slicing.

## Features in this scaffold

- pnpm monorepo (`apps/api`, `apps/web`, `packages/shared`)
- API with Fastify + Prisma + SQLite (`data/db.sqlite`)
- Multi-printer CRUD scaffold with Moonraker health/status endpoints
- Profile import scaffold + editable JSON config storage
- Slice pipeline:
  - STL/3MF upload to `data/uploads`
  - mock slicer enabled by default
  - optional CuraEngine wrapper (`CURA_ENGINE_PATH`)
  - sliced G-code in `data/sliced`
- Explicit confirmation flow:
  - slicing does **not** send
  - send does **not** auto-start print
  - start print requires explicit action
- UI presets in database:
  - `simplyprint-style` (default)
  - `klipper-print-styler`
- Frontend dashboard with SimplyPrint-inspired card layout
- WebSocket status tick endpoint (`/api/ws/status`)

## Quick start

```bash
pnpm i
cp apps/api/.env.example apps/api/.env
pnpm prisma:migrate
pnpm dev
```

- API: http://localhost:7128
- Web: http://localhost:5173

## Environment variables (API)

- `DATABASE_URL` default: `file:../../../data/db.sqlite`
- `PORT` default: `7128`
- `HOST` default: `127.0.0.1`
  - use `0.0.0.0` for LAN access
- `CURA_ENGINE_PATH`
  - default behavior falls back to mock slicing when unset
  - set to your CuraEngine executable path for real slicing

## CuraEngine notes

This scaffold includes a minimal wrapper command:

```bash
CuraEngine slice -j fdmprinter.def.json -l <input.stl> -o <output.gcode>
```

You should provide printer definition/resources available to CuraEngine in your runtime environment.

## Moonraker integration notes

The API currently scaffolds Moonraker reads and action endpoints. Wire in Moonraker command calls for production usage:

- Upload gcode
- Start/Pause/Resume/Cancel
- File management

The safety model is already enforced at API contract level: no auto-send or auto-start.

## Tailscale deployment guidance

Recommended pattern:
1. Keep API bound to `127.0.0.1` by default.
2. Run Tailscale on the host and expose the web/API ports through the tailnet.
3. Optionally add reverse proxy + auth in front of API for shared environments.

## Repository layout

```
apps/
  api/
  web/
packages/
  shared/
data/
```
