// netlify/functions/whoami.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text } from "./_util";

export const handler: Handler = async (event) => {
  try {
    // ✅ CORS / preflight
    if (event.httpMethod === "OPTIONS") {
      return json(200, { ok: true });
    }

    const { user, profile } = await getUserAndProfile(event);

    // Si no hay user => token inválido o no llegó Authorization
    if (!user) return text(401, "Unauthorized");

    // Si hay user pero no hay profile => tu tabla profiles no tiene fila
    // (para este proyecto, lo tratamos como unauthorized para evitar roles null)
    if (!profile) return text(401, "Unauthorized (missing profile)");

    return json(200, {
      email: user.email,
      user_id: user.id,
      role: profile.role ?? null,
      client_id: profile.client_id ?? null,
    });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};