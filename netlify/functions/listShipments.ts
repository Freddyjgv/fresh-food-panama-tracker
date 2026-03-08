import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "GET") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

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

    const privileged = isPrivilegedRole(profile.role || "");
    if (mode === "admin" && !privileged) return text(403, "Forbidden");

    // CAMBIO 1: Ampliamos la consulta para traer la metadata del perfil
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
      boxes,
      pallets,
      weight_kg,
      incoterm,
      milestones(at),
      *,
  clients (
name, 
    legal_name, 
    tax_id, 
    country, 
    logo_url, 
    phone, 
    website, 
    billing_address
  )
`;

    let query = sbAdmin.from("shipments").select(selectFields, { count: "exact" });

    if (!privileged) {
      if (!profile.client_id) return json(200, { items: [], total: 0 });
      query = query.eq("client_id", profile.client_id);
    }

    if (destination) query = query.eq("destination", destination);
    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);
    if (q) query = query.ilike("code", `%${q}%`);

    query = query.order("created_at", { ascending: dir === "asc" }).range(fromIndex, toIndex);

    const { data, count, error } = await query;
    if (error) throw error;

    const items = (data || []).map((s: any) => {
      const milestones = Array.isArray(s.milestones) ? s.milestones : [];
      const lastMilestone = milestones.length
        ? milestones.reduce((a: any, b: any) => (new Date(a.at) > new Date(b.at) ? a : b))
        : null;

      return {
        ...s,
        last_event_at: lastMilestone?.at || s.created_at,
        // CAMBIO 2: Mantenemos el nombre pero YA NO borramos el objeto 'clients'
        client_name: s.clients?.legal_name || s.clients?.name || null,
        milestones: undefined 
        // Nota: 'clients' se mantiene para que el frontend lo use en el Header
      };
    });

    return json(200, {
      items,
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
      sort: { field: "created_at", dir },
    });
  } catch (e: any) {
    console.error("Error en listShipments:", e.message);
    return text(500, e?.message || "Server error");
  }
};