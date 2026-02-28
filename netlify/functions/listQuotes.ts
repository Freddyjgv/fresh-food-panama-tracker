// netlify/functions/listQuotes.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

function isPrivileged(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "superadmin";
}

/**
 * Sanitiza el término para que no rompa el parser de PostgREST en .or().
 * - Evita comas y paréntesis (delimitadores del árbol lógico)
 * - Evita caracteres de control
 * - Limita longitud
 */
function sanitizeQ(input: string) {
  const s = String(input || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ") // control chars
    .replace(/[(),]/g, " ") // rompe el or() logic tree
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, 60);
}

/**
 * Escapa % y _ para que no actúen como wildcards inesperados en ILIKE.
 * No es estrictamente necesario, pero evita búsquedas "raras" si pegan texto con %.
 */
function escapeLike(input: string) {
  return String(input || "").replace(/[%_]/g, "\\$&");
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "GET") return text(405, "Method not allowed");

    const { user, profile } = await getUserAndProfile(event);
    if (!user) return text(401, "Unauthorized");
    if (!profile) return text(401, "Unauthorized (missing profile)");
    if (!isPrivileged(profile.role)) return text(403, "Forbidden");

    const pageSize = 20;
    const pageRaw = Number(event.queryStringParameters?.page || 1);
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;

    const dirRaw = String(event.queryStringParameters?.dir || "desc").toLowerCase();
    const dir = dirRaw === "asc" ? "asc" : "desc";

    const status = String(event.queryStringParameters?.status || "").trim().toLowerCase();

    // q: sanitizado + limitado
    const q0 = sanitizeQ(event.queryStringParameters?.q || "");
    const q = q0 ? escapeLike(q0) : "";

    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    const sb = supabaseAdmin();

    let query = sb
      .from("quotes")
      .select(
        `
          id,
          created_at,
          updated_at,
          status,
          mode,
          currency,
          destination,
          boxes,
          weight_kg,
          margin_markup,
          client_id,
          client_snapshot,
          totals,
          clients(name, contact_email)
        `,
        { count: "exact" }
      );

    if (status) query = query.eq("status", status);

    /**
     * ✅ Búsqueda robusta SIN tocar joins en el OR.
     * - destination (columna normal)
     * - client_snapshot->>name (jsonb text)
     * - client_snapshot->>contact_email (jsonb text)
     *
     * Esto evita el error:
     * failed to parse logic tree ((destination.ilike...,clients.name.ilike...))
     */
    if (q) {
      // Usamos \\ para que el backslash llegue bien al parser
      // y el escape de %/_ funcione en LIKE/ILIKE.
      const like = `%${q}%`;
      query = query.or(
        [
          `destination.ilike.${like}`,
          `client_snapshot->>name.ilike.${like}`,
          `client_snapshot->>contact_email.ilike.${like}`,
        ].join(",")
      );
    }

    query = query.order("created_at", { ascending: dir === "asc" }).range(fromIndex, toIndex);

    const { data, count, error } = await query;
    if (error) return text(500, error.message);

    const items = (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      status: r.status,
      mode: r.mode,
      currency: r.currency,
      destination: r.destination,
      boxes: r.boxes,
      weight_kg: r.weight_kg,
      margin_markup: r.margin_markup,
      client_id: r.client_id,
      // prioridad: join si existe, si no snapshot
      client_name: r.clients?.name ?? r.client_snapshot?.name ?? null,
      client_email: r.clients?.contact_email ?? r.client_snapshot?.contact_email ?? null,
      total: r.totals?.total ?? null,
    }));

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return json(200, {
      items,
      page,
      pageSize,
      total,
      totalPages,
      sort: { field: "created_at", dir },
    });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};