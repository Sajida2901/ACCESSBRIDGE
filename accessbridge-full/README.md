# AccessBridge — Essential Services Assistant

AccessBridge is a responsive website that helps people discover official Indian government service, education, scholarship and career-resource starting points. It works out of the box using its included JSON catalogue and does not require a MySQL installation.

> AccessBridge is an independent directory, not a government website. Results are potential matches only. Always verify eligibility, dates, documents and application availability on the official provider's website.

## Features

- Responsive landing page, service finder and resource cards.
- English, Telugu and Hindi interface copy.
- State and education preferences, category filtering and keyword search.
- Recommendation ordering with stable tie-breaking; no generic ₹8,00,000 income cutoff.
- Detail modal with audience notes, document checklist and verification reminders.
- Open official provider links in a new tab.
- Save/unsave resources in the current browser.
- Aadhaar help with translated UIDAI links, including direct Aadhaar-number verification on UIDAI; the site never collects Aadhaar numbers or OTPs.
- Recent searches stored locally, with a history dialog to restore previous filters.
- Optional MySQL storage for the official-resource catalogue and search history.
- API health status and user-friendly connection errors.
- Official-source transparency section with live portal-link checks, timestamps, source host labels, and clear limitations.
- Configurable CORS allowlist.

## Requirements

- Node.js 20 or newer (includes npm).
- VS Code (recommended).

## Run the website in VS Code

### 1. Install JavaScript dependencies

Run once from the project root:

```bash
npm install
```

### 2. Start frontend and backend together

From the project root:

```bash
npm run dev
```

Alternatively, double-click `start-accessbridge.bat` on Windows.

Open **http://localhost:5173** in your browser. The frontend runs on port 5173 and the API runs on port 5000. Stop both with `Ctrl+C` in the terminal. The included JSON catalogue powers searches and the assistant; search history is saved in `server/data/search-history.json`.

If you prefer separate terminals, use `npm run dev:server` and `npm run dev:client` from the project root.

### 3. Verify the backend

Open this URL in a browser:

- `http://localhost:5000/api/health` — should return `"ok":true` and `"storage":"JSON file"`.
- `http://localhost:5000/api/schemes` — returns the resource catalogue.
- `http://localhost:5000/api/stats` — returns resource and search counts.

## Optional MySQL storage

MySQL is not needed to run the website. To use it, create the `accessbridge` database, copy `server/.env.example` to `server/.env`, configure your database credentials, and change `STORAGE=json` to `STORAGE=mysql`. Start both apps with `npm run dev`. On first startup, the starter catalogue is imported into MySQL if its `schemes` table is empty.

## SQL tables

- `schemes`: resource name, category, descriptions, audience, document checklist, verification checklist, official URL and education metadata.
- `search_history`: selected state, education level, category, query, result count and timestamp. Income is not stored.

View data in MySQL Workbench: expand **Schemas → accessbridge → Tables**, then right-click a table and choose **Select Rows**.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API and active storage health check |
| GET | `/api/schemes` | List directory resources; supports `category` and `q` query parameters |
| GET | `/api/sources` | Check approved official portal links; cached for 10 minutes |
| GET | `/api/sources?refresh=1` | Force a fresh portal-link check |
| POST | `/api/match` | Return potential matches based on education, category and keyword |
| POST | `/api/speech` | Synthesize allowlisted Hindi/Telugu neural voice replies through Azure |
| GET | `/api/history?limit=20` | Return recent searches |
| GET | `/api/stats` | Resource and search counts |

Example match request body:

```json
{
  "state": "Telangana",
  "education": "Undergraduate",
  "category": "Scholarships",
  "query": "engineering"
}
```

## Important limitations before public launch

- The initial directory is a set of official starting points, not a comprehensive or continuously synchronized scheme database. Link checks are not content verification. Confirm official links and current eligibility manually.
- The catalogue is national. State is recorded for context but is **not** used as a verified state-specific eligibility filter.
- Income is optional in the UI and does not apply a universal cutoff or get stored in history.
- Search history is shared across anyone using this local prototype. Do not deploy publicly without authentication and per-user access controls.
- Saved items are stored in browser `localStorage`, so they are not shared across devices or users.
- Before production, add accounts, per-user saved-item storage, database migrations/backups, rate limiting, HTTPS, and managed secrets.

