// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Save, FileText } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

type QuoteDetail = {
  id: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "sent" | "won" | "lost" | "archived";
  mode: "AIR" | "SEA";
  currency: "USD" | "EUR";
  destination: string;
  boxes: number;
  weight_kg?: number | null;
  margin_markup: number;
  payment_terms?: string | null;
  terms?: string | null;
  quote_number?: string | null; // ✅ opcional (si existe en DB)
  client_snapshot?: { name?: string; contact_email?: string; tax_id?: string } | null;
  totals?: Record<string, any>;
  costs?: Record<string, any>;
};

type UiLang = "es" | "en";
type PdfVariant = "1" | "2";

type Incoterm = "CIP" | "CPT" | "DAP" | "DDP" | "FCA" | "FOB" | "CIF";

const SALES_LINES = [
  { key: "fruit_value", es: "1. Valor de la fruta (FOB/FCA)", en: "1. Fruit Value (FOB/FCA)" },
  { key: "intl_logistics", es: "2. Logística internacional", en: "2. International Logistics" },
  { key: "origin_customs", es: "3. Gastos en origen y aduana", en: "3. Origin Charges & Customs" },
  { key: "inspection_quality", es: "4. Inspección y calidad", en: "4. Inspection & Quality" },
] as const;

// ✅ Solo fallback local para cotizaciones viejas que perdieron terms.
// No auto-guardamos: el usuario decide guardarlo con el botón “Guardar”.
const DEFAULT_TERMS_ES = `TÉRMINOS Y CONDICIONES – EXPORTACIÓN DE PIÑA (Fresh Food Panamá)

1) Alcance de la oferta
Esta cotización es emitida por Fresh Food Panamá y está sujeta a confirmación final de disponibilidad, capacidad operativa, espacios de carga y validación de costos logísticos al momento de la confirmación.

2) Validez
La oferta tiene una validez de 48 horas (o el tiempo indicado en la propia cotización). Pasado ese período, precios y condiciones pueden variar sin previo aviso.

3) Especificación del producto
Piña fresca de exportación, calidad Premium/Extra, sujeta a especificaciones acordadas (calibre, color, Brix, tolerancias y empaque). El embarque se realiza conforme a los estándares aplicables y a los criterios de inspección definidos para exportación.

4) Condiciones de pago
Las condiciones de pago aplicables serán las indicadas en el campo “Condiciones de pago” de la cotización y/o la factura proforma. La liberación de la carga y/o documentos está sujeta al cumplimiento del pago acordado.

5) Documentación y cumplimiento
Fresh Food Panamá gestionará la documentación comercial y/o de exportación aplicable según el modo de transporte y el país de destino. Cualquier requisito adicional (permisos especiales, certificaciones, registros, etiquetado o traducciones) deberá ser informado por el cliente antes de confirmar la operación.

6) Incoterm, Place y destino
La operación se rige por el Incoterm y el “Place” indicados en la cotización. El cliente es responsable de entender el alcance del Incoterm seleccionado y de cualquier costo/gestión fuera del alcance de Fresh Food Panamá según dicho Incoterm.

7) Entrega, tiempos y variaciones logísticas
Fechas y tiempos son estimados y pueden variar por disponibilidad de aerolínea/naviera, congestión, inspecciones, clima, seguridad, cambios operativos o autoridades. Dichas variaciones no constituyen incumplimiento.

8) Transferencia de riesgo
El riesgo se transfiere conforme al Incoterm acordado. Una vez transferido el riesgo, cualquier pérdida, merma o daño posterior será responsabilidad del comprador, salvo que se establezca lo contrario por escrito.

9) Reclamos y control de calidad (CLÁUSULA CRÍTICA)
NO se aceptarán reclamos posteriores a 3 días calendario de la llegada de la carga al aeropuerto/puerto de destino (arribo), sin excepción.
Cualquier reclamo debe:
- Notificarse por escrito dentro de ese plazo,
- Incluir evidencia fotográfica/video y reporte de recepción/inspección,
- Mantener la carga segregada y disponible para verificación.
Reclamos fuera del plazo indicado serán rechazados automáticamente.

10) Limitación de responsabilidad
La responsabilidad máxima de Fresh Food Panamá, si aplica, se limitará al valor de la mercancía efectivamente facturado y comprobado para el lote afectado, sin incluir pérdidas indirectas (lucro cesante, penalidades, devoluciones de terceros, etc.).

11) Fuerza mayor
Fresh Food Panamá no será responsable por incumplimientos derivados de eventos fuera de su control (autoridades, cierres, huelgas, clima, seguridad, fallas de terceros, restricciones sanitarias, etc.).

12) Aceptación
La confirmación por escrito del cliente (correo/WhatsApp/PO) implica aceptación total de esta cotización, sus términos y el Incoterm/Place seleccionado.`;

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PA");
}
function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function lineLabel(key: string, lang: UiLang) {
  const row = SALES_LINES.find((x) => x.key === key);
  return row ? (lang === "en" ? row.en : row.es) : key;
}

