// netlify/functions/renderQuotePdf.ts
import type { Handler } from "@netlify/functions";
import PDFDocument from "pdfkit";
import { getUserAndProfile, json, text, supabaseAdmin } from "./_util";

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

function drawHeader(
  doc: PDFKit.PDFDocument,
  opts: { lang: "es" | "en"; quoteIdShort: string; incoterm: string; place: string; dateStr: string }
) {
  const { lang, quoteIdShort, incoterm, place, dateStr } = opts;

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111").text("Fresh Food Panamá", 0, 0, { align: "left" });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#555")
    .text(`${t(lang, "Cotización", "Quotation")} #${quoteIdShort}`, { align: "left" })
    .text(`${t(lang, "Fecha", "Date")}: ${dateStr}`, { align: "left" });

  const pillText = `${incoterm} · ${place}`;
  const rightX = doc.page.width - doc.page.margins.right;
  const y = doc.y - 30;
  doc.font("Helvetica-Bold").fontSize(10);
  const w = doc.widthOfString(pillText) + 18;
  const h = 20;
  const x = rightX - w;
  doc.roundedRect(x, y, w, h, 10).strokeColor("#DDD").lineWidth(1).stroke();
  doc.fillColor("#111").text(pillText, x + 9, y + 5, { width: w - 18, align: "center" });

  doc.moveDown(1.2);
  doc.strokeColor("#EEE").moveTo(doc.page.margins.left, doc.y).lineTo(rightX, doc.y).stroke();
  doc.moveDown(1);
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111").text(title);
  doc.moveDown(0.4);
}

function drawBox(doc: PDFKit.PDFDocument, opts: { x: number; y: number; w: number; h: number }) {
  doc.roundedRect(opts.x, opts.y, opts.w, opts.h, 10).strokeColor("#DDD").lineWidth(1).stroke();
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) doc.addPage();
}

function drawKeyValueLines(
  doc: PDFKit.PDFDocument,
  lines: Array<{ k: string; v: string }>,
  boxWidth: number
) {
  const x = doc.page.margins.left;
  const pad = 10;
  const lineH = 14;
  const h = pad * 2 + lines.length * lineH;

  ensureSpace(doc, h + 10);
  const y = doc.y;

  drawBox(doc, { x, y, w: boxWidth, h });

  let ty = y + pad;
  for (const line of lines) {
    doc.font("Helvetica").fontSize(10).fillColor("#555").text(`${line.k}: `, x + pad, ty, { continued: true });
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111").text(line.v || "—");
    ty += lineH;
  }

  doc.y = y + h + 8;
}

function drawTermsBox(doc: PDFKit.PDFDocument, title: string, terms: string, boxWidth: number) {
  drawSectionTitle(doc, title);

  const x = doc.page.margins.left;
  const pad = 10;
  const maxW = boxWidth - pad * 2;

  doc.font("Helvetica").fontSize(10);
  const textH = doc.heightOfString(terms || "", { width: maxW, align: "left" });
  const h = Math.max(40, pad * 2 + textH);

  ensureSpace(doc, h + 10);
  const y = doc.y;

  drawBox(doc, { x, y, w: boxWidth, h });

  doc.font("Helvetica").fontSize(10).fillColor("#111").text(terms || "", x + pad, y + pad, {
    width: maxW,
    align: "left",
  });

  doc.y = y + h + 8;
}

function drawItemsTable(doc: PDFKit.PDFDocument, opts: { lang: "es" | "en"; currency: string; items: any[]; total: number; boxWidth: number }) {
  const { lang, currency, items, total, boxWidth } = opts;

  drawSectionTitle(doc, t(lang, "Detalle", "Details"));

  const x = doc.page.margins.left;
  const rightX = x + boxWidth;
  const pad = 10;

  const colItem = Math.floor(boxWidth * 0.46);
  const colQty = Math.floor(boxWidth * 0.18);
  const colUP = Math.floor(boxWidth * 0.18);
  const colTot = boxWidth - colItem - colQty - colUP;

  const headerH = 22;
  const rowH = 20;

  const tableTopY = doc.y;
  ensureSpace(doc, headerH + rowH * 2 + 50);

  doc.roundedRect(x, doc.y, boxWidth, headerH, 10).strokeColor("#DDD").lineWidth(1).stroke();
  doc.rect(x, doc.y, boxWidth, headerH).fillOpacity(0.04).fill("#000").fillOpacity(1);

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#444");
  doc.text(t(lang, "Item", "Item"), x + pad, doc.y + 7, { width: colItem - pad });
  doc.text(t(lang, "Cantidad (cajas)", "Qty (boxes)"), x + colItem, doc.y + 7, { width: colQty - pad, align: "right" });
  doc.text(t(lang, "Precio unit.", "Unit price"), x + colItem + colQty, doc.y + 7, { width: colUP - pad, align: "right" });
  doc.text(t(lang, "Total", "Total"), x + colItem + colQty + colUP, doc.y + 7, { width: colTot - pad, align: "right" });

  doc.y += headerH;

  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    ensureSpace(doc, rowH + 20);
    doc.font("Helvetica").fontSize(10).fillColor("#555").text(t(lang, "Sin items", "No items"), x + pad, doc.y + 6);
    doc.y += rowH;
  } else {
    for (const it of safeItems) {
      ensureSpace(doc, rowH + 40);

      const name = String(it?.name || "");
      const qty = Number(it?.qty || 0);
      const up = Number(it?.unit_price || 0);
      const rowTotal = Number(it?.total || qty * up);

      doc.strokeColor("#EEE").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();

      doc.font("Helvetica").fontSize(10).fillColor("#111");
      doc.text(name, x + pad, doc.y + 6, { width: colItem - pad });
      doc.text(qty.toLocaleString("en-US"), x + colItem, doc.y + 6, { width: colQty - pad, align: "right" });
      doc.text(money(up, currency), x + colItem + colQty, doc.y + 6, { width: colUP - pad, align: "right" });
      doc.font("Helvetica-Bold").text(money(rowTotal, currency), x + colItem + colQty + colUP, doc.y + 6, {
        width: colTot - pad,
        align: "right",
      });

      doc.y += rowH;
    }
  }

  doc.strokeColor("#EEE").moveTo(x, doc.y).lineTo(rightX, doc.y).stroke();

  ensureSpace(doc, 40);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#111");
  doc.text(`${t(lang, "Total", "Total")}: ${money(Number(total || 0), currency)}`, x, doc.y, {
    width: boxWidth,
    align: "right",
  });

  doc.moveDown(0.8);

  const endY = doc.y;
  const h = Math.max(60, endY - tableTopY);
  doc.roundedRect(x, tableTopY, boxWidth, h, 10).strokeColor("#DDD").lineWidth(1).stroke();

  doc.y = endY + 4;
}

