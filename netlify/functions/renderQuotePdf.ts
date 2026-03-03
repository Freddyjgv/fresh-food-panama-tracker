// netlify/functions/renderQuotePdf.ts
import type { Handler } from "@netlify/functions";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import * as fs from "fs";
import path from "path";
import { getUserAndProfile, text, sbAdmin, json, isPrivilegedRole } from "./_util";

// --- HELPERS DE FORMATO ---
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

// --- GESTIÓN DE PDF (BUFFERS) ---
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

// --- DIBUJO DE ELEMENTOS ---
function drawWatermark(doc: any, wmBuf: Buffer | null) {
  if (!wmBuf) return;
  const w = 420;
  const x = (doc.page.width - w) / 2;
  const y = (doc.page.height - w) / 2;
  doc.save().opacity(0.05);
  try { doc.image(wmBuf, x, y, { width: w }); } catch (e) { /* ignore */ }
  doc.restore();
}

function drawFooter(doc: any, lang: "es" | "en") {
  const footer = `FRESH FOOD PANAMA, C.A. · RUC: 2684372-1-845616 DV 30 · Calle 55, PH SFC 26, Obarrio, Ciudad de Panamá, Panama`;
  doc.save();
  doc.font("Inter").fontSize(8).fillColor("#6b7280");
  doc.text(footer, doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 10, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    align: "center",
  });
  doc.restore();
}

function drawHeader(doc: any, opts: any) {
  const { lang, quoteNumber, incoterm, place, dateStr, logoBuf } = opts;
  const x = doc.page.margins.left;
  const topY = doc.y;

  if (logoBuf) {
    try { doc.image(logoBuf, x, topY, { width: 110 }); } catch (e) { /* ignore */ }
  }

  doc.font("Inter-Bold").fontSize(16).fillColor("#0f172a");
  doc.text("Fresh Food Panamá", x + 120, topY + 2);
  doc.font("Inter").fontSize(10).fillColor("#475569");
  doc.text(`${t(lang, "Cotización", "Quotation")} ${quoteNumber}`, x + 120, topY + 22);
  doc.text(`${t(lang, "Fecha", "Date")}: ${dateStr}`, x + 120, topY + 36);

  const pillText = `${incoterm} · ${place}`;
  doc.font("Inter-Bold").fontSize(9).fillColor("#0f172a");
  const w = doc.widthOfString(pillText) + 18;
  const rightX = doc.page.width - doc.page.margins.right;
  const px = rightX - w;
  const py = topY + 10;
  doc.roundedRect(px, py, w, 18, 9).strokeColor("#e5e7eb").lineWidth(1).stroke();
  doc.text(pillText, px + 9, py + 5, { width: w - 18, align: "center" });
  doc.moveDown(2.2);
  doc.strokeColor("#eef2f7").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();
  doc.moveDown(0.8);
}

function drawKeyValueLines(doc: any, lines: any[], boxWidth: number) {
  const x = doc.page.margins.left;
  const h = 20 + lines.length * 14;
  ensureSpace(doc, h + 10);
  const y = doc.y;
  doc.roundedRect(x, y, boxWidth, h, 10).strokeColor("#e5e7eb").lineWidth(1).stroke();
  let ty = y + 10;
  for (const line of lines) {
    doc.font("Inter").fontSize(10).fillColor("#64748b").text(`${line.k}: `, x + 10, ty, { continued: true });
    doc.font("Inter-Bold").fontSize(10).fillColor("#0f172a").text(line.v || "—");
    ty += 14;
  }
  doc.y = y + h + 8;
}

