// netlify/functions/updateMilestone.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

const ALLOWED = new Set(["PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION", "CREATED"]);

function clean(v: any) {
  return String(v ?? "").trim();
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    const { user, profile } = await getUserAndProfile(event);
    if (!user) return text(401, "Unauthorized");
    if (!profile) return text(401, "Unauthorized (missing profile)");

    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";
    if (!privileged) return text(403, "Forbidden");

    // Parse body seguro
    let body: any = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return text(400, "Body inválido (JSON requerido)");
    }

    // ✅ Acepta ambos nombres
    const shipmentId = clean(body.shipmentId || body.shipment_id);
    const typeRaw = clean(body.type || body.milestoneType || body.milestone_type).toUpperCase();

    if (!shipmentId) return text(400, "Falta shipmentId");
    if (!typeRaw) return text(400, "Falta type");
    if (!ALLOWED.has(typeRaw)) return text(400, `type inválido: ${typeRaw}`);

    const note = body.note == null ? null : clean(body.note) || null;
    const flight_number = body.flight_number == null ? null : clean(body.flight_number) || null;
    const awb = body.awb == null ? null : clean(body.awb) || null;

    // ✅ nuevos (opcionales)
    const caliber = body.caliber == null ? null : clean(body.caliber) || null;
    const color = body.color == null ? null : clean(body.color) || null;

    // Validaciones operativas (si quieres que backend sea “source of truth”)
    if (typeRaw === "PACKED") {
      if (!caliber || !color) return text(400, "PACKED requiere caliber y color");
    }
    if (typeRaw === "IN_TRANSIT") {
      if (!flight_number) return text(400, "IN_TRANSIT requiere flight_number");
    }

    const sb = supabaseAdmin();

    // 1) Actualiza shipments (status + datos si vienen)
    const shipUpdate: any = { status: typeRaw };

    // Solo setea si vienen (evita pisar con null accidentalmente)
    if (flight_number !== null) shipUpdate.flight_number = flight_number;
    if (awb !== null) shipUpdate.awb = awb;
    if (caliber !== null) shipUpdate.caliber = caliber;
    if (color !== null) shipUpdate.color = color;

    const { error: upErr } = await sb.from("shipments").update(shipUpdate).eq("id", shipmentId);
    if (upErr) return text(500, upErr.message);

    // 2) Upsert milestone (idempotente)
    const { error: msErr } = await sb.from("milestones").upsert(
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
    return text(500, e?.message || "Server error");
  }
};