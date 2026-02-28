// netlify/functions/renderQuotePdf.ts
import type { Handler } from "@netlify/functions";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
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

function docToBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) doc.addPage();
}

function drawBox(doc: PDFKit.PDFDocument, opts: { x: number; y: number; w: number; h: number; r?: number }) {
  const r = opts.r ?? 10;
  doc.roundedRect(opts.x, opts.y, opts.w, opts.h, r).strokeColor("#E6E9EF").lineWidth(1).stroke();
}

function setOpacitySafe(doc: PDFKit.PDFDocument, v: number) {
  // pdfkit soporta doc.opacity(); esto es solo por seguridad si cambia algo.
  // @ts-ignore
  if (typeof doc.opacity === "function") doc.opacity(v);
}

function registerFontsOrThrow(doc: PDFKit.PDFDocument) {
  const fontRegular = path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf");
  const fontBold = path.join(process.cwd(), "public", "fonts", "Inter-Bold.ttf");
  const fontSemi = path.join(process.cwd(), "public", "fonts", "Inter-SemiBold.ttf");

  const missing: string[] = [];
  if (!fs.existsSync(fontRegular)) missing.push(fontRegular);
  if (!fs.existsSync(fontBold)) missing.push(fontBold);
  // semi es opcional
  const hasSemi = fs.existsSync(fontSemi);

  if (missing.length) {
    throw new Error(
      `Missing PDF font files. Add these to git under /public/fonts: ${missing.join(", ")}`
    );
  }

  doc.registerFont("Inter", fontRegular);
  doc.registerFont("Inter-Bold", fontBold);
  if (hasSemi) doc.registerFont("Inter-Semi", fontSemi);

  doc.font("Inter");
}

function wireWatermark(doc: PDFKit.PDFDocument, watermarkAbsPath: string) {
  const draw = () => {
    if (!watermarkAbsPath || !fs.existsSync(watermarkAbsPath)) return;

    const pageW = doc.page.width;
    const pageH = doc.page.height;

    // tamaño grande, centrado, MUY tenue
    const targetW = Math.min(pageW * 0.78, 520);
    const x = (pageW - targetW) / 2;
    const y = (pageH - targetW) / 2;

    doc.save();
    setOpacitySafe(doc, 0.05);
    // sin bordes/rotación para no arriesgar performance
    doc.image(watermarkAbsPath, x, y, { width: targetW });
    setOpacitySafe(doc, 1);
    doc.restore();
  };

  // primera página (autoFirstPage true)
  draw();
  doc.on("pageAdded", draw);
}

