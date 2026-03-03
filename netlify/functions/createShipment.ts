import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

function pad(n: number, width: number) {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

function cleanStr(v: any) {
  return String(v || "").trim();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    // 1) Verificación de Identidad y Rol
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    if (!isPrivilegedRole(profile.role || "")) {
      return text(403, "Forbidden: Se requiere rol de administrador");
    }

    const body = JSON.parse(event.body || "{}");

    // 2) Validación del Cliente
    const clientId = cleanStr(body.clientId || body.client_id);
    if (!clientId) return text(400, "Se requiere el ID del cliente");

    const { data: clientExists, error: clientErr } = await sbAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .single();

    if (clientErr || !clientExists) return text(400, "Cliente no encontrado");

    // 3) Preparar datos logísticos
    const destination = cleanStr(body.destination).toUpperCase();
    const incoterm = cleanStr(body.incoterm).toUpperCase() || "FOB";
    
    if (!destination || destination.length < 3) {
      return text(400, "Destino inválido");
    }

    // 4) Generar correlativo FFP-2026-XXXX
    const year = new Date().getFullYear();
    const prefix = `FFP-${year}-`;
    const { count, error: cntErr } = await sbAdmin
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .ilike("code", `${prefix}%`);

    if (cntErr) throw cntErr;
    const code = `${prefix}${pad((count ?? 0) + 1, 4)}`;

    // 5) Inserción en Tabla 'shipments'
    // Se eliminaron columnas redundantes para evitar errores de schema cache
    const { data: newShip, error: shipErr } = await sbAdmin
      .from("shipments")
      .insert({
        client_id: clientId,
        code,
        destination,
        incoterm,
        boxes: body.boxes ?? null,
        pallets: body.pallets ?? null,
        weight_kg: body.weight_kg ?? null,
        product_name: cleanStr(body.product_name) || "Piña",
        product_variety: cleanStr(body.product_variety) || "MD2 Golden",
        product_mode: cleanStr(body.product_mode) || "Marítima",
        status: "CREATED"
      })
      .select("id")
      .single();

    if (shipErr || !newShip) throw shipErr;

    // 6) Crear Hito Inicial
    await sbAdmin.from("milestones").insert({
      shipment_id: newShip.id,
      type: "CREATED",
      note: `Embarque generado (${incoterm}) para despacho a ${destination}`,
      actor_email: user.email,
      at: new Date().toISOString(),
    });

    return json(200, { 
      ok: true, 
      code, 
      id: newShip.id, 
      message: `Embarque ${code} creado` 
    });

  } catch (e: any) {
    console.error("Error crítico en createShipment:", e.message);
    return text(500, e?.message || "Internal Server Error");
  }
};