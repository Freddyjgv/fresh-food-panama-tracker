// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { 
  ArrowLeft, Save, FileText, Package, CheckCircle2, AlertCircle, 
  Loader2, Building2, MapPin, Plane, Ship, Boxes, Weight, 
  ChevronDown, ChevronUp, Globe, DollarSign 
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

// --- TYPES ---
type QuoteDetail = {
  id: string;
  status: "draft" | "sent" | "won" | "lost" | "archived";
  mode: "AIR" | "SEA";
  currency: "USD" | "EUR";
  destination: string;
  boxes: number;
  weight_kg?: number | null;
  margin_markup: number;
  payment_terms?: string | null;
  terms?: string | null;
  client_id: string;
  client_snapshot?: { name?: string; contact_email?: string; tax_id?: string } | null;
  totals?: any;
  costs?: any;
};

type Incoterm = "CIP" | "CPT" | "DAP" | "DDP" | "FCA" | "FOB" | "CIF";

export default function AdminQuoteDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<QuoteDetail | null>(null);

  // Estados Editables
  const [status, setStatus] = useState<QuoteDetail["status"]>("draft");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [pallets, setPallets] = useState(0);
  const [margin, setMargin] = useState(15);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [incoterm, setIncoterm] = useState<Incoterm>("CIP");
  const [place, setPlace] = useState("");
  
  // Estructura de Costos Granular
  const [cFruit, setCFruit] = useState(0);     // $/caja
  const [cFreight, setCFreight] = useState(0); // Flat
  const [cOrigin, setCOrigin] = useState(0);   // Gastos origen
  const [cAduana, setCAduana] = useState(0);   // Aduana
  const [cInsp, setCInsp] = useState(0);       // Inspección
  const [cDoc, setCDoc] = useState(0);         // Documentación
  const [cTax, setCTax] = useState(0);         // Impuestos adicionales
  const [cOther, setCOther] = useState(0);     // Otros

  const [showCosts, setShowCosts] = useState(true);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function load(quoteId: string) {
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;

    const res = await fetch(`/.netlify/functions/getQuote?id=${encodeURIComponent(quoteId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) { setError("Error cargando cotización"); setLoading(false); return; }

    const json = (await res.json()) as QuoteDetail;
    setData(json);
    setStatus(json.status);
    setBoxes(Number(json.boxes || 0));
    setWeightKg(Number(json.weight_kg || 0));
    setMargin(Number(json.margin_markup || 0));
    setMode(json.mode || "AIR");
    setCurrency(json.currency || "USD");

    const meta = json.totals?.meta || {};
    setIncoterm(meta.incoterm || "CIP");
    setPlace(meta.place || json.destination || "");
    setPallets(meta.pallets || 0);

    const c = json.costs || {};
    setCFruit(Number(c.c_fruit || 0));
    setCFreight(Number(c.c_freight || 0));
    setCOrigin(Number(c.c_origin || 0));
    setCAduana(Number(c.c_aduana || 0));
    setCInsp(Number(c.c_insp || 0));
    setCDoc(Number(c.c_doc || 0));
    setCTax(Number(c.c_tax || 0));
    setCOther(Number(c.c_other || 0));
    setLoading(false);
  }

  useEffect(() => { if (authOk && typeof id === "string") load(id); }, [authOk, id]);

  // CÁLCULO LÓGICO
  const computed = useMemo(() => {
    const totalCost = (cFruit * boxes) + cFreight + cOrigin + cAduana + cInsp + cDoc + cTax + cOther;
    const m = margin / 100;
    
    // Fórmula de Venta basada en Margen sobre Venta: Costo / (1 - Margen)
    const totalSale = m < 1 ? totalCost / (1 - m) : totalCost;
    const profit = totalSale - totalCost;

    return {
      totalCost,
      totalSale,
      profit,
      perBox: boxes > 0 ? totalSale / boxes : 0,
      marginActual: totalSale > 0 ? (profit / totalSale) * 100 : 0
    };
  }, [boxes, margin, cFruit, cFreight, cOrigin, cAduana, cInsp, cDoc, cTax, cOther]);

  async function handleSave() {
    setBusy(true);
    const { data: sess } = await supabase.auth.getSession();
    const payload = {
      id: data?.id,
      status, boxes, weight_kg: weightKg, margin_markup: margin, mode, currency,
      destination: place,
      costs: { 
        c_fruit: cFruit, c_freight: cFreight, c_origin: cOrigin, 
        c_aduana: cAduana, c_insp: cInsp, c_doc: cDoc, c_tax: cTax, c_other: cOther 
      },
      totals: {
        total: computed.totalSale,
        meta: { incoterm, place, boxes, pallets, weight_kg: weightKg }
      }
    };

    const res = await fetch("/.netlify/functions/updateQuote", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token}` },
      body: JSON.stringify(payload),
    });

    setBusy(false);
    if (res.ok) showToast("Cotización actualizada");
  }

  if (!authOk || loading) return <AdminLayout title="Cargando..."><div className="loader">Cargando datos...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.id.slice(0, 8)}`}>
      {/* HEADER: CLIENTE Y STATUS */}
      <div className="quoteHeader ff-card2">
        <div className="clientInfo">
          <div className="clientAvatar"><Building2 size={24} /></div>
          <div className="clientDetails">
            <h2>{data?.client_snapshot?.name || "Cliente General"}</h2>
            <div className="metaRow">
              <span><FileText size={14} /> Tax ID: <b>{data?.client_snapshot?.tax_id || "N/A"}</b></span>
              <span><Globe size={14} /> {data?.client_snapshot?.contact_email}</span>
            </div>
          </div>
        </div>
        <div className="statusActions">
           <select className={`statusSelect ${status}`} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="draft">BORRADOR</option>
              <option value="sent">ENVIADA</option>
              <option value="won">GANADA (WON)</option>
              <option value="lost">PERDIDA</option>
           </select>
           <button className="btnSave" onClick={handleSave} disabled={busy}>
             {busy ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
             Guardar
           </button>
        </div>
      </div>

      <div className="mainGrid">
        <div className="leftCol">
          {/* CONFIGURACIÓN LOGÍSTICA */}
          <div className="card">
            <div className="cardHeader">
              <div className="titleWithIcon"><Package size={18} /> <h3>Configuración Logística</h3></div>
              <div className="segmentedControl">
                <button className={mode === 'AIR' ? 'active' : ''} onClick={() => setMode('AIR')}><Plane size={14}/> Aéreo</button>
                <button className={mode === 'SEA' ? 'active' : ''} onClick={() => setMode('SEA')}><Ship size={14}/> Marítimo</button>
              </div>
            </div>

            <div className="formGrid">
              <div className="field incotermField">
                <label>Incoterm</label>
                <select value={incoterm} onChange={e => setIncoterm(e.target.value as any)}>
                  <option value="FOB">FOB</option><option value="CIF">CIF</option>
                  <option value="CIP">CIP</option><option value="DDP">DDP</option>
                  <option value="FCA">FCA</option>
                </select>
              </div>
              <div className="field placeField">
                <label>Lugar (Place)</label>
                <div className="inputWithFlag">
                   <input value={place} onChange={e => setPlace(e.target.value)} placeholder="Ej: Rotterdam Port, NL" />
                </div>
              </div>
            </div>

            <div className="logisticsGrid">
               <div className="logBox">
                 <Boxes size={16} />
                 <div className="logData"><label>Cajas</label><input type="number" value={boxes} onChange={e => setBoxes(Number(e.target.value))} /></div>
               </div>
               <div className="logBox">
                 <Package size={16} />
                 <div className="logData"><label>Pallets</label><input type="number" value={pallets} onChange={e => setPallets(Number(e.target.value))} /></div>
               </div>
               <div className="logBox">
                 <Weight size={16} />
                 <div className="logData"><label>Peso (KG)</label><input type="number" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} /></div>
               </div>
            </div>
          </div>

          {/* ESTRUCTURA DE COSTOS */}
          <div className="card">
            <div className="cardHeader">
              <div className="titleWithIcon"><DollarSign size={18} /> <h3>Estructura de Costos</h3></div>
              <button className="btnToggle" onClick={() => setShowCosts(!showCosts)}>
                {showCosts ? <><ChevronUp size={16}/> Ocultar detalles</> : <><ChevronDown size={16}/> Editar detalles</>}
              </button>
            </div>

            {showCosts && (
              <div className="costsGrid">
                <div className="field"><label>Fruta $/caja</label><input type="number" step="0.01" value={cFruit} onChange={e => setCFruit(Number(e.target.value))} /></div>
                <div className="field"><label>Flete Internacional</label><input type="number" value={cFreight} onChange={e => setCFreight(Number(e.target.value))} /></div>
                <div className="field"><label>Gastos de Origen</label><input type="number" value={cOrigin} onChange={e => setCOrigin(Number(e.target.value))} /></div>
                <div className="field"><label>Aduana</label><input type="number" value={cAduana} onChange={e => setCAduana(Number(e.target.value))} /></div>
                <div className="field"><label>Inspección</label><input type="number" value={cInsp} onChange={e => setCInsp(Number(e.target.value))} /></div>
                <div className="field"><label>Documentación</label><input type="number" value={cDoc} onChange={e => setCDoc(Number(e.target.value))} /></div>
                <div className="field"><label>Impuestos Adic.</label><input type="number" value={cTax} onChange={e => setCTax(Number(e.target.value))} /></div>
                <div className="field"><label>Otros Gastos</label><input type="number" value={cOther} onChange={e => setCOther(Number(e.target.value))} /></div>
              </div>
            )}
          </div>
        </div>

        <div className="rightCol">
          <div className="card summaryCard">
            <h3>Resumen de Venta</h3>
            <div className="marginControl">
              <label>Margen Deseado (%)</label>
              <input type="number" value={margin} onChange={e => setMargin(Number(e.target.value))} />
            </div>

            <div className="summaryList">
              <div className="summaryItem"><span>Costo Operativo</span><b>{currency} {computed.totalCost.toLocaleString()}</b></div>
              <div className="summaryItem sale"><span>Precio Venta Final</span><b>{currency} {computed.totalSale.toLocaleString()}</b></div>
              <div className="summaryItem utility"><span>Utilidad Bruta</span><b>{currency} {computed.profit.toLocaleString()}</b></div>
            </div>

            <div className="boxValue">
              <div className="label">VALOR POR CAJA</div>
              <div className="value">{currency} {computed.perBox.toFixed(2)}</div>
            </div>

            <button className="btnPrimaryAction" disabled={status !== 'won'}>
               Convertir en Embarque
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .quoteHeader { display: flex; justify-content: space-between; align-items: center; padding: 24px; margin-bottom: 24px; }
        .clientInfo { display: flex; gap: 16px; align-items: center; }
        .clientAvatar { background: #f1f5f9; color: #1f7a3a; padding: 12px; border-radius: 12px; }
        .clientDetails h2 { margin: 0; font-size: 20px; font-weight: 900; color: #1e293b; }
        .metaRow { display: flex; gap: 16px; margin-top: 4px; font-size: 13px; color: #64748b; }
        .metaRow span { display: flex; align-items: center; gap: 4px; }
        
        .statusActions { display: flex; gap: 12px; }
        .statusSelect { padding: 8px 16px; border-radius: 10px; font-weight: 800; font-size: 12px; border: 1px solid #e2e8f0; cursor: pointer; }
        .statusSelect.won { background: #dcfce7; color: #166534; }
        .btnSave { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 800; display: flex; align-items: center; gap: 8px; cursor: pointer; }

        .mainGrid { display: grid; grid-template-columns: 1fr 380px; gap: 24px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; margin-bottom: 24px; }
        .cardHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .titleWithIcon { display: flex; align-items: center; gap: 10px; color: #1e293b; }
        .cardHeader h3 { margin: 0; font-size: 16px; font-weight: 900; }

        .segmentedControl { background: #f1f5f9; padding: 4px; border-radius: 10px; display: flex; gap: 4px; }
        .segmentedControl button { border: none; padding: 6px 14px; border-radius: 7px; font-size: 12px; font-weight: 800; color: #64748b; cursor: pointer; transition: 0.2s; }
        .segmentedControl button.active { background: white; color: #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .formGrid { display: grid; grid-template-columns: 120px 1fr; gap: 16px; margin-bottom: 24px; }
        .field label { display: block; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
        .field input, .field select { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 14px; outline: none; }

        .logisticsGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
        .logBox { display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 12px; border-radius: 14px; color: #64748b; }
        .logData { display: flex; flex-direction: column; }
        .logData label { font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .logData input { border: none; background: transparent; font-size: 15px; font-weight: 800; color: #1e293b; width: 60px; outline: none; }

        .btnToggle { background: none; border: none; color: #1f7a3a; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 4px; }
        .costsGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; animation: slideDown 0.3s ease; }

        .summaryCard { background: #1e293b; color: white; position: sticky; top: 24px; }
        .summaryCard h3 { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .marginControl { margin: 20px 0; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 14px; }
        .marginControl input { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; width: 100%; padding: 8px; border-radius: 8px; font-size: 18px; font-weight: 800; text-align: center; }

        .summaryList { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .summaryItem { display: flex; justify-content: space-between; font-size: 14px; color: #94a3b8; }
        .summaryItem.sale { color: white; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; font-size: 16px; }
        .summaryItem.utility { color: #4ade80; font-weight: 800; }

        .boxValue { background: #1f7a3a; padding: 20px; border-radius: 16px; text-align: center; }
        .boxValue .label { font-size: 11px; font-weight: 800; opacity: 0.8; }
        .boxValue .value { font-size: 28px; font-weight: 900; margin-top: 4px; }

        .btnPrimaryAction { width: 100%; margin-top: 20px; padding: 16px; border-radius: 12px; border: none; background: #3b82f6; color: white; font-weight: 900; cursor: pointer; transition: 0.2s; }
        .btnPrimaryAction:disabled { opacity: 0.3; cursor: not-allowed; }

        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}