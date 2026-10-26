# AgriBridge

Flask web app for agricultural supply-chain workflows: farmer onboarding, produce
lots, marketplace search, buyer demand, transporter dispatching, and an admin
command center.

## Requirements

- Python 3.10 or newer (tested with 3.12)
- A Supabase project for authentication and data
- Internet access for Supabase and Google Fonts

## Setup

1. Unzip the project and open a terminal in the folder that contains `main.py`.

2. Create and activate a virtual environment (recommended):

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   macOS/Linux:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

4. Create your environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

   Then edit `.env` and fill in `SUPABASE_URL`, `SUPABASE_KEY`,
   `FLASK_SECRET_KEY`, and the `INITIAL_ADMIN_*` values.

5. In the Supabase dashboard, open **SQL Editor**, paste the contents of
   `supabase_schema.sql`, and run it once. This creates the tables, functions,
   and policies the app expects.

6. Start the app:

   ```powershell
   python main.py
   ```

   Open <http://127.0.0.1:3000>.

## Accounts and roles

- Public sign-up/sign-in: `/auth`. Choose `agent`, `buyer`, or `transporter`;
  the role is stored in the Supabase user metadata and controls which dashboard
  opens.
- Staff administrator: `/staff_login` only. Credentials come from
  `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` in `.env`. Staff
  credentials are deliberately rejected by the public `/api/login` endpoint.
- Direct dashboard routes redirect signed-out visitors: admin to `/staff_login`,
  everyone else to `/auth`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/public key |
| `FLASK_SECRET_KEY` | Signs session cookies; use a long random value |
| `FLASK_SESSION_COOKIE_SECURE` | `true` only when serving over HTTPS |
| `INITIAL_ADMIN_USERNAME` | Staff login username |
| `INITIAL_ADMIN_PASSWORD` | Staff login password |
| `INITIAL_ADMIN_NAME` | Display name in the admin dashboard |
| `FLASK_DEBUG` | `1` enables auto-reload; off by default |

Generate a secret key with:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

## Sharing this project

- **Never share the real `.env`.** It contains your Supabase keys and staff
  password. Send `.env.example` instead, or give the recipient their own values
  privately. If a real `.env` has already been shared, rotate the Supabase keys
  and change the admin password.
- The recipient needs their own Supabase project (or access to yours) with
  `supabase_schema.sql` applied. Without the tables, sign-in may work but
  farmer/produce/marketplace/demand/vehicle data cannot be stored.
- Keep `.env`, `__pycache__/`, and `.venv/` out of the zip.

## Troubleshooting

**Port 3000 already in use / socket errors**

Only one server may listen on port 3000. Check and stop stale processes:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress,OwningProcess
Stop-Process -Id <PID> -Force
```

If the Flask debug reloader was enabled, both the parent and child process must
be stopped. `python main.py` now runs as a single process unless
`FLASK_DEBUG=1` is set, which avoids two servers splitting in-memory state.

**Sign-in says authentication is not configured**

`SUPABASE_URL` / `SUPABASE_KEY` are missing or still placeholders in `.env`.
Restart the server after editing `.env`.

**Data actions fail with a "table not found" style error**

Apply `supabase_schema.sql` in the Supabase SQL Editor, then retry.

**Fonts do not load offline**

The UI falls back to system fonts; functionality is unaffected.
