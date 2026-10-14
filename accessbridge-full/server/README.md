# AccessBridge API — local JSON or MySQL storage

## Default setup (no database required)

From the project root, run `npm install` and `npm run dev`. The API loads its catalogue from `data/accessbridge.json` and stores search history in `data/search-history.json`.

## Optional MySQL setup

MySQL is optional. To enable it, start MySQL and configure the connection below. Copy `.env.example` to `.env` and set `STORAGE=mysql` along with the correct database credentials.

## Optional Hindi and Telugu neural speech

Create an Azure AI Speech resource in the [Azure portal](https://portal.azure.com/) and copy its key and region into `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in this folder's private `.env` file. Restart the API after setting them. `POST /api/speech` accepts only an allowlisted Hindi/Telugu voice and a short text response; it returns MP3 audio, does not save text/audio, and limits requests per IP. The browser never receives the Azure key. Azure Speech usage may incur charges; check [current pricing](https://azure.microsoft.com/en-us/pricing/details/speech/).

## Requirements for MySQL
- Node.js 20 or newer
- MySQL Server 8.0+ (or a compatible MySQL service)

## Setup
1. Start MySQL Server (for example, from MySQL Workbench or your system service manager).
2. In this `server` folder, copy `.env.example` to `.env`.
3. Edit `DB_USER` and `DB_PASSWORD` to match your local MySQL account. Keep `.env` private and out of Git.
4. Install and run the API:

   ```bash
   npm install
   npm start
   ```

The server creates the `schemes` and `search_history` tables automatically in the database named by `DB_NAME`. **Create the database itself first** if it does not exist, using MySQL Workbench or the MySQL command line:

```sql
CREATE DATABASE accessbridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The first time it connects to an empty `schemes` table, it imports the starter catalogue from `data/accessbridge.json`. It will not overwrite an existing SQL catalogue. `schema.sql` is included for reference/manual setup.

## Tables
- `schemes`: service name, category, descriptions, official URLs, audience, education/state arrays stored as JSON, documents, verification checklist and active flag.
- `search_history`: selected state, education, category, search text, result count and timestamp. Income is not collected or stored.

## API
- `GET /api/health`
- `GET /api/schemes?category=Education&q=student`
- `POST /api/match` with `{ "state":"Telangana", "education":"B.Tech", "category":"Education", "query":"" }`
- `GET /api/history?limit=20`
- `GET /api/stats`

Search history is global in this prototype and has no user login/privacy boundary. Do not deploy publicly with real user data until authentication, per-user authorization, migrations, backups and rate limiting are implemented.


## Official source checks

- `GET /api/sources` checks the allowlisted official portal URLs and returns their HTTP response and check timestamp.
- `GET /api/sources?refresh=1` bypasses the cache and checks again.
- The endpoint verifies link reachability, not the correctness of every scheme detail.
- Resource descriptions are directory summaries. Scheme rules and deadlines must be confirmed on the linked official portal.
- No generic scraping of arbitrary URLs is allowed. For automated scheme data ingestion, use a documented/authorized official API or dataset and store provenance per field.
