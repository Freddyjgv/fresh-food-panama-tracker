import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    if (event.httpMethod !== "GET") return text(405, "Method not allowed");

    // ✅ normaliza SIEMPRE
    const role = String(profile.role || "").trim().toLowerCase();
    if (role !== "superadmin") return text(403, "Forbidden");

    const sb = supabaseAdmin();

    // 1) Lista Auth Users
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return text(500, error.message);

    const users = data.users || [];
    const userIds = users.map((u) => u.id);

    // 2) Trae profiles asociados
    const { data: profiles, error: pErr } = await sb
      .from("profiles")
      .select("user_id, role, client_id, created_at")
      .in("user_id", userIds);

    if (pErr) return text(500, pErr.message);

    const pmap = new Map<string, any>();
    (profiles || []).forEach((p) => pmap.set(p.user_id, p));

    const items = users.map((u) => {
      const p = pmap.get(u.id);
      return {
        user_id: u.id,
        email: u.email ?? null,
        auth_created_at: u.created_at ?? null,
        last_sign_in_at: (u as any).last_sign_in_at ?? null,
        role: p?.role ?? null,
        client_id: p?.client_id ?? null,
        profile_created_at: p?.created_at ?? null,
      };
    });

    // orden: superadmin/admin primero
    const rank = (r: any) => {
      const rr = String(r || "").trim().toLowerCase();
      if (rr === "superadmin") return 0;
      if (rr === "admin") return 1;
      if (rr === "client") return 2;
      return 9;
    };

    items.sort(
      (a, b) =>
        rank(a.role) - rank(b.role) ||
        String(a.email || "").localeCompare(String(b.email || ""))
    );

    return json(200, { items });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};