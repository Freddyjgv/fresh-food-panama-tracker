import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

type ShipmentRow = {
  id: string;
  code: string | null;
  destination: string | null;
  status: string | null;
  created_at: string | null;
  boxes: number | null;
  pallets: number | null;
  weight_kg: number | null;
  flight_number: string | null;
  awb: string | null;
  client_id: string | null;

  // ✅ nuevos
  caliber: string | null;
  color: string | null;

  product_name: string | null;
  product_variety: string | null;
  product_mode: string | null;

  // ✅ join
  client?: { name?: string | null } | null;
};

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
        `
        id,
        code,
        destination,
        status,
        created_at,
        boxes,
        pallets,
        weight_kg,
        flight_number,
        awb,
        client_id,
        caliber,
        color,
        product_name,
        product_variety,
        product_mode,
        client:clients(name)
        `
      )
      .eq("id", id)
      .maybeSingle<ShipmentRow>();

    if (error) return text(500, error.message);
    if (!shipment) return text(404, "Not found");

    // Roles
    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";

    // Bloquear acceso admin sin permisos
    if (mode === "admin" && !privileged) return text(403, "Forbidden");

    // Cliente solo ve su shipment
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

    const documents = (files || []).filter((x) => x.kind === "doc");
    const photos = (files || []).filter((x) => x.kind === "photo");

    const SIGNED_SECONDS = 60 * 60; // 1 hora

    const photosWithUrl = await Promise.all(
      photos.map(async (p) => {
        if (!p.storage_path) return { ...p, url: null };

        const { data, error } = await sb.storage
          .from(p.bucket || "shipment-photos")
          .createSignedUrl(p.storage_path, SIGNED_SECONDS);

        if (error) return { ...p, url: null };

        return { ...p, url: data.signedUrl };
      })
    );

    return json(200, {
      ...shipment,
      client_name: shipment.client?.name ?? null,
      milestones: milestones || [],
      documents,
      photos: photosWithUrl,
    });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};