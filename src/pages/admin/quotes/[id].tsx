// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  FileText,
  Settings2,
  CheckCircle2,
  Send,
  XCircle,
  Archive,
  Plus,
  Trash2,
} from "lucide-react";

import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

type DbClient = {
  id?: string;
  name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
};

type QuoteRecord = {
  id: string;
  created_at: string;
  updated_at: string;

  created_by: string;
  client_id?: string | null;
  status: string;

  mode: "AIR" | "SEA";
  currency: "USD" | "EUR";
  destination: string;
  boxes: number;
  weight_kg?: number | null;
  margin_markup: number;

  payment_terms?: string | null;
  terms?: string | null;

  client_snapshot: any;
  costs: any;
  totals: any;

  clients?: DbClient | null;
};

type QuoteItem = {
  id: string; // uuid simple client-side
  name: string; // "Piña MD2 Golden Premium"
  uom: "Caja";
  qty: number; // cajas
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PA");
  } catch {
    return String(iso);
  }
}

function statusLabel(v: string) {
  const s = String(v || "").toLowerCase();
  return s === "draft"
    ? "Borrador"
    : s === "sent"
    ? "Enviada"
    : s === "won"
    ? "Ganada"
    : s === "lost"
    ? "Perdida"
    : "Archivada";
}

const EUR_RATE = 0.92;

// Rates
const airRates: Record<string, { name: string; rates: Record<number, number> }> = {
  AMS: { name: "Amsterdam (AMS)", rates: { 1000: 1.2, 2500: 1.12 } },
  MAD: { name: "Madrid (MAD)", rates: { 1000: 0.96, 2500: 1.06 } },
  CDG: { name: "París (CDG)", rates: { 1000: 1.2, 2500: 1.15 } },
  WAW: { name: "Varsovia (WAW)", rates: { 1000: 1.4, 2500: 1.35 } },
};

const seaRates: Record<string, { name: string; flat: number }> = {
  RTM: { name: "Rotterdam (Sea)", flat: 3318.95 },
};

const INCOTERMS = ["EXW", "FCA", "FOB", "CIF", "CIP"] as const;
type Incoterm = (typeof INCOTERMS)[number];

const DEFAULT_TERMS = `1. Validez de la oferta: 7 días calendario a partir de la fecha de emisión.
2. Sujeto a disponibilidad de espacio en aerolínea/naviera al momento de la reserva.
3. Pago: Según los "Payment Terms" indicados arriba.
4. Incoterm: CIP (Carriage and Insurance Paid to) Puerto/Aeropuerto Destino.
5. Calidad: Premium Golden MD2 Export Grade (Color 2.75-3, Calibre 5-6, High Brix 13+).
6. Tiempos de Tránsito: Estimados según itinerario del transportista y trámites aduanales.
7. Los costos en origen incluyen: Documentación, Inspección Fito, Aduana Panamá y Reporte de calidad de la carga.`;

type CostsState = {
  c_fruit: number;
  c_othf: number;
  c_freight: number;
  c_handling: number;
  c_origin: number;
  c_aduana: number;
  c_insp: number;
  c_itbms: number;
  c_wbox: number;
  c_wpallet: number;
  c_bpallet: number;
};

function defaultsForMode(mode: "AIR" | "SEA"): CostsState {
  if (mode === "SEA") {
    return {
      c_fruit: 9.25,
      c_othf: 15,
      c_freight: 3318.95,
      c_handling: 0,
      c_origin: 35,
      c_aduana: 275,
      c_insp: 100,
      c_itbms: 7.4,
      c_wbox: 13.0,
      c_wpallet: 20,
      c_bpallet: 40,
    };
  }
  return {
    c_fruit: 13.3,
    c_othf: 15,
    c_freight: 0,
    c_handling: 0.03,
    c_origin: 412,
    c_aduana: 275,
    c_insp: 100,
    c_itbms: 7.4,
    c_wbox: 13.0,
    c_wpallet: 20,
    c_bpallet: 40,
  };
}

type PdfVariant = "1" | "2"; // 1: Simple, 2: Detallada

