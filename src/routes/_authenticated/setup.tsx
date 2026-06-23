import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/setup")({ component: SetupPage });

function SetupPage() {
  const { user, fullName, role, refresh } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const current = useSettings();
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({
    store_name: "", store_phone: "", store_address: "",
    currency: "PKR", currency_symbol: "Rs.", tax_percent: 0,
    receipt_footer: "Thank you for shopping with us!", invoice_prefix: "INV",
    admin_name: fullName || "",
  });

  useEffect(() => {
    if (current.setup_complete) nav({ to: "/dashboard", replace: true });
  }, [current.setup_complete, nav]);

  useEffect(() => { if (fullName && !v.admin_name) setV(s => ({ ...s, admin_name: fullName })); }, [fullName]); // eslint-disable-line

  if (role && role !== "admin") {
    return <div className="p-6 text-sm text-muted-foreground">Only an admin can complete the first-time setup.</div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("settings")
      .upsert({
        id: 1,
        store_name: v.store_name,
        store_phone: v.store_phone,
        store_address: v.store_address,
        currency: v.currency,
        currency_symbol: v.currency_symbol,
        tax_percent: v.tax_percent,
        receipt_footer: v.receipt_footer,
        invoice_prefix: v.invoice_prefix,
        setup_complete: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      .select("*")
      .single();
    if (!error && user && v.admin_name) {
      await supabase.from("profiles").update({ full_name: v.admin_name }).eq("id", user.id);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
    qc.setQueryData(["settings"], data);
    await qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Setup complete — welcome!");
    nav({ to: "/dashboard", replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground"><Store className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">First-time setup</h1>
          <p className="text-sm text-muted-foreground">Enter your store details to get started. You can change these later in Settings.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Store</CardTitle><CardDescription>Basic store information.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Store name *</Label><Input required value={v.store_name} onChange={e=>setV({...v, store_name: e.target.value})} placeholder="e.g. Sunrise Mart" /></div>
            <div><Label>Phone</Label><Input value={v.store_phone} onChange={e=>setV({...v, store_phone: e.target.value})} /></div>
            <div><Label>Invoice prefix</Label><Input value={v.invoice_prefix} onChange={e=>setV({...v, invoice_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")})} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Textarea value={v.store_address} onChange={e=>setV({...v, store_address: e.target.value})} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Currency & Tax</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div><Label>Currency code</Label><Input value={v.currency} onChange={e=>setV({...v, currency: e.target.value})} /></div>
            <div><Label>Currency symbol</Label><Input value={v.currency_symbol} onChange={e=>setV({...v, currency_symbol: e.target.value})} /></div>
            <div><Label>Default tax (%)</Label><Input type="number" step="0.01" value={v.tax_percent} onChange={e=>setV({...v, tax_percent: Number(e.target.value)})} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Admin profile</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div><Label>Your name</Label><Input value={v.admin_name} onChange={e=>setV({...v, admin_name: e.target.value})} /></div>
            <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
            <div className="sm:col-span-2"><Label>Receipt message</Label><Textarea value={v.receipt_footer} onChange={e=>setV({...v, receipt_footer: e.target.value})} /></div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={busy}><CheckCircle2 className="mr-2 h-4 w-4" />{busy ? "Saving…" : "Finish setup"}</Button>
        </div>
      </form>
    </div>
  );
}
