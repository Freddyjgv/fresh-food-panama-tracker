// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, Boxes, Weight, 
  ChevronDown, ChevronUp, Globe, DollarSign, Thermometer, Droplets, Info, TrendingUp
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { LocationSelector } from "../../../components/LocationSelector";

export default function AdminQuoteDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);

  // Estados Editables
  const [status, setStatus] = useState("draft");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [pallets, setPallets] = useState(0);
  const [margin, setMargin] = useState(15);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [incoterm, setIncoterm] = useState("CIP");
  const [place, setPlace] = useState("");
  
  // Producto
  const [productId, setProductId] = useState("");
  const [variety, setVariety] = useState("");
  const [color, setColor] = useState("2.75 - 3");
  const [brix, setBrix] = useState("> 13");

  // Estructura de Costos Completa
  const [cFruit, setCFruit] = useState(13.30);
  const [cFreight, setCFreight] = useState(0);
  const [cOrigin, setCOrigin] = useState(0);
  const [cAduana, setCAduana] = useState(0);
  const [cInsp, setCInsp] = useState(0);
  const [cDoc, setCDoc] = useState(0);
  const [cTax, setCTax] = useState(0);
  const [cOther, setCOther] = useState(0);

  const [showCosts, setShowCosts] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();

    if (quote) {
      setData(quote);
      setStatus(quote.status);
      setBoxes(quote.boxes || 0);
      setWeightKg(quote.weight_kg || 0);
      setMargin(quote.margin_markup || 15);
      setMode(quote.mode || "AIR");
      setPlace(quote.destination || "");
      setProductId(quote.product_id || "");
      
      const p = quote.product_details || {};
      setVariety(p.variety || "");
      setColor(p.color || "2.75 - 3");
      setBrix(p.brix || "> 13");

      const c = quote.costs || {};
      setCFruit(c.c_fruit || 13.30);
      setCFreight(c.c_freight || 0);
      setCOrigin(c.c_origin || 0);
      setCAduana(c.c_aduana || 0);
      setCInsp(c.c_insp || 0);
      setCDoc(c.c_doc || 0);
      setCTax(c.c_tax || 0);
      setCOther(c.c_other || 0);

      const m = quote.totals?.meta || {};
      setIncoterm(m.incoterm || "CIP");
      setPallets(m.pallets || 0);
    }
    const { data: pList } = await supabase.from("products").select("*");
    if (pList) setProducts(pList);
    setLoading(false);
  }

  useEffect(() => { if (authOk && id) loadData(id as string); }, [authOk, id]);

  const computed = useMemo(() => {
    const totalCost = (Number(cFruit) * Number(boxes)) + Number(cFreight) + Number(cOrigin) + 
                      Number(cAduana) + Number(cInsp) + Number(cDoc) + Number(cTax) + Number(cOther);
    const m = Number(margin) / 100;
    const totalSale = m < 1 ? totalCost / (1 - m) : totalCost;
    return {
      totalCost,
      totalSale,
      profit: totalSale - totalCost,
      perBox: boxes > 0 ? totalSale / boxes : 0
    };
  }, [boxes, margin, cFruit, cFreight, cOrigin, cAduana, cInsp, cDoc, cTax, cOther]);

  async function handleSave() {
    setBusy(true);
    const payload = {
      status, boxes, weight_kg: weightKg, margin_markup: margin, mode, destination: place,
      product_id: productId,
      product_details: { variety, color, brix },
      costs: { c_fruit: cFruit, c_freight: cFreight, c_origin: cOrigin, c_aduana: cAduana, c_insp: cInsp, c_doc: cDoc, c_tax: cTax, c_other: cOther },
      totals: { total: computed.totalSale, profit: computed.profit, per_box: computed.perBox, meta: { incoterm, pallets, place } }
    };
    const { error } = await supabase.from("quotes").update(payload).eq("id", id);
    setBusy(false);
    if (!error) { setToast("Cambios guardados"); setTimeout(() => setToast(null), 2000); }
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="ff-card-pad">Sincronizando...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.quote_number || id?.slice(0,8)}`}>
      <div className="ff-content ff-content--wide">
        
        {/* TOP BAR */}
        <div className="ff-card ff-card-pad header-flex">
          <div className="client-brand">
            <div className="avatar-box"><Building2 size={20} /></div>
            <div>
              <h2 className="client-name">{data?.client_snapshot?.name || "Cliente Demo"}</h2>
              <div className="client-meta">
                <span><FileText size={12}/> {data?.client_snapshot?.tax_id || "N/A"}</span>
                <span><Globe size={12}/> {data?.client_snapshot?.contact_email}</span>
              </div>
            </div>
          </div>
          <div className="actions-cluster">
            <select className={`status-pill ${status}`} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="draft">BORRADOR</option>
              <option value="sent">ENVIADA</option>
              <option value="won">GANADA</option>
            </select>
            <button className="ff-btn ff-btn-primary" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin"/> : <Save size={16}/>} Guardar
            </button>
          </div>
        </div>

        <div className="main-grid">
          {/* COLUMNA IZQUIERDA: 25% (EDICIÓN) */}
          <aside className="editor-side">
            
            <div className="ff-card editor-card">
              <div className="card-head"><Package size={16}/> <h4>Producto</h4></div>
              <div className="fields-stack">
                <div className="field">
                  <label>Producto</label>
                  <select className="ff-input" value={productId} onChange={e => setProductId(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>Variedad</label><input className="ff-input" value={variety} onChange={e => setVariety(e.target.value)} /></div>
                <div className="field-row">
                  <div className="field"><label><Thermometer size={10}/> Color</label><input className="ff-input" value={color} onChange={e => setColor(e.target.value)} /></div>
                  <div className="field"><label><Droplets size={10}/> Brix</label><input className="ff-input" value={brix} onChange={e => setBrix(e.target.value)} /></div>
                </div>
              </div>
            </div>

            <div className="ff-card editor-card">
              <div className="card-head-spread">
                <div className="card-head"><Ship size={16}/> <h4>Logística</h4></div>
                <div className="mode-toggle">
                  <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={12}/></button>
                  <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={12}/></button>
                </div>
              </div>
              <div className="fields-stack">
                <div className="field">
                  <label>Incoterm</label>
                  <select className="ff-input" value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                    <option value="CIP">CIP</option><option value="FOB">FOB</option><option value="DDP">DDP</option><option value="CIF">CIF</option>
                  </select>
                </div>
                <div className="field"><label>Lugar</label><LocationSelector mode={mode} value={place} onChange={setPlace} /></div>
                <div className="stats-mini-grid">
                   <div className="mini-box"><span>Cajas</span><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div>
                   <div className="mini-box"><span>Pallets</span><input type="number" value={pallets} onChange={e=>setPallets(Number(e.target.value))}/></div>
                   <div className="mini-box"><span>Peso</span><input type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
                </div>
              </div>
            </div>

            <div className="ff-card editor-card">
              <div className="card-head-spread" onClick={()=>setShowCosts(!showCosts)} style={{cursor:'pointer'}}>
                <div className="card-head"><DollarSign size={16}/> <h4>Costos</h4></div>
                {showCosts ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </div>
              {showCosts && (
                <div className="fields-stack costs-stack">
                  <div className="field-val"><span>Fruta $/caja</span><input type="number" step="0.01" value={cFruit} onChange={e=>setCFruit(Number(e.target.value))}/></div>
                  <div className="field-val"><span>Flete Int.</span><input type="number" value={cFreight} onChange={e=>setCFreight(Number(e.target.value))}/></div>
                  <div className="field-val"><span>Origen</span><input type="number" value={cOrigin} onChange={e=>setCOrigin(Number(e.target.value))}/></div>
                  <div className="field-val"><span>Aduana</span><input type="number" value={cAduana} onChange={e=>setCAduana(Number(e.target.value))}/></div>
                  <div className="field-val"><span>Inspección</span><input type="number" value={cInsp} onChange={e=>setCInsp(Number(e.target.value))}/></div>
                  <div className="field-val"><span>Docs</span><input type="number" value={cDoc} onChange={e=>setCDoc(Number(e.target.value))}/></div>
                  <div className="field-val"><span>Impuestos</span><input type="number" value={cTax} onChange={e=>setCTax(Number(e.target.value))}/></div>
                  <div className="field-val"><span>Otros</span><input type="number" value={cOther} onChange={e=>setCOther(Number(e.target.value))}/></div>
                </div>
              )}
            </div>
          </aside>

          {/* COLUMNA DERECHA: 75% (RESUMEN CLARO) */}
          <main className="display-side">
            <div className="ff-card summary-display">
              <div className="display-header">
                <div>
                  <h3>Resumen Financiero de Venta</h3>
                  <p>Cálculo basado en el {margin}% de margen operativo.</p>
                </div>
                <div className="margin-control-box">
                  <label>MARGEN DESEADO (%)</label>
                  <input type="number" value={margin} onChange={e=>setMargin(Number(e.target.value))}/>
                </div>
              </div>

              <div className="finance-grid">
                <div className="finance-card">
                  <div className="f-icon"><Package size={20}/></div>
                  <div className="f-info">
                    <span className="f-label">Inversión Operativa</span>
                    <span className="f-value">USD {computed.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
                <div className="finance-card highlight">
                  <div className="f-icon"><TrendingUp size={20}/></div>
                  <div className="f-info">
                    <span className="f-label">Precio de Venta Total</span>
                    <span className="f-value">USD {computed.totalSale.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
                <div className="finance-card utility">
                  <div className="f-icon"><DollarSign size={20}/></div>
                  <div className="f-info">
                    <span className="f-label">Utilidad Proyectada</span>
                    <span className="f-value">USD {computed.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>

              <div className="big-badge-container">
                <div className="per-box-badge">
                   <div className="badge-text">
                      <h4>VALOR FINAL POR CAJA</h4>
                      <p>Precio sugerido de venta al cliente</p>
                   </div>
                   <div className="badge-price">
                      <span className="currency">USD</span>
                      <span className="amount">{computed.perBox.toFixed(2)}</span>
                   </div>
                </div>
              </div>

              <div className="info-footer">
                <Info size={14}/>
                <span>Este cálculo incluye flete, seguros y gastos de nacionalización según el incoterm {incoterm}.</span>
              </div>
            </div>

            {toast && <div className="ff-toast">{toast}</div>}
          </main>
        </div>
      </div>

      <style jsx>{`
        .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-radius: 12px; }
        .client-brand { display: flex; gap: 14px; align-items: center; }
        .avatar-box { background: #f0fdf4; color: var(--ff-green); padding: 10px; border-radius: 10px; border: 1px solid rgba(31,122,58,0.1); }
        .client-name { margin: 0; font-size: 18px; font-weight: 800; color: var(--ff-text); }
        .client-meta { display: flex; gap: 12px; font-size: 12px; color: var(--ff-muted); margin-top: 2px; }
        .client-meta span { display: flex; align-items: center; gap: 4px; }

        .actions-cluster { display: flex; gap: 12px; }
        .status-pill { border: 1px solid var(--ff-border); border-radius: 6px; padding: 0 12px; font-weight: 700; font-size: 11px; height: 36px; cursor: pointer; }
        .status-pill.draft { background: #f1f5f9; color: #475569; }
        .status-pill.won { background: #dcfce7; color: #166534; border-color: #bbf7d0; }

        .main-grid { display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: start; }
        
        /* EDITOR SIDE (25%) */
        .editor-card { margin-bottom: 16px; border-radius: 10px; }
        .card-head { display: flex; align-items: center; gap: 8px; color: var(--ff-green); padding: 12px 16px; border-bottom: 1px solid var(--ff-border); }
        .card-head h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
        .card-head-spread { display: flex; justify-content: space-between; align-items: center; padding-right: 16px; }
        
        .fields-stack { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 10px; font-weight: 700; color: var(--ff-muted); text-transform: uppercase; }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .stats-mini-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
        .mini-box { background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid var(--ff-border); text-align: center; }
        .mini-box span { display: block; font-size: 9px; font-weight: 700; color: var(--ff-muted); margin-bottom: 2px; }
        .mini-box input { width: 100%; border: none; background: transparent; text-align: center; font-weight: 800; font-size: 13px; outline: none; }

        .costs-stack { gap: 8px; }
        .field-val { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
        .field-val span { font-size: 11px; font-weight: 600; color: #475569; }
        .field-val input { width: 70px; text-align: right; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 6px; font-size: 12px; font-weight: 700; }

        .mode-toggle { display: flex; background: #f1f5f9; padding: 3px; border-radius: 6px; }
        .mode-toggle button { border: none; background: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; color: #94a3b8; }
        .mode-toggle button.active { background: #fff; color: var(--ff-green); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        /* DISPLAY SIDE (75%) */
        .summary-display { padding: 40px; border-radius: 16px; border: none; background: #fff; box-shadow: 0 10px 40px rgba(15,23,42,0.04); }
        .display-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f8fafc; padding-bottom: 20px; }
        .display-header h3 { margin: 0; font-size: 24px; font-weight: 800; color: var(--ff-text); }
        .display-header p { margin: 5px 0 0; color: var(--ff-muted); font-size: 14px; }

        .margin-control-box { background: #f0fdf4; padding: 12px 20px; border-radius: 12px; border: 1px solid #dcfce7; text-align: right; }
        .margin-control-box label { display: block; font-size: 10px; font-weight: 800; color: var(--ff-green); margin-bottom: 4px; }
        .margin-control-box input { background: transparent; border: none; font-size: 24px; font-weight: 900; color: var(--ff-green); width: 60px; text-align: right; outline: none; }

        .finance-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
        .finance-card { padding: 24px; border-radius: 16px; background: #f8fafc; display: flex; align-items: center; gap: 16px; border: 1px solid #f1f5f9; }
        .finance-card.highlight { background: #fff; border: 2px solid var(--ff-green); }
        .finance-card.utility { background: #f0fdf4; border: 1px solid #dcfce7; }
        .f-icon { width: 44px; height: 44px; border-radius: 12px; background: #fff; display: grid; place-items: center; color: var(--ff-green); box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
        .f-label { display: block; font-size: 12px; font-weight: 600; color: var(--ff-muted); margin-bottom: 4px; }
        .f-value { font-size: 18px; font-weight: 800; color: var(--ff-text); }
        .finance-card.utility .f-value { color: var(--ff-green); }

        .big-badge-container { margin-bottom: 30px; }
        .per-box-badge { background: var(--ff-green); color: #fff; padding: 40px; border-radius: 24px; display: flex; justify-content: space-between; align-items: center; }
        .badge-text h4 { margin: 0; font-size: 14px; font-weight: 700; opacity: 0.9; }
        .badge-text p { margin: 4px 0 0; font-size: 13px; opacity: 0.7; }
        .badge-price { display: flex; align-items: baseline; gap: 8px; }
        .badge-price .currency { font-size: 20px; font-weight: 600; opacity: 0.8; }
        .badge-price .amount { font-size: 64px; font-weight: 900; letter-spacing: -2px; }

        .info-footer { display: flex; align-items: center; gap: 10px; color: var(--ff-muted); font-size: 12px; padding: 20px; background: #f1f5f9; border-radius: 12px; }
        .ff-toast { position: fixed; bottom: 20px; right: 20px; background: var(--ff-green); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 700; box-shadow: 0 10px 20px rgba(0,0,0,0.1); z-index: 100; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}