# Reusing this template for a new client

This repo is a white-label POS template. Spinning up a new client means a new
Git fork + new Supabase project + new Vercel deployment. Nothing about the
codebase is client-specific — all branding comes from the database.

## Checklist

1. **Fork / duplicate** the GitHub repo for the new client.
2. **Create a new Supabase project** for the client (see
   [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)).
3. **Run the migrations** in `supabase/migrations/` against that project.
4. **Create a new Vercel project** pointing at the fork (see
   [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md)).
5. **Set environment variables** on Vercel with the new Supabase URL and
   publishable key.
6. **Deploy.** Open the live URL.
7. **Sign up the first user.** That account becomes `admin` automatically.
8. **Complete the first-time setup wizard** — enter the client's store name,
   phone, address, currency, tax %, receipt footer, invoice prefix, and
   optional logo URL.
9. (Optional) **Seed demo data** to demo the app, then clear it before going
   live.
10. **Create the cashier / manager accounts** the client needs.
11. **Connect a custom domain** in Vercel.
12. Hand off the admin credentials.

## What never needs code changes

- Store name, logo, phone, email, address
- Currency / currency symbol
- Tax percentage
- Invoice prefix
- Receipt footer text
- Theme color

All of these are editable from the **Settings** page after sign-in.

## What DOES need code changes (rare)

- Adding entirely new modules / pages
- Changing the role model
- Major schema additions
