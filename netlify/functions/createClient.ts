// netlify/functions/createClient.ts (VERSION ACTUALIZADA)
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

type CreateMode = "invite" | "manual";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user: adminUser, profile: adminProfile } = await getUserAndProfile(event);
    
    if (!adminUser || !adminProfile || !isPrivilegedRole(adminProfile.role || "")) {
      return text(403, "Forbidden: No tienes permisos de administrador");
    }

    const body = JSON.parse(event.body || "{}");

    // EXTRACTO DE NUEVOS CAMPOS PARA EL HEADER PREMIUM
    const email = String(body.contact_email || body.email || "").trim().toLowerCase();
    const companyName = String(body.name || body.company_name || "").trim();
    const legalName = String(body.legal_name || companyName).trim(); // Fallback al nombre comercial
    const logoUrl = String(body.logo_url || "").trim();
    const taxId = String(body.tax_id || "").trim();
    const country = String(body.country || "Panamá").trim();
    
    const mode = (String(body.mode || "invite").trim().toLowerCase()) as CreateMode;
    const password = String(body.password || "").trim();

    if (!email || !companyName) {
      return json(400, { error: "Email y Nombre son requeridos." });
    }

    // 3. OPERACIÓN EN TABLA 'clients' (Enriquecida)
    const { data: clientData, error: clientError } = await sbAdmin
      .from("clients")
      .upsert({
        name: companyName,
        legal_name: legalName,
        tax_id: taxId,
        country: country,
        logo_url: logoUrl, // El nombre del archivo ya subido desde el front
        contact_email: email,
        contact_name: String(body.contact_name || "").trim() || null,
        phone: String(body.phone || "").trim() || null,
        status: "active",
        updated_at: new Date().toISOString()
      }, { onConflict: 'contact_email' })
      .select("id")
      .single();

    if (clientError || !clientData) {
      throw new Error(`Error en tabla clients: ${clientError?.message}`);
    }
    const clientId = clientData.id;

    // 4. GESTIÓN DE AUTH (Igual a tu lógica pero con metadata extendida)
    let authUserId: string;
    const { data: listData } = await sbAdmin.auth.admin.listUsers();
    const existingAuthUser = (listData?.users || []).find((u: any) => u.email?.toLowerCase() === email);

    const userMetadata = { 
      company_name: companyName,
      legal_name: legalName,
      logo_url: logoUrl,
      created_by_admin: adminUser.id 
    };

    if (!existingAuthUser) {
      if (mode === "manual") {
        const { data: newUser, error: createError } = await sbAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          password,
          user_metadata: userMetadata
        });
        if (createError) throw createError;
        authUserId = newUser.user!.id;
      } else {
        const { data: invite, error: inviteError } = await sbAdmin.auth.admin.inviteUserByEmail(email, {
          data: userMetadata
        });
        if (inviteError) throw inviteError;
        authUserId = invite.user!.id;
      }
    } else {
      authUserId = existingAuthUser.id;
    }

    // 5. VINCULACIÓN FINAL EN 'profiles'
    const { error: profileError } = await sbAdmin
      .from("profiles")
      .upsert({
        user_id: authUserId,
        role: "client",
        client_id: clientId,
      }, { onConflict: 'user_id' });

    if (profileError) throw new Error(`Error vinculación: ${profileError.message}`);

    return json(200, { ok: true, clientId });

  } catch (err: any) {
    return json(500, { error: err.message });
  }
};