function safeIncoterm(v: any): Incoterm {
  const s = String(v || "").toUpperCase();
  const allowed: Incoterm[] = ["CIP", "CPT", "DAP", "DDP", "FCA", "FOB", "CIF"];
  return allowed.includes(s as Incoterm) ? (s as Incoterm) : "CIP";
}

function incotermHelp(incoterm: Incoterm, lang: UiLang) {
  const es = {
    CIP: "CIP requiere Place of Destination (Aeropuerto/Puerto destino).",
    CPT: "CPT requiere Place of Destination.",
    DAP: "DAP requiere Place (lugar de entrega).",
    DDP: "DDP requiere Place (lugar de entrega, impuestos incluidos).",
    FCA: "FCA: Place suele ser punto de entrega en origen (terminal / almacén).",
    FOB: "FOB (marítimo): Place suele ser puerto de salida.",
    CIF: "CIF (marítimo): Place suele ser puerto de destino.",
  } as const;

  const en = {
    CIP: "CIP requires Place of Destination (Airport/Port).",
    CPT: "CPT requires Place of Destination.",
    DAP: "DAP requires Place (place of delivery).",
    DDP: "DDP requires Place (delivery, duties paid).",
    FCA: "FCA: Place is usually delivery point at origin (terminal / warehouse).",
    FOB: "FOB (sea): Place is usually port of loading.",
    CIF: "CIF (sea): Place is usually port of destination.",
  } as const;

  return lang === "en" ? en[incoterm] : es[incoterm];
}

