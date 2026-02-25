import type { Handler } from "@netlify/functions";
import { getUserAndProfile, text, supabaseAdmin } from "./_util";

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
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";
    if (!privileged) return text(403, "Forbidden");

    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    const body = JSON.parse(event.body || "{}");

    const clientId = cleanStr(body.clientId || body.client_id);
    const clientEmail = cleanEmail(body.clientEmail || body.client_email);
    const newClientEmail = cleanEmail(body.newClientEmail || body.new_client_email);
    const newClientName = cleanStr(body.newClientName || body.new_client_name);

    const destination = cleanStr(body.destination).toUpperCase();
    const boxes = body.boxes ?? null;
    const pallets = body.pallets ?? null;
    const weight_kg = body.weight_kg ?? null;

    // ✅ NUEVOS
    const caliber = cleanStr(body.caliber);
    const color = cleanStr(body.color);

    if (!["MAD", "AMS", "CDG"].includes(destination)) return text(400, "destination inválido");

    const product_name = cleanStr(body.product_name || body.productName) || "Piña";
    const product_variety = cleanStr(body.product_variety || body.productVariety) || "MD2 Golden";
    const product_mode = cleanStr(body.product_mode || body.productMode) || "Aérea";

    const sb = supabaseAdmin();

    // 1) Resolver cliente (ID final)
    let resolvedClient: { id: string; name: string | null } | null = null;

    if (clientId) {
      const { data, error } = await sb.from("clients").select("id, name").eq("id", clientId).maybeSingle();
      if (error) return text(500, error.message);
      if (!data) return text(400, "clientId no existe en tabla clients");
      resolvedClient = data;
    } else if (newClientEmail) {
      const { data: existing, error: exErr } = await sb
        .from("clients")
        .select("id, name")
        .eq("contact_email", newClientEmail)
        .maybeSingle();

      if (exErr) return text(500, exErr.message);

      if (existing) {
        resolvedClient = existing;
      } else {
        const nameToUse = newClientName || newClientEmail;

        const { data: created, error: cErr } = await sb
          .from("clients")
          .insert({ name: nameToUse, contact_email: newClientEmail })
          .select("id, name")
          .single();

        if (cErr) return text(500, cErr.message);
        resolvedClient = created;
      }
    } else if (clientEmail) {
      const { data, error } = await sb
        .from("clients")
        .select("id, name")
        .eq("contact_email", clientEmail)
        .maybeSingle();

      if (error) return text(500, error.message);
      if (!data) return text(400, "Cliente no existe en tabla clients (contact_email)");
      resolvedClient = data;
    } else {
      return text(400, "clientEmail requerido si no envías clientId o newClientEmail");
    }

    // 2) Generar code correlativo
    const year = new Date().getFullYear();
    const prefix = `FFP-${year}-`;

    const { count, error: cntErr } = await sb
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .ilike("code", `${prefix}%`);

    if (cntErr) return text(500, cntErr.message);

    const next = (count ?? 0) + 1;
    const code = `${prefix}${pad(next, 4)}`;

    // 3) Insert shipment
    const { data: newShip, error: shipErr } = await sb
      .from("shipments")
      .insert({
        client_id: resolvedClient!.id,
        code,
        destination,
        boxes,
        pallets,
        weight_kg,
        status: "CREATED",
        product_name,
        product_variety,
        product_mode,

        // ✅ NUEVOS
        caliber: caliber || null,
        color: color || null,
      })
      .select("id")
      .single();

    if (shipErr) return text(500, shipErr.message);

    const shipmentId = newShip.id;

    // 4) Insert milestone CREATED automáticamente (idempotente)
    const { error: msErr } = await sb.from("milestones").upsert(
      {
        shipment_id: shipmentId,
        type: "CREATED",
        note: null,
        actor_email: user.email,
        at: new Date().toISOString(),
      },
      { onConflict: "shipment_id,type" }
    );

    if (msErr) return text(500, msErr.message);

    return text(200, `OK: Embarque creado ${code} para ${resolvedClient?.name || "cliente"}`);
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};