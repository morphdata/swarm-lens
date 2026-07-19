# Swarm Lens

A **Lens-style IDE for Docker Swarm**, built as a native desktop app:

- **Backend:** Go — talks to any server over **SSH** and drives the `docker` CLI (no agent, no exposed Docker TCP socket, nothing to install on your VPS)
- **Frontend:** React + TypeScript + Tailwind — runs natively as a **macOS app**/**Linux app** via [Wails v2](https://wails.io)
- **Contexts:** add as many servers as you like and switch between them from the top-bar dropdown, like kubeconfig contexts in Lens

![icon](./assets/appicon.png)

## Features

| Area | What you get |
| --- | --- |
| Dashboard | Swarm state, cluster name/ID, node role, daemon info, live CPU/memory/disk gauges with history |
| Nodes | List with status/availability/manager role, inspect JSON, drain / pause / activate, remove |
| Services | List with replica health, detail page with tasks, **live streaming logs**, inspect, scale, rolling restart (`service update --force`), remove |
| Stacks | List, expand to see services + tasks, jump into services, remove stack |
| Containers | Running/all containers on the host, logs (live), inspect, remove |
| Networks / Volumes / Secrets & Configs | Lists with search/sort + full inspect JSON |
| Metrics | Host gauges + sparklines (CPU/mem/disk/load/uptime) and a live `docker stats` table, 3s refresh |
| Servers | Add/edit/remove servers, **Test connection** before saving, per-server auth: SSH key, ssh-agent, or password; optional strict `known_hosts` checking |

Everything is parsed from `docker … --format '{{json .}}'` output over SSH, so any host where your user can run `docker` (root or the `docker` group) works.

## Architecture

```
┌──────────────────────┐   window.go.main.App.*   ┌────────────────────┐
│ React UI (frontend/) │ ───────────────────────▶ │ Go App (app.go)    │
│                      │ ◀── "logs:<kind>:<id>" ── │  Wails bindings    │
└──────────────────────┘      Wails events        └─────────┬──────────┘
                                                            │ pooled SSH conns
                                                  ┌─────────▼─────────┐
                                                  │ sshx.Manager      │
                                                  │ docker.Client     │ ──▶ docker CLI on any manager/VPS
                                                  └───────────────────┘
```

- `internal/store` — JSON server registry at `~/Library/Application Support/swarm-lens/servers.json` (mode `0600`)
- `internal/sshx` — SSH connection pool with keepalive probing and reconnect; one-shot + streaming command execution
- `internal/docker` — typed wrappers around the Docker CLI; host metrics sampled from `/proc/stat`, `free -b`, `df -B1` in a single SSH round-trip
- `app.go` — every exported method on `App` becomes a JS binding; log following is pushed to the UI via Wails events

Identifiers interpolated into remote commands are validated against a strict whitelist to prevent shell injection.

## Requirements

- **Build machine (your Mac):** macOS 11+, Go ≥ 1.25, Node ≥ 18 (LTS), Xcode Command Line Tools
- **Servers:** SSH access; the user can run `docker`. Connect to a swarm **manager** for cluster-wide views — workers and non-swarm hosts work with reduced functionality (the dashboard tells you).

## Build the macOS app

```bash
# once: install the Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

cd swarm-lens
wails build -platform darwin/arm64        # Apple Silicon
# wails build -platform darwin/amd64      # Intel
# wails build -platform darwin/universal  # universal binary

# result:
open "build/bin/Swarm Lens.app"
```

The app is unsigned, so on first launch either right-click → **Open**, or allow it in *System Settings → Privacy & Security*. For distribution, sign and notarize it (see Wails' code-signing guide).

## Develop

```bash
cd swarm-lens
wails dev                 # native app with hot-reload

# UI-only iteration in a browser (no backend/SSH needed):
cd frontend
npm install
npm run dev               # http://localhost:5173
```

In a plain browser the frontend automatically falls back to a **mock backend** with two realistic demo clusters (`prod-eu-1`, `staging-us-1`) — context switching, live logs, metrics, scaling and removals all work, which is exactly what the hosted preview shows.

## Data & security notes

- **Metrics/containers are per connected host.** Swarm has no built-in cluster metrics; `docker stats` and `docker ps` cover the host you're SSH'd into. Add other nodes as servers to see them.
- **Secrets values are never read** — Docker doesn't expose them; Swarm Lens lists and inspects metadata only.
- Credentials live only in your local config file (`0600`). Choose **ssh-agent** auth to store no secrets at all.
- Host key verification is accept-any by default for first-use convenience; enable **strict known_hosts** per server in the edit dialog.

## Project layout

```
swarm-lens/
├── main.go                  # Wails entrypoint (macOS options, embedded assets)
├── app.go                   # bound App struct: servers, contexts, resources, logs, metrics, actions
├── wails.json
├── internal/
│   ├── store/store.go       # server registry + active context (JSON, 0600)
│   ├── sshx/manager.go      # SSH pool, auth (key/agent/password), one-shot + streaming
│   └── docker/
│       ├── client.go        # docker CLI over SSH, JSON parsing, actions, overview fan-out
│       ├── hostmetrics.go   # CPU/mem/disk/load/uptime from /proc, free, df
│       └── types.go
├── build/
│   ├── appicon.png          # app icon (used by wails build)
│   └── darwin/Info.plist
└── frontend/                # React + TS + Tailwind (Vite)
    └── src/
        ├── api/             # Api interface, Wails bindings, mock backend (browser demo)
        ├── components/      # sidebar, top bar + context dropdown, tables, drawers,
        │                    # modals, log viewer, JSON tree, gauges
        └── views/           # dashboard, nodes, services (+detail), stacks, containers,
                             # networks, volumes, secrets & configs, metrics
```

## Roadmap ideas

- Deploy stack from a Compose file (upload + `docker stack deploy`)
- Service create/update wizard (image, env, mounts, constraints)
- Registry browser (tags, digests) and image pull/update
- Optional per-node metrics agent for cluster-wide utilization
- Pluggable log export (download filtered service logs)
