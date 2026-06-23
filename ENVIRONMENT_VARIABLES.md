# Environment Variables

All variables live in `.env` locally and in **Vercel → Project → Settings →
Environment Variables** for deployed environments. Use `.env.example` as the
authoritative template.

## Required (the app will not start without these)

| Variable                         | Where used | Notes                                                |
| -------------------------------- | ---------- | ---------------------------------------------------- |
| `VITE_SUPABASE_URL`              | Browser    | `https://<project-ref>.supabase.co`                  |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | Browser    | Supabase **anon / publishable** key. Safe to expose. |
| `SUPABASE_URL`                   | Server     | Same value as `VITE_SUPABASE_URL`.                   |
| `SUPABASE_PUBLISHABLE_KEY`       | Server     | Same value as `VITE_SUPABASE_PUBLISHABLE_KEY`.       |

## Optional

| Variable                          | Default            | Purpose                                                                 |
| --------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `VITE_SUPABASE_PROJECT_ID`        | —                  | Display-only; some integrations read it.                                |
| `SUPABASE_PROJECT_ID`             | —                  | Server mirror of the above.                                             |
| `SUPABASE_SERVICE_ROLE_KEY`       | —                  | **Server only.** Required only if you run admin/maintenance server fns. |
| `VITE_APP_NAME`                   | `POS & Inventory`  | Fallback browser tab title before settings load.                        |
| `VITE_APP_ENV`                    | `production`       | `development` / `staging` / `production`.                               |
| `VITE_DEFAULT_CURRENCY`           | `PKR`              | Fallback currency code before first settings row exists.                |
| `VITE_DEFAULT_CURRENCY_SYMBOL`    | `Rs.`              | Fallback currency symbol.                                               |

## Rules

1. **Never** put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` variable. Anything
   prefixed with `VITE_` is inlined into the browser bundle.
2. The publishable (anon) key **is safe** to expose; Row-Level Security on the
   database is what protects your data.
3. After changing env vars in Vercel, redeploy — Vite inlines env vars at
   build time.
4. For local dev: changing `.env` requires restarting `npm run dev`.

## On Vercel

Add each `VITE_*` variable to **all three** environments (Production, Preview,
Development) unless you intentionally want different values per environment.
Server-side variables (no `VITE_` prefix) can stay Production-only if Preview
deploys don't need them.