function drawHeader(doc: PDFKit.PDFDocument, opts: {
  lang: "es" | "en";
  quoteNumber: string;
  incoterm: string;
  place: string;
  dateStr: string;
  logoAbsPath: string | null;
  isInternal: boolean;
}) {
  const { lang, quoteNumber, incoterm, place, dateStr, logoAbsPath, isInternal } = opts;

  const leftX = doc.page.margins.left;
  const rightX = doc.page.width - doc.page.margins.right;

  const topY = doc.y;

  // Logo + Brand
  const logoW = 64;
  if (logoAbsPath && fs.existsSync(logoAbsPath)) {
    doc.image(logoAbsPath, leftX, topY, { width: logoW });
  }

  const titleX = leftX + (logoAbsPath && fs.existsSync(logoAbsPath) ? logoW + 10 : 0);

  doc
    .font("Inter-Bold")
    .fontSize(15)
    .fillColor("#0B1B12")
    .text("FRESH FOOD PANAMA, C.A", titleX, topY + 2, { align: "left" });

  doc
    .font("Inter")
    .fontSize(9)
    .fillColor("#4B5563")
    .text(`RUC: 2684372-1-845616 DV 30`, titleX, topY + 22)
    .text(`Calle 55, PH SFC 26, Obarrio, Ciudad de Panamá, Panamá`, titleX, topY + 35);

  // etiqueta interna (si aplica)
  if (isInternal) {
    const tag = t(lang, "USO INTERNO", "INTERNAL USE");
    doc.font("Inter-Bold").fontSize(9).fillColor("#14532D");
    const w = doc.widthOfString(tag) + 14;
    const h = 18;
    const x = rightX - w;
    const y = topY + 2;
    doc.save();
    setOpacitySafe(doc, 1);
    doc.roundedRect(x, y, w, h, 9).fillOpacity(0.08).fill("#16A34A").fillOpacity(1);
    doc.roundedRect(x, y, w, h, 9).strokeColor("rgba(22,163,74,.22)").lineWidth(1).stroke();
    doc.fillColor("#14532D").text(tag, x, y + 5, { width: w, align: "center" });
    doc.restore();
  }

  // bloque derecha: quote # + fecha + incoterm/place (compacto)
  const blockY = topY + 26;
  const line1 = `${t(lang, "Cotización", "Quotation")}: ${quoteNumber}`;
  const line2 = `${t(lang, "Fecha", "Date")}: ${dateStr}`;
  const line3 = `${incoterm} · ${place || "—"}`;

  doc.font("Inter-Bold").fontSize(10).fillColor("#111827");
  const bw = Math.min(290, doc.widthOfString(line1) + 18);
  const x = rightX - bw;
  const h = 54;

  doc.save();
  doc.roundedRect(x, blockY, bw, h, 12).fillOpacity(0.03).fill("#0B1B12").fillOpacity(1);
  doc.roundedRect(x, blockY, bw, h, 12).strokeColor("#E6E9EF").lineWidth(1).stroke();
  doc.restore();

  doc.text(line1, x + 10, blockY + 8, { width: bw - 20, align: "left" });
  doc.font("Inter").fontSize(9).fillColor("#4B5563");
  doc.text(line2, x + 10, blockY + 24, { width: bw - 20, align: "left" });
  doc.font("Inter-Bold").fontSize(9).fillColor("#0B1B12");
  doc.text(line3, x + 10, blockY + 38, { width: bw - 20, align: "left" });

  doc.y = topY + 70;

  // divider
  doc.strokeColor("#EEF2F7").moveTo(leftX, doc.y).lineTo(rightX, doc.y).stroke();
  doc.moveDown(0.7);
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.25);
  doc.font("Inter-Bold").fontSize(11).fillColor("#0B1B12").text(title);
  doc.moveDown(0.25);
}

function drawKeyValueGrid(doc: PDFKit.PDFDocument, opts: {
  left: Array<{ k: string; v: string }>;
  right?: Array<{ k: string; v: string }>;
  boxWidth: number;
}) {
  const x = doc.page.margins.left;
  const y = doc.y;
  const pad = 10;
  const colGap = 12;

  const colW = opts.right ? Math.floor((opts.boxWidth - colGap) / 2) : opts.boxWidth;

  const lineH = 13;
  const leftH = pad * 2 + opts.left.length * lineH;
  const rightH = opts.right ? pad * 2 + opts.right.length * lineH : 0;
  const h = Math.max(leftH, rightH, 52);

  ensureSpace(doc, h + 10);
  const y2 = doc.y;

  drawBox(doc, { x, y: y2, w: opts.boxWidth, h, r: 12 });

  const drawCol = (colX: number, lines: Array<{ k: string; v: string }>) => {
    let ty = y2 + pad;
    for (const line of lines) {
      doc.font("Inter").fontSize(9).fillColor("#6B7280").text(`${line.k}`, colX + pad, ty, { continued: true });
      doc.font("Inter-Bold").fontSize(9).fillColor("#111827").text(` ${line.v || "—"}`);
      ty += lineH;
    }
  };

  drawCol(x, opts.left);
  if (opts.right) drawCol(x + colW + colGap, opts.right);

  doc.y = y2 + h + 8;
  if (doc.y < y) doc.y = y + h + 8;
}

