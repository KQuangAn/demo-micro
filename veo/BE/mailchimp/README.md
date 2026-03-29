# Mailchimp Webhook Listener

Listens for Mailchimp **subscribe** and **open** events and appends each event as a new row in an Excel file.

Built with FastAPI + openpyxl.

---

## Project Structure

```
mailchimp-webhook/
├── app/
│   ├── main.py                  # FastAPI app factory lifespan
│   ├── config.py                # Pydantic settings (readsenv)
│   ├── models/
│   │   └── webhook.py           # Typed event models
│   ├── routers/
│   │   └── webhook_router.py    # GET verify + POST handler
│   └── services/
│       ├── excel_service.py     # Thread-safe Excel append
│       └── parser_service.py    # Mailchimp form → typed model
├── data/                        # Excel file written here (auto-created)
├── .env.example
├── requirements.txt
└── README.md
```

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
MAILCHIMP_API_KEY=your-api-key-here
MAILCHIMP_WEBHOOK_SECRET=choose-any-random-string
EXCEL_FILE_PATH=./data/mailchimp_events.xlsx
```

- `MAILCHIMP_API_KEY` — from Mailchimp → Account → Extras → API Keys
- `MAILCHIMP_WEBHOOK_SECRET` — any random string you choose; appended to your webhook URL
- `EXCEL_FILE_PATH` — where the Excel file will be created (directory is auto-created)

### 3. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

---

## Registering the Webhook in Mailchimp

### Local development (ngrok)

```bash
npx ngrok http 8000
# → https://abc123.ngrok.io
```

Your webhook URL:
```
https://abc123.ngrok.io/webhooks/mailchimp?secret=your-webhook-secret
```

### In Mailchimp dashboard

1. Go to **Audience** → **Manage Audience** → **Settings** → **Webhooks**
2. Click **Create New Webhook**
3. Paste your URL (including `?secret=...`)
4. Enable events:
   - ✅ Subscribes
   - ✅ Opens (requires Mailchimp Transactional / Mandrill for per-email opens)
5. Save — Mailchimp fires a GET to verify; you should see `200 OK`

---

## Excel Output

Events are appended to the Excel file at `EXCEL_FILE_PATH`. Columns:

| Column | Description |
|---|---|
| Timestamp (UTC) | When the event was received |
| Event Type | `subscribe` or `open` |
| Email | Subscriber email address |
| List ID | Mailchimp audience/list ID |
| Campaign ID | Campaign that triggered the open (open events only) |
| Campaign Subject | Email subject line (open events only) |
| URL (click) | Clicked URL (click events only, not tracked here) |
| IP Address | Subscriber IP (open events only) |
| User Agent | Browser/client info (open events only) |
| Reason | Unsubscribe reason (not tracked here) |

---

## API Docs

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health check: http://localhost:8000/health

---

## Testing Locally

Simulate a subscribe event:

```bash
curl -X POST "http://localhost:8000/webhooks/mailchimp?secret=your-webhook-secret" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "type=subscribe&fired_at=2024-01-15+10:30:00&data[email]=test@example.com&data[list_id]=abc123&data[email_type]=html"
```

Simulate an open event:

```bash
curl -X POST "http://localhost:8000/webhooks/mailchimp?secret=your-webhook-secret" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "type=open&fired_at=2024-01-15+11:00:00&data[email]=test@example.com&data[list_id]=abc123&data[campaign_id]=camp456&data[ip]=1.2.3.4&data[user_agent]=Mozilla/5.0"
```
