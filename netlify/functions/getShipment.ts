// netlify/functions/getShipment.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const id = event.queryStringParameters?.id;
    if (!id) return text(400, "Missing id");

    const mode = String(event.queryStringParameters?.mode || "").toLowerCase();

    // 1. Obtener el Shipment con Join de Cliente
    // Usamos el 'as any' en el select para evitar que TS se queje de la estructura del Join
    const { data: shipment, error } = await sbAdmin
      .from("shipments")
      .select(`
        *,
        client:clients(name)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) return text(500, error.message);
    if (!shipment) return text(404, "Not found");

    // 2. Verificación de Seguridad (RLS Manual)
    const privileged = isPrivilegedRole(profile.role || "");

    if (mode === "admin" && !privileged) return text(403, "Forbidden");

    if (!privileged) {
      if (!profile.client_id || shipment.client_id !== profile.client_id) {
        return text(403, "Forbidden: No tienes acceso a este envío");
      }
    }

    // 3. Obtener Milestones (Hitos)
    const { data: milestones, error: mErr } = await sbAdmin
      .from("milestones")
      .select("type, at, note, actor_email")
      .eq("shipment_id", shipment.id)
      .order("at", { ascending: true });

    if (mErr) return text(500, mErr.message);

    // 4. Obtener Archivos (Documentos y Fotos)
    const { data: files, error: fErr } = await sbAdmin
      .from("shipment_files")
      .select("id, kind, doc_type, filename, created_at, bucket, storage_path")
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false });

    if (fErr) return text(500, fErr.message);

    const documents = (files || []).filter((x) => x.kind === "doc");
    const photos = (files || []).filter((x) => x.kind === "photo");

    // 5. Generar URLs firmadas para las fotos
    const SIGNED_SECONDS = 3600; // 1 hora
    const photosWithUrl = await Promise.all(
      photos.map(async (p) => {
        if (!p.storage_path) return { ...p, url: null };

        const { data, error: sErr } = await sbAdmin.storage
          .from(p.bucket || "shipment-photos")
          .createSignedUrl(p.storage_path, SIGNED_SECONDS);

        return { ...p, url: sErr ? null : data.signedUrl };
      })
    );

    // 6. Respuesta final mapeada
    return json(200, {
      ...shipment,
      // Extraemos el nombre del cliente del objeto join de forma segura
      client_name: (shipment.client as any)?.name ?? null,
      milestones: milestones || [],
      documents,
      photos: photosWithUrl,
    });
  } catch (e: any) {
    console.error("Error en getShipment:", e.message);
    return text(500, e?.message || "Server error");
  }
};