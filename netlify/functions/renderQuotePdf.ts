// netlify/functions/renderQuotePdf.ts
import type { Handler } from "@netlify/functions";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { getUserAndProfile, text, supabaseAdmin } from "./_util";

function isPrivileged(role: string) {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" || r === "superadmin";
}

function t(lang: "es" | "en", es: string, en: string) {
  return lang === "en" ? en : es;
}

function safeFileName(name: string) {
  return String(name || "quotation")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v: number, currency: string) {
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym} ${n(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function docToBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

// -------- Brand / Assets (from public/brand) --------
function tryReadAsset(relFromRepoRoot: string) {
  try {
    const p = path.join(process.cwd(), relFromRepoRoot);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

// Watermark fixed path per your instruction
function loadWatermark() {
  return tryReadAsset(path.join("public", "brand", "FFPWM.png"));
}

// Logo: we attempt common names (keeps you flexible)
function loadLogo() {
  const candidates = [
    path.join("public", "brand", "FFP_LOGO.png"),
    path.join("public", "brand", "FFPLogo.png"),
    path.join("public", "brand", "logo.png"),
    path.join("public", "brand", "logo.webp"),
    path.join("public", "brand", "logo.jpg"),
    path.join("public", "brand", "logo.jpeg"),
  ];
  for (const c of candidates) {
    const b = tryReadAsset(c);
    if (b) return b;
  }
  return null;
}

// -------- Layout constants (compact & modern) --------
const BRAND = {
  greenDark: "#234d23",
  green: "#277632",
  white: "#ffffff",
  gold: "#d17711",
  black: "#000000",
};

const COMPANY = {
  name: "FRESH FOOD PANAMA, C.A",
  ruc: "2684372-1-845616 DV 30",
  address: "Calle 55, PH SFC 26, Obarrio, Ciudad de Panamá, Panama",
};

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

function drawWatermark(doc: PDFKit.PDFDocument, watermark: Buffer | null) {
  if (!watermark) return;

  // very subtle, centered, behind content
  const w = doc.page.width;
  const h = doc.page.height;

  doc.save();
  try {
    doc.opacity(0.05);
    const targetW = Math.min(520, w * 0.75);
    const x = (w - targetW) / 2;
    const y = (h - targetW) / 2;
    doc.image(watermark, x, y, { width: targetW });
  } catch {
    // ignore watermark errors
  } finally {
    doc.opacity(1);
    doc.restore();
  }
}

function drawFooter(doc: PDFKit.PDFDocument, lang: "es" | "en") {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.page.height - doc.page.margins.bottom + 14;

  doc.save();
  doc.strokeColor("rgba(0,0,0,0.08)").lineWidth(1);
  doc.moveTo(left, y - 10).lineTo(right, y - 10).stroke();

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("rgba(0,0,0,0.60)")
    .text(
      `${COMPANY.name} · RUC: ${COMPANY.ruc} · ${COMPANY.address}`,
      left,
      y,
      { width: right - left, align: "center" }
    );

  doc.restore();
}

function drawHeader(doc: PDFKit.PDFDocument, opts: {
  lang: "es" | "en";
  quoteNumber: string;
  incoterm: string;
  place: string;
  dateStr: string;
  isInternal: boolean;
  logo: Buffer | null;
}) {
  const { lang, quoteNumber, incoterm, place, dateStr, isInternal, logo } = opts;

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  // Header band (compact)
  const topY = doc.y;
  const bandH = 54;

  doc.save();
  doc.roundedRect(left, topY, right - left, bandH, 10)
    .fillColor("rgba(35,77,35,0.06)")
    .fill();

  // logo or text brand
  if (logo) {
    try {
      doc.image(logo, left + 12, topY + 14, { height: 26 });
    } catch {
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(BRAND.greenDark)
        .text("Fresh Food Panamá", left + 12, topY + 17);
    }
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(BRAND.greenDark)
      .text("Fresh Food Panamá", left + 12, topY + 17);
  }

  // Right meta block
  const metaX = right - 240;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BRAND.black)
    .text(t(lang, "Cotización", "Quotation"), metaX, topY + 12, { width: 240, align: "right" });

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(BRAND.greenDark)
    .text(quoteNumber, metaX, topY + 26, { width: 240, align: "right" });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("rgba(0,0,0,0.65)")
    .text(`${t(lang, "Fecha", "Date")}: ${dateStr}`, metaX, topY + 42, { width: 240, align: "right" });

  // Internal pill
  if (isInternal) {
    const tag = t(lang, "INTERNO", "INTERNAL");
    doc.font("Helvetica-Bold").fontSize(8.5);
    const tw = doc.widthOfString(tag) + 16;
    const th = 16;
    const x = left + 12;
    const y = topY + 10;
    doc.roundedRect(x, y, tw, th, 8).fillColor("rgba(209,119,17,0.14)").fill();
    doc.fillColor(BRAND.gold).text(tag, x, y + 4, { width: tw, align: "center" });
  }

  doc.restore();

  // Incoterm pill (compact line)
  const pillText = `${incoterm} · ${place || "—"}`;
  doc.save();
  doc.font("Helvetica-Bold").fontSize(9).fillColor("rgba(0,0,0,0.75)");
  const pw = doc.widthOfString(pillText) + 18;
  const ph = 18;
  const px = right - pw;
  const py = topY + bandH + 6;

  doc.roundedRect(px, py, pw, ph, 9).strokeColor("rgba(0,0,0,0.14)").lineWidth(1).stroke();
  doc.text(pillText, px + 9, py + 5, { width: pw - 18, align: "center" });
  doc.restore();

  doc.y = topY + bandH + 28; // compact spacing after header
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(BRAND.black)
    .text(title);
  doc.moveDown(0.25);
}

function drawBox(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
  doc.save();
  doc.roundedRect(x, y, w, h, 10).strokeColor("rgba(0,0,0,0.14)").lineWidth(1).stroke();
  doc.restore();
}

function kvGrid(doc: PDFKit.PDFDocument, opts: {
  rows: Array<{ k: string; v: string }>;
  cols: 2 | 3;
  boxWidth: number;
}) {
  const { rows, cols, boxWidth } = opts;
  const left = doc.page.margins.left;
  const padX = 10;
  const padY = 8;

  const colW = (boxWidth - (cols - 1) * 10) / cols;
  const rowH = 32; // compact but readable

  const lines = Math.ceil(rows.length / cols);
  const h = padY * 2 + lines * rowH;

  ensureSpace(doc, h + 8);
  const y = doc.y;
  drawBox(doc, left, y, boxWidth, h);

  let idx = 0;
  for (let r = 0; r < lines; r++) {
    for (let c = 0; c < cols; c++) {
      if (idx >= rows.length) break;
      const cellX = left + c * (colW + 10) + padX;
      const cellY = y + padY + r * rowH;

      const item = rows[idx++];
      doc.font("Helvetica").fontSize(8.5).fillColor("rgba(0,0,0,0.55)").text(item.k, cellX, cellY);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BRAND.black).text(item.v || "—", cellX, cellY + 12, {
        width: colW - padX * 2,
        ellipsis: true,
      });
    }
  }

  doc.y = y + h + 8;
}

function drawSummary(doc: PDFKit.PDFDocument, opts: {
  lang: "es" | "en";
  currency: string;
  mode: string;
  destination: string;
  boxes: number;
  weightKg: number;
  total: number;
  color: string;
  brix: string;
  boxWidth: number;
}) {
  const { lang, currency, mode, destination, boxes, weightKg, total, color, brix, boxWidth } = opts;

  drawSectionTitle(doc, t(lang, "Resumen de oferta", "Offer Summary"));

  kvGrid(doc, {
    cols: 3,
    boxWidth,
    rows: [
      { k: t(lang, "Modo", "Mode"), v: mode || "—" },
      { k: t(lang, "Destino / Place", "Destination / Place"), v: destination || "—" },
      { k: t(lang, "Moneda", "Currency"), v: currency || "—" },

      { k: t(lang, "Cajas", "Boxes"), v: String(n(boxes)) },
      { k: t(lang, "Peso (kg)", "Weight (kg)"), v: n(weightKg).toLocaleString("en-US") },
      { k: t(lang, "Total", "Total"), v: money(total, currency) },

      { k: t(lang, "Color", "Color"), v: color || "—" },
      { k: "Brix", v: brix || "—" },
      { k: t(lang, "Producto", "Product"), v: t(lang, "Piña fresca (Premium/Extra)", "Fresh Pineapple (Premium/Extra)") },
    ],
  });
}

function drawItemsTable(doc: PDFKit.PDFDocument, opts: {
  lang: "es" | "en";
  currency: string;
  items: any[];
  total: number;
  color: string;
  brix: string;
  boxWidth: number;
}) {
  const { lang, currency, items, total, color, brix, boxWidth } = opts;

  drawSectionTitle(doc, t(lang, "Detalle de la oferta", "Offer Details"));

  // Small product spec line (compact)
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("rgba(0,0,0,0.70)")
    .text(`${t(lang, "Especificación", "Specification")}: ${t(lang, "Color", "Color")} ${color || "—"} · Brix ${brix || "—"}`);
  doc.moveDown(0.35);

  const left = doc.page.margins.left;
  const right = left + boxWidth;
  const pad = 8;

  const colItem = Math.floor(boxWidth * 0.52);
  const colQty = Math.floor(boxWidth * 0.16);
  const colUP = Math.floor(boxWidth * 0.16);
  const colTot = boxWidth - colItem - colQty - colUP;

  const headerH = 20;
  const rowH = 18;

  ensureSpace(doc, headerH + rowH * 2 + 40);
  const tableY = doc.y;

  // Header band
  doc.save();
  doc.roundedRect(left, tableY, boxWidth, headerH, 10).fillColor("rgba(35,77,35,0.08)").fill();
  doc.roundedRect(left, tableY, boxWidth, headerH, 10).strokeColor("rgba(0,0,0,0.14)").lineWidth(1).stroke();
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("rgba(0,0,0,0.70)");
  doc.text(t(lang, "Concepto", "Concept"), left + pad, tableY + 6, { width: colItem - pad });
  doc.text(t(lang, "Cant.", "Qty"), left + colItem, tableY + 6, { width: colQty - pad, align: "right" });
  doc.text(t(lang, "Unit.", "Unit"), left + colItem + colQty, tableY + 6, { width: colUP - pad, align: "right" });
  doc.text(t(lang, "Total", "Total"), left + colItem + colQty + colUP, tableY + 6, { width: colTot - pad, align: "right" });

  doc.y = tableY + headerH;

  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    doc.font("Helvetica").fontSize(9).fillColor("rgba(0,0,0,0.60)").text(t(lang, "Sin items", "No items"), left + pad, doc.y + 6);
    doc.y += rowH;
  } else {
    for (const it of safeItems) {
      ensureSpace(doc, rowH + 30);

      const name = String(it?.name || "");
      const qty = n(it?.qty || 0);
      const up = n(it?.unit_price || 0);
      const rowTotal = n(it?.total || qty * up);

      // separator
      doc.save();
      doc.strokeColor("rgba(0,0,0,0.08)").lineWidth(1);
      doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
      doc.restore();

      doc.font("Helvetica").fontSize(9.2).fillColor(BRAND.black);
      doc.text(name, left + pad, doc.y + 5, { width: colItem - pad });

      doc.font("Helvetica").fontSize(9.2).fillColor(BRAND.black);
      doc.text(qty.toLocaleString("en-US"), left + colItem, doc.y + 5, { width: colQty - pad, align: "right" });

      doc.text(money(up, currency), left + colItem + colQty, doc.y + 5, { width: colUP - pad, align: "right" });

      doc.font("Helvetica-Bold").fontSize(9.2).text(money(rowTotal, currency), left + colItem + colQty + colUP, doc.y + 5, {
        width: colTot - pad,
        align: "right",
      });

      doc.y += rowH;
    }
  }

  // bottom line
  doc.save();
  doc.strokeColor("rgba(0,0,0,0.08)").lineWidth(1);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.restore();

  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.greenDark);
  doc.text(`${t(lang, "Total", "Total")}: ${money(total, currency)}`, left, doc.y, { width: boxWidth, align: "right" });
  doc.moveDown(0.3);

  // outer frame (from tableY to current y)
  const endY = doc.y;
  doc.save();
  doc.roundedRect(left, tableY, boxWidth, Math.max(50, endY - tableY), 10).strokeColor("rgba(0,0,0,0.14)").lineWidth(1).stroke();
  doc.restore();

  doc.y = endY + 6;
}

