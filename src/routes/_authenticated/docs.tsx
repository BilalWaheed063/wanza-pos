import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/docs")({ component: DocsPage });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="prose prose-sm max-w-none text-sm leading-6 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5">{children}</CardContent>
    </Card>
  );
}

function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Setup Guide</h1>
          <p className="text-sm text-muted-foreground">Everything you need to launch this POS for a new client.</p>
        </div>
      </div>

      <Section title="1. Change store settings (branding)">
        Go to <b>Settings</b> in the sidebar. Update the store name, logo URL, phone, email,
        address, currency, tax %, invoice prefix, theme color, and receipt footer. These appear
        on the dashboard, POS, printed receipt, reports, and login screen automatically — there
        is no hardcoded store name in the app.
      </Section>

      <Section title="2. Add products">
        Open <b>Categories</b> first and create the categories you sell (e.g. Grocery, Drinks,
        Cosmetics). Then go to <b>Products</b> → <b>Add product</b> and fill in name, SKU/barcode,
        category, supplier, purchase price, selling price, opening stock, and minimum stock for
        the low-stock alert. You can edit or deactivate products any time.
      </Section>

      <Section title="3. Create users (roles)">
        The very first account that signs up is auto-promoted to <b>admin</b>. Subsequent sign-ups
        default to <b>cashier</b>. To create a manager or another admin, ask them to sign up from the
        login screen, then open <b>Users</b> and change their role. Roles are:
        <ul className="list-disc pl-6">
          <li><b>Admin</b> — full access including Users, Demo Data, Setup.</li>
          <li><b>Manager</b> — products, purchases, suppliers, reports.</li>
          <li><b>Cashier</b> — POS, returns, customers only.</li>
        </ul>
      </Section>

      <Section title="4. Use the POS">
        Open <b>POS / New Sale</b>. Search a product by name/SKU or scan a barcode, set the
        quantity, optionally pick a customer, choose payment method, and click <b>Charge</b>. The
        receipt opens in a print-friendly window using your store branding. Stock is decremented
        automatically.
      </Section>

      <Section title="5. Test sale, purchase, return, reports">
        <ul className="list-disc pl-6">
          <li><b>Sale</b> — add a product to POS and complete it. Confirm the product stock drops in <b>Products</b>.</li>
          <li><b>Purchase</b> — go to <b>Purchases</b> → <b>New purchase</b>, add items from a supplier. Confirm stock increases.</li>
          <li><b>Return</b> — go to <b>Returns</b> → <b>New return</b>, pick the original invoice. Confirm stock returns.</li>
          <li><b>Reports</b> — open <b>Reports</b>; you should see sales, profit, top products and date filters.</li>
        </ul>
      </Section>

      <Section title="6. Clear demo data before going live">
        Open <b>Demo Data</b> (admin only). Click <b>Clear demo data</b> and confirm — this removes
        only rows tagged <code>[DEMO]</code>. Your real products, sales, and customers are never
        touched. Re-seed any time for testing.
      </Section>

      <Section title="7. Duplicate this template for another client">
        Each client gets their own isolated database. To launch a new client:
        <ol className="list-decimal pl-6">
          <li>Duplicate this project.</li>
          <li>Connect it to a fresh Lovable Cloud / backend project — this regenerates Supabase URL & publishable key in <code>.env</code> automatically.</li>
          <li>Apply the same migrations (already included in <code>supabase/migrations</code>).</li>
          <li>Set a custom domain for the new client.</li>
          <li>Sign in as the first user to become admin, then complete the first-time setup screen.</li>
        </ol>
        Because every table has Row-Level Security enabled and policies are scoped to the
        authenticated user / role, client data never crosses projects.
      </Section>
    </div>
  );
}
