// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Save, FileText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { requireAdminOrRedirect } from "@/lib/requireAdmin";
import { AdminLayout } from "@/components/AdminLayout";

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
  client_snapshot?: {
    name?: string;
    contact_email?: string;
  } | null;
  totals?: Record<string, any>;
  costs?: Record<string, any>;
};

type UiLang = "es" | "en";

type Incoterm = "CIP" | "CIF" | "CFR" | "FOB" | "FCA" | "EXW" | "DAP" | "DDP";

const INCOTERMS: { value: Incoterm; label: string; hint?: string }[] = [
  { value: "CIP", label: "CIP", hint: "CIP requiere Place of Destination (Aeropuerto/Puerto destino)." },
  { value: "CIF", label: "CIF", hint: "CIF aplica típicamente a marítimo: costo + seguro + flete hasta puerto destino." },
  { value: "CFR", label: "CFR", hint: "CFR: costo + flete hasta puerto destino (seguro por el comprador)." },
  { value: "FOB", label: "FOB", hint: "FOB: entrega a bordo en puerto de salida." },
  { value: "FCA", label: "FCA", hint: "FCA: entrega al transportista en punto acordado." },
  { value: "EXW", label: "EXW", hint: "EXW: retiro en origen, mínimo compromiso del vendedor." },
  { value: "DAP", label: "DAP", hint: "DAP: entregado en lugar (sin descarga), impuestos por comprador." },
  { value: "DDP", label: "DDP", hint: "DDP: entregado con impuestos pagados (máximo compromiso del vendedor)." },
];

const PAYMENT_PRESETS: { value: string; label: string }[] = [
  { value: "100% Prepaid", label: "100% Prepaid" },
  { value: "50% Advance / 50% Before Shipment", label: "50% Advance / 50% Before Shipment" },
  { value: "80% Advance / 20% BL", label: "80% Advance / 20% BL" },
  { value: "CAD (Cash Against Documents)", label: "CAD (Cash Against Documents)" },
  { value: "Net 7 days", label: "Net 7 days" },
  { value: "Net 15 days", label: "Net 15 days" },
  { value: "Manual", label: "Manual (especificar)" },
];

const SALES_LINES = [
  { key: "fruit_value", es: "1. Valor de la fruta (FOB/FCA)", en: "1. Fruit Value (FOB/FCA)" },
  { key: "intl_logistics", es: "2. Logística internacional", en: "2. International Logistics" },
  { key: "origin_customs", es: "3. Gastos en origen y aduana", en: "3. Origin Charges & Customs" },
  { key: "inspection_quality", es: "4. Inspección y calidad", en: "4. Inspection & Quality" },
] as const;

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

