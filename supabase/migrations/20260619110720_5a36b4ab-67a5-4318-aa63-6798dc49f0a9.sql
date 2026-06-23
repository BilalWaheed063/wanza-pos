
-- Tighten RLS policies by role

-- PROFILES: only self or admin can read
DROP POLICY IF EXISTS "profiles read all auth" ON public.profiles;
CREATE POLICY "profiles read self or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- USER_ROLES: only self or admin can read
DROP POLICY IF EXISTS "user_roles read self or admin" ON public.user_roles;
CREATE POLICY "user_roles read self or admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Helper predicate inlined: admin OR manager
-- PRODUCTS: read all auth, write admin/manager
DROP POLICY IF EXISTS "prod all auth" ON public.products;
CREATE POLICY "products read auth" ON public.products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "products write mgr" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "products update mgr" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "products delete mgr" ON public.products
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- CATEGORIES
DROP POLICY IF EXISTS "cat all auth" ON public.categories;
CREATE POLICY "categories read auth" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories write mgr" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "categories update mgr" ON public.categories FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "categories delete mgr" ON public.categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- CUSTOMERS: read all auth (needed at POS), write admin/manager
DROP POLICY IF EXISTS "cust all auth" ON public.customers;
CREATE POLICY "customers read auth" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers write mgr" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "customers update mgr" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "customers delete mgr" ON public.customers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- SUPPLIERS: read all auth, write admin/manager
DROP POLICY IF EXISTS "sup all auth" ON public.suppliers;
CREATE POLICY "suppliers read auth" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers write mgr" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "suppliers update mgr" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "suppliers delete mgr" ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- PURCHASES + PURCHASE_ITEMS: admin/manager only
DROP POLICY IF EXISTS "purch all auth" ON public.purchases;
CREATE POLICY "purchases mgr" ON public.purchases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

DROP POLICY IF EXISTS "pi all auth" ON public.purchase_items;
CREATE POLICY "purchase_items mgr" ON public.purchase_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- SALES + SALE_ITEMS: read all auth (reports), direct write admin/manager (cashiers write via SECURITY DEFINER process_sale)
DROP POLICY IF EXISTS "sales all auth" ON public.sales;
CREATE POLICY "sales read auth" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales write mgr" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "sales update mgr" ON public.sales FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "sales delete mgr" ON public.sales FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

DROP POLICY IF EXISTS "sale_items all auth" ON public.sale_items;
CREATE POLICY "sale_items read auth" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "sale_items write mgr" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "sale_items update mgr" ON public.sale_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "sale_items delete mgr" ON public.sale_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- RETURNS + RETURN_ITEMS: admin/manager direct (cashiers use process_return)
DROP POLICY IF EXISTS "ret all auth" ON public.returns;
CREATE POLICY "returns read auth" ON public.returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "returns write mgr" ON public.returns FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "returns update mgr" ON public.returns FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "returns delete mgr" ON public.returns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

DROP POLICY IF EXISTS "ri all auth" ON public.return_items;
CREATE POLICY "return_items read auth" ON public.return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "return_items write mgr" ON public.return_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "return_items update mgr" ON public.return_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "return_items delete mgr" ON public.return_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_sale(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_purchase(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_return(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.process_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_return(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- process_purchase: add admin/manager check inside, allow authenticated to call
CREATE OR REPLACE FUNCTION public.process_purchase(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_ref TEXT;
  v_item JSONB;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  v_ref := 'PO-' || to_char(now(),'YYMMDD') || '-' || lpad(floor(random()*10000)::text,4,'0');
  INSERT INTO public.purchases(reference_no, supplier_id, total, paid, payment_status, notes, created_by)
  VALUES (
    v_ref,
    NULLIF(payload->>'supplier_id','')::UUID,
    (payload->>'total')::NUMERIC,
    COALESCE((payload->>'paid')::NUMERIC,0),
    COALESCE(payload->>'payment_status','paid'),
    payload->>'notes',
    auth.uid()
  ) RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    INSERT INTO public.purchase_items(purchase_id, product_id, product_name, quantity, unit_cost, total)
    VALUES (
      v_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_cost')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );
    UPDATE public.products
    SET stock_quantity = stock_quantity + (v_item->>'quantity')::NUMERIC,
        purchase_price = (v_item->>'unit_cost')::NUMERIC,
        updated_at = now()
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_purchase(jsonb) TO authenticated;
