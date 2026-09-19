# Leviathan

Leviathan is a comprehensive mobile security analysis tool. It provides an automated, all-in-one solution for pentesting and security assessment of Android and iOS applications.

This repository is the **release tree**. Taint analysis is powered by the public [cxxsheng/appshark](https://github.com/cxxsheng/appshark/) engine, cloned at image build time. Leviathan’s own rules live in `Services/Engine/Rules/` and are added deliberately — the folder starts empty.

## Stack

- Frontend: Vue 3 + Vuetify + Vite (http://localhost:3000)
- Backend: Flask + PostgreSQL + Celery + Redis (http://localhost:5001)
- iOS twin: strongarm / LIEF (http://localhost:5003)
- Engine: AppShark + JADX + Vineflower + TruffleHog
- Optional: AI / MCP sidecar

## Quick start

1. Copy the env template and set real secrets:

   ```bash
   cp .env.example .env
   ```

   Generate keys:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Fill `SECRET_KEY`, `POSTGRES_PASSWORD`, and `INTERNAL_SERVICE_TOKEN`. Do not leave the `change-me` placeholders.

2. Build and start:

   ```bash
   docker compose up --build
   ```

3. Open http://localhost:3000 and register an account, then sign in.

Frontend hot-reload:

```bash
docker compose -f docker-compose.yml -f docker-compose-dev.yml up --build
```

## Architectures

Images build natively for the host CPU: `linux/amd64` and `linux/arm64` (Apple Silicon).

`ios-analysis` is the exception. `strongarm-dataflow` has no Linux arm64 wheel, so that one service stays `linux/amd64` (QEMU/Rosetta on M-series). Frida cannot run under that emulation, which is why the native `backend` service owns Frida and the amd64 twin owns iOS analysis.

Java tools (AppShark, JADX, Vineflower) and the UI are the same on both arches.

## Ports

This is a local lab tool. Redis, Postgres, and the engine bind to `127.0.0.1` so they are not on the LAN.

| Service | URL |
|---|---|
| UI | http://localhost:3000 |
| API | http://localhost:5001 |
| iOS API | http://localhost:5003 |
| Nginx (optional) | https://localhost:4433 |

## Rules

Put selected AppShark JSON rules in `Services/Engine/Rules/` and rebuild the engine image. See that folder’s README.

## License

See [LICENSE](LICENSE).
