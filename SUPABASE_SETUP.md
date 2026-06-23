# Supabase Setup

Each client should have **its own** Supabase project — never share databases.

## 1. Create the project

1. https://supabase.com → New project. Pick a region close to the store.
2. Save the **Project URL** and **anon (publishable) key** — these become
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## 2. Run migrations

All schema lives in [`supabase/migrations/`](./supabase/migrations/). Apply
them with the Supabase CLI:

```bash
npm i -g supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates every table, RLS policy, function, and trigger the app needs.

## 3. Auth configuration

In the Supabase dashboard → **Authentication → Providers**:

- Enable **Email** sign-in. For internal store staff, disable public sign-ups
  once the admin account is created.
- (Optional) Enable Google OAuth and add your Vercel domain to the redirect
  URLs.

Set **Site URL** and **Redirect URLs** to your deployed domain.

## 4. Create the first admin

The `handle_new_user` trigger auto-promotes the **very first signup** to
`admin`. Every subsequent signup becomes `cashier` by default; admins can
re-assign roles from the Users page.

So: sign up once via the live app, and you're the admin.

## 5. (Optional) Seed demo data

Sign in as admin → **Demo Data** page → **Insert demo data**. Use the
matching **Clear demo data** button to remove every `[DEMO]`-prefixed record
before going live.

## 6. Going live

- Disable public email sign-ups in Supabase Auth so only admin-created users
  can log in.
- Confirm RLS is **on** for every table in the public schema (Supabase
  Dashboard → Database → Tables → each table → RLS).
- Clear demo data.
- Update store settings in the Settings page.
