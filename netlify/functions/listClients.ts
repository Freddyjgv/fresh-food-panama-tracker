import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";
    if (!privileged) return text(403, "Forbidden");

    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("clients")
      .select("id, name, contact_email, created_at")
      .order("name", { ascending: true });

    if (error) return text(500, error.message);

    return json(200, { ok: true, items: data || [] });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};