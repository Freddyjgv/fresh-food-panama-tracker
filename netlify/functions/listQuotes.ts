// netlify/functions/listQuotes.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

function isPrivileged(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "superadmin";
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
    const page = Math.max(1, Number(event.queryStringParameters?.page || 1));
    const dir =
      (event.queryStringParameters?.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const status = String(event.queryStringParameters?.status || "").trim().toLowerCase();
    const q = String(event.queryStringParameters?.q || "").trim().slice(0, 60);

    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    const sb = supabaseAdmin();

    let query = sb
      .from("quotes")
      .select(
        "id, quote_number, created_at, updated_at, status, mode, currency, destination, boxes, weight_kg, margin_markup, client_id, client_snapshot, totals, clients(name, contact_email)",
        { count: "exact" }
      );

    if (status) query = query.eq("status", status);

    // búsqueda simple: destino o cliente (join)
    if (q) {
      query = query.or(`destination.ilike.%${q}%,clients.name.ilike.%${q}%`);
    }

    query = query
      .order("created_at", { ascending: dir === "asc" })
      .range(fromIndex, toIndex);

    const { data, count, error } = await query;
    if (error) return text(500, error.message);

    const items = (data || []).map((r: any) => ({
      id: r.id,
      quote_number: r.quote_number ?? null,
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