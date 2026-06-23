# Deploying to Vercel

This project uses **TanStack Start** on Vite. The dev setup in this repo
targets the Lovable-managed config (`@lovable.dev/vite-tanstack-config`)
which bundles its own Nitro target for Cloudflare. To ship to Vercel as a
standalone app you need a one-time `vite.config.ts` swap — see step 2 below.

## 1. Push to GitHub

Create a GitHub repo and push this codebase. Vercel deploys from Git.

## 2. Swap to the upstream TanStack Start Vite plugin (one-time)

Replace `vite.config.ts` with the upstream plugin and target Vercel's Node
runtime. This removes the Lovable wrapper.

```ts
// vite.config.ts (Vercel-ready)
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      target: "vercel",            // produces .vercel/output/
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
});
```

Then remove the Lovable config dependency:

```bash
npm uninstall @lovable.dev/vite-tanstack-config
npm install --save-dev @tanstack/react-start
```

> Note: while this repo lives inside Lovable, **keep the original
> `vite.config.ts`** so the preview keeps working. Only swap when you fork the
> repo for standalone Vercel deployment.

## 3. Create the Vercel project

1. Vercel dashboard → **Add New → Project** → Import the GitHub repo.
2. **Framework Preset**: *Other* (TanStack Start's Vite plugin emits the
   Vercel build output directly).
3. **Build Command**: `npm run build`
4. **Output Directory**: leave empty — the TanStack Vercel target writes to
   `.vercel/output` automatically.
5. **Install Command**: `npm install` (or `bun install`).

## 4. Environment variables

In Vercel → **Settings → Environment Variables**, add the values from
[`ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md). At minimum:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Add them to **Production, Preview, and Development** environments.

## 5. Deploy

Click **Deploy**. Vercel will build and serve the app. Refreshing on any inner
route (`/pos`, `/products/...`) works out of the box — TanStack Start handles
SPA routing.

## 6. Custom domain

Vercel → **Settings → Domains** → Add. Update Supabase **Auth → URL
Configuration** to allow your new domain in *Site URL* and *Redirect URLs*.

## 7. Post-deploy checklist

1. Open the deployed URL — you should see the login page.
2. Sign up the first user → that account is auto-promoted to `admin`.
3. Complete the first-time setup wizard.
4. (Optional) Sign in as admin → **Demo Data** → seed demo records.
5. Run through [`TESTING_CHECKLIST.md`](./TESTING_CHECKLIST.md).

## Troubleshooting

- **Blank page / "Missing Supabase environment variable"** — env vars are not
  set or the build didn't pick them up. Re-add them in Vercel and redeploy.
- **404 on refresh** — make sure the build output is `.vercel/output` (step 2)
  and you didn't add a `vercel.json` that overrides routing.
- **Auth redirects to `localhost`** — update Supabase Auth URL configuration
  to your Vercel domain.
