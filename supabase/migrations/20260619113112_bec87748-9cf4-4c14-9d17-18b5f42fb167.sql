
-- Add white-label columns to settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS store_logo_url text,
  ADD COLUMN IF NOT EXISTS store_email text,
  ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT '#0ea5e9',
  ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;

-- Allow public (anon) to read store branding for login screen
GRANT SELECT ON public.settings TO anon;
DROP POLICY IF EXISTS "settings read public" ON public.settings;
CREATE POLICY "settings read public" ON public.settings
  FOR SELECT TO anon USING (true);

-- Update process_sale to use invoice_prefix from settings
CREATE OR REPLACE FUNCTION public.process_sale(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID;
  v_invoice TEXT;
  v_prefix TEXT;
  v_item JSONB;
  v_stock NUMERIC;
  v_name TEXT;
BEGIN
  SELECT COALESCE(invoice_prefix,'INV') INTO v_prefix FROM public.settings WHERE id=1;
  v_invoice := COALESCE(v_prefix,'INV') || '-' || to_char(now(),'YYMMDD') || '-' || lpad(floor(random()*10000)::text,4,'0');

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
    IF COALESCE(payload->>'status','completed') = 'completed' THEN
      SELECT stock_quantity, name INTO v_stock, v_name FROM public.products WHERE id = (v_item->>'product_id')::UUID FOR UPDATE;
      IF v_stock IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
      IF v_stock < (v_item->>'quantity')::NUMERIC THEN RAISE EXCEPTION 'Insufficient stock for %', v_name; END IF;
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
$function$;

-- Ensure a settings row exists
INSERT INTO public.settings (id, store_name) VALUES (1, 'My Store') ON CONFLICT (id) DO NOTHING;
