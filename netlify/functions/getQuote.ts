// netlify/functions/getQuote.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

function isPrivileged(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "superadmin";
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "GET") return text(405, "Method not allowed");

    const { user, profile } = await getUserAndProfile(event);
    if (!user) return text(401, "Unauthorized");
    if (!profile) return text(401, "Unauthorized (missing profile)");
    if (!isPrivileged(profile.role)) return text(403, "Forbidden");

    const id = String(event.queryStringParameters?.id || "").trim();
    if (!id) return text(400, "Missing id");

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("quotes")
      .select("*, clients(name, contact_name, contact_email, phone, country, city)")
      .eq("id", id)
      .single();

    if (error) return text(404, error.message);

    return json(200, data);
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};