// netlify/functions/createQuote.ts
import type { Handler } from "@netlify/functions";
import { sbAdmin, getUserAndProfile, json, text, isPrivilegedRole } from "./_util";

function yearFromNow() {
  return new Date().getFullYear();
}

function pad5(n: number) {
  const x = Math.max(0, Math.floor(n));
  return String(x).padStart(5, "0");
}

async function getNextQuoteNumber(year: number) {
  // Busca el último quote_number del año: RFQ/YYYY/0000X
  const prefix = `RFQ/${year}/`;

  const { data, error } = await sbAdmin
    .from("quotes")
    .select("quote_number")
    .ilike("quote_number", `${prefix}%`)
    .order("quote_number", { ascending: false })
    .limit(1);

  if (error || !data?.[0]?.quote_number) {
    return `${prefix}${pad5(1)}`;
  }

  const last = String(data[0].quote_number).trim();
  const tail = last.slice(prefix.length);
  const lastN = Number(tail);
  const next = Number.isFinite(lastN) ? lastN + 1 : 1;
  return `${prefix}${pad5(next)}`;
}

const DEFAULT_TERMS_ES = `TÉRMINOS Y CONDICIONES — EXPORTACIÓN DE PIÑAS (Fresh Food Panamá)...`; // (Mantén tu texto completo aquí)

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return text(405, "Method not allowed");

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    
    // Usamos nuestra utilidad de _util.ts
    if (!isPrivilegedRole(profile.role || "")) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");

    const mode = String(body.mode || "AIR").toUpperCase() === "SEA" ? "SEA" : "AIR";
    const currency = String(body.currency || "USD").toUpperCase() === "EUR" ? "EUR" : "USD";
    const boxes = Number.isFinite(Number(body.boxes)) ? Number(body.boxes) : 0;
    const destination = String(body.destination || body.place || "").trim();
    const year = Number(body.year) || yearFromNow();

    // Generación robusta con retry por colisión
    const maxAttempts = 6;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const quote_number = await getNextQuoteNumber(year);

      const payload = {
        quote_number,
        status: "draft",
        mode,
        currency,
        destination,
        boxes,
        weight_kg: null,
        margin_markup: 15,
        payment_terms: String(body.payment_terms || ""),
        terms: String(body.terms || DEFAULT_TERMS_ES),
        client_id: body.client_id ?? null,
        client_snapshot: body.client_snapshot ?? null,
        costs: body.costs ?? null,
        totals: body.totals ?? null,
        created_by: user.id
      };

      const { data, error } = await sbAdmin
        .from("quotes")
        .insert(payload)
        .select("id, quote_number")
        .single();

      if (!error && data?.id) {
        return json(200, { ok: true, id: data.id, quote_number: data.quote_number });
      }

      lastErr = error;
      const msg = String(error?.message || "").toLowerCase();
      const isUnique = msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505");

      if (!isUnique) break;
      
      // Pequeña espera antes de reintentar si hubo colisión
      if (attempt < maxAttempts) await new Promise(res => setTimeout(res, 50 * attempt));
    }

    return json(500, { error: lastErr?.message || "No se pudo crear la cotización" });
  } catch (e: any) {
    console.error("Error crítico en createQuote:", e.message);
    return text(500, "Server error");
  }
};