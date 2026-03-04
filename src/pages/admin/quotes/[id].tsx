// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, Boxes, Weight, 
  ChevronDown, ChevronUp, Globe, DollarSign, Thermometer, Droplets 
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
  
  // Estado de Producto
  const [productId, setProductId] = useState("");
  const [variety, setVariety] = useState("");
  const [color, setColor] = useState("2.75 - 3");
  const [brix, setBrix] = useState("> 13");

  // Costos
  const [cFruit, setCFruit] = useState(13.30);
  const [cFreight, setCFreight] = useState(0);
  const [cOrigin, setCOrigin] = useState(0);
  const [cAduana, setCAduana] = useState(0);
  const [cInsp, setCInsp] = useState(0);
  const [cOther, setCOther] = useState(0);

  const [showCosts, setShowCosts] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quote) {
      setData(quote);
      setStatus(quote.status);
      setBoxes(quote.boxes || 0);
      setWeightKg(quote.weight_kg || 0);
      setMargin(quote.margin_markup || 15);
      setMode(quote.mode || "AIR");
      setPlace(quote.destination || "");
      setProductId(quote.product_id || "");
      
      const pDetails = quote.product_details || {};
      setVariety(pDetails.variety || "");
      setColor(pDetails.color || "2.75 - 3");
      setBrix(pDetails.brix || "> 13");

      const c = quote.costs || {};
      setCFruit(c.c_fruit || 13.30);
      setCFreight(c.c_freight || 0);
      setCOrigin(c.c_origin || 0);
      setCAduana(c.c_aduana || 0);
      setCInsp(c.c_insp || 0);
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
    const totalCost = (Number(cFruit) * Number(boxes)) + Number(cFreight) + Number(cOrigin) + Number(cAduana) + Number(cInsp) + Number(cOther);
    const m = Number(margin) / 100;
    const totalSale = m < 1 ? totalCost / (1 - m) : totalCost;
    return {
      totalCost,
      totalSale,
      profit: totalSale - totalCost,
      perBox: boxes > 0 ? totalSale / boxes : 0
    };
  }, [boxes, margin, cFruit, cFreight, cOrigin, cAduana, cInsp, cOther]);

  async function handleSave() {
    setBusy(true);
    const payload = {
      status, boxes, weight_kg: weightKg, margin_markup: margin, mode,
      destination: place,
      product_id: productId,
      product_details: { variety, color, brix },
      costs: { c_fruit: cFruit, c_freight: cFreight, c_origin: cOrigin, c_aduana: cAduana, c_insp: cInsp, c_other: cOther },
      totals: {
        total: computed.totalSale,
        profit: computed.profit,
        meta: { incoterm, pallets, place }
      }
    };

    const { error } = await supabase.from("quotes").update(payload).eq("id", id);
    setBusy(false);
    if (!error) {
      setToast("Cambios guardados");
      setTimeout(() => setToast(null), 2000);
    }
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="p-8">Cargando datos...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.quote_number || id?.slice(0,8)}`}>
      <div className="quote-container">
        
        {/* HEADER CARD */}
        <div className="card header-card">
          <div className="client-info">
            <div className="avatar"><Building2 size={24} /></div>
            <div>
              <h2>{data?.client_snapshot?.name || "Cliente Demo"}</h2>
              <p><FileText size={14}/> Tax ID: {data?.client_snapshot?.tax_id || "N/A"} | <Globe size={14}/> {data?.client_snapshot?.contact_email}</p>
            </div>
          </div>
          <div className="header-actions">
            <select className={`status-pill ${status}`} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="draft">BORRADOR</option>
              <option value="sent">ENVIADA</option>
              <option value="won">GANADA</option>
            </select>
            <button className="btn-save" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={18} className="spin"/> : <Save size={18}/>} 
              {busy ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>

        <div className="workspace">
          <div className="left-panel">
            
            {/* PRODUCTO */}
            <div className="card section-card">
              <div className="section-title"><Package size={18}/> <h3>Producto y Calidad</h3></div>
              <div className="input-grid">
                <div className="field">
                  <label>Producto</label>
                  <select value={productId} onChange={e => {
                    setProductId(e.target.value);
                    const p = products.find(x => x.id === e.target.value);
                    if(p) setVariety(p.variety || "");
                  }}>
                    <option value="">Seleccionar...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>Variedad</label><input value={variety} onChange={e => setVariety(e.target.value)} /></div>
                <div className="field"><label><Thermometer size={12}/> Color</label><input value={color} onChange={e => setColor(e.target.value)} /></div>
                <div className="field"><label><Droplets size={12}/> Brix</label><input value={brix} onChange={e => setBrix(e.target.value)} /></div>
              </div>
            </div>

            {/* LOGÍSTICA */}
            <div className="card section-card">
              <div className="section-header-row">
                <div className="section-title"><Ship size={18}/> <h3>Configuración Logística</h3></div>
                <div className="mode-toggle">
                  <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={14}/> Aéreo</button>
                  <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={14}/> Marítimo</button>
                </div>
              </div>
              <div className="log-top-grid">
                <div className="field"><label>Incoterm</label>
                  <select value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                    <option value="CIP">CIP</option><option value="FOB">FOB</option><option value="DDP">DDP</option>
                  </select>
                </div>
                <div className="field place-field"><label>Lugar (Place)</label>
                  <LocationSelector mode={mode} value={place} onChange={setPlace} />
                </div>
              </div>
              <div className="log-bottom-stats">
                <div className="stat-box"><Boxes size={16}/><div className="inner"><label>Cajas</label><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div></div>
                <div className="stat-box"><Package size={16}/><div className="inner"><label>Pallets</label><input type="number" value={pallets} onChange={e=>setPallets(Number(e.target.value))}/></div></div>
                <div className="stat-box"><Weight size={16}/><div className="inner"><label>Peso (KG)</label><input type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div></div>
              </div>
            </div>

            {/* COSTOS */}
            <div className="card section-card">
              <div className="section-header-row">
                <div className="section-title"><DollarSign size={18}/> <h3>Estructura de Costos (USD)</h3></div>
                <button className="btn-text" onClick={()=>setShowCosts(!showCosts)}>
                  {showCosts ? <><ChevronUp size={16}/> Ocultar</> : <><ChevronDown size={16}/> Editar detalles</>}
                </button>
              </div>
              {showCosts && (
                <div className="costs-expanded">
                  <div className="field"><label>Fruta $/caja</label><input type="number" step="0.01" value={cFruit} onChange={e=>setCFruit(Number(e.target.value))}/></div>
                  <div className="field"><label>Flete</label><input type="number" value={cFreight} onChange={e=>setCFreight(Number(e.target.value))}/></div>
                  <div className="field"><label>Origen</label><input type="number" value={cOrigin} onChange={e=>setCOrigin(Number(e.target.value))}/></div>
                  <div className="field"><label>Aduana</label><input type="number" value={cAduana} onChange={e=>setCAduana(Number(e.target.value))}/></div>
                  <div className="field"><label>Inspección</label><input type="number" value={cInsp} onChange={e=>setCInsp(Number(e.target.value))}/></div>
                  <div className="field"><label>Otros</label><input type="number" value={cOther} onChange={e=>setCOther(Number(e.target.value))}/></div>
                </div>
              )}
            </div>
          </div>

          <div className="right-panel">
            <div className="summary-card">
              <h4>RESUMEN DE VENTA</h4>
              <div className="margin-input">
                <label>Margen Deseado (%)</label>
                <input type="number" value={margin} onChange={e=>setMargin(Number(e.target.value))}/>
              </div>
              <div className="summary-rows">
                <div className="s-row"><span>Costo Operativo</span><b>USD {computed.totalCost.toLocaleString()}</b></div>
                <div className="s-row sale"><span>Precio Venta Final</span><b>USD {computed.totalSale.toLocaleString()}</b></div>
                <div className="s-row utility"><span>Utilidad Bruta</span><b>USD {computed.profit.toLocaleString()}</b></div>
              </div>
              <div className="box-badge">
                <span className="b-label">VALOR POR CAJA</span>
                <span className="b-value">USD {computed.perBox.toFixed(2)}</span>
              </div>
              {toast && <div className="toast-in-card">{toast}</div>}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .quote-container { padding: 20px; max-width: 1400px; margin: 0 auto; font-family: sans-serif; }
        .card { background: white; border-radius: 16px; border: 1px solid #eef2f6; box-shadow: 0 4px 12px rgba(0,0,0,0.03); margin-bottom: 20px; padding: 24px; }
        
        .header-card { display: flex; justify-content: space-between; align-items: center; }
        .client-info { display: flex; gap: 16px; align-items: center; }
        .avatar { background: #f0fdf4; color: #166534; padding: 12px; border-radius: 12px; }
        .client-info h2 { margin: 0; font-size: 20px; color: #1e293b; font-weight: 700; }
        .client-info p { margin: 4px 0 0; color: #64748b; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        
        .header-actions { display: flex; gap: 12px; }
        .status-pill { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 16px; font-weight: 700; font-size: 12px; cursor: pointer; }
        .status-pill.draft { background: #f8fafc; }
        .status-pill.won { background: #dcfce7; color: #166534; }
        .btn-save { background: #1f7a3a; color: white; border: none; padding: 10px 24px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }

        .workspace { display: grid; grid-template-columns: 1fr 360px; gap: 24px; }
        .section-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .section-title { display: flex; align-items: center; gap: 10px; color: #1e293b; }
        .section-title h3 { margin: 0; font-size: 16px; font-weight: 700; }
        
        .input-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        input, select { padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; outline: none; font-size: 14px; }

        .mode-toggle { background: #f1f5f9; padding: 4px; border-radius: 10px; display: flex; gap: 4px; }
        .mode-toggle button { border: none; background: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer; }
        .mode-toggle button.active { background: white; color: #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .log-top-grid { display: grid; grid-template-columns: 140px 1fr; gap: 16px; margin-bottom: 20px; }
        .log-bottom-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        .stat-box { background: #f8fafc; padding: 12px; border-radius: 12px; display: flex; align-items: center; gap: 12px; color: #94a3b8; }
        .inner { display: flex; flex-direction: column; }
        .inner input { border: none; background: none; padding: 0; font-size: 16px; font-weight: 700; color: #1e293b; width: 60px; }

        .costs-expanded { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .btn-text { background: none; border: none; color: #1f7a3a; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 4px; }

        .summary-card { background: #1e293b; color: white; padding: 30px; border-radius: 24px; position: sticky; top: 20px; }
        .summary-card h4 { font-size: 12px; color: #94a3b8; margin-bottom: 24px; letter-spacing: 1px; }
        .margin-input { background: rgba(255,255,255,0.05); padding: 16px; border-radius: 16px; margin-bottom: 24px; }
        .margin-input input { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; width: 100%; text-align: center; font-size: 20px; font-weight: 800; }
        
        .summary-rows { display: flex; flex-direction: column; gap: 14px; margin-bottom: 30px; }
        .s-row { display: flex; justify-content: space-between; font-size: 14px; color: #94a3b8; }
        .s-row.sale { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; color: white; font-weight: 700; font-size: 16px; }
        .s-row.utility { color: #4ade80; font-weight: 700; }
        
        .box-badge { background: #1f7a3a; padding: 24px; border-radius: 20px; text-align: center; }
        .b-label { display: block; font-size: 11px; font-weight: 700; opacity: 0.8; }
        .b-value { font-size: 32px; font-weight: 800; }
        
        .toast-in-card { margin-top: 12px; text-align: center; color: #4ade80; font-weight: 700; font-size: 13px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}