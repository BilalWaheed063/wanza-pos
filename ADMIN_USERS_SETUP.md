# Admin Users & Roles Setup

The Users page already supports these admin actions:

- create a user directly from the dashboard
- assign `admin`, `manager`, or `cashier` role
- approve/re-enable/disable users
- reset passwords
- delete users

## Why the “valid Bearer token” error appears

Supabase Auth admin operations require a **server-only service role/secret key**. The app must never call `auth.admin.createUser()` from the browser.

In this project, the current `.env` had `SUPABASE_SERVICE_ROLE_KEY` set to a `sb_publishable_...` key. That is the anon/publishable key and cannot create users. This causes errors such as:

```txt
This endpoint requires a valid Bearer token
```

## Required environment variables

Add these in Vercel → Project → Settings → Environment Variables, then redeploy.

Browser variables:

```env
VITE_SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-anon-key"
```

Server variables:

```env
SUPABASE_URL="https://YOUR-PROJECT-REF.supabase.co"
SUPABASE_PUBLISHABLE_KEY="same-publishable-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-server-only-service-role-or-secret-key"
```

Important rules:

1. `SUPABASE_SERVICE_ROLE_KEY` must not start with `sb_publishable_`.
2. Do not add `VITE_` before `SUPABASE_SERVICE_ROLE_KEY`.
3. Do not expose the service role key in frontend code.
4. After changing env variables in Vercel, redeploy the project.

## Supabase database requirements

Run all migrations in `supabase/migrations/` on the active Supabase project. The latest migration includes:

- `profiles.status`
- `admin_set_user_status`
- `admin_set_user_role`
- `role_permissions`
- updated `handle_new_user` trigger

If these migrations are not pushed to the same Supabase project used by Vercel, role/status actions can fail even after the service role key is fixed.
