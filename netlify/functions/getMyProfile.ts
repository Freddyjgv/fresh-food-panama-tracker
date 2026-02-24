// netlify/functions/getMyProfile.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text } from "./_util";

export const handler: Handler = async (event) => {
  try {
    // ✅ CORS / preflight
    if (event.httpMethod === "OPTIONS") {
      return json(200, { ok: true });
    }

    const { user, profile } = await getUserAndProfile(event);

    if (!user) return text(401, "Unauthorized");
    if (!profile) return text(401, "Unauthorized (missing profile)");

    return json(200, {
      email: user.email,
      role: profile.role ?? null,
      client_id: profile.client_id ?? null,
      user_id: user.id,
    });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};