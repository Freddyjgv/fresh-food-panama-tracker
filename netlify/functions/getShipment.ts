import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const id = event.queryStringParameters?.id;
    if (!id) return text(400, "Missing id");

    const mode = String(event.queryStringParameters?.mode || "").toLowerCase(); // "admin" opcional

    const sb = supabaseAdmin();

    const { data: shipment, error } = await sb
      .from("shipments")
      .select(
        [
          "id",
          "code",
          "destination",
          "status",
          "created_at",
          "boxes",
          "pallets",
          "weight_kg",
          "flight_number",
          "awb",
          "client_id",
          "product_name",
          "product_variety",
          "product_mode",
        ].join(",")
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return text(500, error.message);
    if (!shipment) return text(404, "Not found");

    // ✅ Roles normalizados
    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";

    // Si alguien intenta modo admin sin privilegios => bloqueado
    if (mode === "admin" && !privileged) return text(403, "Forbidden");

    // ✅ Cliente: solo puede ver su shipment
    if (!privileged) {
      if (!profile.client_id) return text(403, "Forbidden");
      if (shipment.client_id !== profile.client_id) return text(403, "Forbidden");
    }

    const { data: milestones, error: mErr } = await sb
      .from("milestones")
      .select("type, at, note, actor_email")
      .eq("shipment_id", shipment.id)
      .order("at", { ascending: true });

    if (mErr) return text(500, mErr.message);

    const { data: files, error: fErr } = await sb
      .from("shipment_files")
      .select("id, kind, doc_type, filename, created_at, bucket, storage_path")
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false });

    if (fErr) return text(500, fErr.message);

    const documents = (files || []).filter((x: any) => x.kind === "doc");
    const photos = (files || []).filter((x: any) => x.kind === "photo");

    // Signed URLs para fotos
    const SIGNED_SECONDS = 60 * 60; // 1 hora

    const photosWithUrl = await Promise.all(
      (photos || []).map(async (p: any) => {
        const bucket = p.bucket || "shipment-photos";
        const path = p.storage_path;

        if (!path) return { ...p, url: null };

        const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, SIGNED_SECONDS);
        if (error) return { ...p, url: null };

        return { ...p, url: data?.signedUrl ?? null };
      })
    );

    return json(200, {
      ...shipment,
      milestones: milestones || [],
      documents,
      photos: photosWithUrl,
    });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};