import type { Handler } from "@netlify/functions";
import { getUserAndProfile, text } from "./_util";

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);

    if (!user) {
      return text(401, "Unauthorized");
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        role: profile?.role || "client",
        client_id: profile?.client_id || null,
      }),
    };
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};