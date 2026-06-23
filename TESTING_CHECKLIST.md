# Testing Checklist

Run through this list before handing a deployment to a client.

## Environment

- [ ] App loads at the deployed URL with no console errors
- [ ] Missing env var shows a clear error (try unsetting one in a Preview deploy)

## Auth & roles

- [ ] First signup becomes admin
- [ ] Subsequent signups become cashier
- [ ] Admin can promote a user to manager / cashier from Users page
- [ ] Cashier cannot see Purchases, Suppliers, Users, Settings, Demo Data
- [ ] Manager can manage inventory & purchases but not user roles
- [ ] Direct URL access (e.g. /users as cashier) is blocked by RLS

## First-time setup

- [ ] Fresh database redirects admin to `/setup`
- [ ] Setup wizard saves store name, phone, address, currency, tax, invoice prefix, receipt footer
- [ ] After setup, admin lands on dashboard
- [ ] Branding (logo, store name) appears in sidebar, login, receipts

## POS

- [ ] Add product to cart, complete sale, print receipt
- [ ] Stock decreases on the product after sale
- [ ] Out-of-stock product cannot be sold
- [ ] Different payment methods record correctly
- [ ] Receipt shows correct store name, address, currency, footer

## Purchases

- [ ] Create a purchase → stock increases on each line item
- [ ] Purchase price updates on the product

## Returns

- [ ] Process a return → stock increases on returned items
- [ ] Refund amount records on the sale

## Reports

- [ ] Today / 7-day / 30-day sales totals match seeded data
- [ ] Low-stock report lists products below `min_stock`
- [ ] Top-selling products list populates

## Settings

- [ ] Changing store name updates sidebar and receipts immediately
- [ ] Theme color picker updates primary UI color
- [ ] Logo URL renders in sidebar and login page

## Demo data

- [ ] "Insert demo data" populates products, sales, purchases, returns, customers
- [ ] "Clear demo data" removes only `[DEMO]`-prefixed records
- [ ] Real records are untouched after clearing demo data

## Production safety

- [ ] Disabled public email signups in Supabase
- [ ] Cleared all demo data
- [ ] Verified RLS enabled on every table
- [ ] Set custom domain
