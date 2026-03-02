import type { Handler } from "@netlify/functions";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import * as fs from "fs";
import path from "path";
import { getUserAndProfile, text, supabaseAdmin, json } from "./_util";

// --- HELPERS DE APOYO ---

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

function money(n: number, currency: string) {
  const sym = currency === "EUR" ? "€" : "$";
  const v = Number.isFinite(n) ? n : 0;
  return `${sym} ${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function t(lang: "es" | "en", es: string, en: string) {
  return lang === "en" ? en : es;
}

type QuoteRow = any;

function docToBuffer(doc: any) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function ensureSpace(doc: any, neededHeight: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) doc.addPage();
}

function readIfExists(absPath: string): Buffer | null {
  try {
    if (!fs.existsSync(absPath)) return null;
    const b = fs.readFileSync(absPath);
    return Buffer.isBuffer(b) ? b : Buffer.from(b as any);
  } catch {
    return null;
  }
}

// --- FUNCIONES DE DIBUJO (RESTAURADAS COMPLETAMENTE) ---

function drawWatermark(doc: any, wmBuf: Buffer | null) {
  if (!wmBuf) return;
  const w = 420;
  const x = (doc.page.width - w) / 2;
  const y = (doc.page.height - w) / 2;
  doc.save();
  doc.opacity(0.05);
  try {
    doc.image(wmBuf, x, y, { width: w });
  } catch { /* ignore */ }
  doc.opacity(1);
  doc.restore();
}

function drawFooter(doc: any, lang: "es" | "en") {
  const footer = `FRESH FOOD PANAMA, C.A. · RUC: 2684372-1-845616 DV 30 · Calle 55, PH SFC 26, Obarrio, Ciudad de Panamá, Panama`;
  doc.save();
  // Fallback de fuente para evitar crash si no carga Inter
  try { doc.font("Inter"); } catch { doc.font("Helvetica"); }
  doc.fontSize(8).fillColor("#6b7280");
  doc.text(footer, doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 10, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    align: "center",
  });
  doc.restore();
}

function drawHeader(
  doc: any,
  opts: {
    lang: "es" | "en";
    quoteNumber: string;
    incoterm: string;
    place: string;
    dateStr: string;
    logoBuf: Buffer | null;
  }
) {
  const { lang, quoteNumber, incoterm, place, dateStr, logoBuf } = opts;
  const x = doc.page.margins.left;
  const topY = doc.y;

  if (logoBuf) {
    try {
      doc.image(logoBuf, x, topY, { width: 110 });
    } catch { /* ignore */ }
  }

  try { doc.font("Inter-Bold"); } catch { doc.font("Helvetica-Bold"); }
  doc.fontSize(16).fillColor("#0f172a");
  doc.text("Fresh Food Panamá", x + 120, topY + 2);

  try { doc.font("Inter"); } catch { doc.font("Helvetica"); }
  doc.fontSize(10).fillColor("#475569");
  doc.text(`${t(lang, "Cotización", "Quotation")} ${quoteNumber}`, x + 120, topY + 22);
  doc.text(`${t(lang, "Fecha", "Date")}: ${dateStr}`, x + 120, topY + 36);

  const pillText = `${incoterm} · ${place}`;
  try { doc.font("Inter-Bold"); } catch { doc.font("Helvetica-Bold"); }
  doc.fontSize(9).fillColor("#0f172a");
  const w = doc.widthOfString(pillText) + 18;
  const h = 18;
  const rightX = doc.page.width - doc.page.margins.right;
  const px = rightX - w;
  const py = topY + 10;

  doc.roundedRect(px, py, w, h, 9).strokeColor("#e5e7eb").lineWidth(1).stroke();
  doc.text(pillText, px + 9, py + 5, { width: w - 18, align: "center" });

  doc.moveDown(2.2);
  doc.strokeColor("#eef2f7").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();
  doc.moveDown(0.8);
}

function drawSectionTitle(doc: any, title: string) {
  try { doc.font("Inter-Bold"); } catch { doc.font("Helvetica-Bold"); }
  doc.fontSize(12).fillColor("#0f172a").text(title);
  doc.moveDown(0.35);
}

function drawBox(doc: any, x: number, y: number, w: number, h: number) {
  doc.roundedRect(x, y, w, h, 10).strokeColor("#e5e7eb").lineWidth(1).stroke();
}

function drawKeyValueLines(doc: any, lines: Array<{ k: string; v: string }>, boxWidth: number) {
  const x = doc.page.margins.left;
  const pad = 10;
  const lineH = 14;
  const h = pad * 2 + lines.length * lineH;
  ensureSpace(doc, h + 10);
  const y = doc.y;
  drawBox(doc, x, y, boxWidth, h);
  let ty = y + pad;
  for (const line of lines) {
    try { doc.font("Inter"); } catch { doc.font("Helvetica"); }
    doc.fontSize(10).fillColor("#64748b").text(`${line.k}: `, x + pad, ty, { continued: true });
    try { doc.font("Inter-Bold"); } catch { doc.font("Helvetica-Bold"); }
    doc.fontSize(10).fillColor("#0f172a").text(line.v || "—");
    ty += lineH;
  }
  doc.y = y + h + 8;
}

function drawItemsTable(doc: any, opts: { lang: "es" | "en"; currency: string; items: any[]; total: number; boxWidth: number }) {
  const { lang, currency, items, total, boxWidth } = opts;
  const x = doc.page.margins.left;
  const rightX = x + boxWidth;
  const pad = 10;

  drawSectionTitle(doc, t(lang, "Detalle", "Details"));

  const colItem = Math.floor(boxWidth * 0.46);
  const colQty = Math.floor(boxWidth * 0.18);
  const colUP = Math.floor(boxWidth * 0.18);
  const colTot = boxWidth - colItem - colQty - colUP;

  const headerH = 20;
  const rowH = 18;

  ensureSpace(doc, headerH + rowH * 2 + 40);
  const tableTopY = doc.y;

  drawBox(doc, x, tableTopY, boxWidth, headerH);
  doc.save().opacity(0.04).rect(x, tableTopY, boxWidth, headerH).fill("#000").restore();

  try { doc.font("Inter-Bold"); } catch { doc.font("Helvetica-Bold"); }
  doc.fontSize(9).fillColor("#475569");
  doc.text(t(lang, "Item", "Item"), x + pad, tableTopY + 6, { width: colItem - pad });
  doc.text(t(lang, "Cantidad (cajas)", "Qty (boxes)"), x + colItem, tableTopY + 6, { width: colQty - pad, align: "right" });
  doc.text(t(lang, "Precio unit.", "Unit price"), x + colItem + colQty, tableTopY + 6, { width: colUP - pad, align: "right" });
  doc.text(t(lang, "Total", "Total"), x + colItem + colQty + colUP, tableTopY + 6, { width: colTot - pad, align: "right" });

  doc.y = tableTopY + headerH;
  const safeItems = Array.isArray(items) ? items : [];
  
  if (!safeItems.length) {
    try { doc.font("Inter"); } catch { doc.font("Helvetica"); }
    doc.fontSize(10).fillColor("#64748b").text(t(lang, "Sin items", "No items"), x + pad, doc.y + 6);
    doc.y += rowH;
  } else {
    for (const it of safeItems) {
      ensureSpace(doc, rowH + 30);
      const name = String(it?.name || "");
      const qty = Number(it?.qty || 0);
      const up = Number(it?.unit_price || 0);
      const rowTotal = Number(it?.total || qty * up);

      doc.strokeColor("#eef2f7").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();
      try { doc.font("Inter"); } catch { doc.font("Helvetica"); }
      doc.fontSize(10).fillColor("#0f172a").text(name, x + pad, doc.y + 5, { width: colItem - pad });
      doc.text(qty.toLocaleString("en-US"), x + colItem, doc.y + 5, { width: colQty - pad, align: "right" });
      doc.text(money(up, currency), x + colItem + colQty, doc.y + 5, { width: colUP - pad, align: "right" });
      try { doc.font("Inter-Bold"); } catch { doc.font("Helvetica-Bold"); }
      doc.text(money(rowTotal, currency), x + colItem + colQty + colUP, doc.y + 5, { width: colTot - pad, align: "right" });
      doc.y += rowH;
    }
  }

  doc.strokeColor("#eef2f7").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();
  doc.moveDown(0.6);
  try { doc.font("Inter-Bold"); } catch { doc.font("Helvetica-Bold"); }
  doc.fontSize(12).fillColor("#0f172a").text(`${t(lang, "Total", "Total")}: ${money(Number(total || 0), currency)}`, x, doc.y, { width: boxWidth, align: "right" });
  
  doc.moveDown(0.4);
  const endY = doc.y + 4;
  const h = Math.max(60, endY - tableTopY);
  doc.roundedRect(x, tableTopY, boxWidth, h, 10).strokeColor("#e5e7eb").lineWidth(1).stroke();
  doc.y = endY + 4;
}

function drawTermsBox(doc: any, title: string, terms: string, boxWidth: number) {
  if (!String(terms || "").trim()) return;
  drawSectionTitle(doc, title);
  const x = doc.page.margins.left;
  const pad = 10;
  const maxW = boxWidth - pad * 2;
  try { doc.font("Inter"); } catch { doc.font("Helvetica"); }
  doc.fontSize(10);
  const textH = doc.heightOfString(terms || "", { width: maxW, align: "left" });
  const h = Math.max(40, pad * 2 + textH);
  ensureSpace(doc, h + 10);
  const y = doc.y;
  drawBox(doc, x, y, boxWidth, h);
  doc.fillColor("#0f172a").text(terms || "", x + pad, y + pad, { width: maxW, align: "left" });
  doc.y = y + h + 8;
}

// --- HANDLER PRINCIPAL ---

export const handler: Handler = async (event) => {
  const reqId = (event.headers["x-nf-request-id"] || event.headers["X-Nf-Request-Id"] || "").toString();

  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile || !isPrivileged(profile.role)) return text(401, "Unauthorized/Forbidden");

    const id = String(event.queryStringParameters?.id || "").trim();
    const variant = (String(event.queryStringParameters?.variant || "2").trim() as "1" | "2");
    const lang = (String(event.queryStringParameters?.lang || "es").trim().toLowerCase() as "es" | "en");
    if (!id) return text(400, "Missing id");

    const sb = supabaseAdmin();
    const { data, error } = await sb.from("quotes").select("*, clients:clients(*)").eq("id", id).single<QuoteRow>();
    if (error || !data) return text(404, error?.message || "Quote not found");

    // Lógica de variables de datos (Restaurada)
    const totals = data?.totals || {};
    const meta = totals?.meta || {};
    const incoterm = String(meta?.incoterm || "CIP");
    const place = String(meta?.place || data?.destination || "—");
    const currency = String(data?.currency || "USD");
    const total = Number(totals?.total || 0);
    const items = Array.isArray(totals?.items) ? totals.items : [];
    const clientName = String(data?.clients?.name || data?.client_snapshot?.name || "—");
    const clientEmail = String(data?.clients?.contact_email || data?.client_snapshot?.contact_email || "—");
    const quoteNumber = String(data?.quote_number || `RFQ/${new Date(data?.created_at || Date.now()).getFullYear()}/${String(data?.id || id).slice(0, 5)}`);
    const dateStr = new Date(data?.created_at || Date.now()).toLocaleDateString(lang === "en" ? "en-US" : "es-PA");

    // --- MANEJO DE ASSETS (Punto Crítico Netlify) ---
    const brandDir = path.join(process.cwd(), "public", "brand");
    const logoBuf = readIfExists(path.join(brandDir, "freshfood_logo.png"));
    const wmBuf = readIfExists(path.join(brandDir, "FFPWM.png"));
    const interRegularBuf = readIfExists(path.join(brandDir, "Inter-Regular.ttf"));
    const interBoldBuf = readIfExists(path.join(brandDir, "Inter-Bold.ttf"));

    // PDF SETUP
    const doc = new (PDFDocument as any)({
      size: "A4", margin: 42,
      info: { Title: `${t(lang, "Cotización", "Quotation")} ${quoteNumber}`, Author: "Fresh Food Panamá" }
    });

    // REGISTRO DE FUENTES PRIORITARIO
    if (interRegularBuf && interBoldBuf) {
        doc.registerFont("Inter", interRegularBuf);
        doc.registerFont("Inter-Bold", interBoldBuf);
        doc.font("Inter");
    } else {
        doc.font("Helvetica");
    }

    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Elementos de página
    const setupPage = () => { drawWatermark(doc, wmBuf); drawFooter(doc, lang); };
    doc.on("pageAdded", setupPage);
    setupPage();

    // RENDERIZADO FINAL
    drawHeader(doc, { lang, quoteNumber, incoterm, place, dateStr, logoBuf });

    drawSectionTitle(doc, t(lang, "Cliente", "Client"));
    drawKeyValueLines(doc, [
      { k: t(lang, "Nombre", "Name"), v: clientName },
      { k: t(lang, "Email", "Email"), v: clientEmail }
    ], boxWidth);

    if (variant === "1") {
      drawSectionTitle(doc, t(lang, "Resumen", "Summary"));
      drawKeyValueLines(doc, [
        { k: t(lang, "Moneda", "Currency"), v: currency },
        { k: t(lang, "Modo", "Mode"), v: String(data?.mode || "—") },
        { k: t(lang, "Destino/Place", "Destination/Place"), v: String(place || "—") },
        { k: t(lang, "Total", "Total"), v: money(total, currency) },
      ], boxWidth);
    } else {
      drawItemsTable(doc, { lang, currency, items, total, boxWidth });
    }

    drawTermsBox(doc, t(lang, "Términos y condiciones", "Terms & Conditions"), String(data?.terms || ""), boxWidth);

    const pdfBuffer = await docToBuffer(doc);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName(clientName)}_${safeFileName(quoteNumber)}.pdf"`,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e: any) {
    console.error("[renderQuotePdf] FATAL", { reqId, message: e?.message });
    return text(500, e?.message || "Server error");
  }
};