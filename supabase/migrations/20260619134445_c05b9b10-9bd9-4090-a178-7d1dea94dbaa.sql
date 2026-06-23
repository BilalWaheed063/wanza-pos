
DROP VIEW IF EXISTS public.customers_pos;
DROP VIEW IF EXISTS public.settings_public;

-- Public branding RPC (safe subset of settings)
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (
  store_name text,
  store_logo_url text,
  theme_color text,
  currency text,
  currency_symbol text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_name, store_logo_url, theme_color, currency, currency_symbol
  FROM public.settings WHERE id = 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- Cashier-safe minimal customer list
CREATE OR REPLACE FUNCTION public.pos_list_customers()
RETURNS TABLE (id uuid, name text, is_walk_in boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, is_walk_in FROM public.customers
  ORDER BY is_walk_in DESC, name
$$;
REVOKE EXECUTE ON FUNCTION public.pos_list_customers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_list_customers() TO authenticated;
