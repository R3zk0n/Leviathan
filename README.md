# Leviathan

Leviathan is a comprehensive mobile security analysis tool. It provides an automated, all-in-one solution for pentesting and security assessment of Android and iOS applications.

This repository is the **release tree**. Taint analysis is powered by the public [cxxsheng/appshark](https://github.com/cxxsheng/appshark/) engine, cloned at image build time. Leviathan’s own rules live in `Services/Engine/Rules/` and are added deliberately — the folder starts empty.

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
- [LIEF](Test)



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


.

## License

See [LICENSE](LICENSE).
