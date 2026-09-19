# Leviathan

Leviathan is a comprehensive mobile security analysis tool. It provides an automated, all-in-one solution for pentesting and security assessment of Android and iOS applications.

## Features
- Android static analysis: manifest parsing, components, intent filters, exported surface
- Appshark taint analysis with per-scan settings and a serialized scan queue
- iOS binary analysis and decompilation (Strongarm, LIEF)
- Decompilation via JADX, dex2jar, and Vineflower, with an in-browser code viewer
- Frida dynamic analysis: device management, spawn/attach, script injection, WebSocket REPL
- Secret scanning (TruffleHog)
- MCP server exposing scan data for triage tooling

## Technologies Used
- **Vue.js**: A progressive JavaScript framework for building user interfaces.
- **Vuetify**: A Vue UI Library with beautifully handcrafted Material Components.
- **Python**: For backend processing and security analysis.
- **Node.js**: For handling server-side logic and API endpoints.
- **Appshark**: For taint and source tracking of vulnerabilities.
- **PostgreSQL**: For robust and reliable data storage.
- **Docker**: For simplified deployment and scalability.


## Libraries Used
- [Strongarm-iOS](https://github.com/datatheorem/strongarm/tree/release)
- [Androguard](https://github.com/androguard/androguard)
- [Appshark](https://github.com/bytedance/appshark)
- [JADX](https://github.com/skylot/jadx)
- [LIEF](https://github.com/lief-project/LIEF)
- [Frida](https://github.com/frida/frida)
- [Radare2](https://github.com/radareorg/radare2)
- [r2ghidra](https://github.com/radareorg/r2ghidra)
- [Vineflower](https://github.com/Vineflower/vineflower)




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
````

## License

See [LICENSE](LICENSE).
