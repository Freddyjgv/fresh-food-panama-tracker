// netlify/functions/listClients.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

export const handler: Handler = async (event) => {
  // 1. Manejo de CORS (Preflight)
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    // 2. Validación de Sesión y Rol
    const { user, profile } = await getUserAndProfile(event);

    if (!user || !profile || !isPrivilegedRole(profile.role)) {
      return text(403, "No autorizado: Se requieren permisos de administrador");
    }

    // 3. Consulta a la Base de Datos (Tabla 'clients')
    // Usamos los nombres de columna confirmados por tu SQL anterior
    const { data: clients, error } = await sbAdmin
      .from("clients")
      .select(`
        id,
        name,
        contact_name,
        contact_email,
        phone,
        status,
        country,
        city,
        tax_id,
        created_at
      `)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error en listClients:", error.message);
      return json(500, { error: error.message });
    }

    // 4. Respuesta Exitosa
    return json(200, clients);

  } catch (err: any) {
    console.error("Error crítico en listClients:", err.message);
    return text(500, "Error interno del servidor");
  }
};