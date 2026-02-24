// netlify/functions/createClient.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

function cleanStr(v: any) {
  return String(v ?? "").trim();
}
function cleanEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

type CreateMode = "invite" | "manual";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");

    const role = String(profile.role || "").trim().toLowerCase();
    const privileged = role === "admin" || role === "superadmin";
    if (!privileged) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");

    // ✅ Obligatorios (según tu regla)
    const companyName = cleanStr(body.company_name || body.name); // clients.name (required)
    const contactName = cleanStr(body.contact_name); // UX required
    const email = cleanEmail(body.contact_email || body.email); // clients.contact_email (required)
    const phone = cleanStr(body.phone); // UX required
    const country = cleanStr(body.country); // UX required

    // Opcionales
    const legalName = cleanStr(body.legal_name);
    const taxId = cleanStr(body.tax_id);
    const website = cleanStr(body.website);
    const city = cleanStr(body.city);
    const externalRef = cleanStr(body.external_ref);
    const status = cleanStr(body.status || "active") || "active";

    const mode = String(body.mode || "invite").trim().toLowerCase() as CreateMode; // invite | manual
    const password = cleanStr(body.password);

    if (!companyName) return text(400, "Falta: nombre de la empresa (company_name)");
    if (!contactName) return text(400, "Falta: nombre del contacto (contact_name)");
    if (!email) return text(400, "Falta: email (contact_email)");
    if (!phone) return text(400, "Falta: teléfono (phone)");
    if (!country) return text(400, "Falta: país (country)");

    if (!["invite", "manual"].includes(mode)) {
      return text(400, "mode inválido. Usa 'invite' o 'manual'");
    }
    if (mode === "manual" && !password) {
      return text(400, "Para mode='manual' debes enviar password");
    }

    const sb = supabaseAdmin();

    // 1) Upsert en clients por email único
    const { data: existingClient, error: exC } = await sb
      .from("clients")
      .select("id")
      .eq("contact_email", email)
      .maybeSingle();

    if (exC) return text(500, exC.message);

    let clientId: string;

    if (existingClient?.id) {
      const { error: upErr } = await sb
        .from("clients")
        .update({
          name: companyName,
          contact_name: contactName || null,
          contact_email: email,
          phone: phone || null,
          country: country || null,
          legal_name: legalName || null,
          tax_id: taxId || null,
          website: website || null,
          city: city || null,
          external_ref: externalRef || null,
          status: status || "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingClient.id);

      if (upErr) return text(500, upErr.message);
      clientId = existingClient.id;
    } else {
      const { data: createdClient, error: cErr } = await sb
        .from("clients")
        .insert({
          name: companyName,
          contact_name: contactName || null,
          contact_email: email,
          phone: phone || null,
          country: country || null,
          legal_name: legalName || null,
          tax_id: taxId || null,
          website: website || null,
          city: city || null,
          external_ref: externalRef || null,
          status: status || "active",
        })
        .select("id")
        .single();

      if (cErr) return text(500, cErr.message);
      clientId = createdClient.id;
    }

    // 2) Auth user: crear si no existe
    const { data: got, error: getUErr } = await sb.auth.admin.getUserByEmail(email);
    if (getUErr) return text(500, getUErr.message);

    let authUserId = got?.user?.id || null;

    if (!authUserId) {
      if (mode === "manual") {
        const { data: createdU, error: cuErr } = await sb.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { company_name: companyName, contact_name: contactName },
        });
        if (cuErr) return text(500, cuErr.message);
        authUserId = createdU.user?.id || null;
      } else {
        const { data: inv, error: invErr } = await sb.auth.admin.inviteUserByEmail(email, {
          data: { company_name: companyName, contact_name: contactName },
        });
        if (invErr) return text(500, invErr.message);
        authUserId = inv.user?.id || null;
      }
    } else {
      // si ya existe usuario y quieres setear password manualmente
      if (mode === "manual" && password) {
        const { error: upUErr } = await sb.auth.admin.updateUserById(authUserId, {
          password,
          user_metadata: { company_name: companyName, contact_name: contactName },
        });
        if (upUErr) return text(500, upUErr.message);
      }
    }

    if (!authUserId) return text(500, "No se pudo resolver auth user id");

    // 3) Profiles (según tu esquema REAL)
    // user_id (uuid, NOT NULL), role (text, NOT NULL), client_id (uuid, nullable), created_at default now()
    const { error: pErr } = await sb.from("profiles").upsert(
      {
        user_id: authUserId,
        role: "client",
        client_id: clientId,
      },
      { onConflict: "user_id" }
    );

    if (pErr) return text(500, `No se pudo upsert profiles: ${pErr.message}`);

    return json(200, {
      ok: true,
      client_id: clientId,
      auth_user_id: authUserId,
      mode,
      message: mode === "invite" ? "Cliente creado e invitación enviada." : "Cliente creado con password manual.",
    });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};