export default function AdminQuoteDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [data, setData] = useState<QuoteDetail | null>(null);

  // UI
  const [uiLang, setUiLang] = useState<UiLang>("es");
  const [pdfVariant, setPdfVariant] = useState<PdfVariant>("1");
  const [pdfLang, setPdfLang] = useState<UiLang>("es");

  // Editables principales
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [margin, setMargin] = useState<number>(15); // markup %
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");

  // ✅ Incoterm + Place
  const [incoterm, setIncoterm] = useState<Incoterm>("CIP");
  const [place, setPlace] = useState(""); // Place of destination/delivery/origin per incoterm

  // (compat) seguimos guardando destination al backend con el mismo valor de place
  const destination = place;

  const [paymentTerms, setPaymentTerms] = useState("");
  const [terms, setTerms] = useState("");

  // Costos detallados (ADMIN)
  const [cFruit, setCFruit] = useState(0);
  const [cOthf, setCOthf] = useState(0);
  const [cFreight, setCFreight] = useState(0);
  const [cHandling, setCHandling] = useState(0);
  const [cOrigin, setCOrigin] = useState(0);
  const [cAduana, setCAduana] = useState(0);
  const [cInsp, setCInsp] = useState(0);
  const [cItbms, setCItbms] = useState(0);
  const [cOther, setCOther] = useState(0);

  const [showCosts, setShowCosts] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function getTokenOrRedirect() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      return null;
    }
    return token;
  }

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      setAuthOk(true);
    })();
  }, []);

  // ✅ si estás en AIR, no dejes CIF/FOB (sea-only)
  useEffect(() => {
    if (mode === "AIR" && (incoterm === "CIF" || incoterm === "FOB")) {
      setIncoterm("CIP");
    }
  }, [mode, incoterm]);

  async function load(quoteId: string) {
    setLoading(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch(`/.netlify/functions/getQuote?id=${encodeURIComponent(quoteId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      setError(t || "No se pudo cargar la cotización");
      setLoading(false);
      return;
    }

    const json = (await res.json()) as QuoteDetail;
    setData(json);

    setBoxes(n(json.boxes));
    setWeightKg(n(json.weight_kg));
    setMargin(n(json.margin_markup));
    setMode((json.mode || "AIR") as any);
    setCurrency((json.currency || "USD") as any);

    // ✅ hydrate incoterm/place desde totals.meta si existe, si no usa destination
    const meta = (json.totals as any)?.meta || {};
    const metaInc = safeIncoterm(meta?.incoterm);
    const metaPlace = String(meta?.place || json.destination || "");
    setIncoterm(metaInc);
    setPlace(metaPlace);

    setPaymentTerms(String(json.payment_terms || ""));

    // ✅ Terms: si vienen vacíos, prefill local (NO auto-save)
    const backendTerms = String(json.terms || "");
    setTerms(backendTerms.trim() ? backendTerms : DEFAULT_TERMS_ES);

    const costs = json.costs || {};
    setCFruit(n((costs as any).c_fruit));
    setCOthf(n((costs as any).c_othf));
    setCFreight(n((costs as any).c_freight));
    setCHandling(n((costs as any).c_handling));
    setCOrigin(n((costs as any).c_origin));
    setCAduana(n((costs as any).c_aduana));
    setCInsp(n((costs as any).c_insp));
    setCItbms(n((costs as any).c_itbms));
    setCOther(n((costs as any).c_other));

    setLoading(false);
  }

  useEffect(() => {
    if (!authOk) return;
    if (typeof id !== "string") return;
    load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOk, id]);

  const computed = useMemo(() => {
    const b = Math.max(0, n(boxes));
    const w = Math.max(0, n(weightKg));
    const m = n(margin) / 100;

    const p1 = b * n(cFruit);
    const p2 = n(cFreight) + n(cOthf);

    const handlingTotal = w * n(cHandling);
    const itbmsBase = n(cOrigin) + handlingTotal;
    const itbmsVal = itbmsBase * (n(cItbms) / 100);
    const p3 = n(cAduana) + n(cOrigin) + handlingTotal + itbmsVal + n(cOther);

    const p4 = n(cInsp);

    const rows = [
      { key: "fruit_value", cost: p1 },
      { key: "intl_logistics", cost: p2 },
      { key: "origin_customs", cost: p3 },
      { key: "inspection_quality", cost: p4 },
    ];

    const costTotal = rows.reduce((acc, r) => acc + r.cost, 0);
    const saleRows = rows.map((r) => ({ ...r, sale: r.cost * (1 + m) }));
    const saleTotal = saleRows.reduce((acc, r) => acc + r.sale, 0);

    const profitTotal = saleTotal - costTotal;

    // ✅ 2 métricas
    const marginOnSale = saleTotal > 0 ? (profitTotal / saleTotal) * 100 : 0;
    const markupOnCost = costTotal > 0 ? (profitTotal / costTotal) * 100 : 0;

    const perBox = b > 0 ? saleTotal / b : 0;
    const perKg = w > 0 ? saleTotal / w : 0;

    return { rows: saleRows, costTotal, saleTotal, profitTotal, marginOnSale, markupOnCost, perBox, perKg };
  }, [boxes, weightKg, margin, cFruit, cOthf, cFreight, cHandling, cOrigin, cAduana, cInsp, cItbms, cOther]);

  function money(v: number) {
    const sym = currency === "EUR" ? "€" : "$";
    return `${sym} ${n(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function save() {
    if (!data) return;
    setBusy(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const costs = {
      c_fruit: n(cFruit),
      c_othf: n(cOthf),
      c_freight: n(cFreight),
      c_handling: n(cHandling),
      c_origin: n(cOrigin),
      c_aduana: n(cAduana),
      c_insp: n(cInsp),
      c_itbms: n(cItbms),
      c_other: n(cOther),
    };

    const items = computed.rows.map((r) => ({
      name: lineLabel(r.key, uiLang),
      qty: Math.max(0, n(boxes)),
      unit_price: Math.max(0, n(boxes)) > 0 ? n(r.sale) / Math.max(1, n(boxes)) : 0,
      total: n(r.sale),
    }));

    const totals = {
      total: n(computed.saleTotal),
      cost_total: n(computed.costTotal),
      sale_total: n(computed.saleTotal),
      profit_total: n(computed.profitTotal),
      margin_on_sale: n(computed.marginOnSale),
      markup_on_cost: n(computed.markupOnCost),
      items,
      meta: {
        incoterm,
        place: place || "—",
        per_box: computed.perBox,
        per_kg: computed.perKg,
        weight_kg: n(weightKg),
        boxes: n(boxes),
        // ✅ dejamos hueco para color/brix si luego lo guardas en meta
        // color: "...",
        // brix: "...",
      },
    };

    const payload = {
      id: data.id,
      boxes: Math.max(0, n(boxes)),
      weight_kg: Math.max(0, n(weightKg)),
      margin_markup: n(margin),
      mode,
      currency,
      destination: destination,
      payment_terms: paymentTerms,
      terms,
      costs,
      totals,
    };

    const res = await fetch("/.netlify/functions/updateQuote", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    const t = await res.text().catch(() => "");
    setBusy(false);

    if (!res.ok) {
      setError(t || "No se pudo guardar");
      return;
    }

    showToast("Guardado ✅");
    load(data.id);
  }

  async function downloadPdf(opts: { variant: PdfVariant; lang: UiLang; report?: boolean }) {
    if (!data) return;

    await save();

    const token = await getTokenOrRedirect();
    if (!token) return;

    const qs = new URLSearchParams();
    qs.set("id", data.id);
    qs.set("variant", opts.variant);
    qs.set("lang", opts.lang);
    if (opts.report) qs.set("report", "1");

    const url = `/.netlify/functions/renderQuotePdf?${qs.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      showToast("No se pudo generar el PDF");
      return;
    }

    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quote_${data.id.slice(0, 8)}_${opts.variant}_${opts.lang}${opts.report ? "_INTERNAL" : ""}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  // ✅ Número de cotización:
  // - Si data.quote_number existe -> úsalo.
  // - Si no, fallback estable: RFQ/YYYY/<id-sin-guiones-5>
  const quoteNumber = useMemo(() => {
    if (!data?.id) return "—";
    const created = data?.created_at ? new Date(data.created_at) : new Date();
    const yyyy = String(created.getUTCFullYear());
    const short = String(data.id).replace(/-/g, "").slice(0, 5);
    return String(data.quote_number || `RFQ/${yyyy}/${short}`);
  }, [data?.id, data?.created_at, data?.quote_number]);

  // mantenemos compat con badge corto
  const quoteCode = useMemo(() => {
    if (!data?.id) return "—";
    return `#${data.id.slice(0, 8)}`;
  }, [data?.id]);

  if (!authOk) {
    return (
      <AdminLayout title="Cotización" subtitle="Verificando permisos…">
        <div className="ff-card2">Cargando…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cotización" subtitle="Cotizador admin (UI premium).">
      <div className="topBar">
        <Link href="/admin/quotes" className="btnGhost">
          <ArrowLeft size={16} />
          Volver
        </Link>

        <div className="topMeta">
          <div className="topTitle">
            Cotización <span className="code">{quoteCode}</span>
            {data?.client_snapshot?.name ? <span className="sub">· {data.client_snapshot.name}</span> : null}
            {data?.client_snapshot?.contact_email ? <span className="sub"> ({data.client_snapshot.contact_email})</span> : null}
          </div>
          {data ? (
            <div className="topSub">
              <span className="qnum">Número: {quoteNumber}</span>
              <span className="sep">·</span>
              Creada: {fmtDateTime(data.created_at)} <span className="sep">·</span> Actualizada: {fmtDateTime(data.updated_at)}
            </div>
          ) : null}
        </div>

        <div className="topActions">
          <button className="segBtn" type="button" onClick={() => setUiLang(uiLang === "es" ? "en" : "es")}>
            {uiLang === "es" ? "ES" : "EN"}
          </button>

          <button className="btnPrimary" type="button" disabled={busy || loading} onClick={save}>
            <Save size={16} />
            Guardar
          </button>
        </div>
      </div>

      {toast ? <div className="msgOk">{toast}</div> : null}
      {error ? <div className="msgWarn">{error}</div> : null}

      <div className="layout">
        {/* LEFT */}
        <div className="col">
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="h">Configuración de oferta</div>
                <div className="muted">Modo + incoterm + place + moneda + parámetros.</div>
              </div>
            </div>

            <div className="divider" />

            <div className="segRow">
              <button className={`seg ${mode === "AIR" ? "on" : ""}`} type="button" onClick={() => setMode("AIR")}>
                ✈️ AÉREO
              </button>
              <button className={`seg ${mode === "SEA" ? "on" : ""}`} type="button" onClick={() => setMode("SEA")}>
                🚢 MARÍTIMO
              </button>
            </div>

            <div className="grid2">
              <div>
                <label className="lbl">Incoterm</label>
                <select className="in" value={incoterm} onChange={(e) => setIncoterm(safeIncoterm(e.target.value))}>
                  <option value="CIP">CIP</option>
                  <option value="CPT">CPT</option>
                  <option value="DAP">DAP</option>
                  <option value="DDP">DDP</option>
                  <option value="FCA">FCA</option>
                  <option value="FOB" disabled={mode === "AIR"}>
                    FOB {mode === "AIR" ? "(solo marítimo)" : ""}
                  </option>
                  <option value="CIF" disabled={mode === "AIR"}>
                    CIF {mode === "AIR" ? "(solo marítimo)" : ""}
                  </option>
                </select>
              </div>

              <div>
                <label className="lbl">Place (Incoterm + Place)</label>
                <input className="in" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ej: Madrid (MAD) / AMS / Puerto..." />
                <div className="help">{incotermHelp(incoterm, uiLang)}</div>
              </div>

              <div>
                <label className="lbl">Moneda</label>
                <select className="in" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                </select>
              </div>

              <div>
                <label className="lbl">Cajas (Total)</label>
                <input className="in" type="number" value={boxes} onChange={(e) => setBoxes(Number(e.target.value || 0))} />
              </div>

              <div>
                <label className="lbl">Peso KG (Manual)</label>
                <input className="in warn" type="number" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value || 0))} />
              </div>

              <div>
                <label className="lbl">Markup %</label>
                <input className="in" type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value || 0))} />
              </div>

              <div>
                <label className="lbl">Condiciones de pago</label>
                <input className="in" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Ej: 80% Advance / 20% BL" />
              </div>
            </div>

            <div className="divider" />

            <div className="cardSubHead">
              <div>
                <div className="h2">Términos & Condiciones</div>
                <div className="muted">Texto de la oferta (editable).</div>
              </div>
            </div>

            <textarea className="ta" rows={7} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>

          <div className="card">
            <div className="cardHead">
              <div>
                <div className="h">Costos (solo admin)</div>
                <div className="muted">Activa para editar, sin ensuciar la vista.</div>
              </div>
              <button className="btnGhostSmall" type="button" onClick={() => setShowCosts(!showCosts)}>
                {showCosts ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {showCosts ? (
              <>
                <div className="divider" />

                <div className="grid2">
                  <div>
                    <label className="lbl">Piña ($/caja)</label>
                    <input className="in" type="number" step="0.01" value={cFruit} onChange={(e) => setCFruit(Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <label className="lbl">OTHF ($)</label>
                    <input className="in" type="number" step="0.01" value={cOthf} onChange={(e) => setCOthf(Number(e.target.value || 0))} />
                  </div>

                  <div>
                    <label className="lbl">Flete ($)</label>
                    <input className="in" type="number" step="0.01" value={cFreight} onChange={(e) => setCFreight(Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <label className="lbl">Handling / Kg</label>
                    <input className="in" type="number" step="0.01" value={cHandling} onChange={(e) => setCHandling(Number(e.target.value || 0))} />
                  </div>

                  <div>
                    <label className="lbl">Gastos origen ($)</label>
                    <input className="in" type="number" step="0.01" value={cOrigin} onChange={(e) => setCOrigin(Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <label className="lbl">Aduana ($)</label>
                    <input className="in" type="number" step="0.01" value={cAduana} onChange={(e) => setCAduana(Number(e.target.value || 0))} />
                  </div>

                  <div>
                    <label className="lbl">Inspección ($)</label>
                    <input className="in" type="number" step="0.01" value={cInsp} onChange={(e) => setCInsp(Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <label className="lbl">ITBMS (%)</label>
                    <input className="in" type="number" step="0.01" value={cItbms} onChange={(e) => setCItbms(Number(e.target.value || 0))} />
                  </div>

                  <div>
                    <label className="lbl">Otros gastos ($)</label>
                    <input className="in" type="number" step="0.01" value={cOther} onChange={(e) => setCOther(Number(e.target.value || 0))} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* RIGHT */}
        <div className="col">
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="h">Estructura de venta</div>
                <div className="muted">Costos vs venta + margen real.</div>
              </div>
              <button className="btnPrimary" type="button" disabled={busy || loading} onClick={save}>
                <Save size={16} />
                Guardar
              </button>
            </div>

            <div className="divider" />

            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Concepto</th>
                  <th style={{ textAlign: "right" }}>Costo</th>
                  <th style={{ textAlign: "right" }}>Venta</th>
                  <th style={{ textAlign: "right" }}>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {computed.rows.map((r) => (
                  <tr key={r.key}>
                    <td style={{ textAlign: "left", fontWeight: 900 }}>{lineLabel(r.key, uiLang)}</td>
                    <td style={{ textAlign: "right" }}>{money(r.cost)}</td>
                    <td style={{ textAlign: "right", fontWeight: 950 }}>{money(r.sale)}</td>
                    <td style={{ textAlign: "right", fontWeight: 950, color: "var(--ff-green-dark)" }}>+{money(r.sale - r.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tot">
                  <td style={{ textAlign: "left" }}>TOTAL</td>
                  <td style={{ textAlign: "right" }}>{money(computed.costTotal)}</td>
                  <td style={{ textAlign: "right" }}>{money(computed.saleTotal)}</td>
                  <td style={{ textAlign: "right" }}>+{money(computed.profitTotal)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="kpis">
              <div className="kpi">
                <div className="kpiLbl">Margen real (Profit / Venta)</div>
                <div className="kpiVal">{computed.marginOnSale.toFixed(1)}%</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Markup real (Profit / Costo): <b>{computed.markupOnCost.toFixed(1)}%</b>
                </div>
              </div>
              <div className="kpi">
                <div className="kpiLbl">Unidades</div>
                <div className="kpiVal">
                  {money(computed.perBox)} / caja &nbsp;&nbsp;·&nbsp;&nbsp; {money(computed.perKg)} / kg &nbsp;&nbsp;·&nbsp;&nbsp;{" "}
                  {n(weightKg).toLocaleString("en-US")} kg
                </div>
              </div>
            </div>
          </div>

          <div className="card softGreen">
            <div className="cardHead">
              <div>
                <div className="h">Salida PDF</div>
                <div className="muted">Selecciona tipo + idioma y descarga el PDF listo.</div>
              </div>
            </div>

            <div className="divider" />

            <div className="pdfRow">
              <div className="segGroup">
                <button className={`segMini ${pdfVariant === "1" ? "on" : ""}`} type="button" onClick={() => setPdfVariant("1")}>
                  Simple
                </button>
                <button className={`segMini ${pdfVariant === "2" ? "on" : ""}`} type="button" onClick={() => setPdfVariant("2")}>
                  Detallada
                </button>
              </div>

              <div className="segGroup">
                <button className={`segMini ${pdfLang === "es" ? "on" : ""}`} type="button" onClick={() => setPdfLang("es")}>
                  🇪🇸 ES
                </button>
                <button className={`segMini ${pdfLang === "en" ? "on" : ""}`} type="button" onClick={() => setPdfLang("en")}>
                  🇺🇸 EN
                </button>
              </div>

              <div style={{ flex: "1 1 auto" }} />

              <button className="btnPrimary" type="button" disabled={busy || loading} onClick={() => downloadPdf({ variant: pdfVariant, lang: pdfLang })}>
                <FileText size={16} />
                Generar PDF
              </button>
            </div>

            <div className="pdfTotal">
              <div className="pdfTotalLbl">TOTAL</div>
              <div className="pdfTotalVal">{money(computed.saleTotal)}</div>
              <div className="pdfMeta">
                Tipo: {pdfVariant === "1" ? "Simple" : "Detallada"} · Idioma: {pdfLang.toUpperCase()} · Incoterm: {incoterm} · Place: {place || "—"}
              </div>
            </div>

            <div className="divider" />

            <div className="pdfRow">
              <button className="btnGhostSmall" type="button" disabled={busy || loading} onClick={() => downloadPdf({ variant: "2", lang: "es", report: true })}>
                <FileText size={16} /> PDF Interno (ES)
              </button>

              <button className="btnGhostSmall" type="button" disabled={busy || loading} onClick={() => downloadPdf({ variant: "2", lang: "en", report: true })}>
                <FileText size={16} /> PDF Interno (EN)
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 1100px) {
          .layout {
            grid-template-columns: 1.05fr 0.95fr;
            gap: 12px;
          }
        }
        .col {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .topBar {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 10px;
          align-items: center;
          margin-bottom: 12px;
        }
        .topMeta {
          min-width: 0;
        }
        .topTitle {
          font-weight: 950;
          font-size: 15px;
          letter-spacing: -0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .code {
          color: var(--ff-green-dark);
        }
        .sub {
          color: var(--ff-muted);
          font-weight: 800;
          font-size: 13px;
        }
        .topSub {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .qnum {
          font-weight: 950;
          color: var(--ff-text);
        }
        .sep {
          opacity: 0.6;
        }
        .topActions {
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }

        .card {
          border: 1px solid var(--ff-border);
          background: var(--ff-surface);
          border-radius: var(--ff-radius);
          padding: 12px;
        }
        .softGreen {
          border-color: rgba(31, 122, 58, 0.18);
          background: rgba(31, 122, 58, 0.06);
        }
        .cardHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .cardSubHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .h {
          font-weight: 950;
          font-size: 14px;
          letter-spacing: -0.2px;
        }
        .h2 {
          font-weight: 950;
          font-size: 13px;
          letter-spacing: -0.2px;
        }
        .muted {
          font-size: 12px;
          color: var(--ff-muted);
        }
        .divider {
          height: 1px;
          background: rgba(15, 23, 42, 0.08);
          margin: 12px 0;
        }

        .grid2 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .grid2 {
            grid-template-columns: 1fr 1fr;
          }
        }
        .lbl {
          display: block;
          font-size: 12px;
          font-weight: 900;
          color: var(--ff-muted);
          margin-bottom: 6px;
        }
        .in {
          width: 100%;
          height: 38px;
          border: 1px solid var(--ff-border);
          border-radius: 10px;
          padding: 0 10px;
          font-size: 13px;
          outline: none;
          background: #fff;
        }
        .in.warn {
          border-color: rgba(209, 119, 17, 0.35);
          box-shadow: 0 0 0 4px rgba(209, 119, 17, 0.08);
        }
        .help {
          margin-top: 6px;
          font-size: 12px;
          color: var(--ff-muted);
        }

        .ta {
          width: 100%;
          border: 1px solid var(--ff-border);
          border-radius: 10px;
          padding: 10px;
          font-size: 13px;
          outline: none;
          background: #fff;
          white-space: pre-wrap;
        }

        .btnPrimary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(31, 122, 58, 0.35);
          background: var(--ff-green);
          color: #fff;
          border-radius: 10px;
          height: 36px;
          padding: 0 12px;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .btnPrimary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btnGhost,
        .btnGhostSmall {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid var(--ff-border);
          background: #fff;
          color: var(--ff-text);
          border-radius: 10px;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
        }
        .btnGhost {
          height: 36px;
          padding: 0 12px;
          font-size: 12px;
        }
        .btnGhostSmall {
          height: 34px;
          padding: 0 10px;
          font-size: 12px;
        }
        .btnGhost:hover,
        .btnGhostSmall:hover {
          background: rgba(15, 23, 42, 0.03);
        }

        .segBtn {
          height: 36px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid var(--ff-border);
          background: #fff;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
        }

        .segRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .seg {
          height: 38px;
          border-radius: 12px;
          border: 1px solid var(--ff-border);
          background: #fff;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
        }
        .seg.on {
          border-color: rgba(31, 122, 58, 0.28);
          background: rgba(31, 122, 58, 0.1);
          color: var(--ff-green-dark);
        }

        .segGroup {
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }
        .segMini {
          height: 34px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--ff-border);
          background: #fff;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .segMini.on {
          border-color: rgba(31, 122, 58, 0.28);
          background: rgba(31, 122, 58, 0.1);
          color: var(--ff-green-dark);
        }

        .tbl {
          width: 100%;
          border-collapse: collapse;
        }
        .tbl th {
          font-size: 12px;
          color: var(--ff-muted);
          padding: 10px 8px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }
        .tbl td {
          padding: 10px 8px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          font-size: 13px;
        }
        .tot td {
          background: rgba(15, 23, 42, 0.03);
          font-weight: 950;
        }

        .kpis {
          margin-top: 12px;
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .kpis {
            grid-template-columns: 0.8fr 1.2fr;
          }
        }
        .kpi {
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.75);
          border-radius: 12px;
          padding: 10px;
        }
        .kpiLbl {
          font-size: 12px;
          color: var(--ff-muted);
          font-weight: 900;
        }
        .kpiVal {
          margin-top: 2px;
          font-size: 13px;
          font-weight: 950;
        }

        .pdfRow {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .pdfTotal {
          margin-top: 12px;
          border-radius: 12px;
          padding: 10px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(255, 255, 255, 0.65);
        }
        .pdfTotalLbl {
          font-size: 12px;
          color: var(--ff-muted);
          font-weight: 900;
        }
        .pdfTotalVal {
          margin-top: 4px;
          font-size: 22px;
          font-weight: 950;
          color: var(--ff-green-dark);
        }
        .pdfMeta {
          margin-top: 6px;
          font-size: 12px;
          color: var(--ff-muted);
          font-weight: 800;
        }

        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 12px;
        }
        .msgOk {
          border: 1px solid rgba(31, 122, 58, 0.3);
          background: rgba(31, 122, 58, 0.08);
          border-radius: 12px;
          padding: 10px;
          font-weight: 950;
          font-size: 12px;
          margin-bottom: 12px;
        }
      `}</style>
    </AdminLayout>
  );
}