// netlify/functions/listShipments.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "GET") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    // Parámetros de URL
    const pageSize = 20;
    const page = Math.max(1, Number(event.queryStringParameters?.page || 1));
    const dir = (event.queryStringParameters?.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const destination = event.queryStringParameters?.destination || "";
    const from = event.queryStringParameters?.from || "";
    const to = event.queryStringParameters?.to || "";
    const q = (event.queryStringParameters?.q || "").trim().slice(0, 40);
    const mode = String(event.queryStringParameters?.mode || "").trim().toLowerCase();

    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    // Seguridad de Roles
    const privileged = isPrivilegedRole(profile.role || "");
    if (mode === "admin" && !privileged) return text(403, "Forbidden");

    // Construcción de la Query
    // Nota: Eliminamos el nombre explícito de la FK (!shipments_client_id_fkey) 
    // para que Supabase use la relación por defecto, lo cual es más robusto.
    let selectFields = `
      id,
      code,
      destination,
      status,
      created_at,
      flight_number,
      awb,
      client_id,
      product_name,
      product_variety,
      product_mode,
      caliber,
      color,
      milestones(at),
      clients(name)
    `;

    let query = sbAdmin.from("shipments").select(selectFields, { count: "exact" });

    // Filtro RLS Manual
    if (!privileged) {
      if (!profile.client_id) return json(200, { items: [], total: 0 });
      query = query.eq("client_id", profile.client_id);
    }

    // Filtros de búsqueda
    if (destination) query = query.eq("destination", destination);
    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);
    if (q) query = query.ilike("code", `%${q}%`);

    // Orden y Paginación
    query = query.order("created_at", { ascending: dir === "asc" }).range(fromIndex, toIndex);

    const { data, count, error } = await query;
    if (error) throw error;

    // Mapeo de datos para el Frontend
    const items = (data || []).map((s: any) => {
      const milestones = Array.isArray(s.milestones) ? s.milestones : [];
      const lastMilestone = milestones.length
        ? milestones.reduce((a: any, b: any) => (new Date(a.at) > new Date(b.at) ? a : b))
        : null;

      return {
        ...s,
        last_event_at: lastMilestone?.at || s.created_at,
        client_name: s.clients?.name ?? null,
        // Limpieza de objetos de join para no enviar data duplicada
        clients: undefined,
        milestones: undefined
      };
    });

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
    console.error("Error en listShipments:", e.message);
    return text(500, e?.message || "Server error");
  }
};