function drawTerms(doc: PDFKit.PDFDocument, opts: { lang: "es" | "en"; terms: string; boxWidth: number }) {
  const { lang, terms, boxWidth } = opts;
  const left = doc.page.margins.left;
  const pad = 10;

  if (!String(terms || "").trim()) return;

  drawSectionTitle(doc, t(lang, "Términos y condiciones", "Terms & Conditions"));

  doc.font("Helvetica").fontSize(9);
  const textH = doc.heightOfString(terms, { width: boxWidth - pad * 2 });
  const h = Math.max(44, textH + pad * 2);

  ensureSpace(doc, h + 8);
  const y = doc.y;

  drawBox(doc, left, y, boxWidth, h);
  doc.fillColor("rgba(0,0,0,0.85)").text(terms, left + pad, y + pad, { width: boxWidth - pad * 2 });

  doc.y = y + h + 6;
}

function drawInternalBlock(doc: PDFKit.PDFDocument, opts: {
  lang: "es" | "en";
  totals: any;
  costs: any;
  currency: string;
  boxWidth: number;
}) {
  const { lang, totals, costs, currency, boxWidth } = opts;
  const left = doc.page.margins.left;

  drawSectionTitle(doc, t(lang, "Uso interno (no enviar al cliente)", "Internal use (do not send to client)"));

  const meta = totals?.meta || {};
  const marginOnSale = n(totals?.margin_on_sale);
  const markupOnCost = n(totals?.markup_on_cost);
  const costTotal = n(totals?.cost_total);
  const saleTotal = n(totals?.sale_total);

  kvGrid(doc, {
    cols: 3,
    boxWidth,
    rows: [
      { k: t(lang, "Costo total", "Total cost"), v: money(costTotal, currency) },
      { k: t(lang, "Venta total", "Total sale"), v: money(saleTotal, currency) },
      { k: t(lang, "Profit", "Profit"), v: money(n(totals?.profit_total), currency) },
      { k: t(lang, "Margen (Profit/Venta)", "Margin (Profit/Sale)"), v: `${marginOnSale.toFixed(1)}%` },
      { k: t(lang, "Markup (Profit/Costo)", "Markup (Profit/Cost)"), v: `${markupOnCost.toFixed(1)}%` },
      { k: t(lang, "Per box", "Per box"), v: money(n(meta?.per_box), currency) },
    ],
  });

  // compact cost breakdown list (optional)
  const c = costs || {};
  const lines: Array<{ k: string; v: string }> = [
    { k: "c_fruit", v: String(n(c.c_fruit)) },
    { k: "c_freight", v: String(n(c.c_freight)) },
    { k: "c_origin", v: String(n(c.c_origin)) },
    { k: "c_aduana", v: String(n(c.c_aduana)) },
    { k: "c_handling", v: String(n(c.c_handling)) },
    { k: "c_itbms", v: String(n(c.c_itbms)) },
    { k: "c_insp", v: String(n(c.c_insp)) },
    { k: "c_other", v: String(n(c.c_other)) },
    { k: "c_othf", v: String(n(c.c_othf)) },
  ];

  doc.font("Helvetica").fontSize(8.5).fillColor("rgba(0,0,0,0.60)").text(t(lang, "Costos (raw)", "Costs (raw)"));
  doc.moveDown(0.2);

  const pad = 10;
  const text = lines.map((x) => `${x.k}: ${x.v}`).join("  ·  ");

  ensureSpace(doc, 44);
  const y = doc.y;
  drawBox(doc, left, y, boxWidth, 36);
  doc.font("Helvetica").fontSize(9).fillColor("rgba(0,0,0,0.80)").text(text, left + pad, y + 10, { width: boxWidth - pad * 2 });

  doc.y = y + 42;
}

