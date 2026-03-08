import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const id = event.queryStringParameters?.id;
    if (!id) return text(400, "Missing id");

    const { data: shipment, error } = await sbAdmin
      .from("shipments")
      .select(`*, client:clients(name)`)
      .eq("id", id)
      .maybeSingle();

    if (error) return text(500, error.message);
    if (!shipment) return text(404, "Not found");

    const privileged = isPrivilegedRole(profile.role || "");
    if (!privileged && (!profile.client_id || shipment.client_id !== profile.client_id)) {
      return text(403, "Forbidden");
    }

    // Milestones con Join a Profiles para obtener el nombre del autor
    const { data: milestones } = await sbAdmin
      .from("milestones")
      .select(`*, author:profiles!created_by(name)`)
      .eq("shipment_id", shipment.id)
      .order("at", { ascending: true });

    // Archivos con Join a Profiles
    const { data: files } = await sbAdmin
      .from("shipment_files")
      .select(`*, author:profiles!created_by(name)`)
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false });

    const documents = (files || []).filter((x) => x.kind === "doc");
    const photosRaw = (files || []).filter((x) => x.kind === "photo");

    // Lógica original de firmado de fotos preservada
    const photos = await Promise.all(
      photosRaw.map(async (p) => {
        const { data } = await sbAdmin.storage
          .from(p.bucket || "shipment-photos")
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, url: data?.signedUrl };
      })
    );

    return json(200, {
      ...shipment,
      client_name: (shipment.client as any)?.name,
      milestones: milestones || [],
      documents,
      photos
    });
  } catch (e: any) {
    return text(500, e.message);
  }
};