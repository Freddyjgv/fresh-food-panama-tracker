import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, 
  Globe, DollarSign, Thermometer, Droplets, Info, Calculator, ChevronDown, Download
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
  const [varieties, setVarieties] = useState<string[]>([]);

  // --- ESTADOS ---
  const [status, setStatus] = useState("draft");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [pallets, setPallets] = useState(0);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [incoterm, setIncoterm] = useState("CIP");
  const [place, setPlace] = useState("");
  const [productId, setProductId] = useState("");
  const [variety, setVariety] = useState("");
  const [color, setColor] = useState("2.75 - 3");
  const [brix, setBrix] = useState("> 13");

  const [costs, setCosts] = useState<any>({
    fruit: { base: 13.30, margin: 15 },
    freight: { base: 0, margin: 0 },
    origin: { base: 0, margin: 0 },
    aduana: { base: 0, margin: 0 },
    insp: { base: 0, margin: 0 },
    doc: { base: 0, margin: 0 },
    tax: { base: 0, margin: 0 },
    other: { base: 0, margin: 0 }
  });

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    // Join con la tabla clients para obtener datos frescos y corregir el error de TaxID
    const { data: quote } = await supabase
      .from("quotes")
      .select(`
        *,
        clients (
          name,
          tax_id,
          contact_email,
          logo_url
        )
      `)
      .eq("id", quoteId)
      .single();

    if (quote) {
      setData(quote);
      setStatus(quote.status || "draft");
      setBoxes(quote.boxes || 0);
      setWeightKg(quote.weight_kg || 0);
      setMode(quote.mode || "AIR");
      setPlace(quote.destination || "");
      setProductId(quote.product_id || "");
      
      const p = quote.product_details || {};
      setVariety(p.variety || "");
      setColor(p.color || "2.75 - 3");
      setBrix(p.brix || "> 13");

      const c = quote.costs || {};
      setCosts({
        fruit: { base: c.c_fruit || 13.30, margin: quote.margin_markup || 15 },
        freight: { base: c.c_freight || 0, margin: c.m_freight || 0 },
        origin: { base: c.c_origin || 0, margin: c.m_origin || 0 },
        aduana: { base: c.c_aduana || 0, margin: c.m_aduana || 0 },
        insp: { base: c.c_insp || 0, margin: c.m_insp || 0 },
        doc: { base: c.c_doc || 0, margin: c.m_doc || 0 },
        tax: { base: c.c_tax || 0, margin: c.m_tax || 0 },
        other: { base: c.c_other || 0, margin: c.m_other || 0 }
      });

      const m = quote.totals?.meta || {};
      setIncoterm(m.incoterm || "CIP");
      setPallets(m.pallets || 0);
      
      if (quote.product_id) fetchVarieties(quote.product_id);
    }
    const { data: pList } = await supabase.from("products").select("*");
    if (pList) setProducts(pList);
    setLoading(false);
  }

  async function fetchVarieties(pId: string) {
    if (!pId) return;
    const { data: p } = await supabase.from("products").select("varieties").eq("id", pId).single();
    if (p?.varieties) setVarieties(p.varieties);
  }

  useEffect(() => { if (authOk && id) loadData(id as string); }, [authOk, id]);

  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]: [string, any]) => {
      const baseTotal = key === 'fruit' ? val.base * boxes : val.base;
      const marginFact = val.margin / 100;
      const sale = marginFact < 1 ? baseTotal / (1 - marginFact) : baseTotal;
      return { key, baseTotal, sale, margin: val.margin };
    });
    const totalCost = lines.reduce((acc, curr) => acc + curr.baseTotal, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    return {
      lines, totalCost, totalSale,
      profit: totalSale - totalCost,
      perBox: boxes > 0 ? totalSale / boxes : 0
    };
  }, [costs, boxes]);

  const updateCostLine = (key: string, field: 'base' | 'margin', value: number) => {
    setCosts((prev: any) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  async function handleSave() {
    setBusy(true);
    const payload = {
      status, boxes, weight_kg: weightKg, mode, destination: place, product_id: productId,
      margin_markup: costs.fruit.margin,
      product_details: { variety, color, brix },
      costs: { 
        c_fruit: costs.fruit.base, c_freight: costs.freight.base, c_origin: costs.origin.base, 
        c_aduana: costs.aduana.base, c_insp: costs.insp.base, c_doc: costs.doc.base, 
        c_tax: costs.tax.base, c_other: costs.other.base,
        m_freight: costs.freight.margin, m_origin: costs.origin.margin, m_aduana: costs.aduana.margin
      },
      totals: { total: analysis.totalSale, profit: analysis.profit, per_box: analysis.perBox, meta: { incoterm, pallets, place } }
    };
    // CORREGIDO: Se agregaron los 2 argumentos necesarios para .eq()
    const { error } = await supabase.from("quotes").update(payload).eq("id", id as string);
    setBusy(false);
    if (!error) { 
      setToast("Cambios guardados"); 
      setTimeout(() => setToast(null), 2000); 
    }
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="ff-card-pad">Cargando datos de cotización...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.quote_number || id?.slice(0,8)}`}>
      <div className="ff-content ff-content--wide">
        
        {/* HEADER PRO - ESTILO CLIENTES */}
        <div className="ff-card header-pro">
          <div className="header-left">
            <div className="logo-holder">
              {data?.clients?.logo_url ? (
                <img src={data.clients.logo_url} alt="Logo" />
              ) : (
                <Building2 size={24} className="opacity-20" />
              )}
            </div>
            
            <div className="client-main-info">
              <div className="title-row">
                <h1>{data?.clients?.name || data?.client_snapshot?.name || "Cliente no definido"}</h1>
                <span className={`status-badge-pro ${status}`}>{status.toUpperCase()}</span>
              </div>
              <div className="sub-row">
                <span className="tax-label">
                   <FileText size={12}/> Tax ID: <strong>{data?.clients?.tax_id || data?.client_snapshot?.tax_id || 'Pendiente'}</strong>
                </span>
                <span className="geo-label">
                  <Globe size={12}/> {data?.clients?.contact_email || data?.client_snapshot?.contact_email || 'Sin email'}
                </span>
              </div>
            </div>

            <div className="header-stats-group">
              <div className="h-stat">
                <span className="h-stat-label">Cajas</span>
                <span className="h-stat-val">{boxes}</span>
              </div>
              <div className="v-divider"></div>
              <div className="h-stat">
                <span className="h-stat-label">Venta Total</span>
                <span className="h-stat-val">${analysis.totalSale.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="actions-cluster">
            <div className="status-pill-container">
               <select className={`status-pill-select ${status}`} value={status} onChange={e => setStatus(e.target.value)}>
                 <option value="draft">BORRADOR</option>
                 <option value="sent">ENVIADA</option>
                 <option value="won">GANADA</option>
               </select>
               <ChevronDown size={14} className="pill-icon"/>
            </div>
            <button className="ff-btn ff-btn-secondary pdf-btn" onClick={() => alert('Generando PDF...')}>
              <Download size={16}/> <span>Exportar PDF</span>
            </button>
            <button className="ff-btn ff-btn-primary save-btn" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin"/> : <Save size={16}/>} <span>Guardar</span>
            </button>
          </div>
        </div>

        {/* CONFIGURACIÓN 3 COLUMNAS */}
        <div className="config-row">
          <div className="ff-card config-card">
            <div className="card-label"><Package size={14}/> Producto y Calidad</div>
            <div className="config-grid">
              <div className="field full">
                <label>Producto</label>
                <select className="ff-input" value={productId} onChange={e => { setProductId(e.target.value); fetchVarieties(e.target.value); }}>
                  <option value="">Seleccionar...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field full">
                <label>Variedad</label>
                <select className="ff-input" value={variety} onChange={e => setVariety(e.target.value)}>
                   <option value="">Seleccionar variedad...</option>
                   {varieties.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="field"><label><Thermometer size={10}/> Color</label><input className="ff-input" value={color} onChange={e => setColor(e.target.value)} /></div>
              <div className="field"><label><Droplets size={10}/> Brix</label><input className="ff-input" value={brix} onChange={e => setBrix(e.target.value)} /></div>
            </div>
          </div>

          <div className="ff-card config-card">
            <div className="card-label"><Ship size={14}/> Logística</div>
            <div className="config-grid">
              <div className="field full flex-between">
                <label>Modo</label>
                <div className="mini-toggle">
                  <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={12}/></button>
                  <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={12}/></button>
                </div>
              </div>
              <div className="field full">
                <label>Incoterm</label>
                <select className="ff-input" value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                  <option value="CIP">CIP</option><option value="CIF">CIF</option><option value="FOB">FOB</option><option value="DDP">DDP</option>
                </select>
              </div>
              <div className="field full"><label>Destino</label><LocationSelector mode={mode} value={place} onChange={setPlace} /></div>
              <div className="mini-stats">
                 <div className="ms-item"><span>Cajas</span><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div>
                 <div className="ms-item"><span>Pallets</span><input type="number" value={pallets} onChange={e=>setPallets(Number(e.target.value))}/></div>
                 <div className="ms-item"><span>KG</span><input type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
              </div>
            </div>
          </div>

          <div className="ff-card config-card">
            <div className="card-label"><DollarSign size={14}/> Costos Base</div>
            <div className="costs-entry-list">
               <div className="ce-item"><span>Fruta ($/cx)</span><input type="number" step="0.01" value={costs.fruit.base} onChange={e=>updateCostLine('fruit','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Flete Int.</span><input type="number" value={costs.freight.base} onChange={e=>updateCostLine('freight','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Gastos Origen</span><input type="number" value={costs.origin.base} onChange={e=>updateCostLine('origin','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Aduana</span><input type="number" value={costs.aduana.base} onChange={e=>updateCostLine('aduana','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Otros</span><input type="number" value={costs.other.base} onChange={e=>updateCostLine('other','base', Number(e.target.value))}/></div>
            </div>
          </div>
        </div>

        {/* ANÁLISIS FINANCIERO */}
        <div className="ff-card analysis-card">
          <div className="analysis-header">
            <div className="ah-left">
              <Calculator size={20} className="text-green"/>
              <h3>Resumen de Venta</h3>
            </div>
            <div className="mini-badges">
              <div className="m-badge">Costo: <b>${analysis.totalCost.toLocaleString()}</b></div>
              <div className="m-badge green">Venta: <b>${analysis.totalSale.toLocaleString()}</b></div>
            </div>
          </div>

          <table className="analysis-table">
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>CONCEPTO</th>
                <th style={{textAlign:'right'}}>COSTO BASE</th>
                <th style={{textAlign:'center'}}>MARGEN (%)</th>
                <th style={{textAlign:'right'}}>PRECIO VENTA</th>
                <th style={{textAlign:'right'}}>IMPACTO</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.key}>
                  <td className="capitalize">{line.key === 'fruit' ? 'Fruta (Total)' : line.key}</td>
                  <td className="text-right">
                    <input className="table-input" type="number" value={costs[line.key].base} onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}/>
                  </td>
                  <td className="text-center">
                    <input className="table-input center" type="number" value={line.margin} onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}/>
                  </td>
                  <td className="text-right font-bold">USD {line.sale.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td className="text-right impact-tag">
                    {analysis.totalSale > 0 ? ((line.sale / analysis.totalSale) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="footer-flex">
            <div className="info-box"><Info size={14}/> <span>Precios editables. El cambio de margen afecta el precio de venta.</span></div>
            <div className="final-actions-group">
                <button className="ff-btn ff-btn-primary save-btn-extra" onClick={handleSave} disabled={busy}>
                    {busy ? <Loader2 size={16} className="spin"/> : <Save size={16}/>} Guardar Cambios
                </button>
                <div className="final-price-pill">
                <span className="fp-label">PRECIO FINAL POR CAJA</span>
                <span className="fp-value">USD {analysis.perBox.toFixed(2)}</span>
                </div>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        /* HEADER PRO STYLE */
        .header-pro { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 18px 24px; background: white; border: 1px solid #eef0f2; border-radius: 12px; }
        .header-left { display: flex; align-items: center; gap: 20px; flex: 1; }
        .logo-holder { width: 54px; height: 54px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
        
        .client-main-info h1 { font-size: 20px; font-weight: 800; color: #1a202c; margin: 0; }
        .title-row { display: flex; align-items: center; gap: 12px; }
        .status-badge-pro { font-size: 9px; font-weight: 800; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; background: #f1f5f9; color: #475569; }
        .status-badge-pro.won { background: #dcfce7; color: #166534; }
        .status-badge-pro.sent { background: #eff6ff; color: #1e40af; }
        
        .sub-row { display: flex; gap: 15px; font-size: 12px; color: #718096; align-items: center; margin-top: 4px; }
        .tax-label strong { color: #2d3748; }

        .header-stats-group { display: flex; gap: 20px; padding-left: 20px; border-left: 1px solid #edf2f7; margin-left: 10px; }
        .h-stat { display: flex; flex-direction: column; }
        .h-stat-label { font-size: 10px; font-weight: 700; color: #a0aec0; text-transform: uppercase; }
        .h-stat-val { font-size: 15px; font-weight: 800; color: #2d3748; }
        .v-divider { width: 1px; height: 30px; background: #edf2f7; }

        /* ACTIONS CLUSTER */
        .actions-cluster { display: flex; gap: 10px; align-items: center; }
        .status-pill-container { position: relative; display: flex; align-items: center; }
        .pill-icon { position: absolute; right: 12px; pointer-events: none; opacity: 0.5; }
        .status-pill-select { 
          appearance: none; border: 1px solid #e2e8f0; border-radius: 100px; 
          padding: 0 32px 0 16px; font-weight: 800; font-size: 11px; height: 38px; cursor: pointer; background: white;
        }
        .status-pill-select.won { color: #166534; border-color: #bcf0da; }

        .pdf-btn { height: 38px; background: white; border: 1px solid #e2e8f0; color: #64748b; font-weight: 700; }
        .save-btn { height: 38px; padding: 0 20px; font-weight: 700; border-radius: 10px; }

        /* GRID & CARDS */
        .config-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
        .config-card { padding: 20px; }
        .card-label { font-size: 11px; font-weight: 900; text-transform: uppercase; color: var(--ff-green); display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .config-grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 45%; min-width: 0; }
        .field.full { flex: 1 1 100%; }
        .flex-between { flex-direction: row !important; justify-content: space-between; align-items: center; }
        .field label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }

        .mini-toggle { display: flex; background: #f1f5f9; padding: 3px; border-radius: 8px; }
        .mini-toggle button { border: none; background: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; color: #94a3b8; }
        .mini-toggle button.active { background: #fff; color: var(--ff-green); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .mini-stats { display: flex; gap: 8px; width: 100%; margin-top: 8px; }
        .ms-item { flex: 1; background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
        .ms-item span { display: block; font-size: 9px; font-weight: 800; color: #94a3b8; }
        .ms-item input { width: 100%; border: none; background: transparent; text-align: center; font-weight: 900; font-size: 13px; outline: none; }

        .costs-entry-list { display: flex; flex-direction: column; gap: 10px; }
        .ce-item { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
        .ce-item span { font-size: 13px; font-weight: 600; color: #475569; }
        .ce-item input { width: 90px; text-align: right; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; font-weight: 700; }

        /* ANALYSIS */
        .analysis-card { padding: 30px; }
        .analysis-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .ah-left { display: flex; align-items: center; gap: 12px; }
        .ah-left h3 { margin: 0; font-size: 18px; font-weight: 800; }
        .m-badge { background: #f8fafc; padding: 8px 16px; border-radius: 12px; font-size: 12px; border: 1px solid #e2e8f0; }
        .m-badge.green { background: #f0fdf4; color: var(--ff-green); border-color: #dcfce7; }

        .analysis-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .analysis-table th { padding: 12px; border-bottom: 2px solid #f8fafc; font-size: 11px; color: #94a3b8; text-transform: uppercase; }
        .analysis-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .table-input { width: 100px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; font-weight: 700; text-align: right; }
        .table-input.center { text-align: center; color: var(--ff-green); width: 70px; }

        /* FOOTER ACTIONS */
        .footer-flex { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #f1f5f9; padding-top: 25px; }
        .final-actions-group { display: flex; align-items: center; gap: 15px; }
        .save-btn-extra { height: 60px; padding: 0 25px; font-weight: 800; border-radius: 12px; font-size: 14px; display: flex; gap: 10px; }
        
        .final-price-pill { background: #1e293b; color: white; padding: 10px 24px; border-radius: 12px; text-align: right; min-width: 200px; }
        .fp-label { display: block; font-size: 10px; font-weight: 800; opacity: 0.6; margin-bottom: 2px; }
        .fp-value { font-size: 26px; font-weight: 900; letter-spacing: -1px; }

        .ff-toast { position: fixed; bottom: 24px; right: 24px; background: #1e293b; color: white; padding: 14px 28px; border-radius: 12px; font-weight: 700; z-index: 1000; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}