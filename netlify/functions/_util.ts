// netlify/functions/_util.ts
import { createClient } from "@supabase/supabase-js";
import type { HandlerEvent } from "@netlify/functions";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) throw new Error("Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");

  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getBearerToken(event: HandlerEvent) {
  const h = event.headers.authorization || event.headers.Authorization;
  if (!h) return null;

  // Netlify a veces mete "Bearer <token>"
  const m = /^Bearer\s+(.+)$/i.exec(String(h));
  return m?.[1] ?? null;
}

export function normRole(role: any) {
  return String(role ?? "")
    .trim()
    .toLowerCase();
}

export function isPrivilegedRole(role: any) {
  const r = normRole(role);
  return r === "admin" || r === "superadmin";
}

export async function getUserAndProfile(event: HandlerEvent) {
  const token = getBearerToken(event);
  if (!token) return { token: null, user: null, profile: null };

  const sb = supabaseAdmin();

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { token, user: null, profile: null };

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("user_id, role, client_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (pErr) throw pErr;

  // Normalizamos role aquí para que NO haya “superadmin ” / “Admin” / etc
  const normalized = profile
    ? { ...profile, role: normRole(profile.role) }
    : null;

  return { token, user: data.user, profile: normalized };
}

const commonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export function json(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export function text(statusCode: number, body: string) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    },
    body,
  };
}