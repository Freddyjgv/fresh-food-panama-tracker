// netlify/functions/registerFile.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, text, sbAdmin, json, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    // Validación de privilegios centralizada
    if (!isPrivilegedRole(profile.role || "")) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");
    const shipmentId = String(body.shipmentId || "").trim();
    const kind = String(body.kind || "").trim();
    const doc_type = body.doc_type ?? null;
    const filename = String(body.filename || "").trim();
    const storage_path = String(body.storage_path || "").trim();
    const bucket = String(body.bucket || "").trim();

    // Validaciones de integridad de datos
    if (!shipmentId || !kind || !filename || !storage_path || !bucket) {
      return text(400, "Campos requeridos faltantes");
    }
    if (!["doc", "photo"].includes(kind)) return text(400, "kind inválido");

    // 1. Validar que el embarque exista antes de registrar el archivo
    const { data: ship, error: sErr } = await sbAdmin
      .from("shipments")
      .select("id")
      .eq("id", shipmentId)
      .maybeSingle();

    if (sErr) return text(500, sErr.message);
    if (!ship) return text(404, "Shipment not found");

    // 2. Insertar el registro en shipment_files
    const { error } = await sbAdmin.from("shipment_files").insert({
      shipment_id: shipmentId,
      kind,
      doc_type: kind === "doc" ? doc_type : null,
      filename,
      storage_path,
      bucket,
      uploaded_by: user.email, // Mantenemos el email como referencia del autor
    });

    if (error) {
      console.error("Error inserting shipment_file:", error.message);
      return text(500, error.message);
    }

    return json(200, { ok: true, message: "Archivo registrado exitosamente" });

  } catch (e: any) {
    console.error("Falla en registerFile:", e.message);
    return text(500, e?.message || "Server error");
  }
};