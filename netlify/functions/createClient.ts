// netlify/functions/createClient.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

type CreateMode = "invite" | "manual";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    // 1. Verificación de Seguridad
    const { user: adminUser, profile: adminProfile } = await getUserAndProfile(event);
    
    if (!adminUser || !adminProfile || !isPrivilegedRole(adminProfile.role || "")) {
      return text(403, "Forbidden: No tienes permisos de administrador");
    }

    const body = JSON.parse(event.body || "{}");

    // 2. Extracción y Limpieza
    const email = String(body.contact_email || body.email || "").trim().toLowerCase();
    const companyName = String(body.company_name || body.name || "").trim();
    const contactName = String(body.contact_name || "").trim();
    const mode = (String(body.mode || "invite").trim().toLowerCase()) as CreateMode;
    const password = String(body.password || "").trim();

    if (!email || !companyName) {
      return json(400, { error: "El email y el nombre de la empresa son obligatorios." });
    }

    // 3. Operación en Tabla 'clients'
    const { data: clientData, error: clientError } = await sbAdmin
      .from("clients")
      .upsert({
        name: companyName,
        contact_email: email,
        contact_name: contactName || null,
        tax_id: String(body.tax_id || "").trim() || null,
        phone: String(body.phone || "").trim() || null,
        country: String(body.country || "").trim() || null,
        billing_address: String(body.billing_address || "").trim() || null,
        shipping_address: String(body.shipping_address || "").trim() || null,
        internal_notes: String(body.internal_notes || "").trim() || null,
        status: String(body.status || "active").trim(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'contact_email' })
      .select("id")
      .single();

    if (clientError || !clientData) {
      throw new Error(`Error en tabla clients: ${clientError?.message || "No data"}`);
    }
    const clientId = clientData.id;

   // 4. Gestión de Identidad (Auth)
    let authUserId: string;
    
    const { data: listData, error: listError } = await sbAdmin.auth.admin.listUsers();
    
    if (listError || !listData?.users) {
      throw new Error(`Error listando usuarios: ${listError?.message || "Sin datos"}`);
    }

    // Forzamos el tipo 'any' en u para evitar el error 'never'
    const existingAuthUser = (listData.users as any[]).find((u: any) => 
      u.email?.toLowerCase() === email
    );

    const userMetadata = { 
      company_name: companyName, 
      contact_name: contactName,
      created_by_admin: adminUser.id 
    };

    if (!existingAuthUser) {
      // CASO A: El usuario no existe en Auth, lo creamos/invitamos
      if (mode === "manual") {
        const { data: newUser, error: createError } = await sbAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          password,
          user_metadata: userMetadata
        });
        if (createError || !newUser.user) throw createError || new Error("Falla al crear usuario");
        authUserId = newUser.user.id;
      } else {
        const { data: invite, error: inviteError } = await sbAdmin.auth.admin.inviteUserByEmail(email, {
          data: userMetadata
        });
        if (inviteError || !invite.user) throw inviteError || new Error("Falla al invitar usuario");
        authUserId = invite.user.id;
      }
    } else {
      // CASO B: El usuario ya existe
      authUserId = existingAuthUser.id;
      if (mode === "manual" && password) {
        await sbAdmin.auth.admin.updateUserById(authUserId, { password });
      }
    }

    // 5. Vinculación Final en 'profiles'
    const { error: profileError } = await sbAdmin
      .from("profiles")
      .upsert({
        user_id: authUserId,
        role: "client",
        client_id: clientId,
      }, { onConflict: 'user_id' });

    if (profileError) throw new Error(`Error en vinculación de perfil: ${profileError.message}`);

    return json(200, {
      ok: true,
      clientId,
      message: mode === "invite" ? "Invitación enviada correctamente." : "Usuario configurado con acceso manual."
    });

  } catch (err: any) {
    console.error("Falla en createClient:", err.message);
    return json(500, { error: err.message || "Error interno del servidor" });
  }
};