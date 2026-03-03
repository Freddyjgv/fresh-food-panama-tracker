// netlify/functions/updateQuote.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    
    // Validaciones de seguridad
    if (!user || !profile) return text(401, "Unauthorized");
    if (!isPrivilegedRole(profile.role || "")) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");
    const id = String(body.id || "").trim();
    if (!id) return text(400, "Missing id");

    const patch: any = {
      updated_at: new Date().toISOString() // Añadimos marca de tiempo de edición
    };

    // Campos permitidos para actualización
    const allowed = [
      "client_id",
      "status",
      "mode",
      "currency",
      "destination",
      "boxes",
      "weight_kg",
      "margin_markup",
      "payment_terms",
      "terms",
      "client_snapshot",
      "costs",
      "totals",
    ];

    // Llenamos el patch de forma segura
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        patch[k] = body[k];
      }
    }

    // Normalización de datos
    if (patch.mode) patch.mode = String(patch.mode).toUpperCase();
    if (patch.currency) patch.currency = String(patch.currency).toUpperCase();

    // Actualización en base de datos
    const { error } = await sbAdmin
      .from("quotes")
      .update(patch)
      .eq("id", id);

    if (error) {
      console.error("Error DB updateQuote:", error.message);
      return text(500, error.message);
    }

    return json(200, { ok: true, message: "Cotización actualizada" });

  } catch (e: any) {
    console.error("Falla en updateQuote:", e.message);
    return text(500, e?.message || "Server error");
  }
};