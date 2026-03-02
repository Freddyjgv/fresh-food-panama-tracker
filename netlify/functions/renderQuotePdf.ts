import type { Handler } from "@netlify/functions";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import * as fs from "fs";
import path from "path";
import { getUserAndProfile, text, supabaseAdmin, json } from "./_util";

// --- HELPERS (IDÉNTICOS A TU ORIGINAL) ---
function isPrivileged(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "superadmin";
}

function safeFileName(name: string) {
  return String(name || "cotizacion").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 80);
}

function money(n: number, currency: string) {
  const sym = currency === "EUR" ? "€" : "$";
  const v = Number.isFinite(n) ? n : 0;
  return `${sym} ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function t(lang: "es" | "en", es: string, en: string) { return lang === "en" ? en : es; }

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
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
  }
}

function readIfExists(absPath: string): Buffer | null {
  try {
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath);
  } catch { return null; }
}

// --- FUNCIONES DE DIBUJO (CORREGIDAS PARA EVITAR RECURSIÓN) ---

function drawWatermark(doc: any, wmBuf: Buffer | null) {
  if (!wmBuf) return;
  doc.save().opacity(0.05);
  try {
    const w = 420;
    doc.image(wmBuf, (doc.page.width - w) / 2, (doc.page.height - w) / 2, { width: w });
  } catch (e) {}
  doc.restore();
}

function drawFooter(doc: any) {
  const footer = `FRESH FOOD PANAMA, C.A. · RUC: 2684372-1-845616 DV 30 · Calle 55, PH SFC 26, Obarrio, Ciudad de Panamá, Panama`;
  doc.save();
  // Usamos una fuente estándar para el footer para evitar cargar buffers en el evento de página
  doc.font("Helvetica").fontSize(8).fillColor("#6b7280");
  doc.text(footer, doc.page.margins.left, doc.page.height - 35, {
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
    try { doc.image(logoBuf, x, topY, { width: 110 }); } catch (e) {}
  }

  doc.font("Inter-Bold").fontSize(16).fillColor("#0f172a").text("Fresh Food Panamá", x + 120, topY + 2);
  doc.font("Inter").fontSize(10).fillColor("#475569");
  doc.text(`${t(lang, "Cotización", "Quotation")} ${quoteNumber}`, x + 120, topY + 22);
  doc.text(`${t(lang, "Fecha", "Date")}: ${dateStr}`, x + 120, topY + 36);

  const pillText = `${incoterm} · ${place}`;
  doc.font("Inter-Bold").fontSize(9);
  const w = doc.widthOfString(pillText) + 18;
  const rightX = doc.page.width - doc.page.margins.right;
  doc.roundedRect(rightX - w, topY + 10, w, 18, 9).strokeColor("#e5e7eb").stroke();
  doc.text(pillText, rightX - w + 9, topY + 15, { width: w - 18, align: "center" });

  doc.moveDown(2.5).strokeColor("#eef2f7").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke().moveDown(0.8);
}

// ... (drawSectionTitle, drawBox, drawKeyValueLines permanecen igual que tu original)

function drawItemsTable(doc: any, opts: any) {
  const { lang, currency, items, total, boxWidth } = opts;
  const x = doc.page.margins.left;
  const rightX = x + boxWidth;
  
  doc.font("Inter-Bold").fontSize(12).fillColor("#0f172a").text(t(lang, "Detalle", "Details")).moveDown(0.4);

  const colItem = Math.floor(boxWidth * 0.46), colQty = Math.floor(boxWidth * 0.18), colUP = Math.floor(boxWidth * 0.18), colTot = boxWidth - colItem - colQty - colUP;
  const tableTopY = doc.y;

  // Header de tabla
  doc.roundedRect(x, tableTopY, boxWidth, 20, 10).strokeColor("#e5e7eb").stroke();
  doc.font("Inter-Bold").fontSize(9).fillColor("#475569");
  doc.text(t(lang, "Item", "Item"), x + 10, tableTopY + 6);
  doc.text(t(lang, "Cant.", "Qty"), x + colItem, tableTopY + 6, { width: colQty - 10, align: "right" });
  doc.text(t(lang, "Total", "Total"), x + colItem + colQty + colUP, tableTopY + 6, { width: colTot - 10, align: "right" });

  doc.y = tableTopY + 20;
  for (const it of (items || [])) {
    ensureSpace(doc, 25);
    doc.strokeColor("#eef2f7").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();
    doc.font("Inter").fontSize(10).fillColor("#0f172a").text(it.name || "—", x + 10, doc.y + 5, { width: colItem - 10 });
    doc.text(money(it.total || 0, currency), x + colItem + colQty + colUP, doc.y - 10, { width: colTot - 10, align: "right" });
    doc.y += 18;
  }
  
  doc.moveDown(1);
  doc.font("Inter-Bold").fontSize(12).text(`${t(lang, "Total", "Total")}: ${money(total, currency)}`, x, doc.y, { width: boxWidth, align: "right" });
}

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile || !isPrivileged(profile.role)) return text(403, "Forbidden");

    const id = event.queryStringParameters?.id;
    const variant = event.queryStringParameters?.variant || "2";
    const lang = (event.queryStringParameters?.lang || "es") as "es" | "en";

    const sb = supabaseAdmin();
    const { data } = await sb.from("quotes").select("*, clients:clients(*)").eq("id", id).single();
    if (!data) return text(404, "Not found");

    const brandDir = path.join(process.cwd(), "public", "brand");
    const logoBuf = readIfExists(path.join(brandDir, "freshfood_logo.png"));
    const wmBuf = readIfExists(path.join(brandDir, "FFPWM.png"));
    const interR = readIfExists(path.join(brandDir, "Inter-Regular.ttf"));
    const interB = readIfExists(path.join(brandDir, "Inter-Bold.ttf"));

    const doc = new (PDFDocument as any)({ size: "A4", margin: 42, bufferPages: true });

    // REGISTRO ÚNICO
    if (interR) doc.registerFont("Inter", interR);
    if (interB) doc.registerFont("Inter-Bold", interB);
    doc.font("Inter");

    // DIBUJO DE CONTENIDO
    // Nota: Dibujamos el header y tablas PRIMERO.
    drawHeader(doc, { 
      lang, quoteNumber: data.quote_number || id?.slice(0,5), 
      incoterm: data.totals?.meta?.incoterm || "CIP", 
      place: data.destination || "Panamá", 
      dateStr: new Date(data.created_at).toLocaleDateString(), logoBuf 
    });

    if (variant === "1") {
        // ... Resumen corto
    } else {
        drawItemsTable(doc, { lang, currency: data.currency, items: data.totals?.items, total: data.totals?.total, boxWidth: 511 });
    }

    // --- EL TRUCO PARA EVITAR EL CRASH ---
    // En lugar de usar doc.on('pageAdded'), recorremos las páginas al final
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      drawWatermark(doc, wmBuf);
      drawFooter(doc);
    }

    const pdfBuffer = await docToBuffer(doc);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/pdf" },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e: any) {
    return text(500, `Error: ${e.message}`);
  }
};