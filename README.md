# Ledger

A cross-platform, installable income/expense tracker with an encrypted local vault for logins. Runs entirely in the browser — no server, no account, no data leaving your device.

## Features

- **Money** — log income and expenses, categorize them, and see a 14‑day balance chart.
- **Vault** — an AES‑GCM encrypted store for logins, unlocked with a master password that never leaves the device.
- **Backup / restore** — export everything to a JSON file and re-import it anywhere.
- **Installable PWA** — add it to your home screen or dock on macOS, Windows, or Android.

## Project structure

```
index.html          markup
style.css            styling
src.js                app logic (finance ledger + vault crypto + PWA registration)
ledger.sql           optional schema, for if a backend/sync layer gets added later
.env.example         placeholder config for a future backend
package.json         dev dependencies (a static file server)
package-lock.json
```

## Run it locally

```bash
npm install
npm start
```

This serves the app at a local URL via `serve`. Open it in your browser.

## Install as an app

- **macOS / Windows (Chrome, Edge)**: open the app in the browser, then use the install icon in the address bar.
- **Android (Chrome)**: open the app, then "Add to Home screen" from the browser menu.

## Data & privacy

All transactions and vault entries are stored in `localStorage` on your device. The vault is encrypted with AES‑GCM using a key derived (PBKDF2, 250,000 iterations) from your master password — the password itself is never stored. There's no password recovery: if you forget it, the vault contents are unrecoverable by design.

## License

MIT
