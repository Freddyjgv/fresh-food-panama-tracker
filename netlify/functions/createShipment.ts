// netlify/functions/createShipment.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

function pad(n: number, width: number) {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

function cleanEmail(v: any) {
  return String(v || "").trim().toLowerCase();
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

    // Verificación de rol usando nuestra utilidad
    if (!isPrivilegedRole(profile.role || "")) {
      return text(403, "Forbidden: Se requiere rol de administrador");
    }

    const body = JSON.parse(event.body || "{}");

    // Extracción de datos con limpieza
    const clientId = cleanStr(body.clientId || body.client_id);
    const clientEmail = cleanEmail(body.clientEmail || body.client_email);
    const newClientEmail = cleanEmail(body.newClientEmail || body.new_client_email);
    const newClientName = cleanStr(body.newClientName || body.new_client_name);

    const destination = cleanStr(body.destination).toUpperCase();
    const boxes = body.boxes ?? null;
    const pallets = body.pallets ?? null;
    const weight_kg = body.weight_kg ?? null;

    if (!["MAD", "AMS", "CDG"].includes(destination)) {
      return text(400, "Destino inválido (Solo MAD, AMS, CDG)");
    }

    const product_name = cleanStr(body.product_name || body.productName) || "Piña";
    const product_variety = cleanStr(body.product_variety || body.productVariety) || "MD2 Golden";
    const product_mode = cleanStr(body.product_mode || body.productMode) || "Aérea";

    // 1) Resolver cliente (ID final)
    let resolvedClient: { id: string; name: string | null } | null = null;

    if (clientId) {
      const { data, error } = await sbAdmin.from("clients").select("id, name").eq("id", clientId).maybeSingle();
      if (error) throw error;
      if (!data) return text(400, "clientId no existe");
      resolvedClient = data;
    } else if (newClientEmail) {
      const { data: existing, error: exErr } = await sbAdmin
        .from("clients")
        .select("id, name")
        .eq("contact_email", newClientEmail)
        .maybeSingle();

      if (exErr) throw exErr;

      if (existing) {
        resolvedClient = existing;
      } else {
        const nameToUse = newClientName || newClientEmail;
        const { data: created, error: cErr } = await sbAdmin
          .from("clients")
          .insert({ name: nameToUse, contact_email: newClientEmail })
          .select("id, name")
          .single();

        if (cErr) throw cErr;
        resolvedClient = created;
      }
    } else if (clientEmail) {
      const { data, error } = await sbAdmin
        .from("clients")
        .select("id, name")
        .eq("contact_email", clientEmail)
        .maybeSingle();

      if (error) throw error;
      if (!data) return text(400, "Cliente no existe por email");
      resolvedClient = data;
    } else {
      return text(400, "Se requiere identificación del cliente (ID o Email)");
    }

    // 2) Generar code correlativo
    const year = new Date().getFullYear();
    const prefix = `FFP-${year}-`;

    const { count, error: cntErr } = await sbAdmin
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .ilike("code", `${prefix}%`);

    if (cntErr) throw cntErr;

    const next = (count ?? 0) + 1;
    const code = `${prefix}${pad(next, 4)}`;

    // 3) Insert shipment
    const { data: newShip, error: shipErr } = await sbAdmin
      .from("shipments")
      .insert({
        client_id: resolvedClient.id,
        code,
        destination,
        boxes,
        pallets,
        weight_kg,
        status: "CREATED",
        product_name,
        product_variety,
        product_mode,
      })
      .select("id")
      .single();

    if (shipErr || !newShip) throw shipErr || new Error("Falla al crear embarque");

    // 4) Insert milestone CREATED automáticamente
    const { error: msErr } = await sbAdmin.from("milestones").upsert(
      {
        shipment_id: newShip.id,
        type: "CREATED",
        note: "Embarque generado en sistema",
        actor_email: user.email,
        at: new Date().toISOString(),
      },
      { onConflict: "shipment_id,type" }
    );

    if (msErr) throw msErr;

    return json(200, { 
      ok: true, 
      code, 
      id: newShip.id, 
      message: `Embarque ${code} creado para ${resolvedClient.name}` 
    });

  } catch (e: any) {
    console.error("Error en createShipment:", e.message);
    return text(500, e?.message || "Server error");
  }
};