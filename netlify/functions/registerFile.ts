import type { Handler } from "@netlify/functions";
import { getUserAndProfile, text, supabaseAdmin } from "./_util";

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    // ✅ admin o superadmin
    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";
    if (!privileged) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");
    const shipmentId = String(body.shipmentId || "").trim();
    const kind = String(body.kind || "").trim();
    const doc_type = body.doc_type ?? null;
    const filename = String(body.filename || "").trim();
    const storage_path = String(body.storage_path || "").trim();
    const bucket = String(body.bucket || "").trim();

    if (!shipmentId || !kind || !filename || !storage_path || !bucket) {
      return text(400, "Campos requeridos faltantes");
    }
    if (!["doc", "photo"].includes(kind)) return text(400, "kind inválido");

    const sb = supabaseAdmin();

    // (Opcional pero recomendado) Validar que el shipment exista
    const { data: ship, error: sErr } = await sb
      .from("shipments")
      .select("id")
      .eq("id", shipmentId)
      .maybeSingle();

    if (sErr) return text(500, sErr.message);
    if (!ship) return text(404, "Shipment not found");

    const { error } = await sb.from("shipment_files").insert({
      shipment_id: shipmentId,
      kind,
      doc_type: kind === "doc" ? doc_type : null,
      filename,
      storage_path,
      bucket,
      uploaded_by: user.email,
    });

    if (error) return text(500, error.message);
    return text(200, "OK");
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};