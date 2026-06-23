
-- Restrict customers SELECT to admin/manager; cashiers use a minimal view
DROP POLICY IF EXISTS "customers read auth" ON public.customers;
CREATE POLICY "customers read mgr" ON public.customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE OR REPLACE VIEW public.customers_pos
WITH (security_invoker = on) AS
  SELECT id, name, is_walk_in FROM public.customers;
GRANT SELECT ON public.customers_pos TO authenticated;

-- The view uses security_invoker, so it needs its own permissive policy for cashiers
CREATE POLICY "customers read pos minimal" ON public.customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'cashier'));
-- ^ Cashier can still SELECT base table rows, but app only queries the view (minimal columns).
-- To strictly hide columns from cashiers, swap to security_invoker=off:
DROP POLICY IF EXISTS "customers read pos minimal" ON public.customers;
DROP VIEW IF EXISTS public.customers_pos;
CREATE VIEW public.customers_pos
WITH (security_invoker = off) AS
  SELECT id, name, is_walk_in FROM public.customers;
GRANT SELECT ON public.customers_pos TO authenticated;

-- Restrict suppliers SELECT to admin/manager only
DROP POLICY IF EXISTS "suppliers read auth" ON public.suppliers;
CREATE POLICY "suppliers read mgr" ON public.suppliers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Settings: remove anon access to base table; expose only branding via a view
DROP POLICY IF EXISTS "settings read public" ON public.settings;
REVOKE SELECT ON public.settings FROM anon;

CREATE OR REPLACE VIEW public.settings_public
WITH (security_invoker = off) AS
  SELECT id, store_name, store_logo_url, theme_color, currency, currency_symbol
  FROM public.settings WHERE id = 1;
GRANT SELECT ON public.settings_public TO anon, authenticated;
