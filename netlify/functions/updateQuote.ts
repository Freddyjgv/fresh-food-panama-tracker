// netlify/functions/updateQuote.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

function isPrivileged(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "superadmin";
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    const { user, profile } = await getUserAndProfile(event);
    if (!user) return text(401, "Unauthorized");
    if (!profile) return text(401, "Unauthorized (missing profile)");
    if (!isPrivileged(profile.role)) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");
    const id = String(body.id || "").trim();
    if (!id) return text(400, "Missing id");

    const patch: any = {};

    // permitimos actualizar solo lo que necesitamos
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

    for (const k of allowed) {
      if (k in body) patch[k] = body[k];
    }

    if ("mode" in patch) patch.mode = String(patch.mode || "").toUpperCase();
    if ("currency" in patch) patch.currency = String(patch.currency || "").toUpperCase();

    const sb = supabaseAdmin();
    const { error } = await sb.from("quotes").update(patch).eq("id", id);
    if (error) return text(500, error.message);

    return json(200, { ok: true });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};