function drawItemsTable(doc: PDFKit.PDFDocument, opts: {
  lang: "es" | "en";
  currency: string;
  items: any[];
  total: number;
  boxWidth: number;
}) {
  const { lang, currency, items, total, boxWidth } = opts;

  drawSectionTitle(doc, t(lang, "Detalle de la oferta", "Offer Details"));

  const x = doc.page.margins.left;
  const rightX = x + boxWidth;
  const pad = 10;

  const colItem = Math.floor(boxWidth * 0.52);
  const colQty = Math.floor(boxWidth * 0.14);
  const colUP = Math.floor(boxWidth * 0.17);
  const colTot = boxWidth - colItem - colQty - colUP;

  const headerH = 20;
  const rowH = 18;

  ensureSpace(doc, headerH + rowH * 3 + 42);
  const tableTopY = doc.y;

  // header
  doc.save();
  doc.roundedRect(x, doc.y, boxWidth, headerH, 10).fillOpacity(0.05).fill("#0B1B12").fillOpacity(1);
  doc.roundedRect(x, doc.y, boxWidth, headerH, 10).strokeColor("#E6E9EF").lineWidth(1).stroke();
  doc.restore();

  doc.font("Inter-Bold").fontSize(8.5).fillColor("#374151");
  doc.text(t(lang, "Producto", "Product"), x + pad, doc.y + 6, { width: colItem - pad });
  doc.text(t(lang, "Cajas", "Boxes"), x + colItem, doc.y + 6, { width: colQty - pad, align: "right" });
  doc.text(t(lang, "Unitario", "Unit"), x + colItem + colQty, doc.y + 6, { width: colUP - pad, align: "right" });
  doc.text(t(lang, "Total", "Total"), x + colItem + colQty + colUP, doc.y + 6, { width: colTot - pad, align: "right" });

  doc.y += headerH;

  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    doc.font("Inter").fontSize(9).fillColor("#6B7280").text(t(lang, "Sin items", "No items"), x + pad, doc.y + 6);
    doc.y += rowH;
  } else {
    for (const it of safeItems) {
      ensureSpace(doc, rowH + 30);

      const name = String(it?.name || "");
      const qty = Number(it?.qty || 0);
      const up = Number(it?.unit_price || 0);
      const rowTotal = Number(it?.total || qty * up);

      doc.strokeColor("#EEF2F7").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();

      doc.font("Inter").fontSize(9.2).fillColor("#111827");
      doc.text(name, x + pad, doc.y + 5, { width: colItem - pad });

      doc.font("Inter").fontSize(9.2).fillColor("#111827");
      doc.text(qty.toLocaleString("en-US"), x + colItem, doc.y + 5, { width: colQty - pad, align: "right" });

      doc.text(money(up, currency), x + colItem + colQty, doc.y + 5, { width: colUP - pad, align: "right" });

      doc.font("Inter-Bold").text(money(rowTotal, currency), x + colItem + colQty + colUP, doc.y + 5, {
        width: colTot - pad,
        align: "right",
      });

      doc.y += rowH;
    }
  }

  doc.strokeColor("#EEF2F7").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();

  // total
  doc.moveDown(0.4);
  doc.font("Inter-Bold").fontSize(12).fillColor("#0B1B12");
  doc.text(`${t(lang, "Total", "Total")}: ${money(Number(total || 0), currency)}`, x, doc.y, { width: boxWidth, align: "right" });

  doc.moveDown(0.5);

  const endY = doc.y;
  const h = Math.max(58, endY - tableTopY);
  doc.roundedRect(x, tableTopY, boxWidth, h, 10).strokeColor("#E6E9EF").lineWidth(1).stroke();

  doc.y = endY + 4;
}

