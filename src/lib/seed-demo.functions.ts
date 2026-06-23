import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEMO_TAG = "[DEMO]";

export const getDemoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count: products }, { count: sales }, { count: purchases }] = await Promise.all([
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }).like("name", `${DEMO_TAG}%`),
      supabaseAdmin.from("sales").select("id", { count: "exact", head: true }).like("notes", `${DEMO_TAG}%`),
      supabaseAdmin.from("purchases").select("id", { count: "exact", head: true }).like("notes", `${DEMO_TAG}%`),
    ]);
    return { products: products ?? 0, sales: sales ?? 0, purchases: purchases ?? 0 };
  });

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Do NOT overwrite store settings — those are owned by the client via the Settings page.


    // Categories
    const catNames = ["Grocery","Beverages","Snacks","Dairy","Household","Personal Care","Frozen Items","Bakery"];
    const catRows = catNames.map(name => ({ name: `${DEMO_TAG} ${name}` }));
    const { data: cats } = await supabaseAdmin.from("categories")
      .upsert(catRows, { onConflict: "name" }).select("id,name");
    const cat = (n: string) => cats?.find(c => c.name === `${DEMO_TAG} ${n}`)?.id;

    // Suppliers (no unique constraint on name -> select-existing then insert missing)
    const supNames = ["Metro Wholesale","Islamabad Traders","Fresh Dairy Suppliers","Pak Beverages Distributor","Daily Mart Supply Co."];
    const supTagged = supNames.map(n => `${DEMO_TAG} ${n}`);
    const { data: existingSups } = await supabaseAdmin.from("suppliers")
      .select("id,name").in("name", supTagged);
    const missingSup = supNames
      .map((n, i) => ({ n, i, tagged: `${DEMO_TAG} ${n}` }))
      .filter(x => !existingSups?.some(e => e.name === x.tagged))
      .map(({ n, i, tagged }) => ({
        name: tagged,
        phone: `0300-100000${i + 1}`,
        email: `${n.toLowerCase().replace(/[^a-z]/g, "")}@demo.local`,
        address: "Islamabad, Pakistan",
      }));
    if (missingSup.length > 0) {
      await supabaseAdmin.from("suppliers").insert(missingSup);
    }
    const { data: sups } = await supabaseAdmin.from("suppliers")
      .select("id,name").in("name", supTagged);
    const sup = (n: string) => sups?.find(s => s.name === `${DEMO_TAG} ${n}`)?.id;

    // Customers (no unique constraint on name -> select-existing then insert missing)
    const custNames = ["Walk-in Customer","Ali Khan","Ahmed Raza","Sara Malik","Bilal Ahmed","Usman Tariq","Ayesha Noor","Hassan Ali","Fatima Zahra","Imran Shah"];
    const custTagged = custNames.map(n => `${DEMO_TAG} ${n}`);
    const { data: existingCusts } = await supabaseAdmin.from("customers")
      .select("id,name").in("name", custTagged);
    const missingCust = custNames
      .map((n, i) => ({ n, i, tagged: `${DEMO_TAG} ${n}` }))
      .filter(x => !existingCusts?.some(e => e.name === x.tagged))
      .map(({ i, tagged }) => ({
        name: tagged,
        phone: i === 0 ? null : `0301-200${String(i).padStart(4, "0")}`,
      }));
    if (missingCust.length > 0) {
      await supabaseAdmin.from("customers").insert(missingCust);
    }
    const { data: custs } = await supabaseAdmin.from("customers")
      .select("id,name").in("name", custTagged);

    // Products: [name, category, supplier, purchase, selling, stock, min, unit]
    type P = [string, string, string, number, number, number, number, string];
    const prods: P[] = [
      ["Rice 5kg","Grocery","Metro Wholesale",1200,1450,40,10,"pack"],
      ["Sugar 1kg","Grocery","Metro Wholesale",150,180,60,15,"kg"],
      ["Flour 10kg","Grocery","Metro Wholesale",1100,1300,25,5,"pack"],
      ["Cooking Oil 1L","Grocery","Islamabad Traders",520,600,50,10,"bottle"],
      ["Tea Pack 190g","Grocery","Islamabad Traders",280,350,80,20,"pack"],
      ["Milk 1L","Dairy","Fresh Dairy Suppliers",180,220,30,20,"bottle"],
      ["Yogurt 500g","Dairy","Fresh Dairy Suppliers",120,160,3,10,"cup"],     // low
      ["Bread","Bakery","Daily Mart Supply Co.",100,140,15,10,"loaf"],
      ["Eggs Dozen","Dairy","Fresh Dairy Suppliers",260,320,40,10,"dozen"],
      ["Butter 200g","Dairy","Fresh Dairy Suppliers",380,450,2,5,"pack"],     // low
      ["Coca Cola 1.5L","Beverages","Pak Beverages Distributor",150,190,70,15,"bottle"],
      ["Sprite 1.5L","Beverages","Pak Beverages Distributor",150,190,55,15,"bottle"],
      ["Mineral Water 1.5L","Beverages","Pak Beverages Distributor",60,90,120,30,"bottle"],
      ["Chips Pack","Snacks","Daily Mart Supply Co.",40,60,90,20,"pack"],
      ["Biscuits Pack","Snacks","Daily Mart Supply Co.",60,90,75,20,"pack"],
      ["Noodles Pack","Snacks","Daily Mart Supply Co.",45,70,0,10,"pack"],    // out
      ["Soap","Personal Care","Metro Wholesale",80,120,60,15,"piece"],
      ["Shampoo","Personal Care","Metro Wholesale",320,420,25,10,"bottle"],
      ["Toothpaste","Personal Care","Metro Wholesale",180,240,4,10,"tube"],   // low
      ["Washing Powder","Household","Metro Wholesale",350,450,30,10,"pack"],
      ["Dishwash Liquid","Household","Metro Wholesale",220,290,28,10,"bottle"],
      ["Tissue Roll","Household","Daily Mart Supply Co.",90,130,50,15,"roll"],
      ["Detergent Bar","Household","Metro Wholesale",60,90,80,20,"bar"],
      ["Frozen Paratha","Frozen Items","Daily Mart Supply Co.",280,360,18,8,"pack"],
      ["Ketchup","Grocery","Islamabad Traders",180,240,35,10,"bottle"],
      ["Mayonnaise","Grocery","Islamabad Traders",260,330,22,8,"bottle"],
      ["Salt","Grocery","Metro Wholesale",40,60,90,20,"pack"],
      ["Red Chili Powder","Grocery","Metro Wholesale",120,160,45,15,"pack"],
      ["Turmeric Powder","Grocery","Metro Wholesale",130,170,40,15,"pack"],
      ["Black Pepper","Grocery","Metro Wholesale",240,310,1,5,"pack"],       // low
      ["Lentils 1kg","Grocery","Metro Wholesale",280,340,55,15,"kg"],
      ["Chickpeas 1kg","Grocery","Metro Wholesale",260,320,48,15,"kg"],
      ["Beans 1kg","Grocery","Metro Wholesale",300,370,42,15,"kg"],
      ["Jam Bottle","Grocery","Islamabad Traders",320,410,20,8,"bottle"],
      ["Honey Bottle","Grocery","Islamabad Traders",650,820,15,5,"bottle"],
      ["Cornflakes","Grocery","Islamabad Traders",480,600,18,8,"box"],
      ["Juice Pack","Beverages","Pak Beverages Distributor",140,190,0,10,"pack"], // out
      ["Energy Drink","Beverages","Pak Beverages Distributor",180,230,40,10,"can"],
      ["Face Wash","Personal Care","Metro Wholesale",280,360,22,8,"tube"],
      ["Hand Wash","Personal Care","Metro Wholesale",220,290,30,10,"bottle"],
    ];

    const prodRows = prods.map(([name, c, s, pp, sp, qty, min, unit], i) => ({
      name: `${DEMO_TAG} ${name}`,
      sku: `DEMO-${String(i + 1).padStart(4, "0")}`,
      barcode: `999${String(1000000 + i)}`,
      category_id: cat(c) ?? null,
      supplier_id: sup(s) ?? null,
      purchase_price: pp,
      selling_price: sp,
      stock_quantity: qty,
      min_stock: min,
      unit,
      is_active: true,
    }));
    const { data: insertedProds, error: prodErr } = await supabaseAdmin.from("products")
      .upsert(prodRows, { onConflict: "sku" }).select("id,name,selling_price,purchase_price,stock_quantity");
    if (prodErr) throw prodErr;
    const pId = (n: string) => insertedProds?.find(p => p.name === `${DEMO_TAG} ${n}`);

    // Skip transactional seeding if already present (reference_no/invoice_no are unique)
    const { count: existingTxns } = await supabaseAdmin
      .from("sales").select("id", { count: "exact", head: true }).like("invoice_no", "DEMO-INV-%");
    if ((existingTxns ?? 0) > 0) return { ok: true, skippedTransactions: true };

    // Purchases: 5 records
    const purchasePlans = [
      { sup: "Metro Wholesale", items: [["Rice 5kg", 10, 1200], ["Sugar 1kg", 20, 150]], paidPct: 1 },
      { sup: "Islamabad Traders", items: [["Cooking Oil 1L", 24, 520], ["Tea Pack 190g", 30, 280]], paidPct: 0.5 },
      { sup: "Fresh Dairy Suppliers", items: [["Milk 1L", 40, 180], ["Yogurt 500g", 20, 120]], paidPct: 1 },
      { sup: "Pak Beverages Distributor", items: [["Coca Cola 1.5L", 24, 150], ["Mineral Water 1.5L", 48, 60]], paidPct: 0 },
      { sup: "Daily Mart Supply Co.", items: [["Chips Pack", 50, 40], ["Biscuits Pack", 50, 60]], paidPct: 1 },
    ];
    for (let i = 0; i < purchasePlans.length; i++) {
      const plan = purchasePlans[i];
      const total = plan.items.reduce((s, [, q, c]) => s + (q as number) * (c as number), 0);
      const paid = total * plan.paidPct;
      const status = plan.paidPct === 1 ? "paid" : plan.paidPct === 0 ? "unpaid" : "partial";
      const ref = `DEMO-PO-${String(i + 1).padStart(3, "0")}`;
      const { data: pur } = await supabaseAdmin.from("purchases").insert({
        reference_no: ref,
        supplier_id: sup(plan.sup),
        total, paid, payment_status: status,
        notes: `${DEMO_TAG} demo purchase`,
        created_by: context.userId,
      }).select("id").single();
      if (!pur) continue;
      for (const [name, qty, cost] of plan.items) {
        const p = pId(name as string);
        if (!p) continue;
        await supabaseAdmin.from("purchase_items").insert({
          purchase_id: pur.id, product_id: p.id, product_name: `${DEMO_TAG} ${name}`,
          quantity: qty as number, unit_cost: cost as number, total: (qty as number) * (cost as number),
        });
        // Don't double-add stock — products were seeded with desired stock already.
      }
    }

    // Sales: 15 across dates, payment methods
    const payMethods = ["Cash","Card","Bank Transfer","EasyPaisa","JazzCash"];
    const saleSpecs = [
      { days: 0, items: [["Rice 5kg",1],["Cooking Oil 1L",1],["Salt",1]] },
      { days: 0, items: [["Milk 1L",2],["Bread",1],["Eggs Dozen",1]] },
      { days: 0, items: [["Coca Cola 1.5L",2],["Chips Pack",3]] },
      { days: 1, items: [["Sugar 1kg",2],["Tea Pack 190g",1]] },
      { days: 1, items: [["Shampoo",1],["Soap",2]] },
      { days: 2, items: [["Biscuits Pack",4],["Mineral Water 1.5L",2]] },
      { days: 3, items: [["Flour 10kg",1],["Lentils 1kg",2]] },
      { days: 4, items: [["Ketchup",1],["Mayonnaise",1],["Bread",2]] },
      { days: 5, items: [["Energy Drink",3]] },
      { days: 6, items: [["Yogurt 500g",1],["Butter 200g",1]] },
      { days: 10, items: [["Washing Powder",1],["Dishwash Liquid",1]] },
      { days: 14, items: [["Honey Bottle",1],["Jam Bottle",1]] },
      { days: 18, items: [["Frozen Paratha",2],["Cornflakes",1]] },
      { days: 22, items: [["Face Wash",1],["Hand Wash",1],["Toothpaste",1]] },
      { days: 28, items: [["Chickpeas 1kg",2],["Beans 1kg",1],["Red Chili Powder",1]] },
    ];
    const customerIds = (custs ?? []).map(c => c.id);
    for (let i = 0; i < saleSpecs.length; i++) {
      const s = saleSpecs[i];
      const createdAt = new Date(Date.now() - s.days * 86400000).toISOString();
      const invoice = `DEMO-INV-${String(i + 1).padStart(3, "0")}`;
      const itemRows = s.items.map(([name, qty]) => {
        const p = pId(name as string)!;
        return { p, qty: qty as number };
      }).filter(x => x.p);
      const subtotal = itemRows.reduce((sum, r) => sum + r.qty * Number(r.p.selling_price), 0);
      const total = subtotal;
      const paid = total;
      const { data: sale } = await supabaseAdmin.from("sales").insert({
        invoice_no: invoice,
        customer_id: customerIds[i % customerIds.length] ?? null,
        cashier_id: context.userId,
        cashier_name: "Demo Cashier",
        subtotal, discount: 0, tax: 0, total, paid, change_due: 0,
        payment_method: payMethods[i % payMethods.length],
        status: "completed",
        notes: `${DEMO_TAG} demo sale`,
        created_at: createdAt,
      }).select("id").single();
      if (!sale) continue;
      for (const r of itemRows) {
        await supabaseAdmin.from("sale_items").insert({
          sale_id: sale.id, product_id: r.p.id, product_name: r.p.name,
          quantity: r.qty, unit_price: r.p.selling_price,
          purchase_price: r.p.purchase_price, discount: 0,
          total: r.qty * Number(r.p.selling_price),
        });
        // Decrement stock to reflect the sale
        await supabaseAdmin.rpc as any; // noop placeholder; do direct update
        await supabaseAdmin.from("products").update({
          stock_quantity: Math.max(0, Number(r.p.stock_quantity) - r.qty),
        }).eq("id", r.p.id);
        r.p.stock_quantity = Math.max(0, Number(r.p.stock_quantity) - r.qty) as any;
      }
    }

    // Returns: 3
    const { data: recentSales } = await supabaseAdmin.from("sales")
      .select("id,invoice_no,total").like("notes", `${DEMO_TAG}%`).limit(3);
    for (let i = 0; i < (recentSales?.length ?? 0); i++) {
      const s = recentSales![i];
      const { data: items } = await supabaseAdmin.from("sale_items")
        .select("product_id,product_name,unit_price").eq("sale_id", s.id).limit(1);
      const it = items?.[0];
      if (!it) continue;
      const ref = `DEMO-RT-${String(i + 1).padStart(3, "0")}`;
      const total = Number(it.unit_price);
      const { data: ret } = await supabaseAdmin.from("returns").insert({
        reference_no: ref, sale_id: s.id, total, refund_amount: total,
        reason: "Customer changed mind", created_by: context.userId,
      }).select("id").single();
      if (!ret) continue;
      await supabaseAdmin.from("return_items").insert({
        return_id: ret.id, product_id: it.product_id, product_name: it.product_name,
        quantity: 1, unit_price: it.unit_price, total,
      });
      if (it.product_id) {
        const { data: cur } = await supabaseAdmin.from("products")
          .select("stock_quantity").eq("id", it.product_id).single();
        await supabaseAdmin.from("products").update({
          stock_quantity: Number(cur?.stock_quantity ?? 0) + 1,
        }).eq("id", it.product_id);
      }
    }

    return { ok: true };
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Delete demo sales/purchases/returns by tagged notes; items cascade
    await supabaseAdmin.from("returns").delete().like("reference_no", "DEMO-RT-%");
    await supabaseAdmin.from("sales").delete().like("notes", `${DEMO_TAG}%`);
    await supabaseAdmin.from("purchases").delete().like("notes", `${DEMO_TAG}%`);
    await supabaseAdmin.from("products").delete().like("name", `${DEMO_TAG}%`);
    await supabaseAdmin.from("customers").delete().like("name", `${DEMO_TAG}%`);
    await supabaseAdmin.from("suppliers").delete().like("name", `${DEMO_TAG}%`);
    await supabaseAdmin.from("categories").delete().like("name", `${DEMO_TAG}%`);
    return { ok: true };
  });
