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
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    if (!isPrivilegedRole(profile.role || "")) {
      return text(403, "Forbidden: Se requiere rol de administrador");
    }

    const body = JSON.parse(event.body || "{}");

    // 1) Resolver Cliente y sus datos maestros
    const clientId = cleanStr(body.clientId || body.client_id);
    if (!clientId) return text(400, "Se requiere el ID del cliente seleccionado");

    const { data: clientData, error: clientErr } = await sbAdmin
      .from("clients")
      .select("id, name, billing_address, country, phone")
      .eq("id", clientId)
      .single();

    if (clientErr || !clientData) return text(400, "Cliente no encontrado en el directorio");

    // 2) Preparar datos del embarque (Prioridad: Body > Ficha Cliente)
    const destination = cleanStr(body.destination).toUpperCase();
    const boxes = body.boxes ?? null;
    const pallets = body.pallets ?? null;
    const weight_kg = body.weight_kg ?? null;

    // Capturamos las direcciones (vienen del selector que hicimos en el paso anterior)
    const shipping_address = cleanStr(body.shipping_address); 
    const billing_address = cleanStr(body.billing_address) || clientData.billing_address;

    if (!["MAD", "AMS", "CDG"].includes(destination)) {
      return text(400, "Destino inválido (Solo MAD, AMS, CDG)");
    }

    const product_name = cleanStr(body.product_name || body.productName) || "Piña";
    const product_variety = cleanStr(body.product_variety || body.productVariety) || "MD2 Golden";
    const product_mode = cleanStr(body.product_mode || body.productMode) || "Aérea";

    // 3) Generar código correlativo (FFP-2026-0001)
    const year = new Date().getFullYear();
    const prefix = `FFP-${year}-`;
    const { count, error: cntErr } = await sbAdmin
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .ilike("code", `${prefix}%`);

    if (cntErr) throw cntErr;
    const next = (count ?? 0) + 1;
    const code = `${prefix}${pad(next, 4)}`;

    // 4) Insertar Embarque con toda la metadata logística
    const { data: newShip, error: shipErr } = await sbAdmin
      .from("shipments")
      .insert({
        client_id: clientData.id,
        code,
        destination,
        boxes,
        pallets,
        weight_kg,
        status: "CREATED",
        product_name,
        product_variety,
        product_mode,
        // NUEVOS CAMPOS MAESTROS
        shipping_address, 
        billing_address,
        client_phone: clientData.phone,
        origin_country: clientData.country
      })
      .select("id")
      .single();

    if (shipErr || !newShip) throw shipErr;

    // 5) Hito (Milestone) inicial
    await sbAdmin.from("milestones").upsert({
      shipment_id: newShip.id,
      type: "CREATED",
      note: `Embarque generado para despacho a ${destination}`,
      actor_email: user.email,
      at: new Date().toISOString(),
    }, { onConflict: "shipment_id,type" });

    return json(200, { 
      ok: true, 
      code, 
      id: newShip.id, 
      message: `Embarque ${code} creado exitosamente` 
    });

  } catch (e: any) {
    console.error("Error en createShipment:", e.message);
    return text(500, e?.message || "Server error");
  }
};