function drawTerms(doc: PDFKit.PDFDocument, title: string, body: string, boxWidth: number) {
  if (!String(body || "").trim()) return;
  drawSectionTitle(doc, title);

  const x = doc.page.margins.left;
  const pad = 10;
  const maxW = boxWidth - pad * 2;

  doc.font("Inter").fontSize(9.1);
  const textH = doc.heightOfString(body, { width: maxW, align: "left" });
  const h = Math.max(48, pad * 2 + textH);

  ensureSpace(doc, h + 10);
  const y = doc.y;

  drawBox(doc, { x, y, w: boxWidth, h, r: 12 });

  doc.font("Inter").fontSize(9.1).fillColor("#111827");
  doc.text(body, x + pad, y + pad, { width: maxW, align: "left" });

  doc.y = y + h + 8;
}

function drawFooter(doc: PDFKit.PDFDocument, lang: "es" | "en") {
  const leftX = doc.page.margins.left;
  const rightX = doc.page.width - doc.page.margins.right;

  const footerY = doc.page.height - doc.page.margins.bottom + 8;

  doc.save();
  doc.strokeColor("#EEF2F7").moveTo(leftX, footerY - 8).lineTo(rightX, footerY - 8).stroke();
  doc.restore();

  doc.font("Inter").fontSize(8.5).fillColor("#6B7280");
  doc.text(
    "FRESH FOOD PANAMA, C.A · RUC: 2684372-1-845616 DV 30 · Calle 55, PH SFC 26, Obarrio, Ciudad de Panamá, Panamá",
    leftX,
    footerY,
    { width: rightX - leftX, align: "center" }
  );

  // nota auto-generado
  doc.font("Inter").fontSize(8).fillColor("#9CA3AF");
  doc.text(t(lang, "Documento generado automáticamente.", "Automatically generated document."), leftX, footerY + 11, {
    width: rightX - leftX,
    align: "center",
  });
}

