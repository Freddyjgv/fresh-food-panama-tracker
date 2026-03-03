// netlify/functions/updateMilestone.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

const ALLOWED = new Set(["PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION", "CREATED"]);

function clean(v: any) {
  return String(v ?? "").trim();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    // Usamos nuestra utilidad compartida para verificar admin
    if (!isPrivilegedRole(profile.role || "")) return text(403, "Forbidden");

    // Parse body seguro
    let body: any = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return text(400, "Body inválido (JSON requerido)");
    }

    // Acepta ambos nombres (flexibilidad para el frontend)
    const shipmentId = clean(body.shipmentId || body.shipment_id);
    const typeRaw = clean(body.type || body.milestoneType || body.milestone_type).toUpperCase();

    if (!shipmentId) return text(400, "Falta shipmentId");
    if (!typeRaw) return text(400, "Falta type");
    if (!ALLOWED.has(typeRaw)) return text(400, `type inválido: ${typeRaw}`);

    const note = body.note == null ? null : clean(body.note) || null;
    const flight_number = body.flight_number == null ? null : clean(body.flight_number) || null;
    const awb = body.awb == null ? null : clean(body.awb) || null;

    // Nuevos campos operativos (opcionales)
    const caliber = body.caliber == null ? null : clean(body.caliber) || null;
    const color = body.color == null ? null : clean(body.color) || null;

    // Validaciones operativas intactas
    if (typeRaw === "PACKED") {
      if (!caliber || !color) return text(400, "PACKED requiere caliber y color");
    }
    if (typeRaw === "IN_TRANSIT") {
      if (!flight_number) return text(400, "IN_TRANSIT requiere flight_number");
    }

    // 1) Actualiza shipments (status + datos si vienen)
    const shipUpdate: any = { status: typeRaw };

    if (flight_number !== null) shipUpdate.flight_number = flight_number;
    if (awb !== null) shipUpdate.awb = awb;
    if (caliber !== null) shipUpdate.caliber = caliber;
    if (color !== null) shipUpdate.color = color;

    const { error: upErr } = await sbAdmin.from("shipments").update(shipUpdate).eq("id", shipmentId);
    if (upErr) return text(500, upErr.message);

    // 2) Upsert milestone (idempotente)
    const { error: msErr } = await sbAdmin.from("milestones").upsert(
      {
        shipment_id: shipmentId,
        type: typeRaw,
        note,
        actor_email: user.email,
        at: new Date().toISOString(),
      },
      { onConflict: "shipment_id,type" }
    );

    if (msErr) return text(500, msErr.message);

    return json(200, { ok: true, shipmentId, type: typeRaw });
  } catch (e: any) {
    console.error("Error en updateMilestone:", e.message);
    return text(500, e?.message || "Server error");
  }
};