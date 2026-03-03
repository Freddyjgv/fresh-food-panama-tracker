// netlify/functions/getQuote.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "GET") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);

    // Validaciones de seguridad con tipos seguros
    if (!user) return text(401, "Unauthorized");
    if (!profile) return text(401, "Unauthorized (missing profile)");
    
    // Acceso restringido: Solo admins y superadmins
    if (!isPrivilegedRole(profile.role || "")) return text(403, "Forbidden");

    const id = String(event.queryStringParameters?.id || "").trim();
    if (!id) return text(400, "Missing id");

    // Realizamos la consulta con el ALIAS code:quote_number
    const { data, error } = await sbAdmin
      .from("quotes")
      .select(`
        *, 
        code:quote_number, 
        clients(name, contact_name, contact_email, phone, country, city)
      `)
      .eq("id", id)
      .maybeSingle(); 

    if (error) return text(500, error.message);
    if (!data) return text(404, "Quote not found");

    return json(200, data);
  } catch (e: any) {
    console.error("Error en getQuote:", e.message);
    return text(500, e?.message || "Server error");
  }
};