export const handler: Handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, content-type",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        body: JSON.stringify({ ok: true }),
      };
    }

    // Auth
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    if (!isPrivileged(profile.role)) return text(403, "Forbidden");

    // Params
    const id = String(event.queryStringParameters?.id || "").trim();
    const variant = (String(event.queryStringParameters?.variant || "2").trim() as "1" | "2");
    const lang = (String(event.queryStringParameters?.lang || "es").trim().toLowerCase() as "es" | "en");
    const report = String(event.queryStringParameters?.report || "").trim() === "1";

    if (!id) return text(400, "Missing id");

    // Fetch quote
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("quotes")
      .select("*, clients:clients(*)")
      .eq("id", id)
      .single<QuoteRow>();

    if (error || !data) return text(404, error?.message || "Quote not found");

    const totals = data?.totals || {};
    const meta = totals?.meta || {};
    const incoterm = String(meta?.incoterm || "CIP");
    const place = String(meta?.place || data?.destination || "—");
    const currency = String(data?.currency || "USD");
    const total = Number(totals?.total || 0);
    const items = Array.isArray(totals?.items) ? totals.items : [];

    const clientName = String(data?.clients?.name || data?.client_snapshot?.name || "—");
    const clientEmail = String(data?.clients?.contact_email || data?.client_snapshot?.contact_email || "—");
    const clientTaxId = String(data?.clients?.tax_id || data?.client_snapshot?.tax_id || "—"); // si aún no existe, quedará "—"

    // Número de cotización: si ya existe en DB úsalo; si no, fallback al corto.
    const quoteNumber =
      String(data?.quote_number || "").trim() || `RFQ/${new Date(data?.created_at || Date.now()).getFullYear()}/${String(data?.id || id).slice(0, 5)}`;

    const dateStr = new Date(data?.created_at || Date.now()).toLocaleDateString(lang === "en" ? "en-US" : "es-PA");

    // Assets (logo + watermark)
    const logoAbsPath = path.join(process.cwd(), "public", "brand", "freshfood_logo.png"); // ajusta si tu logo tiene otro nombre
    const watermarkAbsPath = path.join(process.cwd(), "public", "brand", "FFPWM.png");

    // PDF
    const doc = new PDFDocument({
      size: "A4",
      margin: 42, // un poco más compacto que 52
      autoFirstPage: true,
      info: {
        Title: `${t(lang, "Cotización", "Quotation")} ${quoteNumber}`,
        Author: "Fresh Food Panamá",
      },
    });

    // ✅ FONTS (crítico en Netlify)
    registerFontsOrThrow(doc);

    // ✅ WATERMARK (todas las páginas, muy tenue)
    wireWatermark(doc, watermarkAbsPath);

    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header
    drawHeader(doc, {
      lang,
      quoteNumber,
      incoterm,
      place,
      dateStr,
      logoAbsPath: fs.existsSync(logoAbsPath) ? logoAbsPath : null,
      isInternal: report,
    });

    // Client box
    drawSectionTitle(doc, t(lang, "Cliente", "Client"));
    drawKeyValueGrid(doc, {
      boxWidth,
      left: [
        { k: t(lang, "Nombre", "Name"), v: clientName },
        { k: t(lang, "Email", "Email"), v: clientEmail },
      ],
      right: [
        { k: t(lang, "Tax ID", "Tax ID"), v: clientTaxId },
        { k: t(lang, "Incoterm / Place", "Incoterm / Place"), v: `${incoterm} · ${place || "—"}` },
      ],
    });

    // Resumen (Simple)
    if (variant === "1") {
      drawSectionTitle(doc, t(lang, "Resumen", "Summary"));

      const color = String(meta?.color || data?.color || "—");
      const brix = String(meta?.brix || data?.brix || "—");

      drawKeyValueGrid(doc, {
        boxWidth,
        left: [
          { k: t(lang, "Moneda", "Currency"), v: currency },
          { k: t(lang, "Modo", "Mode"), v: String(data?.mode || "—") },
          { k: t(lang, "Destino", "Destination"), v: String(data?.destination || place || "—") },
        ],
        right: [
          { k: t(lang, "Color", "Color"), v: color },
          { k: t(lang, "Brix", "Brix"), v: brix },
          { k: t(lang, "Total", "Total"), v: money(total, currency) },
        ],
      });
    } else {
      // Detallada
      drawItemsTable(doc, { lang, currency, items, total, boxWidth });

      // mini resumen de producto (color/brix) también en detallada
      const color = String(meta?.color || data?.color || "—");
      const brix = String(meta?.brix || data?.brix || "—");

      drawSectionTitle(doc, t(lang, "Especificación del producto", "Product Specification"));
      drawKeyValueGrid(doc, {
        boxWidth,
        left: [
          { k: t(lang, "Color", "Color"), v: color },
          { k: t(lang, "Brix", "Brix"), v: brix },
        ],
        right: [
          { k: t(lang, "Cajas", "Boxes"), v: String(meta?.boxes ?? data?.boxes ?? "—") },
          { k: t(lang, "Peso (kg)", "Weight (kg)"), v: String(meta?.weight_kg ?? data?.weight_kg ?? "—") },
        ],
      });
    }

    // Terms
    const terms = String(data?.terms || "");
    drawTerms(doc, t(lang, "Términos y condiciones", "Terms and Conditions"), terms, boxWidth);

    // Footer en todas las páginas: lo dibujamos al final de la última,
    // y también cada vez que se agregue una página nueva.
    const footerDrawer = () => drawFooter(doc, lang);
    footerDrawer();
    doc.on("pageAdded", footerDrawer);

    const pdfBuffer = await docToBuffer(doc);

    const filename = `${safeFileName(clientName)}_${safeFileName(quoteNumber)}_${variant}_${lang}${report ? "_INTERNAL" : ""}.pdf`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e: any) {
    // Mensaje claro para debug (sin filtrar stack en UI, pero sí en logs)
    console.error("[renderQuotePdf] ERROR", { message: e?.message, stack: e?.stack });
    return text(500, e?.message || "Server error");
  }
};