export default function AdminQuoteDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [quote, setQuote] = useState<QuoteRecord | null>(null);

  // Editable fields
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [destination, setDestination] = useState("MAD");
  const [boxes, setBoxes] = useState<number>(200); // total cajas (derivado de items)
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [margin, setMargin] = useState<number>(15);

  const [paymentTerms, setPaymentTerms] = useState<string>("");
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [costs, setCosts] = useState<CostsState>(defaultsForMode("AIR"));

  const [status, setStatus] = useState<string>("draft");

  // --- meta de oferta / PDF ---
  const [incoterm, setIncoterm] = useState<Incoterm>("CIP");
  const [place, setPlace] = useState<string>(""); // aeropuerto/puerto destino
  const [pdfLang, setPdfLang] = useState<"es" | "en">("es");
  const [pdfVariant, setPdfVariant] = useState<PdfVariant>("1"); // NEW: Simple/Detallada
  const [pdfBusy, setPdfBusy] = useState(false);

  // --- items ---
  const [items, setItems] = useState<QuoteItem[]>([
    { id: uid(), name: "Piña MD2 Golden Premium", uom: "Caja", qty: 200 },
  ]);

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

    const json = (await res.json()) as QuoteRecord;
    setQuote(json);

    setMode(json.mode);
    setCurrency(json.currency);
    setDestination(json.destination || (json.mode === "SEA" ? "RTM" : "MAD"));
    setBoxes(Number(json.boxes || 0) || 200);
    setWeightKg(json.weight_kg ?? null);
    setMargin(Number(json.margin_markup ?? 15) || 15);
    setPaymentTerms(json.payment_terms ?? "");
    setTerms((json.terms ?? "").trim() || DEFAULT_TERMS);
    setStatus(json.status || "draft");

    // costs
    const base = defaultsForMode(json.mode);
    const saved = (json.costs ?? {}) as Partial<CostsState>;
    setCosts({ ...base, ...saved });

    // meta + items (desde totals)
    const meta = (json.totals?.meta ?? {}) as any;
    const savedInc = (meta.incoterm as Incoterm) || "CIP";
    setIncoterm(INCOTERMS.includes(savedInc) ? savedInc : "CIP");

    const destName =
      json.mode === "AIR" ? airRates[json.destination]?.name : seaRates[json.destination]?.name;

    setPlace(String(meta.place || destName || json.destination || "").trim());

    const lang = String(meta.pdf_lang || "es").toLowerCase();
    setPdfLang(lang === "en" ? "en" : "es");

    const v = String(meta.pdf_variant || "1").trim();
    setPdfVariant(v === "2" ? "2" : "1");

    const savedItems = Array.isArray(json.totals?.items) ? json.totals.items : null;
    if (savedItems && savedItems.length) {
      const norm: QuoteItem[] = savedItems.map((it: any) => ({
        id: String(it.id || uid()),
        name: String(it.name || "Item"),
        uom: "Caja",
        qty: Number(it.qty || 0) || 0,
      }));
      setItems(norm);
    } else {
      setItems([
        { id: uid(), name: "Piña MD2 Golden Premium", uom: "Caja", qty: Number(json.boxes || 200) || 200 },
      ]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!authOk) return;
    if (typeof id === "string") load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOk, id]);

  // defaults al cambiar modo + destino coherente
  useEffect(() => {
    setCosts((prev) => {
      const base = defaultsForMode(mode);
      return { ...base, ...prev };
    });

    if (mode === "SEA" && !seaRates[destination]) setDestination("RTM");
    if (mode === "AIR" && !airRates[destination]) setDestination("MAD");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // total cajas = sum items (siempre)
  useEffect(() => {
    const total = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
    setBoxes(total > 0 ? total : 0);
  }, [items]);

  // autoplace si está vacío
  useEffect(() => {
    const destName = mode === "AIR" ? airRates[destination]?.name : seaRates[destination]?.name;
    if (!place) setPlace(destName || destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, mode]);

  // --- Calculations (misma lógica, usando boxes total) ---
  const calc = useMemo(() => {
    const b = Number.isFinite(boxes) && boxes > 0 ? boxes : 0;

    const wbox = Number(costs.c_wbox || 0);
    const bpallet = Math.max(1, Number(costs.c_bpallet || 1));
    const wpallet = Number(costs.c_wpallet || 0);

    const computedWeight = b > 0 ? b * wbox + Math.ceil(b / bpallet) * wpallet : 0;
    const w = weightKg != null && weightKg > 0 ? weightKg : computedWeight;

    const p1 = b * Number(costs.c_fruit || 0);

    let p2 = 0;
    if (mode === "AIR") {
      const r = airRates[destination];
      const perKg = r ? (w >= 2500 ? r.rates[2500] : r.rates[1000]) : 0;
      p2 = w * perKg + Number(costs.c_othf || 0);
    } else {
      p2 = Number(costs.c_freight || 0) + Number(costs.c_othf || 0);
    }

    const originBase = Number(costs.c_origin || 0) + w * Number(costs.c_handling || 0);
    const itbms = originBase * (Number(costs.c_itbms || 0) / 100);
    const p3 = Number(costs.c_aduana || 0) + originBase + itbms;

    const p4 = Number(costs.c_insp || 0);

    const totalCost = p1 + p2 + p3 + p4;

    const sale1 = p1 * (1 + margin / 100);
    const sale2 = p2 * (1 + margin / 100);
    const sale3 = p3 * (1 + margin / 100);
    const sale4 = p4 * (1 + margin / 100);
    const totalSale = sale1 + sale2 + sale3 + sale4;

    const profit = totalSale - totalCost;
    const realMargin = totalSale > 0 ? (profit / totalSale) * 100 : 0;

    const perBox = b > 0 ? totalSale / b : 0;
    const perKg = w > 0 ? totalSale / w : 0;

    const fx = currency === "EUR" ? EUR_RATE : 1;

    return {
      boxes: b,
      weight: w,
      computedWeight,
      breakdown: [
        { label: "1. Fruit Value (FOB/FCA)", cost: p1, sale: sale1 },
        { label: "2. International Logistics", cost: p2, sale: sale2 },
        { label: "3. Origin Charges & Customs", cost: p3, sale: sale3 },
        { label: "4. Inspection & Quality", cost: p4, sale: sale4 },
      ],
      totalCost,
      totalSale,
      profit,
      realMargin,
      perBox,
      perKg,
      fx,
    };
  }, [boxes, weightKg, costs, margin, mode, destination, currency]);

  function fmtMoney(v: number) {
    const fx = currency === "EUR" ? EUR_RATE : 1;
    const sym = currency === "EUR" ? "€" : "$";
    const val = (v || 0) * fx;
    return `${sym} ${val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function fmtPlainNumber(v: number) {
    return (v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  async function savePatch(patch: any, silent?: boolean) {
    if (!quote?.id) return;
    setSaving(true);
    setToast(null);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) {
      setSaving(false);
      return;
    }

    const body = { id: quote.id, ...patch };

    const res = await fetch("/.netlify/functions/updateQuote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const t = await res.text().catch(() => "");
    setSaving(false);

    if (!res.ok) {
      setError(t || "No se pudo guardar");
      return;
    }

    if (!silent) {
      setToast("Guardado ✔");
      setTimeout(() => setToast(null), 1200);
    }

    await load(quote.id);
  }

  async function saveAll() {
    const clientName = quote?.clients?.name || quote?.client_snapshot?.name || null;
    const clientEmail = quote?.clients?.contact_email || quote?.client_snapshot?.contact_email || null;

    const destName = mode === "AIR" ? airRates[destination]?.name : seaRates[destination]?.name;

    const patch = {
      status,
      mode,
      currency,
      destination,
      boxes, // derivado de items
      weight_kg: weightKg,
      margin_markup: margin,
      payment_terms: paymentTerms || null,
      terms: terms || null,
      costs: costs,
      totals: {
        total: calc.totalSale,
        total_cost: calc.totalCost,
        profit: calc.profit,
        margin_pct: calc.realMargin,
        unit_box: calc.perBox,
        unit_kg: calc.perKg,
        weight_kg: calc.weight,
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          uom: it.uom,
          qty: Number(it.qty || 0),
          unit_price: calc.perBox, // prorrateo por caja (por ahora)
          total: Number(it.qty || 0) * calc.perBox,
        })),
        meta: {
          incoterm,
          place: (place || destName || destination || "").trim(),
          pdf_lang: pdfLang,
          pdf_variant: pdfVariant, // NEW
        },
      },
      client_snapshot: {
        ...(quote?.client_snapshot || {}),
        ...(clientName ? { name: clientName } : {}),
        ...(clientEmail ? { contact_email: clientEmail } : {}),
        ...(quote?.clients?.contact_name ? { contact_name: quote.clients.contact_name } : {}),
        ...(quote?.clients?.phone ? { phone: quote.clients.phone } : {}),
        ...(quote?.clients?.country ? { country: quote.clients.country } : {}),
        ...(quote?.clients?.city ? { city: quote.clients.city } : {}),
      },
    };

    await savePatch(patch);
  }

  async function setQuickStatus(next: string) {
    setStatus(next);
    await savePatch({ status: next }, true);
    setToast(`Estado: ${statusLabel(next)}`);
    setTimeout(() => setToast(null), 1200);
  }

  const destOptions = mode === "AIR" ? airRates : seaRates;

  // Items handlers
  function addItem() {
    setItems((prev) => [...prev, { id: uid(), name: "Nuevo item", uom: "Caja", qty: 0 }]);
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((x) => x.id !== itemId));
  }

  function updateItem(itemId: string, patch: Partial<QuoteItem>) {
    setItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, ...patch } : x)));
  }

  function canShowPlaceHint() {
    return incoterm === "CIP" || incoterm === "CIF";
  }

  // Cliente visible
  const clientDisplayName = quote?.clients?.name || quote?.client_snapshot?.name || "—";
  const clientDisplayEmail = quote?.clients?.contact_email || quote?.client_snapshot?.contact_email || "—";

  function inferFilenameFromHeader(contentDisposition: string | null, fallback: string) {
    if (!contentDisposition) return fallback;
    const m = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(contentDisposition);
    if (!m?.[1]) return fallback;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }

  async function generatePdf() {
    if (!quote?.id) return;
    setPdfBusy(true);
    setError(null);
    setToast(null);

    try {
      // 1) guardar todo (incluye meta + items)
      await saveAll();

      // 2) token para auth (esto era la causa del Unauthorized)
      const token = await getTokenOrRedirect();
      if (!token) {
        setPdfBusy(false);
        return;
      }

      // 3) pedir PDF al backend y descargar
      const url =
        `/.netlify/functions/renderQuotePdf` +
        `?id=${encodeURIComponent(quote.id)}` +
        `&variant=${encodeURIComponent(pdfVariant)}` +
        `&lang=${encodeURIComponent(pdfLang)}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `No se pudo generar el PDF (${res.status})`);
      }

      const ab = await res.arrayBuffer();
      const blob = new Blob([ab], { type: "application/pdf" });

      const fallbackName = `cotizacion_${quote.id.slice(0, 8)}_${pdfVariant}_${pdfLang}.pdf`;
      const filename = inferFilenameFromHeader(res.headers.get("content-disposition"), fallbackName);

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);

      setToast("PDF generado ✔");
      setTimeout(() => setToast(null), 1400);
    } catch (e: any) {
      setError(e?.message || "Error generando PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  if (!authOk) return null;

  return (
    <AdminLayout title="Cotización" subtitle="Cotizador (base + costos + items + salida PDF).">
      {/* Toolbar */}
      <div className="toolbar">
        <Link href="/admin/quotes" className="ff-btnSmall">
          <ArrowLeft size={16} />
          Volver
        </Link>

        <div className="toolbarRight">
          <div className="statusPill">{statusLabel(status)}</div>

          <button className="btnGhost" type="button" disabled={saving || pdfBusy} onClick={saveAll}>
            <Save size={16} />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}

      <div className="ff-card2" style={{ padding: 12 }}>
        {loading ? (
          <div className="muted">Cargando…</div>
        ) : error ? (
          <div className="msgWarn">
            <b>Error</b>
            <div>{error}</div>
          </div>
        ) : quote ? (
          <>
            {/* Header compact + cliente visible */}
            <div className="headRow">
              <div>
                <div className="hTitle">
                  Cotización #{quote.id.slice(0, 8)}{" "}
                  <span className="hClient">
                    · {clientDisplayName} <span className="hEmail">({clientDisplayEmail})</span>
                  </span>
                </div>
                <div className="muted">
                  Creada: {fmtDate(quote.created_at)} · Actualizada: {fmtDate(quote.updated_at)}
                </div>
              </div>

              <div className="statusBtns">
                <button className="mini" type="button" onClick={() => setQuickStatus("draft")}>
                  Borrador
                </button>
                <button className="mini" type="button" onClick={() => setQuickStatus("sent")}>
                  <Send size={14} /> Enviar
                </button>
                <button className="mini ok" type="button" onClick={() => setQuickStatus("won")}>
                  <CheckCircle2 size={14} /> Ganada
                </button>
                <button className="mini warn" type="button" onClick={() => setQuickStatus("lost")}>
                  <XCircle size={14} /> Perdida
                </button>
                <button className="mini" type="button" onClick={() => setQuickStatus("archived")}>
                  <Archive size={14} /> Archivar
                </button>
              </div>
            </div>

            <div className="ff-divider" style={{ margin: "10px 0" }} />

            {/* Main grid */}
            <div className="gridMain">
              {/* LEFT */}
              <div>
                <div className="card">
                  <div className="cardTitle">Configuración de oferta</div>
                  <div className="cardSub">Modo + incoterm + destino + moneda + items.</div>

                  <div className="ff-divider" style={{ margin: "10px 0" }} />

                  <div className="modeToggle">
                    <button
                      type="button"
                      className={`modeBtn ${mode === "AIR" ? "active air" : ""}`}
                      onClick={() => setMode("AIR")}
                    >
                      ✈️ AÉREO
                    </button>
                    <button
                      type="button"
                      className={`modeBtn ${mode === "SEA" ? "active sea" : ""}`}
                      onClick={() => setMode("SEA")}
                    >
                      🚢 MARÍTIMO
                    </button>
                  </div>

                  <div style={{ height: 8 }} />

                  {/* Incoterm + place */}
                  <div className="row2">
                    <div>
                      <label className="lbl">Incoterm</label>
                      <select className="in" value={incoterm} onChange={(e) => setIncoterm(e.target.value as Incoterm)}>
                        {INCOTERMS.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="lbl">Place (Destino)</label>
                      <input
                        className="in"
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        placeholder={mode === "AIR" ? "Aeropuerto destino (ej: Madrid – MAD)" : "Puerto destino (ej: Rotterdam – RTM)"}
                      />
                      {canShowPlaceHint() ? (
                        <div className="hint">
                          {incoterm === "CIP"
                            ? "CIP requiere Place of Destination (Aeropuerto/Puerto destino)."
                            : "CIF requiere Port of Destination."}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ height: 8 }} />

                  <div className="row2">
                    <div>
                      <label className="lbl">Destino</label>
                      <select className="in" value={destination} onChange={(e) => setDestination(e.target.value)}>
                        {Object.entries(destOptions).map(([k, v]: any) => (
                          <option key={k} value={k}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="lbl">Moneda</label>
                      <select className="in" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                      </select>
                    </div>
                  </div>

                  <div className="row3" style={{ marginTop: 8 }}>
                    <div>
                      <label className="lbl">Cajas (total)</label>
                      <input className="in" value={String(boxes)} readOnly />
                    </div>
                    <div>
                      <label className="lbl">Peso kg (manual)</label>
                      <input
                        className="in gold"
                        value={weightKg ?? ""}
                        onChange={(e) => {
                          const v = String(e.target.value || "").trim();
                          setWeightKg(v ? Number(v) : null);
                        }}
                        placeholder={`Auto: ${Math.round(calc.computedWeight)} kg`}
                      />
                    </div>
                    <div>
                      <label className="lbl">Markup %</label>
                      <input className="in" value={String(margin)} onChange={(e) => setMargin(Number(e.target.value || 0))} />
                    </div>
                  </div>

                  <div style={{ height: 8 }} />

                  <div>
                    <label className="lbl">Condiciones de pago</label>
                    <input
                      className="in"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder='Ej: 80% Advance / 20% BL'
                    />
                  </div>

                  <div className="ff-divider" style={{ margin: "10px 0" }} />

                  {/* Items */}
                  <div className="spread">
                    <div>
                      <div className="cardTitle">Items</div>
                      <div className="cardSub">Tabla preparada para múltiples productos (unidad: Caja).</div>
                    </div>
                    <button className="btnGhost" type="button" onClick={addItem}>
                      <Plus size={16} />
                      Agregar item
                    </button>
                  </div>

                  <div className="itemsTbl">
                    <div className="itemsHead">
                      <div>Item</div>
                      <div style={{ textAlign: "right" }}>Cantidad (cajas)</div>
                      <div style={{ textAlign: "right" }}>Precio unit.</div>
                      <div style={{ textAlign: "right" }}>Total</div>
                      <div />
                    </div>

                    {items.map((it) => {
                      const qty = Number(it.qty || 0);
                      const unit = calc.perBox; // prorrateo por caja (por ahora)
                      const total = qty * unit;

                      return (
                        <div className="itemsRow" key={it.id}>
                          <input className="in inTight" value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} />
                          <input
                            className="in inTight"
                            style={{ textAlign: "right" }}
                            value={String(qty)}
                            onChange={(e) => updateItem(it.id, { qty: Number(e.target.value || 0) })}
                          />
                          <div className="mono" style={{ textAlign: "right" }}>
                            {fmtMoney(unit)}
                          </div>
                          <div className="mono" style={{ textAlign: "right", fontWeight: 950 }}>
                            {fmtMoney(total)}
                          </div>
                          <button
                            className="iconBtn"
                            type="button"
                            title="Eliminar item"
                            onClick={() => removeItem(it.id)}
                            disabled={items.length <= 1}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="ff-divider" style={{ margin: "10px 0" }} />

                  <div className="cardTitle">Términos & Condiciones</div>
                  <textarea className="ta" rows={6} value={terms} onChange={(e) => setTerms(e.target.value)} />

                  <div className="ff-divider" style={{ margin: "10px 0" }} />

                  <button className="btnGhost" type="button" onClick={() => setAdvancedOpen((v) => !v)}>
                    <Settings2 size={16} />
                    Costos detallados
                  </button>

                  {advancedOpen ? (
                    <div className="adv">
                      <div className="row2">
                        <div>
                          <label className="lbl">Piña (USD/caja)</label>
                          <input className="in" value={costs.c_fruit} onChange={(e) => setCosts({ ...costs, c_fruit: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <label className="lbl">OTHF (USD)</label>
                          <input className="in" value={costs.c_othf} onChange={(e) => setCosts({ ...costs, c_othf: Number(e.target.value || 0) })} />
                        </div>
                      </div>

                      <div className="row2">
                        <div>
                          <label className="lbl">Flete (USD)</label>
                          <input className="in" value={costs.c_freight} onChange={(e) => setCosts({ ...costs, c_freight: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <label className="lbl">Handling/kg</label>
                          <input className="in" value={costs.c_handling} onChange={(e) => setCosts({ ...costs, c_handling: Number(e.target.value || 0) })} />
                        </div>
                      </div>

                      <div className="row2">
                        <div>
                          <label className="lbl">Gastos Origen</label>
                          <input className="in" value={costs.c_origin} onChange={(e) => setCosts({ ...costs, c_origin: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <label className="lbl">Aduana</label>
                          <input className="in" value={costs.c_aduana} onChange={(e) => setCosts({ ...costs, c_aduana: Number(e.target.value || 0) })} />
                        </div>
                      </div>

                      <div className="row2">
                        <div>
                          <label className="lbl">Inspección</label>
                          <input className="in" value={costs.c_insp} onChange={(e) => setCosts({ ...costs, c_insp: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <label className="lbl">ITBMS %</label>
                          <input className="in" value={costs.c_itbms} onChange={(e) => setCosts({ ...costs, c_itbms: Number(e.target.value || 0) })} />
                        </div>
                      </div>

                      <div className="row3">
                        <div>
                          <label className="lbl">Kg/Caja</label>
                          <input className="in" value={costs.c_wbox} onChange={(e) => setCosts({ ...costs, c_wbox: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <label className="lbl">Kg/Pallet</label>
                          <input className="in" value={costs.c_wpallet} onChange={(e) => setCosts({ ...costs, c_wpallet: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <label className="lbl">Cajas/Pallet</label>
                          <input className="in" value={costs.c_bpallet} onChange={(e) => setCosts({ ...costs, c_bpallet: Number(e.target.value || 0) })} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* RIGHT */}
              <div>
                <div className="card">
                  <div className="spread">
                    <div>
                      <div className="cardTitle">Estructura de venta</div>
                      <div className="cardSub">Costos vs venta + margen real.</div>
                    </div>
                    <button className="btnGhost" type="button" disabled={saving || pdfBusy} onClick={saveAll}>
                      <Save size={16} />
                      Guardar
                    </button>
                  </div>

                  <div className="ff-divider" style={{ margin: "10px 0" }} />

                  <div className="tbl">
                    <div className="tblHead">
                      <div>Concepto</div>
                      <div style={{ textAlign: "right" }}>Costo</div>
                      <div style={{ textAlign: "right" }}>Venta</div>
                      <div style={{ textAlign: "right" }}>Ganancia</div>
                    </div>

                    {calc.breakdown.map((r) => (
                      <div key={r.label} className="tblRow">
                        <div className="rowLabel">{r.label}</div>
                        <div style={{ textAlign: "right" }}>{fmtMoney(r.cost)}</div>
                        <div style={{ textAlign: "right", fontWeight: 900 }}>{fmtMoney(r.sale)}</div>
                        <div style={{ textAlign: "right", color: "var(--ff-green-dark)", fontWeight: 900 }}>
                          +{fmtMoney(r.sale - r.cost)}
                        </div>
                      </div>
                    ))}

                    <div className="tblTotal">
                      <div>TOTAL</div>
                      <div style={{ textAlign: "right" }}>{fmtMoney(calc.totalCost)}</div>
                      <div style={{ textAlign: "right" }}>{fmtMoney(calc.totalSale)}</div>
                      <div style={{ textAlign: "right" }}>{fmtMoney(calc.profit)}</div>
                    </div>
                  </div>

                  <div className="traffic">
                    <div className="trafficLeft">
                      <div className="muted" style={{ fontWeight: 900 }}>
                        MARGEN REAL
                      </div>
                      <div className="mVal">{calc.realMargin.toFixed(1)}%</div>
                    </div>
                    <div className="trafficRight">
                      <div className="muted" style={{ fontWeight: 900 }}>
                        UNIDADES
                      </div>
                      <div className="units">
                        <span>{fmtMoney(calc.perBox)} / caja</span>
                        <span>{fmtMoney(calc.perKg)} / kg</span>
                        <span>{fmtPlainNumber(calc.weight)} kg</span>
                      </div>
                    </div>
                  </div>

                  <div className="ff-divider" style={{ margin: "10px 0" }} />

                  {/* PDF controls */}
                  <div className="pdfBox">
                    <div className="pdfTop">
                      <div>
                        <div className="pdfTitle">Salida PDF</div>
                        <div className="muted">Selecciona tipo + idioma y descarga el PDF listo.</div>
                      </div>

                      <div className="pdfTopRight">
                        <div className="seg">
                          <button
                            type="button"
                            className={`segBtn ${pdfVariant === "1" ? "active" : ""}`}
                            onClick={() => setPdfVariant("1")}
                            title="Simple"
                          >
                            Simple
                          </button>
                          <button
                            type="button"
                            className={`segBtn ${pdfVariant === "2" ? "active" : ""}`}
                            onClick={() => setPdfVariant("2")}
                            title="Detallada"
                          >
                            Detallada
                          </button>
                        </div>

                        <div className="langPills">
                          <button
                            type="button"
                            className={`langBtn ${pdfLang === "es" ? "active" : ""}`}
                            onClick={() => setPdfLang("es")}
                            title="Español"
                          >
                            🇪🇸 ES
                          </button>
                          <button
                            type="button"
                            className={`langBtn ${pdfLang === "en" ? "active" : ""}`}
                            onClick={() => setPdfLang("en")}
                            title="English"
                          >
                            🇬🇧 EN
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pdfRow">
                      <div>
                        <div className="muted" style={{ fontWeight: 900 }}>
                          TOTAL {incoterm}
                        </div>
                        <div className="pdfTotal">{fmtMoney(calc.totalSale)}</div>
                      </div>

                      <button
                        className="btnPrimary"
                        type="button"
                        onClick={generatePdf}
                        disabled={saving || pdfBusy}
                        title="Guarda y descarga el PDF"
                      >
                        <FileText size={16} />
                        {pdfBusy ? "Generando…" : "Generar PDF"}
                      </button>
                    </div>

                    <div className="pdfSub">
                      <span className="mono">Tipo:</span> {pdfVariant === "1" ? "Simple" : "Detallada"} ·{" "}
                      <span className="mono">Idioma:</span> {pdfLang.toUpperCase()} ·{" "}
                      <span className="mono">Incoterm:</span> {incoterm} · <span className="mono">Place:</span> {place || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <style jsx>{`
        label.lbl {
          display: block;
          font-size: 10px;
          font-weight: 950;
          color: var(--ff-muted);
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.35px;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .toolbarRight {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .statusPill {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 950;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.1);
          white-space: nowrap;
        }

        .toast {
          margin-bottom: 10px;
          border-radius: var(--ff-radius);
          padding: 9px 10px;
          font-size: 12px;
          font-weight: 950;
          border: 1px solid rgba(31, 122, 58, 0.28);
          background: rgba(31, 122, 58, 0.08);
          color: var(--ff-green-dark);
        }

        .btnGhost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--ff-border);
          background: #fff;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          color: var(--ff-text);
          white-space: nowrap;
        }
        .btnGhost:hover {
          background: rgba(15, 23, 42, 0.02);
        }

        .btnPrimary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(31, 122, 58, 0.35);
          background: var(--ff-green);
          color: #fff;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .btnPrimary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .headRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .hTitle {
          font-weight: 950;
          font-size: 16px;
          letter-spacing: -0.25px;
          line-height: 1.15;
        }
        .hClient {
          font-weight: 800;
          font-size: 12px;
          color: var(--ff-muted);
        }
        .hEmail {
          font-weight: 800;
          color: var(--ff-muted);
        }

        .statusBtns {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .mini {
          height: 32px;
          padding: 0 10px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .mini.ok {
          border-color: rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.06);
          color: var(--ff-green-dark);
        }
        .mini.warn {
          border-color: rgba(209, 119, 17, 0.24);
          background: rgba(209, 119, 17, 0.08);
          color: #7a3f00;
        }

        .gridMain {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1100px) {
          .gridMain {
            grid-template-columns: 1fr 1.1fr;
          }
        }

        .card {
          background: var(--ff-surface);
          border: 1px solid var(--ff-border);
          border-radius: 14px;
          box-shadow: var(--ff-shadow);
          padding: 12px;
        }
        .cardTitle {
          font-weight: 950;
          font-size: 14px;
          letter-spacing: -0.2px;
        }
        .cardSub {
          margin-top: 3px;
          font-size: 12px;
          color: var(--ff-muted);
        }

        .spread {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .modeToggle {
          display: flex;
          gap: 10px;
        }
        .modeBtn {
          flex: 1;
          height: 38px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          font-weight: 950;
          cursor: pointer;
        }
        .modeBtn.active.air {
          border-color: rgba(31, 122, 58, 0.3);
          background: rgba(31, 122, 58, 0.06);
          color: var(--ff-green-dark);
        }
        .modeBtn.active.sea {
          border-color: rgba(2, 119, 189, 0.3);
          background: rgba(2, 119, 189, 0.06);
          color: rgba(2, 119, 189, 1);
        }

        .row2 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .row2 {
            grid-template-columns: 1fr 1fr;
          }
        }

        .row3 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .row3 {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .in {
          width: 100%;
          height: 36px;
          border: 1px solid var(--ff-border);
          border-radius: 12px;
          padding: 0 10px;
          font-size: 13px;
          outline: none;
          background: #fff;
        }
        .inTight {
          height: 34px;
          border-radius: 12px;
        }
        .in.gold {
          border: 2px solid rgba(251, 191, 36, 0.7);
          background: rgba(255, 253, 242, 1);
          font-weight: 950;
        }

        .hint {
          margin-top: 6px;
          font-size: 11px;
          font-weight: 800;
          color: var(--ff-muted);
        }

        .ta {
          width: 100%;
          border: 1px solid var(--ff-border);
          border-radius: 12px;
          padding: 10px;
          font-size: 13px;
          outline: none;
          background: #fff;
          resize: vertical;
        }

        .adv {
          margin-top: 10px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(15, 23, 42, 0.02);
          border-radius: 14px;
          padding: 10px;
        }

        .tbl {
          display: grid;
          gap: 6px;
        }
        .tblHead,
        .tblRow,
        .tblTotal {
          display: grid;
          grid-template-columns: 1.8fr 0.6fr 0.6fr 0.6fr;
          gap: 10px;
          align-items: center;
        }
        .tblHead {
          font-size: 10px;
          font-weight: 950;
          color: var(--ff-muted);
          text-transform: uppercase;
          letter-spacing: 0.35px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }
        .tblRow {
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #fff;
          border-radius: 14px;
          padding: 10px;
          font-size: 12px;
        }
        .rowLabel {
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tblTotal {
          border-radius: 14px;
          padding: 10px;
          font-size: 12px;
          font-weight: 950;
          background: rgba(15, 23, 42, 0.03);
          border: 1px solid rgba(15, 23, 42, 0.1);
          margin-top: 4px;
        }

        .traffic {
          margin-top: 10px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(15, 23, 42, 0.02);
          padding: 10px;
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .traffic {
            grid-template-columns: 0.7fr 1.3fr;
            align-items: center;
          }
        }
        .mVal {
          font-weight: 950;
          font-size: 18px;
          letter-spacing: -0.3px;
        }
        .units {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-weight: 900;
          font-size: 12px;
        }

        .itemsTbl {
          margin-top: 10px;
          display: grid;
          gap: 8px;
        }
        .itemsHead,
        .itemsRow {
          display: grid;
          grid-template-columns: 1.5fr 0.5fr 0.6fr 0.6fr 36px;
          gap: 10px;
          align-items: center;
        }
        .itemsHead {
          font-size: 10px;
          font-weight: 950;
          color: var(--ff-muted);
          text-transform: uppercase;
          letter-spacing: 0.35px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }
        .itemsRow {
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #fff;
          border-radius: 14px;
          padding: 10px;
          font-size: 12px;
        }
        .iconBtn {
          height: 34px;
          width: 34px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: #fff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .iconBtn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pdfBox {
          border-radius: 14px;
          border: 1px solid rgba(31, 122, 58, 0.18);
          background: rgba(31, 122, 58, 0.05);
          padding: 12px;
        }
        .pdfTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pdfTopRight {
          display: inline-flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .pdfRow {
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pdfTitle {
          font-weight: 950;
          font-size: 13px;
        }
        .pdfTotal {
          font-weight: 950;
          font-size: 22px;
          color: var(--ff-green-dark);
          letter-spacing: -0.3px;
          line-height: 1;
          margin-top: 4px;
        }
        .pdfSub {
          margin-top: 10px;
          font-size: 12px;
          color: var(--ff-muted);
          font-weight: 800;
        }

        .langPills {
          display: inline-flex;
          gap: 8px;
        }
        .langBtn {
          height: 34px;
          padding: 0 10px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: #fff;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .langBtn.active {
          border-color: rgba(31, 122, 58, 0.3);
          background: rgba(31, 122, 58, 0.1);
          color: var(--ff-green-dark);
        }

        .seg {
          display: inline-flex;
          gap: 6px;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 12px;
          padding: 6px;
        }
        .segBtn {
          height: 34px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          color: var(--ff-text);
          white-space: nowrap;
        }
        .segBtn.active {
          background: #fff;
          border-color: rgba(15, 23, 42, 0.1);
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
            monospace;
        }
        .muted {
          font-size: 12px;
          color: var(--ff-muted);
        }
        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: 14px;
          font-size: 12px;
        }
        .ff-btnSmall {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--ff-border);
          background: #fff;
          border-radius: 12px;
          height: 34px;
          padding: 0 10px;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
          text-decoration: none;
          color: var(--ff-text);
          white-space: nowrap;
        }
      `}</style>
    </AdminLayout>
  );
}