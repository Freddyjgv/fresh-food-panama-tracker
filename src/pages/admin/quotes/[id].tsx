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
  client_snapshot?: {
    name?: string;
    contact_email?: string;
  } | null;
  totals?: Record<string, any>;
  costs?: Record<string, any>;
};

type UiLang = "es" | "en";

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

export default function AdminQuoteDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [data, setData] = useState<QuoteDetail | null>(null);

  // UI (no cliente)
  const [uiLang, setUiLang] = useState<UiLang>("es");

  // Editables principales
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [margin, setMargin] = useState<number>(15);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [destination, setDestination] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [terms, setTerms] = useState("");

  // Costos detallados (ADMIN)
  const [cFruit, setCFruit] = useState(0);
  const [cOthf, setCOthf] = useState(0);
  const [cFreight, setCFreight] = useState(0);
  const [cHandling, setCHandling] = useState(0); // por kg
  const [cOrigin, setCOrigin] = useState(0);
  const [cAduana, setCAduana] = useState(0);
  const [cInsp, setCInsp] = useState(0);
  const [cItbms, setCItbms] = useState(0); // %
  const [cOther, setCOther] = useState(0); // ✅ nuevo

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

    // hydrate editor
    setBoxes(n(json.boxes));
    setWeightKg(n(json.weight_kg));
    setMargin(n(json.margin_markup));
    setMode((json.mode || "AIR") as any);
    setCurrency((json.currency || "USD") as any);
    setDestination(String(json.destination || ""));
    setPaymentTerms(String(json.payment_terms || ""));
    setTerms(String(json.terms || ""));

    const costs = json.costs || {};
    setCFruit(n(costs.c_fruit));
    setCOthf(n(costs.c_othf));
    setCFreight(n(costs.c_freight));
    setCHandling(n(costs.c_handling));
    setCOrigin(n(costs.c_origin));
    setCAduana(n(costs.c_aduana));
    setCInsp(n(costs.c_insp));
    setCItbms(n(costs.c_itbms));
    setCOther(n(costs.c_other)); // ✅ nuevo

    setLoading(false);
  }

  useEffect(() => {
    if (!authOk) return;
    if (typeof id !== "string") return;
    load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOk, id]);

  // ===== CÁLCULO (base + venta) =====
  const computed = useMemo(() => {
    const b = Math.max(0, n(boxes));
    const w = Math.max(0, n(weightKg));
    const m = n(margin) / 100;

    // p1: fruta
    const p1 = b * n(cFruit);

    // p2: logística internacional
    const p2 = n(cFreight) + n(cOthf);

    // p3: origen + aduana + handling + itbms + otros
    const handlingTotal = w * n(cHandling);
    const itbmsBase = n(cOrigin) + handlingTotal;
    const itbmsVal = itbmsBase * (n(cItbms) / 100);
    const p3 = n(cAduana) + n(cOrigin) + handlingTotal + itbmsVal + n(cOther);

    // p4: inspección
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

    // items para PDF detallado
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
        incoterm: "CIP",
        place: destination || "—",
        per_box: computed.perBox,
        per_kg: computed.perKg,
        weight_kg: n(weightKg),
        boxes: n(boxes),
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

  async function downloadPdf(opts: { variant: "1" | "2"; lang: UiLang; report?: boolean }) {
    if (!data) return;

    // Asegura que exportas lo último guardado
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

  if (!authOk) {
    return (
      <AdminLayout title="Cotización" subtitle="Verificando permisos…">
        <div className="ff-card2">Cargando…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cotización" subtitle="Editor (solo admin) + PDFs ES/EN.">
      <div className="ff-spread2" style={{ marginBottom: 12 }}>
        <Link href="/admin/quotes" className="ff-btnSmall">
          <ArrowLeft size={16} />
          Volver
        </Link>

        <div className="ff-row2" style={{ gap: 8 }}>
          <button className="ff-btnSmall" type="button" onClick={() => setUiLang(uiLang === "es" ? "en" : "es")}>
            Idioma: {uiLang.toUpperCase()}
          </button>

          <button className="ff-primary" type="button" disabled={busy || loading} onClick={save}>
            <Save size={16} /> Guardar
          </button>
        </div>
      </div>

      {toast ? (
        <div className="msgOk" style={{ marginBottom: 12 }}>
          {toast}
        </div>
      ) : null}

      <div className="ff-card2" style={{ padding: 12 }}>
        {loading ? (
          <div className="muted">Cargando…</div>
        ) : error ? (
          <div className="msgWarn">{error}</div>
        ) : data ? (
          <>
            <div style={{ fontWeight: 950, fontSize: 15 }}>{data.client_snapshot?.name || "Cliente sin nombre"}</div>
            <div className="muted" style={{ marginTop: 4 }}>
              {data.client_snapshot?.contact_email || "—"}
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="grid2">
              <div className="ff-card2 soft">
                <div className="sectionTitle">Configuración</div>

                <div className="row2">
                  <div>
                    <label className="lbl">Modo</label>
                    <select className="in2" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                      <option value="AIR">AÉREO</option>
                      <option value="SEA">MARÍTIMO</option>
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Moneda</label>
                    <select className="in2" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                <div className="row2">
                  <div>
                    <label className="lbl">Destino</label>
                    <input className="in2" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ej: Madrid (MAD)" />
                  </div>
                  <div>
                    <label className="lbl">Cajas</label>
                    <input className="in2" type="number" value={boxes} onChange={(e) => setBoxes(Number(e.target.value || 0))} />
                  </div>
                </div>

                <div className="row2">
                  <div>
                    <label className="lbl">Peso Kg (Bruto) *</label>
                    <input className="in2" type="number" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <label className="lbl">Markup %</label>
                    <input className="in2" type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value || 0))} />
                  </div>
                </div>

                <div className="row2">
                  <div>
                    <label className="lbl">Condiciones de pago</label>
                    <input className="in2" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Ej: 80% Advance / 20% BL" />
                  </div>
                  <div>
                    <label className="lbl">Estado</label>
                    <input className="in2" value={data.status} disabled />
                  </div>
                </div>
              </div>

              <div className="ff-card2">
                <div className="sectionTitle">Estructura de venta</div>

                <table className="pl">
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
                        <td style={{ textAlign: "left", fontWeight: 800 }}>{lineLabel(r.key, uiLang)}</td>
                        <td style={{ textAlign: "right" }}>{money(r.cost)}</td>
                        <td style={{ textAlign: "right", fontWeight: 900 }}>{money(r.sale)}</td>
                        <td style={{ textAlign: "right", color: "var(--ff-green-dark)", fontWeight: 900 }}>+{money(r.sale - r.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="totRow">
                      <td style={{ textAlign: "left" }}>TOTAL CIP</td>
                      <td style={{ textAlign: "right" }}>{money(computed.costTotal)}</td>
                      <td style={{ textAlign: "right" }}>{money(computed.saleTotal)}</td>
                      <td style={{ textAlign: "right" }}>+{money(computed.profitTotal)}</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="muted" style={{ marginTop: 10 }}>
                  Margen real: <b>{computed.realMargin.toFixed(1)}%</b> · {money(computed.perBox)} / caja · {money(computed.perKg)} / kg
                </div>

                <div className="ff-divider" style={{ margin: "12px 0" }} />

                <div className="row2">
                  <button className="ff-btnSmall" type="button" disabled={busy} onClick={() => downloadPdf({ variant: "1", lang: "es" })}>
                    <FileText size={16} /> PDF Simple (ES)
                  </button>
                  <button className="ff-btnSmall" type="button" disabled={busy} onClick={() => downloadPdf({ variant: "1", lang: "en" })}>
                    <FileText size={16} /> PDF Simple (EN)
                  </button>
                </div>

                <div className="row2" style={{ marginTop: 8 }}>
                  <button className="ff-btnSmall" type="button" disabled={busy} onClick={() => downloadPdf({ variant: "2", lang: "es" })}>
                    <FileText size={16} /> PDF Detallado (ES)
                  </button>
                  <button className="ff-btnSmall" type="button" disabled={busy} onClick={() => downloadPdf({ variant: "2", lang: "en" })}>
                    <FileText size={16} /> PDF Detallado (EN)
                  </button>
                </div>

                <div className="row2" style={{ marginTop: 8 }}>
                  <button className="ff-primary" type="button" disabled={busy} onClick={() => downloadPdf({ variant: "2", lang: "es", report: true })}>
                    <FileText size={16} /> PDF Interno (ES)
                  </button>
                  <button className="ff-primary" type="button" disabled={busy} onClick={() => downloadPdf({ variant: "2", lang: "en", report: true })}>
                    <FileText size={16} /> PDF Interno (EN)
                  </button>
                </div>
              </div>
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="ff-card2">
              <div className="sectionTitle">Términos y condiciones</div>
              <textarea className="ta" rows={6} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="ff-card2">
              <div className="ff-spread2" style={{ alignItems: "center" }}>
                <div className="sectionTitle">Costos detallados (solo admin)</div>
                <button className="ff-btnSmall" type="button" onClick={() => setShowCosts(!showCosts)}>
                  {showCosts ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              {showCosts ? (
                <div style={{ marginTop: 10 }}>
                  <div className="row2">
                    <div>
                      <label className="lbl">Piña ($/caja)</label>
                      <input className="in2" type="number" step="0.01" value={cFruit} onChange={(e) => setCFruit(Number(e.target.value || 0))} />
                    </div>
                    <div>
                      <label className="lbl">OTHF ($)</label>
                      <input className="in2" type="number" step="0.01" value={cOthf} onChange={(e) => setCOthf(Number(e.target.value || 0))} />
                    </div>
                  </div>

                  <div className="row2">
                    <div>
                      <label className="lbl">Flete ($)</label>
                      <input className="in2" type="number" step="0.01" value={cFreight} onChange={(e) => setCFreight(Number(e.target.value || 0))} />
                    </div>
                    <div>
                      <label className="lbl">Handling / Kg</label>
                      <input className="in2" type="number" step="0.01" value={cHandling} onChange={(e) => setCHandling(Number(e.target.value || 0))} />
                    </div>
                  </div>

                  <div className="row2">
                    <div>
                      <label className="lbl">Gastos origen ($)</label>
                      <input className="in2" type="number" step="0.01" value={cOrigin} onChange={(e) => setCOrigin(Number(e.target.value || 0))} />
                    </div>
                    <div>
                      <label className="lbl">Aduana ($)</label>
                      <input className="in2" type="number" step="0.01" value={cAduana} onChange={(e) => setCAduana(Number(e.target.value || 0))} />
                    </div>
                  </div>

                  <div className="row2">
                    <div>
                      <label className="lbl">Inspección ($)</label>
                      <input className="in2" type="number" step="0.01" value={cInsp} onChange={(e) => setCInsp(Number(e.target.value || 0))} />
                    </div>
                    <div>
                      <label className="lbl">ITBMS (%)</label>
                      <input className="in2" type="number" step="0.01" value={cItbms} onChange={(e) => setCItbms(Number(e.target.value || 0))} />
                    </div>
                  </div>

                  <div className="row2">
                    <div>
                      <label className="lbl">Otros gastos ($)</label>
                      <input className="in2" type="number" step="0.01" value={cOther} onChange={(e) => setCOther(Number(e.target.value || 0))} />
                    </div>
                    <div />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="muted">
              Creada: {fmtDateTime(data.created_at)} · Última actualización: {fmtDateTime(data.updated_at)}
            </div>
          </>
        ) : null}
      </div>

      <style jsx>{`
        .grid2 { display: grid; gap: 12px; grid-template-columns: 1fr; }
        @media (min-width: 1100px) { .grid2 { grid-template-columns: 1fr 1fr; } }

        .row2 { display: grid; gap: 10px; grid-template-columns: 1fr; }
        @media (min-width: 980px) { .row2 { grid-template-columns: 1fr 1fr; } }

        .sectionTitle { font-weight: 950; font-size: 13px; }
        .lbl { display:block; font-size: 12px; font-weight: 900; color: var(--ff-muted); margin-bottom: 6px; }
        .in2 {
          width: 100%; height: 38px; border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius); padding: 0 10px; font-size: 13px; outline: none; background: #fff;
        }
        .ta {
          width: 100%;
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          padding: 10px;
          font-size: 13px;
          outline: none;
          background: #fff;
        }
        .muted { font-size: 12px; color: var(--ff-muted); }
        .soft { background: rgba(15,23,42,.02); }

        .pl { width: 100%; border-collapse: collapse; }
        .pl th { font-size: 12px; color: var(--ff-muted); padding: 10px 8px; border-bottom: 1px solid rgba(15,23,42,.06); }
        .pl td { padding: 10px 8px; border-bottom: 1px solid rgba(15,23,42,.06); font-size: 13px; }
        .totRow td { background: rgba(15,23,42,.02); font-weight: 950; }

        .msgWarn {
          border: 1px solid rgba(209,119,17,.35);
          background: rgba(209,119,17,.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
          font-weight: 800;
        }
        .msgOk {
          border: 1px solid rgba(31,122,58,.3);
          background: rgba(31,122,58,.08);
          border-radius: var(--ff-radius);
          padding: 10px;
          font-weight: 900;
          font-size: 12px;
        }
      `}</style>
    </AdminLayout>
  );
}
