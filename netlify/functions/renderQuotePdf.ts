// netlify/functions/renderQuotePdf.ts
import type { Handler } from "@netlify/functions";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { getUserAndProfile, text, supabaseAdmin } from "./_util";

function isPrivileged(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "superadmin";
}

function safeFileName(name: string) {
  return String(name || "cotizacion")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function buildHtml(opts: { variant: "1" | "2"; lang: "es" | "en"; quote: any }) {
  const { variant, lang, quote } = opts;

  const clientName = quote?.clients?.name || quote?.client_snapshot?.name || "—";
  const clientEmail =
    quote?.clients?.contact_email || quote?.client_snapshot?.contact_email || "—";

  const totals = quote?.totals || {};
  const meta = totals?.meta || {};
  const incoterm = meta?.incoterm || "CIP";
  const place = meta?.place || quote?.destination || "—";

  const currency = quote?.currency || "USD";
  const sym = currency === "EUR" ? "€" : "$";
  const total = Number(totals?.total || 0);
  const items = Array.isArray(totals?.items) ? totals.items : [];

  const t = (es: string, en: string) => (lang === "en" ? en : es);

  const css = `
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #111; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .brand { font-weight:800; font-size:16px; }
    .muted { color:#555; font-size:12px; }
    h1 { font-size:18px; margin: 14px 0 8px; }
    .box { border:1px solid #ddd; border-radius:10px; padding:12px; margin-top:10px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th, td { border-bottom:1px solid #eee; padding:8px; font-size:12px; text-align:left; }
    th { font-size:11px; text-transform:uppercase; letter-spacing:.3px; color:#444; }
    .right { text-align:right; }
    .total { font-size:16px; font-weight:800; }
    .pill { display:inline-block; border:1px solid #ddd; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:700; }
  `;

  const body =
    variant === "1"
      ? `
        <div class="top">
          <div>
            <div class="brand">Fresh Food Panamá</div>
            <div class="muted">${t("Cotización", "Quotation")} #${String(quote.id).slice(0, 8)}</div>
            <div class="muted">${t("Fecha", "Date")}: ${new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-PA")}</div>
          </div>
          <div class="pill">${incoterm} · ${place}</div>
        </div>

        <h1>${t("Cliente", "Client")}</h1>
        <div class="box">
          <div><b>${clientName}</b></div>
          <div class="muted">${clientEmail}</div>
        </div>

        <h1>${t("Resumen", "Summary")}</h1>
        <div class="box">
          <div class="muted">${t("Moneda", "Currency")}: <b>${currency}</b></div>
          <div class="muted">${t("Modo", "Mode")}: <b>${quote.mode}</b></div>
          <div class="muted">${t("Destino", "Destination")}: <b>${quote.destination}</b></div>
          <div style="margin-top:10px" class="total">${t("Total", "Total")}: ${sym} ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `
      : `
        <div class="top">
          <div>
            <div class="brand">Fresh Food Panamá</div>
            <div class="muted">${t("Cotización", "Quotation")} #${String(quote.id).slice(0, 8)}</div>
            <div class="muted">${t("Fecha", "Date")}: ${new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-PA")}</div>
          </div>
          <div class="pill">${incoterm} · ${place}</div>
        </div>

        <h1>${t("Cliente", "Client")}</h1>
        <div class="box">
          <div><b>${clientName}</b></div>
          <div class="muted">${clientEmail}</div>
        </div>

        <h1>${t("Detalle", "Details")}</h1>
        <div class="box">
          <table>
            <thead>
              <tr>
                <th>${t("Item", "Item")}</th>
                <th class="right">${t("Cantidad (cajas)", "Qty (boxes)")}</th>
                <th class="right">${t("Precio unit.", "Unit price")}</th>
                <th class="right">${t("Total", "Total")}</th>
              </tr>
            </thead>
            <tbody>
              ${
                items.length
                  ? items
                      .map((it: any) => {
                        const qty = Number(it.qty || 0);
                        const up = Number(it.unit_price || 0);
                        const rowTotal = Number(it.total || qty * up);
                        return `
                          <tr>
                            <td>${String(it.name || "")}</td>
                            <td class="right">${qty.toLocaleString("en-US")}</td>
                            <td class="right">${sym} ${up.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td class="right"><b>${sym} ${rowTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `<tr><td colspan="4" class="muted">${t("Sin items", "No items")}</td></tr>`
              }
            </tbody>
          </table>

          <div style="margin-top:12px; display:flex; justify-content:flex-end;">
            <div class="total">${t("Total", "Total")}: ${sym} ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      `;

  return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${body}</body></html>`;
}

export const handler: Handler = async (event) => {
  try {
    // auth admin
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    if (!isPrivileged(profile.role)) return text(403, "Forbidden");

    const id = String(event.queryStringParameters?.id || "").trim();
    const variant = (String(event.queryStringParameters?.variant || "2").trim() as "1" | "2");
    const lang = (String(event.queryStringParameters?.lang || "es").trim().toLowerCase() as "es" | "en");
    const debug = String(event.queryStringParameters?.debug || "").trim() === "1";

    if (!id) return text(400, "Missing id");

    // fetch quote
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("quotes")
      .select("*, clients:clients(*)")
      .eq("id", id)
      .single();

    if (error || !data) return text(404, error?.message || "Quote not found");

    const html = buildHtml({ variant, lang: lang === "en" ? "en" : "es", quote: data });

    // ✅ ESTA es la parte crítica: chromium.executablePath() en Netlify
    const executablePath = (await chromium.executablePath()) as unknown as string;

    if (debug) {
      return text(
        200,
        [
          `debug=1`,
          `NODE_ENV=${process.env.NODE_ENV}`,
          `NETLIFY=${process.env.NETLIFY}`,
          `AWS_LAMBDA_FUNCTION_NAME=${process.env.AWS_LAMBDA_FUNCTION_NAME ?? ""}`,
          `chromium.executablePath()=${String(executablePath)}`,
          `chromium.headless=${String((chromium as any).headless)}`,
          `argsCount=${Array.isArray((chromium as any).args) ? (chromium as any).args.length : "n/a"}`,
        ].join("\n")
      );
    }

    if (!executablePath || !String(executablePath).trim()) {
      return text(
        500,
        `Chromium executablePath is empty/undefined. This means the chromium binary is not being packaged for Netlify Functions.`
      );
    }

    const browser = await puppeteer.launch({
      args: (chromium as any).args,
      executablePath: String(executablePath),
      headless: true,
    } as any);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setContent(html, { waitUntil: "load" as any });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", right: "18mm", bottom: "18mm", left: "18mm" },
    });

    await page.close();
    await browser.close();

    const filename = `${safeFileName(data?.clients?.name || "cliente")}_quote_${String(id).slice(0, 8)}_${variant}_${lang}.pdf`;

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
      body: Buffer.from(pdf).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e: any) {
    return text(500, e?.message || "Server error");
  }
};