export const handler: Handler = async (event) => {
  try {
    // Auth
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, "Unauthorized");
    if (!isPrivileged(profile.role)) return text(403, "Forbidden");

    const id = String(event.queryStringParameters?.id || "").trim();
    const variant = (String(event.queryStringParameters?.variant || "2").trim() as "1" | "2");
    const lang = (String(event.queryStringParameters?.lang || "es").trim().toLowerCase() as "es" | "en");
    const isInternal = String(event.queryStringParameters?.report || "") === "1";
    if (!id) return text(400, "Missing id");

    // Fetch quote + client (include tax_id if exists)
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("quotes")
      .select("*, clients:clients(*)")
      .eq("id", id)
      .single<any>();

    if (error || !data) return text(404, error?.message || "Quote not found");

    const totals = data?.totals || {};
    const meta = totals?.meta || {};
    const incoterm = String(meta?.incoterm || "CIP");
    const place = String(meta?.place || data?.destination || "—");
    const currency = String(data?.currency || "USD");
    const total = n(totals?.total || totals?.sale_total || 0);
    const items = Array.isArray(totals?.items) ? totals.items : [];

    // product spec: color + brix must show in both variants
    const color = String(meta?.color || data?.product_color || "").trim();
    const brix = String(meta?.brix || data?.product_brix || "").trim();

    const clientName = String(data?.clients?.name || data?.client_snapshot?.name || "—");
    const clientEmail = String(data?.clients?.contact_email || data?.client_snapshot?.contact_email || "—");
    const clientPhone = String(data?.clients?.phone || data?.client_snapshot?.phone || "—");
    const clientCountry = String(data?.clients?.country || data?.client_snapshot?.country || "—");
    const clientCity = String(data?.clients?.city || data?.client_snapshot?.city || "—");

    // TAX ID in client block (if column exists)
    const clientTaxId = String(
      (data?.clients?.tax_id ?? data?.clients?.taxid ?? data?.client_snapshot?.tax_id ?? "") || ""
    ).trim();

    // Quote number preference:
    // - If DB has quote_number use it
    // - else fallback to RFQ/YYYY/xxxxx using uuid slice (keeps stable without extra DB)
    const createdAt = data?.created_at ? new Date(String(data.created_at)) : new Date();
    const yyyy = String(createdAt.getUTCFullYear());
    const fallbackShort = String(data?.id || id).replace(/-/g, "").slice(0, 5);
    const quoteNumber = String(data?.quote_number || `RFQ/${yyyy}/${fallbackShort}`);

    const dateStr = createdAt.toLocaleDateString(lang === "en" ? "en-US" : "es-PA");

    const watermark = loadWatermark();
    const logo = loadLogo();

    // PDF setup
    const doc = new PDFDocument({
      size: "A4",
      margin: 44, // tighter
      info: {
        Title: `${t(lang, "Cotización", "Quotation")} ${quoteNumber}`,
        Author: "Fresh Food Panamá",
      },
      bufferPages: true,
    });

    // watermark + footer on every page
    doc.on("pageAdded", () => {
      drawWatermark(doc, watermark);
      drawFooter(doc, lang);
    });

    // first page decorations too
    drawWatermark(doc, watermark);
    drawFooter(doc, lang);

    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header
    drawHeader(doc, {
      lang,
      quoteNumber,
      incoterm,
      place,
      dateStr,
      isInternal,
      logo,
    });

    // Client block (compact)
    drawSectionTitle(doc, t(lang, "Cliente", "Client"));

    const clientRows: Array<{ k: string; v: string }> = [
      { k: t(lang, "Nombre", "Name"), v: clientName },
      { k: t(lang, "Email", "Email"), v: clientEmail },
      { k: t(lang, "Teléfono", "Phone"), v: clientPhone },
      { k: t(lang, "País / Ciudad", "Country / City"), v: `${clientCountry}${clientCity && clientCity !== "—" ? ` · ${clientCity}` : ""}` },
    ];

    // Tax ID required per your note
    clientRows.push({ k: t(lang, "TAX ID", "TAX ID"), v: clientTaxId || "—" });

    kvGrid(doc, { cols: 2, boxWidth, rows: clientRows });

    // Simple vs Detailed
    if (variant === "1") {
      drawSummary(doc, {
        lang,
        currency,
        mode: String(data?.mode || "—"),
        destination: String(place || data?.destination || "—"),
        boxes: n(data?.boxes),
        weightKg: n(data?.weight_kg || meta?.weight_kg),
        total,
        color,
        brix,
        boxWidth,
      });
    } else {
      drawItemsTable(doc, { lang, currency, items, total, color, brix, boxWidth });
    }

    // Payment terms (compact)
    const paymentTerms = String(data?.payment_terms || "").trim();
    if (paymentTerms) {
      drawSectionTitle(doc, t(lang, "Condiciones de pago", "Payment Terms"));
      kvGrid(doc, { cols: 2, boxWidth, rows: [{ k: t(lang, "Término", "Term"), v: paymentTerms }] });
    }

    // Terms
    const terms = String(data?.terms || "").trim();
    if (terms) drawTerms(doc, { lang, terms, boxWidth });

    // Internal extra
    if (isInternal) {
      drawInternalBlock(doc, {
        lang,
        totals,
        costs: data?.costs || {},
        currency,
        boxWidth,
      });
    }

    // tiny final note (compact)
    ensureSpace(doc, 24);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("rgba(0,0,0,0.55)")
      .text(
        t(lang, "Documento generado automáticamente.", "Automatically generated document."),
        { align: "center" }
      );

    const pdfBuffer = await docToBuffer(doc);

    const filename = `${safeFileName(clientName)}_${quoteNumber.replace(/\//g, "-")}_${variant}_${lang}${isInternal ? "_INTERNAL" : ""}.pdf`;

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
    return text(500, e?.message || "Server error");
  }
};