## GitHub safety

The `.gitignore` excludes `.env` files, `node_modules`, build output and logs. Commit `.env.example`, not your real `server/.env`.


## Official-source integrity mode

AccessBridge is deliberately configured as an **official portal directory**, not as an unofficial eligibility authority. Resource records link to the source portal and include short navigation summaries. Scheme-specific eligibility, benefit amounts, documents and deadlines must be checked on the official source before applying. The app does not invent deadlines or apply a universal income threshold.

### Live source-link checks

The backend exposes `GET /api/sources` and `GET /api/sources?refresh=1`. It checks a fixed allowlist of official portal URLs and reports the HTTP response, check time and limitations. This is a **link reachability check only**; it does not prove every statement on a portal is current or accurate. Some portals block automated checks. The browser therefore always retains the direct official link.

### Why this does not scrape every portal

Government portals do not share one universal, documented API for every scheme. Some publish dynamic pages, some have their own eligibility tools, and Open Government Data APIs are dataset-specific. AccessBridge does not scrape pages indiscriminately or treat search-engine snippets as official data. To import scheme-level records automatically, configure an official API/feed provided or permitted by the responsible department, record its source URL and retrieval timestamp, and validate each field before publishing it. The Open Government Data Platform is at https://www.data.gov.in/; individual API resources may require an API key and a specific resource ID.

### Accuracy checklist for production

1. Prefer an official API, downloadable government dataset, or explicit departmental feed over scraping HTML.
2. Keep `source_url`, `fetched_at`, `source_updated_at` (when the source publishes it), and a checksum/raw response audit record for imported data.
3. Do not mark content as verified just because the host responds. Separate `link_reachable` from `content_verified`.
4. Never derive eligibility from a general directory summary. Show the official scheme page and state when criteria could not be confirmed.
5. Do not claim state-specific matching unless the scheme data itself defines the applicable state/UT.
6. Do not publish guessed deadlines, income limits, benefits or document lists.

The `myScheme` portal describes itself as a national scheme discovery platform developed/managed by NeGD with MeitY and partner departments. NSP publishes its scheme listings and academic-year announcements directly on its official portal. Those pages remain the source of truth for current details.

## Voice assistant (English, Telugu, Hindi)

AccessBridge includes a floating **Talk to us** assistant. It listens using the selected English (India), Telugu or Hindi locale and automatically sends a final recognized spoken question, then speaks the reply when a matching voice is installed in the browser/operating system. Users can choose from available voices for the selected language. Voice input normally requires HTTPS or localhost and microphone permission; supported recognition languages and speaking voices depend on the browser and operating system. Browser speech recognition may process audio through the browser's configured speech service; AccessBridge does not store microphone audio. The app does not record or learn a person's individual voice or accent. If speech features are unavailable, users can type and read replies in the same chat. Windows language speech options can be installed from Settings > Time & language > Language & region; availability varies by language and Windows edition.

The assistant searches the local resource directory through `POST /api/assistant`. It returns only resources whose URLs are on the server's official-source allowlist. It is a directory-based guided assistant, not an unrestricted AI model: it does not scrape government pages live, decide eligibility, or invent benefits/deadlines. Each suggestion links to the official portal. The conversation is kept in the current browser component state and is not written to storage. The user can clear it at any time.

### Hindi and Telugu neural voice setup

Hindi and Telugu spoken replies use Azure AI Speech neural voices. Create a Speech resource in the [Azure portal](https://portal.azure.com/), then edit `server/.env` (or copy `server/.env.example` if missing) and fill in `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` from the resource's **Keys and Endpoint** page. Restart the API after setting them. Never put the key in client-side environment variables, paste it into chat, or commit it. The server sends only the assistant's reply text to Azure and returns audio without storing it. Azure usage may incur charges; check your subscription and [current Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/) before enabling it. Without the key and region, text chat and microphone transcription remain available, but neural audio reports setup requirements instead of being simulated.
