// netlify/functions/listUsers.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, sbAdmin } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "GET") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    // Validación estricta de Superadmin
    const role = String(profile.role || "").trim().toLowerCase();
    if (role !== "superadmin") return text(403, "Forbidden");

    // 1) Listar Usuarios de Auth (Capa de autenticación)
    const { data, error } = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return text(500, error.message);

    const authUsers = data.users || [];
    const userIds = authUsers.map((u) => u.id);

    // 2) Traer perfiles asociados (Capa de aplicación)
    const { data: profiles, error: pErr } = await sbAdmin
      .from("profiles")
      .select("user_id, role, client_id, created_at")
      .in("user_id", userIds);

    if (pErr) return text(500, pErr.message);

    // Mapeo para cruce eficiente
    const pmap = new Map<string, any>();
    (profiles || []).forEach((p) => pmap.set(p.user_id, p));

    // 3) Mezclar datos de Auth con Perfiles
    const items = authUsers.map((u) => {
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

    // 4) Lógica de ordenamiento (Ranking de roles)
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
    console.error("Error en listUsers:", e.message);
    return text(500, e?.message || "Server error");
  }
};