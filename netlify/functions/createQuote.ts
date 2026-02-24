// netlify/functions/createQuote.ts
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

    const mode = String(body.mode || "").toUpperCase();
    const currency = String(body.currency || "").toUpperCase();
    const destination = String(body.destination || "").trim();
    const boxes = Number(body.boxes || 0);

    if (!["AIR", "SEA"].includes(mode)) return text(400, "Invalid mode");
    if (!["USD", "EUR"].includes(currency)) return text(400, "Invalid currency");
    if (!destination) return text(400, "Destination required");
    if (!Number.isFinite(boxes) || boxes <= 0) return text(400, "Boxes must be > 0");

    const sb = supabaseAdmin();

    const payload = {
      created_by: user.id,
      client_id: body.client_id || null,
      status: body.status || "draft",

      mode,
      currency,
      destination,
      boxes,

      weight_kg: body.weight_kg ?? null,
      margin_markup: body.margin_markup ?? 15,

      payment_terms: body.payment_terms ?? null,
      terms: body.terms ?? null,

      client_snapshot: body.client_snapshot ?? {},
      costs: body.costs ?? {},
      totals: body.totals ?? {},
    };

    const { data, error } = await sb.from("quotes").insert(payload).select("id").single();
    if (error) return text(500, error.message);

    return json(200, { ok: true, id: data.id });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};