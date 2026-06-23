
-- =========== ROLES & PROFILES ===========
CREATE TYPE public.app_role AS ENUM ('admin','manager','cashier');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles read self or admin" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- First user becomes admin; subsequent users get cashier by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email);
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'cashier');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== CORE TABLES ===========
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat all auth" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup all auth" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_walk_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust all auth" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.customers(name, is_walk_in) VALUES ('Walk-in Customer', true);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT UNIQUE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece',
  expiry_date DATE,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_name ON public.products(name);
CREATE INDEX idx_products_barcode ON public.products(barcode);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod all auth" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== SALES ===========
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cashier_name TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  change_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  status TEXT NOT NULL DEFAULT 'completed', -- completed | held | cancelled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_created ON public.sales(created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales all auth" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_items all auth" ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== PURCHASES ===========
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'paid', -- paid | partial | unpaid
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purch all auth" ON public.purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi all auth" ON public.purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== RETURNS ===========
CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no TEXT NOT NULL UNIQUE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ret all auth" ON public.returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ri all auth" ON public.return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== SETTINGS (single row) ===========
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name TEXT NOT NULL DEFAULT 'My General Store',
  store_phone TEXT DEFAULT '',
  store_address TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'PKR',
  currency_symbol TEXT NOT NULL DEFAULT 'Rs.',
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  receipt_footer TEXT DEFAULT 'Thank you for shopping with us!',
  low_stock_alert BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read auth" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings write admin" ON public.settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

INSERT INTO public.settings(id) VALUES (1) ON CONFLICT DO NOTHING;

-- =========== STOCK BUSINESS FUNCTIONS ===========
-- process_sale: insert sale + items, decrement stock atomically
CREATE OR REPLACE FUNCTION public.process_sale(payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id UUID;
  v_invoice TEXT;
  v_item JSONB;
  v_stock NUMERIC;
  v_name TEXT;
BEGIN
  v_invoice := 'INV-' || to_char(now(),'YYMMDD') || '-' || lpad(floor(random()*10000)::text,4,'0');

  INSERT INTO public.sales(invoice_no, customer_id, cashier_id, cashier_name, subtotal, discount, tax, total, paid, change_due, payment_method, status, notes)
  VALUES (
    v_invoice,
    NULLIF(payload->>'customer_id','')::UUID,
    auth.uid(),
    payload->>'cashier_name',
    (payload->>'subtotal')::NUMERIC,
    COALESCE((payload->>'discount')::NUMERIC,0),
    COALESCE((payload->>'tax')::NUMERIC,0),
    (payload->>'total')::NUMERIC,
    COALESCE((payload->>'paid')::NUMERIC,0),
    COALESCE((payload->>'change_due')::NUMERIC,0),
    COALESCE(payload->>'payment_method','Cash'),
    COALESCE(payload->>'status','completed'),
    payload->>'notes'
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    -- Check stock if completed sale
    IF COALESCE(payload->>'status','completed') = 'completed' THEN
      SELECT stock_quantity, name INTO v_stock, v_name FROM public.products WHERE id = (v_item->>'product_id')::UUID FOR UPDATE;
      IF v_stock IS NULL THEN
        RAISE EXCEPTION 'Product not found';
      END IF;
      IF v_stock < (v_item->>'quantity')::NUMERIC THEN
        RAISE EXCEPTION 'Insufficient stock for %', v_name;
      END IF;
      UPDATE public.products SET stock_quantity = stock_quantity - (v_item->>'quantity')::NUMERIC, updated_at = now()
        WHERE id = (v_item->>'product_id')::UUID;
    END IF;

    INSERT INTO public.sale_items(sale_id, product_id, product_name, quantity, unit_price, purchase_price, discount, total)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'purchase_price')::NUMERIC,0),
      COALESCE((v_item->>'discount')::NUMERIC,0),
      (v_item->>'total')::NUMERIC
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.process_sale(JSONB) TO authenticated;

-- process_purchase: insert purchase + items, increment stock
CREATE OR REPLACE FUNCTION public.process_purchase(payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_ref TEXT;
  v_item JSONB;
BEGIN
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
$$;
GRANT EXECUTE ON FUNCTION public.process_purchase(JSONB) TO authenticated;

-- process_return: insert return + items, increment stock
CREATE OR REPLACE FUNCTION public.process_return(payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_ref TEXT;
  v_item JSONB;
BEGIN
  v_ref := 'RT-' || to_char(now(),'YYMMDD') || '-' || lpad(floor(random()*10000)::text,4,'0');
  INSERT INTO public.returns(reference_no, sale_id, total, refund_amount, reason, created_by)
  VALUES (
    v_ref,
    NULLIF(payload->>'sale_id','')::UUID,
    (payload->>'total')::NUMERIC,
    COALESCE((payload->>'refund_amount')::NUMERIC,0),
    payload->>'reason',
    auth.uid()
  ) RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    INSERT INTO public.return_items(return_id, product_id, product_name, quantity, unit_price, total)
    VALUES (
      v_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );
    IF v_item->>'product_id' IS NOT NULL THEN
      UPDATE public.products SET stock_quantity = stock_quantity + (v_item->>'quantity')::NUMERIC, updated_at = now()
      WHERE id = (v_item->>'product_id')::UUID;
    END IF;
  END LOOP;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.process_return(JSONB) TO authenticated;
