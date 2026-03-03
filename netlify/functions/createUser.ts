// netlify/functions/createUser.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, text, sbAdmin, json, isPrivilegedRole } from "./_util";

function cleanEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}
function cleanStr(v: any) {
  return String(v || "").trim();
}

type TargetRole = "client" | "admin" | "superadmin";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const actorRole = String(profile.role || "").trim().toLowerCase();
    const isAdmin = actorRole === "admin";
    const isSuperadmin = actorRole === "superadmin";
    
    // Solo admins y superadmins crean usuarios
    if (!isAdmin && !isSuperadmin) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");

    const email = cleanEmail(body.email);
    const role = cleanStr(body.role).toLowerCase() as TargetRole;
    const invite = body.invite !== false; // default true
    const password = cleanStr(body.password || "");

    const clientId = cleanStr(body.clientId);
    const newClientEmail = cleanEmail(body.newClientEmail);
    const newClientName = cleanStr(body.newClientName);

    if (!email) return text(400, "email requerido");
    if (!["client", "admin", "superadmin"].includes(role)) return text(400, "role inválido");

    // Restricción: admin solo crea clients
    if (isAdmin && role !== "client") return text(403, "Un admin solo puede crear clientes");

    // 1) Resolver client_id si role=client
    let resolvedClientId: string | null = null;

    if (role === "client") {
      if (clientId) {
        const { data, error } = await sbAdmin.from("clients").select("id").eq("id", clientId).maybeSingle();
        if (error) return text(500, error.message);
        if (!data) return text(400, "clientId no existe");
        resolvedClientId = data.id;
      } else if (newClientEmail) {
        const { data: existing, error: exErr } = await sbAdmin
          .from("clients")
          .select("id")
          .eq("contact_email", newClientEmail)
          .maybeSingle();
        if (exErr) return text(500, exErr.message);

        if (existing?.id) {
          resolvedClientId = existing.id;
        } else {
          const nameToUse = newClientName || newClientEmail;
          const { data: created, error: cErr } = await sbAdmin
            .from("clients")
            .insert({ name: nameToUse, contact_email: newClientEmail })
            .select("id")
            .single();
          if (cErr) return text(500, cErr.message);
          resolvedClientId = created.id;
        }
      } else {
        return text(400, "Para role=client debes enviar clientId o newClientEmail");
      }
    }

    // 2) Crear usuario Auth (invite o password)
    const siteUrl = (process.env.SITE_URL || process.env.URL || "").replace(/\/$/, "");
    const redirectTo = siteUrl ? `${siteUrl}/login` : undefined;

    let createdUserId: string | null = null;

    if (invite || !password) {
      const { data, error } = await sbAdmin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error) return text(500, error.message);
      createdUserId = data.user?.id || null;
    } else {
      const { data, error } = await sbAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return text(500, error.message);
      createdUserId = data.user?.id || null;
    }

    if (!createdUserId) return text(500, "No se pudo crear el ID de usuario");

    // 3) Upsert profile
    const { error: pErr } = await sbAdmin
      .from("profiles")
      .upsert(
        { user_id: createdUserId, role, client_id: resolvedClientId },
        { onConflict: "user_id" }
      );

    if (pErr) return text(500, pErr.message);

    return json(200, {
      ok: true,
      email,
      role,
      user_id: createdUserId,
      client_id: resolvedClientId,
      mode: invite || !password ? "invite" : "password",
    });

  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};