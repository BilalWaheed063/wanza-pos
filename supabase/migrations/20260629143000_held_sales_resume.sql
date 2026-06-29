-- Held sale helpers for POS.
-- A held sale is saved in public.sales with status='held'. Stock is not reduced until finalize_held_sale is called.

CREATE OR REPLACE FUNCTION public.update_held_sale(p_sale_id uuid, payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.sales WHERE id = p_sale_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Held sale not found';
  END IF;

  IF v_status <> 'held' THEN
    RAISE EXCEPTION 'Only held sales can be updated';
  END IF;

  UPDATE public.sales
  SET
    customer_id = NULLIF(payload->>'customer_id','')::uuid,
    cashier_id = auth.uid(),
    cashier_name = payload->>'cashier_name',
    subtotal = (payload->>'subtotal')::numeric,
    discount = COALESCE((payload->>'discount')::numeric, 0),
    tax = COALESCE((payload->>'tax')::numeric, 0),
    total = (payload->>'total')::numeric,
    paid = 0,
    change_due = 0,
    payment_method = COALESCE(payload->>'payment_method', 'Cash'),
    status = 'held',
    notes = COALESCE(payload->>'notes', notes)
  WHERE id = p_sale_id;

  DELETE FROM public.sale_items WHERE sale_id = p_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    INSERT INTO public.sale_items(
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      purchase_price,
      discount,
      total
    )
    VALUES (
      p_sale_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'purchase_price')::numeric, 0),
      COALESCE((v_item->>'discount')::numeric, 0),
      (v_item->>'total')::numeric
    );
  END LOOP;

  RETURN p_sale_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_held_sale(p_sale_id uuid, payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_status text;
  v_stock numeric;
  v_name text;
BEGIN
  SELECT status INTO v_status FROM public.sales WHERE id = p_sale_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Held sale not found';
  END IF;

  IF v_status <> 'held' THEN
    RAISE EXCEPTION 'Only held sales can be completed';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    SELECT stock_quantity, name INTO v_stock, v_name
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
    FOR UPDATE;

    IF v_stock IS NULL THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    IF v_stock < (v_item->>'quantity')::numeric THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_name;
    END IF;

    UPDATE public.products
    SET
      stock_quantity = stock_quantity - (v_item->>'quantity')::numeric,
      updated_at = now()
    WHERE id = (v_item->>'product_id')::uuid;
  END LOOP;

  UPDATE public.sales
  SET
    customer_id = NULLIF(payload->>'customer_id','')::uuid,
    cashier_id = auth.uid(),
    cashier_name = payload->>'cashier_name',
    subtotal = (payload->>'subtotal')::numeric,
    discount = COALESCE((payload->>'discount')::numeric, 0),
    tax = COALESCE((payload->>'tax')::numeric, 0),
    total = (payload->>'total')::numeric,
    paid = COALESCE((payload->>'paid')::numeric, 0),
    change_due = COALESCE((payload->>'change_due')::numeric, 0),
    payment_method = COALESCE(payload->>'payment_method', 'Cash'),
    status = 'completed',
    notes = COALESCE(payload->>'notes', notes)
  WHERE id = p_sale_id;

  DELETE FROM public.sale_items WHERE sale_id = p_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    INSERT INTO public.sale_items(
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      purchase_price,
      discount,
      total
    )
    VALUES (
      p_sale_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'purchase_price')::numeric, 0),
      COALESCE((v_item->>'discount')::numeric, 0),
      (v_item->>'total')::numeric
    );
  END LOOP;

  RETURN p_sale_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_held_sale(p_sale_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.sales WHERE id = p_sale_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Held sale not found';
  END IF;

  IF v_status <> 'held' THEN
    RAISE EXCEPTION 'Only held sales can be cancelled';
  END IF;

  UPDATE public.sales
  SET
    status = 'cancelled',
    notes = trim(COALESCE(notes, '') || ' Hold cancelled by POS.')
  WHERE id = p_sale_id;

  RETURN p_sale_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_held_sale(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_held_sale(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_held_sale(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_held_sale(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_held_sale(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_held_sale(uuid) TO authenticated;