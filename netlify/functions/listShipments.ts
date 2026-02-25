// netlify/functions/listShipments.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "GET") return text(405, "Method not allowed");

    const { user, profile } = await getUserAndProfile(event);
    if (!user) return text(401, "Unauthorized");
    if (!profile) return text(401, "Unauthorized (missing profile)");

    const pageSize = 20;
    const page = Math.max(1, Number(event.queryStringParameters?.page || 1));
    const dir =
      (event.queryStringParameters?.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const destination = event.queryStringParameters?.destination || "";
    const from = event.queryStringParameters?.from || "";
    const to = event.queryStringParameters?.to || "";
    const q = (event.queryStringParameters?.q || "").trim().slice(0, 40);
    const mode = String(event.queryStringParameters?.mode || "").trim().toLowerCase(); // "admin" opcional

    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    const sb = supabaseAdmin();

    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";
    if (mode === "admin" && !privileged) return text(403, "Forbidden");

    // ✅ Campos de lista + caliber/color
    // ✅ Join robusto: clients!shipments_client_id_fkey(name)
    // Nota: si tu FK tiene otro nombre, ajusta el !....
    let selectFields = [
      "id",
      "code",
      "destination",
      "status",
      "created_at",
      "flight_number",
      "awb",
      "client_id",
      "product_name",
      "product_variety",
      "product_mode",
      "caliber",
      "color",
      "milestones(at)",
      "clients:clients!shipments_client_id_fkey(name)",
    ].join(",");

    let query = sb.from("shipments").select(selectFields, { count: "exact" });

    // Cliente solo ve lo suyo
    if (!privileged) {
      if (!profile.client_id) return text(403, "Forbidden");
      query = query.eq("client_id", profile.client_id);
    }

    if (destination) query = query.eq("destination", destination);
    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);
    if (q) query = query.ilike("code", `%${q}%`);

    query = query.order("created_at", { ascending: dir === "asc" }).range(fromIndex, toIndex);

    const { data, count, error } = await query;
    if (error) return text(500, error.message);

    const items = (data || []).map((s: any) => {
      const milestones = Array.isArray(s.milestones) ? s.milestones : [];
      const lastMilestone = milestones.length
        ? milestones.reduce((a: any, b: any) => (a.at > b.at ? a : b))
        : null;

      return {
        id: s.id,
        code: s.code,
        destination: s.destination,
        status: s.status,
        created_at: s.created_at,
        flight_number: s.flight_number,
        awb: s.awb,
        last_event_at: lastMilestone?.at || s.created_at,

        product_name: s.product_name ?? null,
        product_variety: s.product_variety ?? null,
        product_mode: s.product_mode ?? null,

        // ✅ nuevos
        caliber: s.caliber ?? null,
        color: s.color ?? null,

        // ✅ cliente
        client_name: s.clients?.name ?? null,
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
    return text(500, e?.message || "Server error");
  }
};