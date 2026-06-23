# POS & Inventory

A modern Point-of-Sale and inventory management web app for general stores,
groceries, marts, pharmacies, and small retail shops.

Built with **TanStack Start** (React 19 + Vite 7) on the frontend and
**Supabase** (Postgres + Auth + RLS) on the backend. White-label by design —
all branding (store name, logo, currency, tax, receipt footer, theme color)
lives in the database and is editable from the Settings page.

## Features

- POS billing with stock validation and receipt printing
- Inventory: products, categories, suppliers, low-stock alerts
- Purchases, sales returns, and customer management
- Reports: sales, profit, low-stock, top products
- Role-based access (admin / manager / cashier) enforced by Postgres RLS
- First-time setup wizard for new deployments
- Admin-only demo data seeder for testing

## Tech stack

- TanStack Start (file-based routing, server functions)
- React 19, Vite 7, Tailwind CSS v4, shadcn/ui
- Supabase (Postgres, Auth, Row-Level Security)
- TanStack Query for data fetching

## Quick start (local)

```bash
# 1. Install
npm install     # or: bun install / pnpm install

# 2. Configure env
cp .env.example .env
# Edit .env and fill in your Supabase project URL and publishable (anon) key.

# 3. Run the database migrations (see SUPABASE_SETUP.md)

# 4. Dev server
npm run dev     # http://localhost:8080
```

## Scripts

| Command         | Purpose                                        |
| --------------- | ---------------------------------------------- |
| `npm run dev`   | Local dev server (Vite + HMR)                  |
| `npm run build` | Production build                               |
| `npm run preview` | Preview the production build locally         |
| `npm run lint`  | ESLint                                         |
| `npm run format`| Prettier write                                 |

## Documentation

- [`ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md) — every env var explained
- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — create the database, run migrations, RLS
- [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md) — deploy to Vercel step-by-step
- [`CLIENT_SETUP.md`](./CLIENT_SETUP.md) — reuse this template for a new client
- [`TESTING_CHECKLIST.md`](./TESTING_CHECKLIST.md) — what to verify before going live

## License

Proprietary / internal template. Customize per client engagement.