function corsHeaders(extra?: Record<string, string>) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
    ...(extra || {}),
  };
}

export const handler: Handler = async (event) => {
  try {
    // ✅ Preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ok: true }),
      };
    }

    // ✅ Method
    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers: corsHeaders({ "Content-Type": "text/plain" }),
        body: "Method not allowed",
      };
    }

    // Auth
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) {
      return {
        statusCode: 401,
        headers: corsHeaders({ "Content-Type": "text/plain" }),
        body: "Unauthorized",
      };
    }
    if (!isPrivileged(profile.role)) {
      return {
        statusCode: 403,
        headers: corsHeaders({ "Content-Type": "text/plain" }),
        body: "Forbidden",
      };
    }

    // Params
    const id = String(event.queryStringParameters?.id || "").trim();
    const variant = String(event.queryStringParameters?.variant || "2").trim() as "1" | "2";
    const lang = String(event.queryStringParameters?.lang || "es").trim().toLowerCase() as "es" | "en";
    if (!id) {
      return {
        statusCode: 400,
        headers: corsHeaders({ "Content-Type": "text/plain" }),
        body: "Missing id",
      };
    }

    // Fetch quote
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("quotes")
      .select("*, clients:clients(*)")
      .eq("id", id)
      .single<QuoteRow>();

    if (error || !data) {
      return {
        statusCode: 404,
        headers: corsHeaders({ "Content-Type": "text/plain" }),
        body: error?.message || "Quote not found",
      };
    }

    const totals = data?.totals || {};
    const meta = totals?.meta || {};
    const incoterm = String(meta?.incoterm || "CIP");
    const place = String(meta?.place || data?.destination || "—");
    const currency = String(data?.currency || "USD");
    const total = Number(totals?.total || 0);
    const items = Array.isArray(totals?.items) ? totals.items : [];

    const clientName = String(data?.clients?.name || data?.client_snapshot?.name || "—");
    const clientEmail = String(data?.clients?.contact_email || data?.client_snapshot?.contact_email || "—");

    const quoteIdShort = String(data?.id || id).slice(0, 8);
    const dateStr = new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-PA");

    // PDF
    const doc = new PDFDocument({
      size: "A4",
      margin: 52,
      info: {
        Title: `${t(lang, "Cotización", "Quotation")} ${quoteIdShort}`,
        Author: "Fresh Food Panamá",
      },
    });

    const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    drawHeader(doc, { lang, quoteIdShort, incoterm, place, dateStr });

    drawSectionTitle(doc, t(lang, "Cliente", "Client"));
    drawKeyValueLines(
      doc,
      [
        { k: t(lang, "Nombre", "Name"), v: clientName },
        { k: t(lang, "Email", "Email"), v: clientEmail },
      ],
      boxWidth
    );

    if (variant === "1") {
      drawSectionTitle(doc, t(lang, "Resumen", "Summary"));
      drawKeyValueLines(
        doc,
        [
          { k: t(lang, "Moneda", "Currency"), v: currency },
          { k: t(lang, "Modo", "Mode"), v: String(data?.mode || "—") },
          { k: t(lang, "Destino", "Destination"), v: String(data?.destination || "—") },
          { k: t(lang, "Total", "Total"), v: money(total, currency) },
        ],
        boxWidth
      );
    } else {
      drawItemsTable(doc, { lang, currency, items, total, boxWidth });
    }

    const terms = String(data?.terms || "");
    if (terms.trim()) drawTermsBox(doc, t(lang, "Condiciones", "Terms"), terms, boxWidth);

    ensureSpace(doc, 40);
    doc.font("Helvetica").fontSize(9).fillColor("#777").text(
      t(lang, "Documento generado automáticamente.", "Automatically generated document."),
      { align: "center" }
    );

    const pdfBuffer = await docToBuffer(doc);
    const filename = `${safeFileName(clientName)}_quote_${quoteIdShort}_${variant}_${lang}.pdf`;

    return {
      statusCode: 200,
      headers: corsHeaders({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      }),
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e: any) {
    // ✅ Siempre con CORS para que el browser vea el error
    return {
      statusCode: 500,
      headers: corsHeaders({ "Content-Type": "text/plain" }),
      body: e?.message || "Server error",
    };
  }
};