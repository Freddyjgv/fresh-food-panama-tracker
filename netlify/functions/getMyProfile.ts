// netlify/functions/getMyProfile.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    const { user, profile } = await getUserAndProfile(event);

    // 1. Verificación estricta para TypeScript
    if (!user) return text(401, "Unauthorized: No session found");
    
    // 2. Si el usuario existe pero el perfil no (error común en registros incompletos)
    if (!profile) {
      return json(200, {
        email: user.email,
        user_id: user.id,
        role: null,
        client_id: null,
        error: "Missing profile in database"
      });
    }

    // 3. Respuesta final con valores seguros
    return json(200, {
      email: user.email ?? "no-email",
      role: profile.role ?? "user",
      client_id: profile.client_id ?? null,
      user_id: user.id,
    });

  } catch (e: any) {
    console.error("Error en getMyProfile:", e.message);
    return text(500, e?.message || "Server error");
  }
};