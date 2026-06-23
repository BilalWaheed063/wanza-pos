
-- 1) profiles.status
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','disabled'));

-- existing users -> active
UPDATE public.profiles SET status = 'active' WHERE status = 'pending';

-- 2) handle_new_user: first user = admin+active, others = cashier+pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE user_count INT;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN
    INSERT INTO public.profiles (id, full_name, email, status)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email, 'active');
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.profiles (id, full_name, email, status)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email, 'pending');
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'cashier');
  END IF;
  RETURN NEW;
END;
$$;

-- 3) role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  page TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role, page)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions read auth" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions write admin" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed defaults (admin = all on; manager = most; cashier = minimal)
INSERT INTO public.role_permissions(role, page, allowed) VALUES
  ('admin','dashboard',true),('admin','pos',true),('admin','products',true),('admin','categories',true),
  ('admin','customers',true),('admin','suppliers',true),('admin','purchases',true),('admin','returns',true),
  ('admin','reports',true),('admin','settings',true),('admin','users',true),('admin','docs',true),('admin','seed-demo',true),
  ('manager','dashboard',true),('manager','pos',true),('manager','products',true),('manager','categories',true),
  ('manager','customers',true),('manager','suppliers',true),('manager','purchases',true),('manager','returns',true),
  ('manager','reports',true),('manager','settings',true),('manager','users',false),('manager','docs',true),('manager','seed-demo',false),
  ('cashier','dashboard',true),('cashier','pos',true),('cashier','products',false),('cashier','categories',false),
  ('cashier','customers',true),('cashier','suppliers',false),('cashier','purchases',false),('cashier','returns',true),
  ('cashier','reports',false),('cashier','settings',false),('cashier','users',false),('cashier','docs',false),('cashier','seed-demo',false)
ON CONFLICT (role, page) DO NOTHING;

-- 4) helper: current user's allowed pages (admin always all)
CREATE OR REPLACE FUNCTION public.my_allowed_pages()
RETURNS TABLE(page TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rp.page
  FROM public.role_permissions rp
  JOIN public.user_roles ur ON ur.role = rp.role
  WHERE ur.user_id = auth.uid() AND rp.allowed = true
  UNION
  SELECT page FROM (VALUES
    ('dashboard'),('pos'),('products'),('categories'),('customers'),
    ('suppliers'),('purchases'),('returns'),('reports'),('settings'),
    ('users'),('docs'),('seed-demo')
  ) AS t(page)
  WHERE public.has_role(auth.uid(),'admin')
$$;

-- 5) admin set status (used by app to approve / disable)
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id UUID, _status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _status NOT IN ('pending','active','disabled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.profiles SET status = _status WHERE id = _user_id;
END;
$$;

-- 6) admin set role (replaces row in user_roles)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id UUID, _role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role);
END;
$$;

-- 7) admin upsert role permissions (single role bulk)
CREATE OR REPLACE FUNCTION public.admin_set_role_permissions(_role public.app_role, _pages JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k TEXT; v BOOLEAN;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOR k, v IN SELECT key, value::text::boolean FROM jsonb_each_text(_pages) LOOP
    INSERT INTO public.role_permissions(role, page, allowed, updated_at)
    VALUES (_role, k, v, now())
    ON CONFLICT (role, page) DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now();
  END LOOP;
END;
$$;
