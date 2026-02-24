// src/lib/requireAdmin.ts
import { supabase } from "./supabaseClient";

type Result =
  | { ok: true; me: any }
  | { ok: false; reason: string };

async function safeJson(res: Response) {
  // Evita crash si vuelve HTML (redirect) o texto
  const ct = res.headers.get("content-type") || "";
  const txt = await res.text().catch(() => "");
  if (!ct.includes("application/json")) return { __raw: txt };
  try {
    return JSON.parse(txt);
  } catch {
    return { __raw: txt };
  }
}

export async function requireAdminOrRedirect(): Promise<Result> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      window.location.href = "/login";
      return { ok: false, reason: "no_token" };
    }

    // Intentamos primero whoami (normalmente es el que ya usaste)
    // y si no existe, caemos a getMyProfile.
    const endpoints = ["/.netlify/functions/whoami", "/.netlify/functions/getMyProfile"];

    let me: any = null;
    let lastStatus = 0;

    for (const url of endpoints) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow",
      });

      lastStatus = res.status;

      if (!res.ok) {
        // Si es 404, probamos el siguiente endpoint
        if (res.status === 404) continue;

        // Si es 401/403, sesión mala → login
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          return { ok: false, reason: `unauthorized_${res.status}` };
        }

        // Otros errores: no redirijas en loop, manda a login una sola vez
        window.location.href = "/login";
        return { ok: false, reason: `bad_status_${res.status}` };
      }

      const json = await safeJson(res);

      // Si nos devolvió HTML o algo raro, evitamos crash
      if (json && typeof json === "object" && !("__raw" in json)) {
        me = json;
        break;
      }
    }

    if (!me) {
      // No pudimos leer perfil por ningún endpoint
      window.location.href = "/login";
      return { ok: false, reason: `no_profile_lastStatus_${lastStatus}` };
    }

    const role = String(me.role || "").toLowerCase();

    if (role !== "admin" && role !== "superadmin") {
      window.location.href = "/shipments";
      return { ok: false, reason: "not_admin" };
    }

    return { ok: true, me };
  } catch (e) {
    // Cualquier excepción (JSON inválido, red, etc.) → login, pero sin crash
    window.location.href = "/login";
    return { ok: false, reason: "exception" };
  }
}