function normalizePaymentPreset(s: string) {
  const hit = PAYMENT_PRESETS.find((p) => p.value !== "Manual" && p.value === s);
  return hit ? hit.value : "Manual";
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

  const [uiLang, setUiLang] = useState<UiLang>("es");

  const [incoterm, setIncoterm] = useState<Incoterm>("CIP");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [margin, setMargin] = useState<number>(15);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [destination, setDestination] = useState("");
  const [terms, setTerms] = useState("");

  const [paymentPreset, setPaymentPreset] = useState<string>("80% Advance / 20% BL");
  const [paymentManual, setPaymentManual] = useState<string>("");

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

  const [pdfVariant, setPdfVariant] = useState<"1" | "2">("1");
  const [pdfLang, setPdfLang] = useState<UiLang>("es");

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

  function getPaymentTermsValue() {
    if (paymentPreset === "Manual") return paymentManual.trim();
    return paymentPreset.trim();
  }

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
    setDestination(String(json.destination || ""));
    setTerms(String(json.terms || ""));

    const metaInc = (json.totals as any)?.meta?.incoterm;
    if (metaInc && typeof metaInc === "string") {
      const match = INCOTERMS.find((x) => x.value === metaInc);
      setIncoterm(match ? match.value : "CIP");
    } else {
      setIncoterm("CIP");
    }

    const pt = String(json.payment_terms || "");
    const preset = pt ? normalizePaymentPreset(pt) : "80% Advance / 20% BL";
    setPaymentPreset(preset);
    setPaymentManual(preset === "Manual" ? pt : "");

    const costs = json.costs || {};
    setCFruit(n(costs.c_fruit));
    setCOthf(n(costs.c_othf));
    setCFreight(n(costs.c_freight));
    setCHandling(n(costs.c_handling));
    setCOrigin(n(costs.c_origin));
    setCAduana(n(costs.c_aduana));
    setCInsp(n(costs.c_insp));
    setCItbms(n(costs.c_itbms));
    setCOther(n(costs.c_other));

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
    const realMargin = saleTotal > 0 ? (profitTotal / saleTotal) * 100 : 0;

    const perBox = b > 0 ? saleTotal / b : 0;
    const perKg = w > 0 ? saleTotal / w : 0;

    return { rows: saleRows, costTotal, saleTotal, profitTotal, realMargin, perBox, perKg };
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
      margin_real: n(computed.realMargin),
      items,
      meta: {
        incoterm,
        place: destination || "—",
        per_box: computed.perBox,
        per_kg: computed.perKg,
        weight_kg: n(weightKg),
        boxes: n(boxes),
        mode,
        currency,
      },
    };

    const payload = {
      id: data.id,
      boxes: Math.max(0, n(boxes)),
      weight_kg: Math.max(0, n(weightKg)),
      margin_markup: n(margin),
      mode,
      currency,
      destination,
      payment_terms: getPaymentTermsValue(),
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

  async function downloadPdf(opts: { variant: "1" | "2"; lang: UiLang; report?: boolean }) {
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

  const incHint = INCOTERMS.find((x) => x.value === incoterm)?.hint;

  if (!authOk) {
    return (
      <AdminLayout title="Cotización" subtitle="Verificando permisos…">
        <div className="card">Cargando…</div>
        <style jsx>{`
          .card {
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
          }
        `}</style>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cotización" subtitle="Editor (solo admin) + PDFs ES/EN.">
      <div className="wrap">
        <div className="topbar">
          <div className="topLeft">
            <Link href="/admin/quotes" className="btnGhost">
              <ArrowLeft size={16} />
              Volver
            </Link>

            <div className="titleBlock">
              <div className="titleLine">
                <span className="title">Cotización</span>
                <span className="titleId">#{typeof id === "string" ? id.slice(0, 8) : "—"}</span>
                <span className="titleClient">
                  {data?.client_snapshot?.name ? `· ${data.client_snapshot.name}` : ""}
                  {data?.client_snapshot?.contact_email ? ` (${data.client_snapshot.contact_email})` : ""}
                </span>
              </div>
              <div className="subLine">
                Creada: {fmtDateTime(data?.created_at)} · Actualizada: {fmtDateTime(data?.updated_at)}
              </div>
            </div>
          </div>

          <div className="topRight">
            <div className="chipRow">
              <button className="chip" type="button">
                Borrador
              </button>
              <button className="chip" type="button">
                Enviar
              </button>
              <button className="chip chipGreen" type="button">
                Ganada
              </button>
              <button className="chip chipRed" type="button">
                Perdida
              </button>
              <button className="chip" type="button">
                Archivar
              </button>
            </div>

            <div className="actionRow">
              <button className="btnGhost" type="button" onClick={() => setUiLang(uiLang === "es" ? "en" : "es")}>
                Idioma UI: {uiLang.toUpperCase()}
              </button>

              <button className="btnPrimary" type="button" disabled={busy || loading} onClick={save}>
                <Save size={16} /> Guardar
              </button>
            </div>
          </div>
        </div>

        {toast ? <div className="msgOk">{toast}</div> : null}

        <div className="outerCard">
          {loading ? (
            <div className="muted">Cargando…</div>
          ) : error ? (
            <div className="msgWarn">{error}</div>
          ) : data ? (
            <div className="mainGrid">
              <div className="col">
                <div className="card">
                  <div className="cardHead">
                    <div>
                      <div className="cardTitle">Configuración de oferta</div>
                      <div className="cardSub">Modo + incoterm + destino + moneda + parámetros.</div>
                    </div>
                  </div>

                  <div className="segRow">
                    <button type="button" className={mode === "AIR" ? "segBtn segBtnOn" : "segBtn"} onClick={() => setMode("AIR")}>
                      ✈️ AÉREO
                    </button>
                    <button type="button" className={mode === "SEA" ? "segBtn segBtnOn" : "segBtn"} onClick={() => setMode("SEA")}>
                      🚢 MARÍTIMO
                    </button>
                  </div>

                  <div className="formGrid">
                    <div>
                      <label className="lbl2">INCOTERM</label>
                      <select className="in3" value={incoterm} onChange={(e) => setIncoterm(e.target.value as Incoterm)}>
                        {INCOTERMS.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                      {incHint ? <div className="hint">{incHint}</div> : null}
                    </div>

                    <div>
                      <label className="lbl2">PLACE (DESTINO)</label>
                      <input className="in3" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Madrid (MAD)" />
                      <div className="hint">Usa formato: Ciudad (COD).</div>
                    </div>

                    <div>
                      <label className="lbl2">MONEDA</label>
                      <select className="in3" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl2">CAJAS (TOTAL)</label>
                      <input className="in3" type="number" value={boxes} onChange={(e) => setBoxes(Number(e.target.value || 0))} />
                    </div>

                    <div>
                      <label className="lbl2">PESO KG (MANUAL)</label>
                      <input className="in3 focusYellow" type="number" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value || 0))} />
                    </div>

                    <div>
                      <label className="lbl2">MARKUP %</label>
                      <input className="in3" type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value || 0))} />
                    </div>

                    <div className="span2">
                      <label className="lbl2">CONDICIONES DE PAGO</label>
                      <div className="payRow">
                        <select className="in3" value={paymentPreset} onChange={(e) => setPaymentPreset(e.target.value)}>
                          {PAYMENT_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        {paymentPreset === "Manual" ? (
                          <input
                            className="in3"
                            value={paymentManual}
                            onChange={(e) => setPaymentManual(e.target.value)}
                            placeholder="Especifica condiciones (ej: 30% advance, 70% BL, net 7)."
                          />
                        ) : null}
                      </div>
                      <div className="hint">
                        Guardaremos: <b>{getPaymentTermsValue() || "—"}</b>
                      </div>
                    </div>

                    <div>
                      <label className="lbl2">ESTADO</label>
                      <input className="in3" value={data.status} disabled />
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="cardHead">
                    <div>
                      <div className="cardTitle">Términos & Condiciones</div>
                      <div className="cardSub">Texto exportable al PDF.</div>
                    </div>
                  </div>
                  <textarea className="ta2" rows={7} value={terms} onChange={(e) => setTerms(e.target.value)} />
                </div>
              </div>

              <div className="col">
                <div className="card">
                  <div className="cardHead">
                    <div>
                      <div className="cardTitle">Estructura de venta</div>
                      <div className="cardSub">Costos vs venta + margen real.</div>
                    </div>
                    <button className="btnGhost" type="button" disabled={busy || loading} onClick={save}>
                      <Save size={16} /> Guardar
                    </button>
                  </div>

                  <table className="pl2">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>CONCEPTO</th>
                        <th style={{ textAlign: "right" }}>COSTO</th>
                        <th style={{ textAlign: "right" }}>VENTA</th>
                        <th style={{ textAlign: "right" }}>GANANCIA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.rows.map((r) => (
                        <tr key={r.key}>
                          <td style={{ textAlign: "left", fontWeight: 950 }}>{lineLabel(r.key, uiLang)}</td>
                          <td style={{ textAlign: "right" }}>{money(r.cost)}</td>
                          <td style={{ textAlign: "right", fontWeight: 950 }}>{money(r.sale)}</td>
                          <td style={{ textAlign: "right" }} className="gain">
                            +{money(r.sale - r.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="totRow2">
                        <td style={{ textAlign: "left" }}>TOTAL</td>
                        <td style={{ textAlign: "right" }}>{money(computed.costTotal)}</td>
                        <td style={{ textAlign: "right" }}>{money(computed.saleTotal)}</td>
                        <td style={{ textAlign: "right" }} className="gain">
                          +{money(computed.profitTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="metrics">
                    <div className="metric">
                      <div className="metricLbl">MARGEN REAL</div>
                      <div className="metricVal">{computed.realMargin.toFixed(1)}%</div>
                    </div>
                    <div className="metric">
                      <div className="metricLbl">UNIDADES</div>
                      <div className="metricValSm">
                        {money(computed.perBox)} / caja &nbsp;&nbsp; {money(computed.perKg)} / kg &nbsp;&nbsp; {n(weightKg).toLocaleString("en-US")} kg
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card pdfCard">
                  <div className="cardHead">
                    <div>
                      <div className="cardTitle">Salida PDF</div>
                      <div className="cardSub">Selecciona tipo + idioma y genera el PDF listo.</div>
                    </div>
                  </div>

                  <div className="pdfControls">
                    <div className="segMini">
                      <button className={pdfVariant === "1" ? "segMiniBtn on" : "segMiniBtn"} type="button" onClick={() => setPdfVariant("1")}>
                        Simple
                      </button>
                      <button className={pdfVariant === "2" ? "segMiniBtn on" : "segMiniBtn"} type="button" onClick={() => setPdfVariant("2")}>
                        Detallada
                      </button>
                    </div>

                    <div className="segMini">
                      <button className={pdfLang === "es" ? "segMiniBtn on" : "segMiniBtn"} type="button" onClick={() => setPdfLang("es")}>
                        🇪🇸 ES
                      </button>
                      <button className={pdfLang === "en" ? "segMiniBtn on" : "segMiniBtn"} type="button" onClick={() => setPdfLang("en")}>
                        🇺🇸 EN
                      </button>
                    </div>
                  </div>

                  <div className="pdfTotal">
                    <div className="pdfTotalLbl">TOTAL</div>
                    <div className="pdfTotalVal">{money(computed.saleTotal)}</div>
                  </div>

                  <div className="pdfMeta">
                    Tipo: <b>{pdfVariant === "1" ? "Simple" : "Detallada"}</b> · Idioma: <b>{pdfLang.toUpperCase()}</b> · Incoterm: <b>{incoterm}</b> · Place:{" "}
                    <b>{destination || "—"}</b>
                  </div>

                  <button className="btnPdf" type="button" disabled={busy} onClick={() => downloadPdf({ variant: pdfVariant, lang: pdfLang })}>
                    <FileText size={16} />
                    Generar PDF
                  </button>

                  <div className="pdfFoot">El sistema guarda antes de generar para asegurar totals/costs actualizados.</div>
                </div>

                <div className="card">
                  <div className="cardHead">
                    <div>
                      <div className="cardTitle">Costos detallados</div>
                      <div className="cardSub">Solo admin.</div>
                    </div>
                    <button className="btnGhost" type="button" onClick={() => setShowCosts(!showCosts)}>
                      {showCosts ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>

                  {showCosts ? (
                    <div className="formGrid" style={{ marginTop: 4 }}>
                      <div>
                        <label className="lbl2">Piña ($/caja)</label>
                        <input className="in3" type="number" step="0.01" value={cFruit} onChange={(e) => setCFruit(Number(e.target.value || 0))} />
                      </div>
                      <div>
                        <label className="lbl2">OTHF ($)</label>
                        <input className="in3" type="number" step="0.01" value={cOthf} onChange={(e) => setCOthf(Number(e.target.value || 0))} />
                      </div>

                      <div>
                        <label className="lbl2">Flete ($)</label>
                        <input className="in3" type="number" step="0.01" value={cFreight} onChange={(e) => setCFreight(Number(e.target.value || 0))} />
                      </div>
                      <div>
                        <label className="lbl2">Handling / Kg</label>
                        <input className="in3" type="number" step="0.01" value={cHandling} onChange={(e) => setCHandling(Number(e.target.value || 0))} />
                      </div>

                      <div>
                        <label className="lbl2">Gastos origen ($)</label>
                        <input className="in3" type="number" step="0.01" value={cOrigin} onChange={(e) => setCOrigin(Number(e.target.value || 0))} />
                      </div>
                      <div>
                        <label className="lbl2">Aduana ($)</label>
                        <input className="in3" type="number" step="0.01" value={cAduana} onChange={(e) => setCAduana(Number(e.target.value || 0))} />
                      </div>

                      <div>
                        <label className="lbl2">Inspección ($)</label>
                        <input className="in3" type="number" step="0.01" value={cInsp} onChange={(e) => setCInsp(Number(e.target.value || 0))} />
                      </div>
                      <div>
                        <label className="lbl2">ITBMS (%)</label>
                        <input className="in3" type="number" step="0.01" value={cItbms} onChange={(e) => setCItbms(Number(e.target.value || 0))} />
                      </div>

                      <div>
                        <label className="lbl2">Otros gastos ($)</label>
                        <input className="in3" type="number" step="0.01" value={cOther} onChange={(e) => setCOther(Number(e.target.value || 0))} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mutedFooter">
                  Creada: {fmtDateTime(data.created_at)} · Última actualización: {fmtDateTime(data.updated_at)}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .wrap {
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }

        .topbar {
          display: flex;
          gap: 12px;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px;
          border: 1px solid var(--ff-border);
          border-radius: 14px;
          background: #fff;
          margin-bottom: 12px;
        }

        .topLeft {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          min-width: 360px;
        }

        .titleBlock {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .titleLine {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: baseline;
        }

        .title {
          font-weight: 900;
          font-size: 16px;
          color: rgba(15, 23, 42, 0.95);
        }

        .titleId {
          font-weight: 900;
          color: rgba(15, 23, 42, 0.7);
        }

        .titleClient {
          color: var(--ff-muted);
          font-weight: 700;
          font-size: 13px;
        }

        .subLine {
          font-size: 12px;
          color: var(--ff-muted);
        }

        .topRight {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-end;
        }

        .chipRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .chip {
          height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: #fff;
          font-weight: 800;
          font-size: 12px;
        }

        .chipGreen {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.25);
          color: rgba(5, 120, 80, 1);
        }

        .chipRed {
          background: rgba(244, 63, 94, 0.1);
          border-color: rgba(244, 63, 94, 0.22);
          color: rgba(159, 18, 57, 1);
        }

        .actionRow {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .btnGhost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font-weight: 800;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.9);
        }

        .btnPrimary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid rgba(31, 122, 58, 0.28);
          background: var(--ff-green-dark);
          color: #fff;
          font-weight: 900;
          font-size: 12px;
        }

        .btnPrimary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .outerCard {
          border: 1px solid var(--ff-border);
          border-radius: 16px;
          background: #fff;
          padding: 12px;
        }

        .mainGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }

        @media (min-width: 1100px) {
          .mainGrid {
            grid-template-columns: 1.05fr 0.95fr;
          }
        }

        .col {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .card {
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 16px;
          padding: 14px;
        }

        .cardHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .cardTitle {
          font-weight: 900;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.95);
        }

        .cardSub {
          color: var(--ff-muted);
          font-size: 12px;
          margin-top: 2px;
        }

        .segRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 10px 0 12px;
        }

        .segBtn {
          height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: #fff;
          font-weight: 900;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.92);
        }

        .segBtnOn {
          background: rgba(31, 122, 58, 0.08);
          border-color: rgba(31, 122, 58, 0.25);
        }

        .formGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }

        @media (min-width: 980px) {
          .formGrid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .span2 {
          grid-column: 1 / -1;
        }

        .lbl2 {
          display: block;
          font-size: 11px;
          font-weight: 900;
          color: var(--ff-muted);
          margin: 0 0 6px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .in3 {
          width: 100%;
          height: 38px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 12px;
          padding: 0 12px;
          font-size: 13px;
          outline: none;
          background: #fff;
          color: rgba(15, 23, 42, 0.95);
        }

        .in3:focus {
          border-color: rgba(31, 122, 58, 0.45);
          box-shadow: 0 0 0 3px rgba(31, 122, 58, 0.1);
        }

        .focusYellow {
          box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.16);
          border-color: rgba(234, 179, 8, 0.35);
        }

        .hint {
          margin-top: 6px;
          font-size: 11px;
          color: var(--ff-muted);
          font-weight: 700;
        }

        .payRow {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        @media (min-width: 980px) {
          .payRow {
            grid-template-columns: 1fr 1.2fr;
          }
        }

        .ta2 {
          width: 100%;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 12px;
          padding: 12px;
          font-size: 13px;
          outline: none;
          background: #fff;
          min-height: 140px;
          color: rgba(15, 23, 42, 0.95);
        }

        .pl2 {
          width: 100%;
          border-collapse: collapse;
        }

        .pl2 th {
          font-size: 11px;
          color: var(--ff-muted);
          padding: 10px 8px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .pl2 td {
          padding: 10px 8px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          font-size: 13px;
        }

        .totRow2 td {
          background: rgba(15, 23, 42, 0.02);
          font-weight: 900;
        }

        .gain {
          color: var(--ff-green-dark);
          font-weight: 900;
        }

        .metrics {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 10px;
          background: rgba(15, 23, 42, 0.02);
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 14px;
          padding: 12px;
        }

        @media (min-width: 700px) {
          .metrics {
            grid-template-columns: 1fr 2fr;
          }
        }

        .metricLbl {
          font-size: 11px;
          color: var(--ff-muted);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .metricVal {
          font-size: 18px;
          font-weight: 900;
        }

        .metricValSm {
          font-size: 12px;
          font-weight: 800;
          color: rgba(15, 23, 42, 0.85);
          margin-top: 2px;
        }

        .pdfCard {
          background: rgba(31, 122, 58, 0.06);
          border-color: rgba(31, 122, 58, 0.16);
        }

        .pdfControls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .segMini {
          display: inline-flex;
          padding: 4px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(255, 255, 255, 0.65);
        }

        .segMiniBtn {
          height: 34px;
          padding: 0 12px;
          border-radius: 10px;
          font-weight: 900;
          font-size: 12px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(15, 23, 42, 0.9);
        }

        .segMiniBtn.on {
          background: #fff;
          border-color: rgba(15, 23, 42, 0.1);
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
        }

        .pdfTotal {
          margin-top: 12px;
        }

        .pdfTotalLbl {
          font-size: 11px;
          font-weight: 900;
          color: var(--ff-muted);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .pdfTotalVal {
          font-size: 26px;
          font-weight: 900;
          color: var(--ff-green-dark);
          margin-top: 4px;
        }

        .pdfMeta {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.75);
          font-weight: 800;
        }

        .btnPdf {
          margin-top: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 42px;
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(31, 122, 58, 0.28);
          background: var(--ff-green-dark);
          color: #fff;
          font-weight: 900;
          font-size: 13px;
        }

        .btnPdf:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .pdfFoot {
          margin-top: 8px;
          font-size: 11px;
          color: rgba(15, 23, 42, 0.6);
          font-weight: 700;
        }

        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 800;
        }

        .msgOk {
          border: 1px solid rgba(31, 122, 58, 0.3);
          background: rgba(31, 122, 58, 0.08);
          border-radius: 12px;
          padding: 10px;
          font-weight: 900;
          font-size: 12px;
          margin-bottom: 12px;
        }

        .muted {
          font-size: 12px;
          color: var(--ff-muted);
          font-weight: 700;
        }

        .mutedFooter {
          font-size: 12px;
          color: var(--ff-muted);
          font-weight: 700;
          padding: 2px 2px 0;
        }
      `}</style>
    </AdminLayout>
  );
}