function drawItemsTable(doc: any, opts: any) {
  const { lang, currency, items, total, boxWidth } = opts;
  const x = doc.page.margins.left;
  doc.font("Inter-Bold").fontSize(12).fillColor("#0f172a").text(t(lang, "Detalle", "Details"));
  doc.moveDown(0.35);
  
  const tableTopY = doc.y;
  const headerH = 20;
  doc.roundedRect(x, tableTopY, boxWidth, headerH, 10).strokeColor("#e5e7eb").stroke();
  doc.font("Inter-Bold").fontSize(9).fillColor("#475569");
  doc.text(t(lang, "Item", "Item"), x + 10, tableTopY + 6);
  doc.text(t(lang, "Total", "Total"), x, tableTopY + 6, { width: boxWidth - 10, align: "right" });
  
  doc.y = tableTopY + headerH + 10;
  const safeItems = Array.isArray(items) ? items : [];
  for (const it of safeItems) {
    ensureSpace(doc, 20);
    doc.font("Inter").fontSize(10).fillColor("#0f172a").text(it.name || "—", x + 10, doc.y);
    doc.font("Inter-Bold").text(money(it.total || 0, currency), x, doc.y, { width: boxWidth - 10, align: "right" });
    doc.y += 18;
  }
  doc.moveDown(1);
  doc.font("Inter-Bold").fontSize(12).text(`${t(lang, "Total", "Total")}: ${money(total, currency)}`, { align: "right" });
}

// --- HANDLER PRINCIPAL ---
export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile || !isPrivilegedRole(profile.role || "")) return text(401, "Unauthorized");

    const id = String(event.queryStringParameters?.id || "").trim();
    const variant = (event.queryStringParameters?.variant || "2") as "1" | "2";
    const lang = (event.queryStringParameters?.lang || "es") as "es" | "en";
    if (!id) return text(400, "Missing id");

    const { data, error } = await sbAdmin
      .from("quotes")
      .select("*, clients(*)")
      .eq("id", id)
      .single();

    if (error || !data) return text(404, "Quote not found");

    // Diagnóstico de Rutas para Netlify
    const brandDir = path.join(process.cwd(), "public", "brand");
    const logoBuf = readIfExists(path.join(brandDir, "freshfood_logo.png"));
    const wmBuf = readIfExists(path.join(brandDir, "FFPWM.png"));
    const interRegularBuf = readIfExists(path.join(brandDir, "Inter-Regular.ttf"));
    const interBoldBuf = readIfExists(path.join(brandDir, "Inter-Bold.ttf"));

    if (!interRegularBuf || !interBoldBuf) {
      console.error("Fuentes no encontradas en:", brandDir);
      return text(500, "Error crítico: Assets del sistema no disponibles.");
    }

    const totals = data.totals || {};
    const meta = totals.meta || {};
    const quoteNumber = data.quote_number || `RFQ-${data.id.slice(0,5)}`;
    const dateStr = new Date(data.created_at).toLocaleDateString(lang === "en" ? "en-US" : "es-PA");

    const doc = new (PDFDocument as any)({ size: "A4", margin: 42 });

    // Registro de fuentes desde Buffer (Evita problemas de path en Netlify)
    doc.registerFont("Inter", interRegularBuf);
    doc.registerFont("Inter-Bold", interBoldBuf);
    doc.font("Inter");

    const boxWidth = doc.page.width - 84;

    // Generar Contenido
    drawWatermark(doc, wmBuf);
    drawHeader(doc, { lang, quoteNumber, incoterm: meta.incoterm || "CIP", place: meta.place || data.destination, dateStr, logoBuf });

    drawKeyValueLines(doc, [
      { k: t(lang, "Cliente", "Client"), v: data.clients?.name || data.client_snapshot?.name },
      { k: t(lang, "Email", "Email"), v: data.clients?.contact_email || data.client_snapshot?.email }
    ], boxWidth);

    if (variant === "2") {
      drawItemsTable(doc, { lang, currency: data.currency, items: totals.items, total: totals.total, boxWidth });
    }

    const terms = String(data.terms || "");
    if (terms) {
      doc.moveDown(1);
      doc.font("Inter-Bold").fontSize(10).text(t(lang, "Términos y condiciones", "Terms & Conditions"));
      doc.font("Inter").fontSize(9).text(terms, { width: boxWidth, align: "justify" });
    }

    drawFooter(doc, lang);

    const pdfBuffer = await docToBuffer(doc);
    const filename = `${safeFileName(data.clients?.name || "quote")}_${quoteNumber}.pdf`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e: any) {
    console.error("FATAL PDF:", e.message);
    return text(500, "Error generando PDF");
  }
};