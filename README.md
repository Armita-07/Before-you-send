# Before You Send — Gmail Send Interceptor Extension

A Chrome browser extension that intercepts Gmail's **Send** button, analyzes the email content using **Gemini AI**, and shows a 3-second gut-check overlay before the email goes out. The overlay flags tone issues, missing context, or regrettable phrasing — color-coded **green/amber/red** with one plain-English reason.

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Gmail Tab       │────▶│  Background SW   │────▶│  Express API │
│  (Content Script)│◀────│  (Service Worker)│◀────│  (Backend)   │
│  + Shadow DOM    │     └──────────────────┘     │              │
│    Overlay       │                               │  Gemini AI   │
└──────────────────┘                               │  Supabase    │
                                                   └──────────────┘
```

- **Content Script**: Injects into Gmail, intercepts Send clicks, shows the overlay
- **Background Service Worker**: Relays API calls from content script to backend
- **Express Backend**: Calls Gemini API, stores analysis history in Supabase

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** 9+
- An [Gemini API key](https://aistudio.google.com/app/apikey)
- A [Supabase project](https://supabase.com/) (free tier works)

### 1. Set Up Supabase

Create these tables in your Supabase project's SQL Editor:

```sql
create table analyses (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  subject text,
  verdict text,
  reason text,
  flags text[],
  sent_anyway boolean default false,
  created_at timestamptz default now()
);

create table user_settings (
  user_id text primary key,
  enabled boolean default true,
  backend_url text,
  created_at timestamptz default now()
);
```

### 2. Run the Backend

```bash
cd backend
npm install
```

Edit `.env` with your credentials:

```env
GEMINI_API_KEY=your-gemini-api-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
PORT=3001
```

Start the server:

```bash
node index.js
# ✓ Before You Send backend running on http://localhost:3001
```

### 3. Build the Extension

```bash
cd extension
npm install
node scripts/generate-icons.js   # Generate extension icons
npm run build                     # Builds popup, content script, and background
```

The built extension will be in `extension/dist/`.

### 4. Load in Chrome

1. Open **chrome://extensions**
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/dist` folder
5. Navigate to [Gmail](https://mail.google.com) and compose an email!

---

## How It Works

1. **You click Send** in Gmail
2. The extension **intercepts** the click (prevents the email from sending)
3. It extracts the **subject** and **body** from the compose window
4. Sends it to the backend, which asks **Gemini** to analyze it
5. Shows a **color-coded overlay** at the top of the compose window:
   - 🟢 **Green** — Fine to send. Auto-sends in 3 seconds.
   - 🟡 **Amber** — Worth a second look. Stays until you act.
   - 🔴 **Red** — Think twice. Stays until you act.
6. You can **Send Anyway** or **Edit First**
7. If the backend is unreachable or takes >5s, it **fails open** — shows amber and auto-sends in 3s

---

## File Structure

```
before-you-send/
├── extension/
│   ├── manifest.json                 # Chrome MV3 manifest
│   ├── src/
│   │   ├── content/
│   │   │   ├── index.tsx             # Entry — injects overlay into Gmail DOM
│   │   │   ├── GmailInterceptor.ts   # Detects + intercepts Send button
│   │   │   ├── Overlay.tsx           # React overlay component
│   │   │   └── content.css           # Tailwind CSS for Shadow DOM
│   │   ├── background/
│   │   │   └── index.ts              # Service worker — relays to backend
│   │   └── popup/
│   │       ├── index.html            # Popup HTML entry
│   │       ├── main.tsx              # Popup React entry
│   │       ├── Popup.tsx             # Settings: backend URL, toggle on/off
│   │       └── popup.css             # Popup Tailwind CSS
│   ├── scripts/
│   │   └── generate-icons.js         # Icon generator
│   ├── vite.config.ts                # Multi-mode Vite configuration
│   ├── tailwind.config.js            # Tailwind with custom verdict colors
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── index.js                      # Express server entry
│   ├── routes/
│   │   └── analyze.js                # POST /analyze route
│   ├── lib/
│   │   └── gemini.js                 # Gemini API wrapper
│   ├── .env                          # API keys (not committed)
│   └── package.json
└── README.md
```

---

## Credentials Needed

| Credential | Where to get it | Where to put it |
|---|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/app/apikey) | `backend/.env` |
| `SUPABASE_URL` | Your Supabase project Settings → API | `backend/.env` |
| `SUPABASE_KEY` | Your Supabase project Settings → API (anon/public key) | `backend/.env` |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyze` | Analyze email content. Body: `{ subject, body, userId }` |
| `PATCH` | `/analyze/:id/sent` | Mark analysis as "sent anyway" |
| `GET` | `/analyze/history/:userId` | Get last 5 analyses + stats |
| `GET` | `/health` | Health check |

---

## Extension Popup

The popup provides:
- **Toggle**: Enable/disable the extension
- **Stats**: "X emails gut-checked, Y sent anyway"
- **History**: Last 5 analyses with color-coded verdict dots
- **Settings**: Configurable backend URL (default: `http://localhost:3001`)

---

## Technical Details

- **Shadow DOM**: The overlay is injected inside a Shadow DOM container to prevent Gmail's CSS from interfering
- **Bypass Flag**: Uses `element.dataset.bypassCheck = 'true'` to let re-triggered sends pass through
- **Fail Open**: If the backend is unreachable or takes >5s, the extension shows an amber warning and auto-sends in 3 seconds
- **MutationObserver**: Watches for dynamically created compose windows and their Send buttons
- **Capture Phase**: Click listeners use the capture phase to intercept before Gmail's handlers

---

## License

MIT
