import type { Handler } from "@netlify/functions";
import { getUserAndProfile, text, supabaseAdmin } from "./_util";

// Flujo real en DB
const ORDER = ["CREATED", "PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION"] as const;

// Aceptamos lo real + compatibilidad temporal (por si queda alguna pantalla vieja)
const ALLOWED = new Set([
  "PACKED",
  "DOCS_READY",
  "AT_ORIGIN",
  "IN_TRANSIT",
  "AT_DESTINATION",
  // legacy (compat)
  "DEPARTED",   // -> IN_TRANSIT
  "DELIVERED",  // -> AT_DESTINATION
]);

function normalizeType(t: string) {
  const up = String(t || "").trim().toUpperCase();
  if (up === "DEPARTED") return "IN_TRANSIT";
  if (up === "DELIVERED") return "AT_DESTINATION";
  return up;
}

function cleanStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    // ✅ admin o superadmin
    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";
    if (!privileged) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");

    const shipmentId = cleanStr(body.shipmentId);
    const rawType = String(body.type || "").trim().toUpperCase();

    if (!shipmentId) return text(400, "shipmentId requerido");
    if (!ALLOWED.has(rawType)) return text(400, "type inválido");

    const type = normalizeType(rawType);
    const note = cleanStr(body.note);

    // ✅ IMPORTANT: solo guardar si viene un valor real
    const flight_number = cleanStr(body.flight_number);
    const awb = cleanStr(body.awb);

    // ✅ Regla negocio: para IN_TRANSIT debe venir vuelo
    if (type === "IN_TRANSIT" && !flight_number) {
      return text(400, "flight_number requerido para marcar IN_TRANSIT");
    }

    const sb = supabaseAdmin();

    const { data: ship, error: sErr } = await sb
      .from("shipments")
      .select("id, status, flight_number, awb")
      .eq("id", shipmentId)
      .maybeSingle();

    if (sErr) return text(500, sErr.message);
    if (!ship) return text(404, "Not found");

    // upsert milestone (idempotente por shipment_id + type)
    const { error: upErr } = await sb
      .from("milestones")
      .upsert(
        {
          shipment_id: shipmentId,
          type,
          note,
          actor_email: user.email,
          at: new Date().toISOString(),
        },
        { onConflict: "shipment_id,type" }
      );

    if (upErr) return text(500, upErr.message);

    // status avanza solo hacia adelante
    const current = String(ship.status || "CREATED").toUpperCase();
    const currentIndex = ORDER.indexOf(current as any);
    const targetIndex = ORDER.indexOf(type as any);

    const nextStatus = targetIndex > currentIndex ? type : current;

    // ✅ PATCH: NO sobreescribir con null
    const patch: any = { status: nextStatus };

    // si viene vuelo, guardar/actualizar
    if (flight_number) patch.flight_number = flight_number;

    // si viene awb, guardar/actualizar
    if (awb) patch.awb = awb;

    const { error: uErr } = await sb
      .from("shipments")
      .update(patch)
      .eq("id", shipmentId);

    if (uErr) return text(500, uErr.message);

    return text(200, "OK");
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};