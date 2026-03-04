// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Save, FileText, Package, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
  quote_number?: string | null;
  client_id: string;
  client_snapshot?: { name?: string; contact_email?: string; tax_id?: string } | null;
  totals?: Record<string, any>;
  costs?: Record<string, any>;
  quote_year?: number | null;
  quote_seq?: number | null;
  shipment_id?: string | null; // Para verificar si ya existe un embarque
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

const DEFAULT_TERMS_ES = `TÉRMINOS Y CONDICIONES – EXPORTACIÓN DE PIÑA (Fresh Food Panamá)...`; // (Se mantiene tu texto de términos)

export default function AdminQuoteDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [data, setData] = useState<QuoteDetail | null>(null);

  // Estados Editables
  const [status, setStatus] = useState<QuoteDetail["status"]>("draft");
  const [uiLang, setUiLang] = useState<UiLang>("es");
  const [pdfVariant, setPdfVariant] = useState<PdfVariant>("1");
  const [pdfLang, setPdfLang] = useState<UiLang>("es");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [margin, setMargin] = useState<number>(15);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [incoterm, setIncoterm] = useState<Incoterm>("CIP");
  const [place, setPlace] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [terms, setTerms] = useState("");

  // Costos
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
    setTimeout(() => setToast(null), 2500);
  }

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  }

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function load(quoteId: string) {
    setLoading(true);
    const token = await getToken();
    if (!token) return;

    const res = await fetch(`/.netlify/functions/getQuote?id=${encodeURIComponent(quoteId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setError("Error cargando datos");
      setLoading(false);
      return;
    }

    const json = (await res.json()) as QuoteDetail;
    setData(json);
    setStatus(json.status);
    setBoxes(Number(json.boxes || 0));
    setWeightKg(Number(json.weight_kg || 0));
    setMargin(Number(json.margin_markup || 0));
    setMode(json.mode || "AIR");
    setCurrency(json.currency || "USD");
    setPaymentTerms(json.payment_terms || "");
    setTerms(json.terms?.trim() ? json.terms : DEFAULT_TERMS_ES);

    const meta = (json.totals as any)?.meta || {};
    setIncoterm(meta.incoterm || "CIP");
    setPlace(meta.place || json.destination || "");

    const c = json.costs || {};
    setCFruit(Number(c.c_fruit || 0));
    setCOthf(Number(c.c_othf || 0));
    setCFreight(Number(c.c_freight || 0));
    setCHandling(Number(c.c_handling || 0));
    setCOrigin(Number(c.c_origin || 0));
    setCAduana(Number(c.c_aduana || 0));
    setCInsp(Number(c.c_insp || 0));
    setCItbms(Number(c.c_itbms || 0));
    setCOther(Number(c.c_other || 0));
    setLoading(false);
  }

  useEffect(() => {
    if (authOk && typeof id === "string") load(id);
  }, [authOk, id]);

  const computed = useMemo(() => {
    const b = Math.max(0, boxes);
    const w = Math.max(0, weightKg);
    const m = margin / 100;

    const p1 = b * cFruit;
    const p2 = cFreight + cOthf;
    const handlingTotal = w * cHandling;
    const itbmsVal = (cOrigin + handlingTotal) * (cItbms / 100);
    const p3 = cAduana + cOrigin + handlingTotal + itbmsVal + cOther;
    const p4 = cInsp;

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

    return {
      rows: saleRows,
      costTotal,
      saleTotal,
      profitTotal,
      marginOnSale: saleTotal > 0 ? (profitTotal / saleTotal) * 100 : 0,
      markupOnCost: costTotal > 0 ? (profitTotal / costTotal) * 100 : 0,
      perBox: b > 0 ? saleTotal / b : 0,
      perKg: w > 0 ? saleTotal / w : 0
    };
  }, [boxes, weightKg, margin, cFruit, cOthf, cFreight, cHandling, cOrigin, cAduana, cInsp, cItbms, cOther]);

  async function save(newStatus?: QuoteDetail["status"]) {
    if (!data) return;
    setBusy(true);
    const token = await getToken();
    
    const payload = {
      id: data.id,
      status: newStatus || status,
      boxes,
      weight_kg: weightKg,
      margin_markup: margin,
      mode,
      currency,
      destination: place,
      payment_terms: paymentTerms,
      terms,
      costs: {
        c_fruit: cFruit, c_othf: cOthf, c_freight: cFreight,
        c_handling: cHandling, c_origin: cOrigin, c_aduana: cAduana,
        c_insp: cInsp, c_itbms: cItbms, c_other: cOther
      },
      totals: {
        total: computed.saleTotal,
        items: computed.rows.map(r => ({
          name: r.key,
          total: r.sale
        })),
        meta: { incoterm, place, boxes, weight_kg: weightKg }
      }
    };

    const res = await fetch("/.netlify/functions/updateQuote", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    setBusy(false);
    if (res.ok) {
      if (newStatus) setStatus(newStatus);
      showToast("Cambios guardados ✅");
      load(data.id);
    }
  }

  async function handleCreateShipment() {
    if (!data) return;
    if (!place || boxes <= 0) {
      setError("Faltan datos críticos (Cajas o Lugar) para crear el embarque.");
      return;
    }
    
    setConverting(true);
    const token = await getToken();

    try {
      // 1. Asegurar que la cotización esté guardada y en WON
      await save("won");

      // 2. Llamar a la creación del embarque
      const res = await fetch("/.netlify/functions/createShipment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quoteId: data.id }),
      });

      const result = await res.json();
      if (res.ok) {
        showToast("Embarque Creado 📦");
        router.push(`/admin/shipments/${result.id}`);
      } else {
        throw new Error(result.message || "Error al crear embarque");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConverting(false);
    }
  }

  // --- RENDERING ---

  if (!authOk || loading) return <AdminLayout title="Cargando..."><div className="ff-card2">Cargando datos maestros...</div></AdminLayout>;

  return (
    <AdminLayout title="Gestión de Cotización">
      {/* TOPBAR MEJORADA */}
      <div className="topBar">
        <div className="topMeta">
          <Link href="/admin/quotes" className="btnBack"><ArrowLeft size={16} /> Volver</Link>
          <div className="titleGroup">
            <span className="quoteId">#{data?.id.slice(0, 8)}</span>
            <select 
              className={`statusPill ${status}`} 
              value={status} 
              onChange={(e) => save(e.target.value as any)}
            >
              <option value="draft">DRAFT</option>
              <option value="sent">SENT</option>
              <option value="won">WON</option>
              <option value="lost">LOST</option>
            </select>
          </div>
        </div>
        
        <div className="topActions">
          <button className="btnPrimary" onClick={() => save()} disabled={busy}>
            <Save size={16} /> {busy ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>

      {error && <div className="msgWarn"><AlertCircle size={16}/> {error}</div>}
      {toast && <div className="msgOk"><CheckCircle2 size={16}/> {toast}</div>}

      <div className="mainGrid">
        {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
        <div className="stack">
          <div className="card">
            <div className="cardHeader">
              <h3>Configuración Logística</h3>
              <div className="modeToggle">
                <button className={mode === 'AIR' ? 'active' : ''} onClick={() => setMode('AIR')}>AÉREO</button>
                <button className={mode === 'SEA' ? 'active' : ''} onClick={() => setMode('SEA')}>MARÍTIMO</button>
              </div>
            </div>
            
            <div className="formGrid">
              <div className="field">
                <label>Incoterm</label>
                <select value={incoterm} onChange={(e) => setIncoterm(e.target.value as any)}>
                  <option value="CIP">CIP</option><option value="DDP">DDP</option>
                  <option value="FCA">FCA</option><option value="FOB">FOB</option>
                </select>
              </div>
              <div className="field">
                <label>Lugar (Place)</label>
                <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ej: Puerto de Rotterdam" />
              </div>
              <div className="field">
                <label>Cajas Totales</label>
                <input type="number" value={boxes} onChange={(e) => setBoxes(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Peso Total (KG)</label>
                <input type="number" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">
              <h3>Estructura de Costos</h3>
              <button className="btnGhost" onClick={() => setShowCosts(!showCosts)}>
                {showCosts ? "Ocultar" : "Editar Costos"}
              </button>
            </div>
            {showCosts && (
              <div className="formGrid">
                <div className="field costFruit"><label>Fruta ($/u)</label><input type="number" step="0.01" value={cFruit} onChange={(e) => setCFruit(Number(e.target.value))} /></div>
                <div className="field costLogistics"><label>Flete Intl</label><input type="number" value={cFreight} onChange={(e) => setCFreight(Number(e.target.value))} /></div>
                <div className="field costOrigin"><label>Gastos Origen</label><input type="number" value={cOrigin} onChange={(e) => setCOrigin(Number(e.target.value))} /></div>
                <div className="field costTax"><label>ITBMS %</label><input type="number" value={cItbms} onChange={(e) => setCItbms(Number(e.target.value))} /></div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: TOTALES Y ACCIONES */}
        <div className="stack">
          {/* BARRA LOGÍSTICA (NUEVA) */}
          <div className={`card logisticsCard ${status === 'won' ? 'won' : ''}`}>
            <div className="cardHeader">
              <div className="iconTitle"><Package size={20} /> <h3>Gestión Operativa</h3></div>
            </div>
            <p className="description">
              {status === 'won' 
                ? "La cotización está lista para convertirse en un embarque real." 
                : "Cambia el estado a 'WON' para habilitar la creación del embarque."}
            </p>
            <button 
              className="btnActionBlue" 
              disabled={status !== 'won' || converting || busy}
              onClick={handleCreateShipment}
            >
              {converting ? <Loader2 className="spin" /> : <Package size={18} />}
              Convertir en Embarque
            </button>
          </div>

          <div className="card salesCard">
            <div className="cardHeader"><h3>Resumen de Venta</h3><span className="currencyTag">{currency}</span></div>
            <table className="salesTable">
              <thead><tr><th>Concepto</th><th className="r">Costo</th><th className="r">Venta</th></tr></thead>
              <tbody>
                {computed.rows.map(r => (
                  <tr key={r.key}>
                    <td>{r.key.replace('_', ' ')}</td>
                    <td className="r">${r.cost.toLocaleString()}</td>
                    <td className="r sale">${r.sale.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="grandTotal">
                  <td>TOTAL VENTA</td>
                  <td colSpan={2} className="r">${computed.saleTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
            
            <div className="profitBadge">
              <div className="label">Utilidad Neta Estimada</div>
              <div className="value">+${computed.profitTotal.toLocaleString()} ({computed.marginOnSale.toFixed(1)}%)</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .topBar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: white; padding: 12px 20px; border-radius: 16px; border: 1px solid #e2e8f0; }
        .topMeta { display: flex; align-items: center; gap: 20px; }
        .titleGroup { display: flex; align-items: center; gap: 12px; }
        .quoteId { font-weight: 800; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 8px; font-size: 14px; }
        
        .statusPill { padding: 6px 14px; border-radius: 99px; font-weight: 800; font-size: 12px; border: none; cursor: pointer; outline: none; }
        .statusPill.draft { background: #e2e8f0; color: #475569; }
        .statusPill.won { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .statusPill.lost { background: #fee2e2; color: #991b1b; }
        
        .mainGrid { display: grid; grid-template-columns: 1fr 400px; gap: 20px; }
        .stack { display: flex; flex-direction: column; gap: 20px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; }
        .cardHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .cardHeader h3 { font-size: 15px; font-weight: 900; color: #1e293b; margin: 0; }
        
        .formGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field label { display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
        .field input, .field select { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; transition: all 0.2s; }
        .field input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); outline: none; }
        
        .logisticsCard { border-left: 6px solid #e2e8f0; transition: all 0.3s; }
        .logisticsCard.won { border-left-color: #3b82f6; background: #f8faff; }
        .description { font-size: 13px; color: #64748b; margin-bottom: 16px; line-height: 1.5; }
        
        .btnActionBlue { width: 100%; background: #3b82f6; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: 0.2s; }
        .btnActionBlue:hover:not(:disabled) { background: #2563eb; transform: translateY(-1px); }
        .btnActionBlue:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }
        
        .salesTable { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .salesTable th { font-size: 11px; color: #94a3b8; padding-bottom: 10px; text-transform: uppercase; }
        .salesTable td { padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .r { text-align: right; }
        .sale { font-weight: 800; color: #0f172a; }
        .grandTotal { font-weight: 900; font-size: 18px; color: #166534; }
        
        .profitBadge { background: #f0fdf4; border: 1px solid #dcfce7; padding: 16px; border-radius: 14px; text-align: center; }
        .profitBadge .label { font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; }
        .profitBadge .value { font-size: 20px; font-weight: 950; color: #15803d; margin-top: 4px; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .msgOk { background: #dcfce7; color: #166534; padding: 12px; border-radius: 10px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-weight: 700; }
        .msgWarn { background: #fef2f2; color: #991b1b; padding: 12px; border-radius: 10px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-weight: 700; border: 1px solid #fee2e2; }
      `}</style>
    </AdminLayout>
  );
}