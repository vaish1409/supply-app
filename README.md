# Bulk & Institutional Supply — Ordering Platform

A headcount-based ordering site: upload items once, buyers say how many people something needs to
cover, and quantities + pricing calculate automatically. Includes a cart, checkout (COD / online /
advance), an admin panel to manage the catalog and orders, and a real backend with its own database.

## What's inside

```
server/            Express API (products, orders, admin auth, payments)
  db.js             SQLite schema + first-run seeding
  routes/           /api/products, /api/orders, /api/auth
  middleware/auth.js  Verifies admin login tokens
public/             The website itself (storefront + admin panel)
  index.html, admin.html
  css/styles.css
  js/app.js, js/admin.js
uploads/            Product images land here (created automatically)
data.sqlite         The database file (created automatically on first run)
```

No build step, no frontend framework — plain HTML/CSS/JS talking to a small Express API. That keeps
it easy to read, cheap to host, and simple to hand to another developer later if needed.

## Running it locally

You'll need [Node.js](https://nodejs.org) 18 or newer installed.

```bash
cd supply-app
cp .env.example .env      # then open .env and set a real ADMIN_PASSWORD and JWT_SECRET
npm install
npm start
```

Open `http://localhost:3000` for the storefront, and `http://localhost:3000/admin.html` for the
admin panel. Log in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set in `.env` — that account is
created automatically the first time the server runs.

The database (`data.sqlite`) and a starter catalog of 5 sample items are created automatically on
first run. Delete or edit the sample items from the admin panel.

## Adding items

Admin panel → **Catalog** tab → fill in name, category, price, unit, and "amount per person" (this
is the number the headcount calculator multiplies by — e.g. 0.25 for 250g of rice per person, or 1
for one cap per person). Optionally attach a product photo.

## Taking online payments (optional)

Cash on delivery works out of the box with no setup. To enable "Pay online":

1. Create a [Razorpay](https://razorpay.com) account (or swap in Cashfree/PayU — the integration
   point is `server/routes/orders.js`).
2. Copy your **Key ID** and **Key Secret** into `.env`.
3. Restart the server. The "Online — UPI / card" option will start working automatically; it's
   disabled with a clear message until keys are present.

Payment amounts are always recalculated server-side from the current catalog before a Razorpay order
is created, and the payment signature is verified server-side too — the browser can't fake a total.

## Deploying it for real

This is a normal Node.js app, so any Node host works: Render, Railway, Fly.io, a VPS, etc.

1. Push this folder to a Git repository (add a `.gitignore` with `node_modules`, `.env`,
   `data.sqlite*`, `uploads/*` — keep `uploads/.gitkeep`).
2. On your host, set the environment variables from `.env.example` (use long random values for
   `JWT_SECRET` and a strong `ADMIN_PASSWORD` — do not reuse the example ones).
3. Set the start command to `npm install && npm start`.
4. **Important — file storage**: `data.sqlite` and `uploads/` are plain files on disk. Most hosting
   platforms (Render, Railway, Fly, etc.) wipe local disk on redeploy unless you attach a *persistent
   volume/disk*. On Render, mount a disk at `/var/data` and set `STORAGE_DIR=/var/data`; this preserves
   both the database and product images. Alternatively, swap SQLite for a hosted Postgres database later
   (the queries in `server/db.js` are simple and easy to port).
5. Point your domain at the host, and you're live. Send your father the storefront link, and keep the
   `/admin.html` link private.

## What to do before real customers use it

These are the safety-relevant gaps worth closing before go-live:

- **Change every default in `.env`** — especially `ADMIN_PASSWORD` and `JWT_SECRET`.
- **Add a persistent disk / real database** as above, or every deploy erases your catalog and orders.
- **Get real Razorpay (or equivalent) keys** if you want online payment — currently COD/advance work
  regardless, and online payment stays disabled until keys are added.
- **Set up GST invoice generation** — the order stores GSTIN and totals, but doesn't generate a
  formal invoice PDF yet; that's a good next feature to add once the flow is confirmed with your
  father.
- **Add WhatsApp/SMS order notifications** — a good fit once you've picked a provider (e.g. Twilio,
  MSG91, or the WhatsApp Business API).

## Customizing the look

All design tokens (colors, fonts) are CSS variables at the top of `public/css/styles.css` — change
those to shift the whole palette without hunting through the rest of the file.
