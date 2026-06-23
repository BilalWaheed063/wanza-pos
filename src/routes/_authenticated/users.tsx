import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, UserPlus, KeyRound, Trash2, Check, X, Copy, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCreateUser, adminDeleteUser, adminListUsers, adminResetPassword } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/users")({ component: UsersPage });

type Row = { id: string; full_name: string | null; email: string; status: "pending"|"active"|"disabled"; role: string; created_at: string };

function genPassword(len = 10) {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function UsersPage() {
  const { role, user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const createFn = useServerFn(adminCreateUser);
  const resetFn = useServerFn(adminResetPassword);
  const deleteFn = useServerFn(adminDeleteUser);

  const list = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn() as Promise<Row[]>,
    enabled: role === "admin",
  });

  const setRoleM = useMutation({
    mutationFn: async ({ uid, role: r }: { uid: string; role: string }) => {
      const { error } = await supabase.rpc("admin_set_user_role", { _user_id: uid, _role: r as any });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatusM = useMutation({
    mutationFn: async ({ uid, status }: { uid: string; status: string }) => {
      const { error } = await supabase.rpc("admin_set_user_status", { _user_id: uid, _status: status });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "active" ? "User approved" : v.status === "disabled" ? "User disabled" : "Status updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (uid: string) => deleteFn({ data: { userId: uid } }),
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (role !== "admin") {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Shield className="mr-2 h-5 w-5" />Admin access required</div>;
  }

  const rows = list.data ?? [];
  const active = rows.filter(r => r.status === "active");
  const pending = rows.filter(r => r.status === "pending");
  const disabled = rows.filter(r => r.status === "disabled");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">Admin can invite users, approve signups, reset passwords, and manage roles.</p>
        </div>
        <CreateUserDialog onCreate={async (v) => {
          await createFn({ data: v });
          toast.success(`Account created for ${v.email}`);
          qc.invalidateQueries({ queryKey: ["admin-users"] });
        }} />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="disabled">Disabled ({disabled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card><CardContent className="p-4 sm:p-5">
            <UserTable
              rows={active}
              currentUserId={user?.id}
              renderActions={(u) => (
                <div className="flex items-center justify-end gap-2">
                  <ResetPasswordDialog email={u.email} onReset={async (pw) => {
                    await resetFn({ data: { userId: u.id, newPassword: pw } });
                  }} />
                  <Button size="sm" variant="outline" disabled={u.id === user?.id} onClick={() => setStatusM.mutate({ uid: u.id, status: "disabled" })}>
                    <Power className="mr-1 h-3 w-3" />Disable
                  </Button>
                  <Button size="sm" variant="destructive" disabled={u.id === user?.id} onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteM.mutate(u.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
              renderRole={(u) => (
                <Select value={u.role} onValueChange={v => setRoleM.mutate({ uid: u.id, role: v })} disabled={u.id === user?.id}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card><CardContent className="p-4 sm:p-5">
            {pending.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No pending signups.</div>
            ) : (
              <UserTable
                rows={pending}
                currentUserId={user?.id}
                renderActions={(u) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" onClick={() => setStatusM.mutate({ uid: u.id, status: "active" })}>
                      <Check className="mr-1 h-3 w-3" />Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`Reject and delete ${u.email}?`)) deleteM.mutate(u.id); }}>
                      <X className="mr-1 h-3 w-3" />Reject
                    </Button>
                  </div>
                )}
                renderRole={(u) => (
                  <Select value={u.role} onValueChange={v => setRoleM.mutate({ uid: u.id, role: v })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="disabled">
          <Card><CardContent className="p-4 sm:p-5">
            {disabled.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No disabled users.</div>
            ) : (
              <UserTable
                rows={disabled}
                currentUserId={user?.id}
                renderActions={(u) => (
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" onClick={() => setStatusM.mutate({ uid: u.id, status: "active" })}>
                      <Check className="mr-1 h-3 w-3" />Re-enable
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteM.mutate(u.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                renderRole={(u) => <span className="text-sm capitalize text-muted-foreground">{u.role}</span>}
              />
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserTable({ rows, currentUserId, renderActions, renderRole }: {
  rows: Row[]; currentUserId?: string;
  renderActions: (u: Row) => React.ReactNode;
  renderRole: (u: Row) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Joined</TableHead>
        <TableHead className="w-40">Role</TableHead>
        <TableHead className="w-[260px] text-right">Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map(u => (
          <TableRow key={u.id}>
            <TableCell className="font-medium">
              {u.full_name || "—"} {u.id === currentUserId && <Badge variant="secondary" className="ml-1">You</Badge>}
            </TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
            <TableCell>{renderRole(u)}</TableCell>
            <TableCell className="text-right">{renderActions(u)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CreateUserDialog({ onCreate }: { onCreate: (v: { email: string; password: string; fullName: string; role: "admin"|"manager"|"cashier" }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin"|"manager"|"cashier">("cashier");
  const [password, setPassword] = useState(() => genPassword());
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreate({ email, password, fullName, role });
      setCreated({ email, password });
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setOpen(false); setCreated(null); setEmail(""); setFullName("");
    setRole("cashier"); setPassword(genPassword());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" />Create user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "User created" : "Create a new user"}</DialogTitle>
          <DialogDescription>
            {created ? "Share these credentials with the user. They will not be shown again." : "Create an active account immediately and assign the role from the admin dashboard."}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
            <div><span className="text-muted-foreground">Email: </span><span className="font-mono">{created.email}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Password:</span>
              <span className="rounded bg-background px-2 py-1 font-mono">{created.password}</span>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(created.password); toast.success("Copied"); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <DialogFooter className="pt-2"><Button onClick={reset}>Done</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Full name</Label><Input value={fullName} onChange={e=>setFullName(e.target.value)} required /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
            <div><Label>Role</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Temporary password</Label>
              <div className="flex gap-2">
                <Input value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
                <Button type="button" variant="outline" onClick={() => setPassword(genPassword())}>Generate</Button>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create user"}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ email, onReset }: { email: string; onReset: (pw: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(() => genPassword());
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await onReset(pw); setDone(true); toast.success("Password reset"); }
    catch (err: any) { toast.error(err.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setDone(false); setPw(genPassword()); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><KeyRound className="mr-1 h-3 w-3" />Reset</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for <span className="font-mono">{email}</span>. Share it with them securely.</DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">New password:</span>
              <span className="rounded bg-background px-2 py-1 font-mono">{pw}</span>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(pw); toast.success("Copied"); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <DialogFooter className="pt-2"><Button onClick={() => setOpen(false)}>Done</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div><Label>New password</Label>
              <div className="flex gap-2">
                <Input value={pw} onChange={e=>setPw(e.target.value)} required minLength={6} />
                <Button type="button" variant="outline" onClick={() => setPw(genPassword())}>Generate</Button>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Resetting..." : "Reset password"}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
