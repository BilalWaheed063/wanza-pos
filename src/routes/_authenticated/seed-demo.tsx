import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Database, Trash2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getDemoStatus, seedDemoData, clearDemoData } from "@/lib/seed-demo.functions";

export const Route = createFileRoute("/_authenticated/seed-demo")({ component: SeedDemoPage });

function SeedDemoPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const statusFn = useServerFn(getDemoStatus);
  const seedFn = useServerFn(seedDemoData);
  const clearFn = useServerFn(clearDemoData);
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);

  const status = useQuery({
    queryKey: ["demo-status"],
    queryFn: () => statusFn({}),
    enabled: role === "admin",
  });

  const seed = useMutation({
    mutationFn: () => seedFn({}),
    onMutate: () => setBusy("seed"),
    onSettled: () => setBusy(null),
    onSuccess: () => {
      toast.success("Demo data inserted");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to seed"),
  });

  const clear = useMutation({
    mutationFn: () => clearFn({}),
    onMutate: () => setBusy("clear"),
    onSettled: () => setBusy(null),
    onSuccess: () => {
      toast.success("Demo data cleared");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to clear"),
  });

  if (role !== "admin") {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Admin access required.</CardContent></Card>
      </div>
    );
  }

  const s = status.data ?? { products: 0, sales: 0, purchases: 0 };
  const hasDemo = s.products > 0 || s.sales > 0 || s.purchases > 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6" /> Demo Data</h1>
        <p className="text-sm text-muted-foreground">Seed safe, clearly tagged demo records for testing. Only affects rows tagged <code>[DEMO]</code>.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current demo data</CardTitle>
          <CardDescription>Counts of records currently tagged as demo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat label="Products" value={s.products} />
            <Stat label="Sales" value={s.sales} />
            <Stat label="Purchases" value={s.purchases} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Seeding skips items that already exist (matched by name/SKU). Clearing removes only [DEMO] rows.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={busy !== null}>
                <Sparkles className="h-4 w-4 mr-2" />
                {hasDemo ? "Re-seed demo data" : "Seed demo data"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Insert demo data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will add 8 categories, 5 suppliers, 10 customers, 40 products, 5 purchases, 15 sales and 3 returns — all clearly tagged with [DEMO]. Existing real data is not modified.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => seed.mutate()}>Insert</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={busy !== null || !hasDemo}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear demo data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear demo data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes every row tagged [DEMO] — products, customers, suppliers, categories, and their associated demo sales, purchases, and returns. Real data is untouched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => clear.mutate()}>Delete demo data</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test users</CardTitle>
          <CardDescription>Create these manually from the sign-up page, then assign roles in the Users page.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>• <b>Admin</b> — the first signed-up user is auto-promoted to admin.</div>
          <div>• <b>Manager</b> — sign up a second account, then set role to <code>manager</code>.</div>
          <div>• <b>Cashier</b> — sign up a third account; defaults to <code>cashier</code>.</div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
