// netlify/functions/createQuote.ts
import type { Handler } from "@netlify/functions";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

function isPrivileged(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "superadmin";
}

// ✅ Términos por defecto (Exportación de Piña Fresca - Fresh Food Panamá)
const DEFAULT_TERMS_EXPORT_PINEAPPLE = `TÉRMINOS Y CONDICIONES
Exportación de Piña Fresca – Fresh Food Panamá

1. Validez de la oferta
La presente cotización tiene una validez de 7 días calendario a partir de su fecha de emisión, salvo indicación expresa en contrario. Los precios y condiciones podrán variar una vez vencido dicho plazo.

2. Naturaleza de la cotización
Esta cotización es de carácter referencial y no vinculante, y no constituye un contrato de compraventa. La operación solo se considerará confirmada tras la aceptación expresa por escrito y la confirmación operativa correspondiente.

3. Producto perecedero
La mercancía objeto de esta oferta corresponde a piña fresca para exportación, considerada producto perecedero. El comprador reconoce los riesgos inherentes asociados a la naturaleza del producto, incluyendo variaciones de maduración, temperatura y manipulación logística.

4. Precios y moneda
Todos los precios están expresados en la moneda indicada en la cotización. Salvo indicación expresa, los precios no incluyen impuestos, tasas, aranceles, cargos portuarios, aeroportuarios ni gastos gubernamentales en destino.

5. Condiciones de pago
Las condiciones de pago serán las expresamente indicadas en la cotización. El inicio de cualquier gestión operativa, reserva de espacio o despacho de la mercancía estará condicionado a la recepción efectiva del pago conforme a los términos acordados.

6. Incoterms
Los Incoterms aplicables se interpretan de acuerdo con las reglas Incoterms® 2020 de la Cámara de Comercio Internacional (ICC). El lugar indicado (“Place”) forma parte integral de la condición Incoterm acordada.

7. Pesos, volúmenes y especificaciones
Los pesos, volúmenes, calibres y cantidades indicados son estimados. Variaciones propias del proceso de selección, empaque o transporte podrán generar ajustes razonables en la facturación final.

8. Transporte y tiempos de tránsito
Los tiempos de tránsito son estimados y dependen de factores externos tales como disponibilidad de espacio, condiciones climáticas, inspecciones, regulaciones sanitarias, congestión logística o eventos de fuerza mayor. No se garantiza una fecha exacta de llegada.

9. Inspección, calidad y reclamos
El comprador deberá inspeccionar la mercancía a la llegada al aeropuerto o puerto de destino.
No se aceptarán reclamos presentados después de transcurridos tres (3) días calendario desde la llegada de la carga al destino.
Cualquier reclamo deberá ser debidamente documentado y comunicado por escrito dentro de dicho plazo. Reclamos fuera de este período serán considerados extemporáneos y no procedentes.

10. Responsabilidad sobre la mercancía
Salvo acuerdo expreso, Fresh Food Panamá no asume responsabilidad por daños derivados de manipulación posterior a la entrega conforme al Incoterm acordado, retrasos ajenos a su control, fallas de refrigeración en destino o almacenamiento inadecuado.

11. Limitación de responsabilidad
La responsabilidad de Fresh Food Panamá se limita exclusivamente a los servicios expresamente contratados y, en ningún caso, excederá el valor de la mercancía efectivamente facturada. No se reconocerán daños indirectos, pérdida de mercado, lucro cesante ni penalidades comerciales.

12. Fuerza mayor
Ninguna de las partes será responsable por incumplimientos derivados de eventos de fuerza mayor, incluyendo, pero no limitándose a, fenómenos naturales, huelgas, fallas logísticas, restricciones gubernamentales, emergencias sanitarias o eventos fuera de control razonable.

13. Confidencialidad
La información contenida en esta cotización es confidencial y no podrá ser divulgada a terceros sin autorización previa y por escrito.

14. Jurisdicción aplicable
Para todos los efectos legales, esta cotización se rige por las leyes de la República de Panamá, salvo acuerdo expreso y escrito en contrario.
`;

function normalizeTerms(input: any) {
  const s = String(input ?? "").trim();
  return s ? s : DEFAULT_TERMS_EXPORT_PINEAPPLE;
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    const { user, profile } = await getUserAndProfile(event);
    if (!user) return text(401, "Unauthorized");
    if (!profile) return text(401, "Unauthorized (missing profile)");
    if (!isPrivileged(profile.role)) return text(403, "Forbidden");

    const body = JSON.parse(event.body || "{}");

    const mode = String(body.mode || "").toUpperCase();
    const currency = String(body.currency || "").toUpperCase();
    const destination = String(body.destination || "").trim();
    const boxes = Number(body.boxes || 0);

    if (!["AIR", "SEA"].includes(mode)) return text(400, "Invalid mode");
    if (!["USD", "EUR"].includes(currency)) return text(400, "Invalid currency");
    if (!destination) return text(400, "Destination required");
    if (!Number.isFinite(boxes) || boxes <= 0) return text(400, "Boxes must be > 0");

    const sb = supabaseAdmin();

    const payload = {
      created_by: user.id,
      client_id: body.client_id || null,
      status: body.status || "draft",

      mode,
      currency,
      destination,
      boxes,

      weight_kg: body.weight_kg ?? null,
      margin_markup: body.margin_markup ?? 15,

      payment_terms: body.payment_terms ?? null,

      // ✅ Default robust terms if missing/blank
      terms: normalizeTerms(body.terms),

      client_snapshot: body.client_snapshot ?? {},
      costs: body.costs ?? {},
      totals: body.totals ?? {},
    };

    const { data, error } = await sb.from("quotes").insert(payload).select("id").single();
    if (error) return text(500, error.message);

    return json(200, { ok: true, id: data.id });
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};