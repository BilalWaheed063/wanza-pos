import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSettings, type StoreSettings } from "@/lib/settings";
import { ALL_PAGES, PAGE_LABELS, type PageKey } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const current = useSettings();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [v, setV] = useState<StoreSettings>(current);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setV(current); }, [current]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("settings").update({
      store_name: v.store_name, store_phone: v.store_phone, store_email: v.store_email,
      store_address: v.store_address, store_logo_url: v.store_logo_url,
      currency: v.currency, currency_symbol: v.currency_symbol, tax_percent: v.tax_percent,
      receipt_footer: v.receipt_footer, invoice_prefix: v.invoice_prefix, theme_color: v.theme_color,
      low_stock_alert: v.low_stock_alert,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Store Settings</h1>
        <p className="text-sm text-muted-foreground">White-label your store: branding, currency, tax, invoice & receipt.</p>
      </div>

      <MyAccountCard />

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Branding</CardTitle><CardDescription>Shown on dashboard, POS, receipts and the login screen.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Store name</Label><Input value={v.store_name} onChange={e=>setV({...v, store_name: e.target.value})} required /></div>
            <div className="sm:col-span-2"><Label>Store logo URL</Label><Input placeholder="https://…/logo.png" value={v.store_logo_url} onChange={e=>setV({...v, store_logo_url: e.target.value})} />
              {v.store_logo_url && <img src={v.store_logo_url} alt="Logo preview" className="mt-2 h-12 rounded border bg-white object-contain p-1" />}
            </div>
            <div><Label>Phone</Label><Input value={v.store_phone} onChange={e=>setV({...v, store_phone: e.target.value})} /></div>
            <div><Label>Email</Label><Input type="email" value={v.store_email} onChange={e=>setV({...v, store_email: e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Textarea value={v.store_address} onChange={e=>setV({...v, store_address: e.target.value})} /></div>
            <div><Label>Theme color</Label>
              <div className="flex gap-2">
                <Input type="color" className="h-10 w-16 p-1" value={v.theme_color} onChange={e=>setV({...v, theme_color: e.target.value})} />
                <Input value={v.theme_color} onChange={e=>setV({...v, theme_color: e.target.value})} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Currency & Tax</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><Label>Currency code</Label><Input value={v.currency} onChange={e=>setV({...v, currency: e.target.value})} /></div>
            <div><Label>Currency symbol</Label><Input value={v.currency_symbol} onChange={e=>setV({...v, currency_symbol: e.target.value})} /></div>
            <div><Label>Default tax (%)</Label><Input type="number" step="0.01" value={v.tax_percent} onChange={e=>setV({...v, tax_percent: Number(e.target.value)})} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Invoice & Receipt</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Invoice prefix</Label><Input value={v.invoice_prefix} onChange={e=>setV({...v, invoice_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")})} /></div>
            </div>
            <div><Label>Receipt footer message</Label><Textarea value={v.receipt_footer} onChange={e=>setV({...v, receipt_footer: e.target.value})} /></div>
            <div className="flex items-center gap-2"><Switch checked={v.low_stock_alert} onCheckedChange={x=>setV({...v, low_stock_alert: x})} /><Label>Show low-stock alerts on dashboard</Label></div>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save Settings"}</Button></div>
      </form>

      {role === "admin" && <RolePermissionsCard />}
    </div>
  );
}

function MyAccountCard() {
  const { user, fullName, refresh } = useAuth();
  const [name, setName] = useState(fullName);
  const [email, setEmail] = useState(user?.email ?? "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setName(fullName); }, [fullName]);
  useEffect(() => { setEmail(user?.email ?? ""); }, [user?.email]);

  const saveName = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Name updated");
    refresh();
  };
  const changeEmail = async () => {
    if (!email || email === user?.email) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Confirmation link sent to the new email. Open it to finish the change.");
  };
  const changePw = async () => {
    if (!pw || pw.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw("");
    toast.success("Password updated");
  };

  return (
    <Card>
      <CardHeader><CardTitle>My Account</CardTitle><CardDescription>Update your own name, email, and password.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-end gap-2">
          <div className="flex-1"><Label>Full name</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div>
          <Button type="button" variant="outline" onClick={saveName} disabled={busy || name === fullName}>Save name</Button>
        </div>
        <div className="sm:col-span-2 flex items-end gap-2">
          <div className="flex-1"><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <Button type="button" variant="outline" onClick={changeEmail} disabled={busy || email === user?.email}>Change email</Button>
        </div>
        <div className="sm:col-span-2 flex items-end gap-2">
          <div className="flex-1"><Label>New password</Label><Input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="At least 6 characters" /></div>
          <Button type="button" variant="outline" onClick={changePw} disabled={busy || pw.length < 6}>Change password</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RolePermissionsCard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role,page,allowed");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    const m: Record<string, Record<string, boolean>> = { manager: {}, cashier: {} };
    for (const r of q.data) {
      if (r.role === "manager" || r.role === "cashier") {
        m[r.role][r.page] = !!r.allowed;
      }
    }
    setMatrix(m);
  }, [q.data]);

  const toggle = (role: "manager"|"cashier", page: PageKey, v: boolean) => {
    setMatrix(m => ({ ...m, [role]: { ...m[role], [page]: v } }));
  };

  const save = async () => {
    setBusy(true);
    try {
      for (const r of ["manager","cashier"] as const) {
        const payload: Record<string, boolean> = {};
        for (const p of ALL_PAGES) payload[p] = matrix[r]?.[p] ?? false;
        const { error } = await supabase.rpc("admin_set_role_permissions", { _role: r as any, _pages: payload });
        if (error) throw error;
      }
      toast.success("Permissions saved");
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-allowed-pages"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Permissions</CardTitle>
        <CardDescription>Choose which pages each role can access. Admin always has full access.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead className="w-28 text-center">Admin</TableHead>
              <TableHead className="w-28 text-center">Manager</TableHead>
              <TableHead className="w-28 text-center">Cashier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_PAGES.map(p => (
              <TableRow key={p}>
                <TableCell className="font-medium">{PAGE_LABELS[p]}</TableCell>
                <TableCell className="text-center"><Checkbox checked disabled /></TableCell>
                <TableCell className="text-center">
                  <Checkbox checked={!!matrix.manager?.[p]} onCheckedChange={(v) => toggle("manager", p, !!v)} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox checked={!!matrix.cashier?.[p]} onCheckedChange={(v) => toggle("cashier", p, !!v)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save permissions"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
