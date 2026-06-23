import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminRole = "admin" | "manager" | "cashier";

const VALID_ROLES: AdminRole[] = ["admin", "manager", "cashier"];

function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidRole(role: string): role is AdminRole {
  return VALID_ROLES.includes(role as AdminRole);
}

function adminErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("valid bearer token") ||
    lower.includes("jwt") ||
    lower.includes("service_role") ||
    lower.includes("service role")
  ) {
    return "Supabase service role key is missing or invalid. Add the real server-only SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.";
  }
  return message;
}

async function assertAdmin(context: any) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden: admin access required");
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name,email,status,created_at").order("created_at"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);
    if (profileError) throw new Error(adminErrorMessage(profileError.message));
    if (roleError) throw new Error(adminErrorMessage(roleError.message));
    const roleMap = new Map<string, string>();
    for (const r of (roles ?? []) as any[]) roleMap.set(r.user_id, r.role);
    return (profiles ?? []).map((p: any) => ({ ...p, role: roleMap.get(p.id) ?? "cashier" }));
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; fullName: string; role: AdminRole }) => {
    if (!d?.email) throw new Error("Email is required");
    if (!d?.fullName?.trim()) throw new Error("Full name is required");
    if (!d?.password || d.password.length < 6) throw new Error("Password must be at least 6 characters");
    if (!isValidRole(d.role)) throw new Error("Invalid role");
    return {
      email: cleanEmail(d.email),
      password: d.password,
      fullName: d.fullName.trim(),
      role: d.role,
    };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(adminErrorMessage(error.message));
    const uid = created.user?.id;
    if (!uid) throw new Error("Supabase did not return a user id");

    // handle_new_user trigger inserts profile + default role. Override to active + chosen role.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, email: data.email, status: "active" })
      .eq("id", uid);
    if (profileError) throw new Error(adminErrorMessage(profileError.message));

    const { error: deleteRoleError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    if (deleteRoleError) throw new Error(adminErrorMessage(deleteRoleError.message));

    const { error: insertRoleError } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (insertRoleError) throw new Error(adminErrorMessage(insertRoleError.message));

    return { id: uid, email: data.email, role: data.role };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; newPassword: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (!data.newPassword || data.newPassword.length < 6) throw new Error("Password must be at least 6 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.newPassword });
    if (error) throw new Error(adminErrorMessage(error.message));
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(adminErrorMessage(error.message));
    return { ok: true };
  });
