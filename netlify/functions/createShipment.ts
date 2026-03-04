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
    const quoteId = body.quoteId || body.quote_id || null;

    // --- LÓGICA DE HERENCIA DE COTIZACIÓN ---
    let inheritedData: any = null;
    let quoteReferenceLabel = "";

    if (quoteId) {
      const { data: quote, error: qErr } = await sbAdmin
        .from("quotes")
        .select("*, clients(id, name)")
        .eq("id", quoteId)
        .single();

      if (!qErr && quote) {
        const meta = quote.totals?.meta || {};
        inheritedData = {
          client_id: quote.client_id,
          destination: quote.destination,
          incoterm: meta.incoterm || "CIP",
          boxes: quote.boxes || 0,
          weight_kg: quote.weight_kg || 0,
          product_mode: quote.mode === "AIR" ? "Aérea" : "Marítima",
          quote_id: quote.id
        };
        // Formateamos el número de cotización para el hito inicial
        quoteReferenceLabel = quote.quote_number || `ID:${quote.id.slice(0, 8)}`;
      }
    }

    // 2) Validación del Cliente (Heredado o del Body)
    const clientId = inheritedData?.client_id || cleanStr(body.clientId || body.client_id);
    if (!clientId) return text(400, "Se requiere el ID del cliente");

    const { data: clientExists, error: clientErr } = await sbAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .single();

    if (clientErr || !clientExists) return text(400, "Cliente no encontrado");

    // 3) Preparar datos logísticos (Prioridad a lo heredado)
    const destination = (inheritedData?.destination || cleanStr(body.destination)).toUpperCase();
    const incoterm = (inheritedData?.incoterm || cleanStr(body.incoterm)).toUpperCase() || "FOB";
    
    if (!destination || destination.length < 2) {
      return text(400, "Destino inválido");
    }

    // 4) Generar correlativo FFP-2026-XXXX (Atomicidad simple)
    const year = new Date().getFullYear();
    const prefix = `FFP-${year}-`;
    const { count, error: cntErr } = await sbAdmin
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .ilike("code", `${prefix}%`);

    if (cntErr) throw cntErr;
    const code = `${prefix}${pad((count ?? 0) + 1, 4)}`;

    // 5) Inserción en Tabla 'shipments'
    const { data: newShip, error: shipErr } = await sbAdmin
      .from("shipments")
      .insert({
        client_id: clientId,
        quote_id: inheritedData?.quote_id || null, // Enlace directo
        code,
        destination,
        incoterm,
        boxes: inheritedData?.boxes || body.boxes || null,
        pallets: body.pallets || null,
        weight_kg: inheritedData?.weight_kg || body.weight_kg || null,
        product_name: cleanStr(body.product_name) || "Piña",
        product_variety: cleanStr(body.product_variety) || "MD2 Golden",
        product_mode: inheritedData?.product_mode || cleanStr(body.product_mode) || "Marítima",
        status: "CREATED"
      })
      .select("id")
      .single();

    if (shipErr || !newShip) throw shipErr;

    // 6) Crear Hito Inicial Personalizado
    const initialNote = quoteId 
      ? `Embarque generado automáticamente desde Cotización ${quoteReferenceLabel}. Destino: ${destination} (${incoterm})`
      : `Embarque generado manualmente (${incoterm}) para despacho a ${destination}`;

    await sbAdmin.from("milestones").insert({
      shipment_id: newShip.id,
      type: "CREATED",
      note: initialNote,
      actor_email: user.email,
      at: new Date().toISOString(),
    });

    return json(200, { 
      ok: true, 
      code, 
      id: newShip.id, 
      message: `Embarque ${code} creado exitosamente` 
    });

  } catch (e: any) {
    console.error("Error crítico en createShipment:", e.message);
    return text(500, e?.message || "Internal Server Error");
  }
};