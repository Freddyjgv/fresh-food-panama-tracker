// netlify/functions/listQuotes.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  // 1. Manejo de CORS y Método
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "GET") return text(405, "Method not allowed");

  try {
    // 2. Validación de Identidad
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    
    // Solo permitimos ver la lista completa a admin/superadmin
    if (!isPrivilegedRole(profile.role)) return text(403, "Forbidden");

    // 3. Paginación y Filtros
    const pageSize = 20;
    const page = Math.max(1, Number(event.queryStringParameters?.page || 1));
    const dir = (event.queryStringParameters?.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const status = event.queryStringParameters?.status?.trim().toLowerCase();
    const q = event.queryStringParameters?.q?.trim().slice(0, 60);

    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    // 4. Construcción de Query con Join a Clientes
    let query = sbAdmin
      .from("quotes")
      .select(`
        id, 
        code, 
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
        clients (
          name, 
          contact_email
        )
      `, { count: "exact" });

    // Aplicar filtros si existen
    if (status) query = query.eq("status", status);
    
    // Búsqueda simple (ILIKE funciona sobre columnas de texto)
    if (q) {
      // Nota: La búsqueda en joins (clients.name) requiere configuración específica en Supabase, 
      // por ahora buscamos en destino y en el snapshot guardado.
      query = query.or(`destination.ilike.%${q}%, code.ilike.%${q}%`);
    }

    query = query
      .order("created_at", { ascending: dir === "asc" })
      .range(fromIndex, toIndex);

    const { data, count, error } = await query;
    if (error) throw error;

    // 5. Mapeo de Datos (Data Transformation)
    const items = (data || []).map((r: any) => ({
      id: r.id,
      code: r.code || "S/N",
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
      // Priorizamos el nombre real del join, si no, el del snapshot
      client_name: r.clients?.name || r.client_snapshot?.name || "Cliente Desconocido",
      client_email: r.clients?.contact_email || r.client_snapshot?.contact_email || null,
      total_amount: r.totals?.total || 0,
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
    console.error("Error en listQuotes:", e.message);
    return text(500, e?.message || "Server error");
  }
};