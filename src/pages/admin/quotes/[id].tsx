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

  async function fetchVarieties(pId: string) {
    if (!pId) return;
    const { data: p } = await supabase.from("products").select("varieties").eq("id", pId).single();
    if (p?.varieties) setVarieties(p.varieties);
  }

  async function loadData(quoteId: string) {
    setLoading(true);
    const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();

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
    const { error } = await supabase.from("quotes").update(payload).eq("id", id);
    setBusy(false);
    if (!error) { setToast("Cambios guardados"); setTimeout(() => setToast(null), 2000); }
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="ff-card-pad">Cargando datos...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.quote_number || id?.slice(0,8)}`}>
      <div className="ff-content ff-content--wide printable-area">
        
        {/* HEADER CON CLIENTE Y TAX ID */}
        <div className="ff-card ff-card-pad header-flex no-print">
          <div className="client-brand">
            <div className="avatar-box"><Building2 size={22} /></div>
            <div className="client-info-stack">
              <h2 className="client-name">{data?.client_snapshot?.name || "Cliente no definido"}</h2>
              <div className="client-meta">
                <span className="meta-item"><FileText size={12}/> {data?.client_snapshot?.tax_id || "Sin Tax ID"}</span>
                <span className="meta-item"><Globe size={12}/> {data?.client_snapshot?.contact_email || "N/A"}</span>
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
            <button className="ff-btn ff-btn-secondary" onClick={() => window.print()}>
              <Download size={16}/> <span>PDF</span>
            </button>
            <button className="ff-btn ff-btn-primary save-btn" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin"/> : <Save size={16}/>} <span>Guardar</span>
            </button>
          </div>
        </div>

        <div className="config-row no-print">
          {/* Producto */}
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

          {/* Logistica */}
          <div className="ff-card config-card">
            <div className="card-label"><Ship size={14}/> Logística</div>
            <div className="config-grid">
              <div className="field full flex-between">
                <label>Transporte</label>
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
                 <div className="ms-item"><span>KG Total</span><input type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
              </div>
            </div>
          </div>

          {/* Costos */}
          <div className="ff-card config-card">
            <div className="card-label"><DollarSign size={14}/> Costos Base</div>
            <div className="costs-entry-list">
               <div className="ce-item"><span>Fruta ($/u)</span><input type="number" step="0.01" value={costs.fruit.base} onChange={e=>updateCostLine('fruit','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Flete Int.</span><input type="number" value={costs.freight.base} onChange={e=>updateCostLine('freight','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Origen</span><input type="number" value={costs.origin.base} onChange={e=>updateCostLine('origin','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Aduana</span><input type="number" value={costs.aduana.base} onChange={e=>updateCostLine('aduana','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Otros</span><input type="number" value={costs.other.base} onChange={e=>updateCostLine('other','base', Number(e.target.value))}/></div>
            </div>
          </div>
        </div>

        {/* ANALISIS FINANCIERO 100% ANCHO */}
        <div className="ff-card analysis-card full-width">
          <div className="analysis-header">
            <div className="ah-left">
              <Calculator size={20} className="text-green"/>
              <h3>Resumen Financiero y Análisis</h3>
            </div>
            <div className="mini-badges no-print">
              <div className="m-badge">Costo: <b>${analysis.totalCost.toLocaleString()}</b></div>
              <div className="m-badge green">Venta: <b>${analysis.totalSale.toLocaleString()}</b></div>
              <div className="m-badge utility">Profit: <b>${analysis.profit.toLocaleString()}</b></div>
            </div>
          </div>

          <table className="analysis-table">
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>CONCEPTO</th>
                <th style={{textAlign:'right'}}>BASE (USD)</th>
                <th style={{textAlign:'center'}}>MARGEN %</th>
                <th style={{textAlign:'right'}}>VENTA</th>
                <th style={{textAlign:'right'}}>IMP. %</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.key}>
                  <td className="capitalize">{line.key === 'fruit' ? 'Fruta (Total)' : line.key}</td>
                  <td className="text-right">
                    <input className="table-input no-print" type="number" value={costs[line.key].base} onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}/>
                    <span className="print-only">${costs[line.key].base.toLocaleString()}</span>
                  </td>
                  <td className="text-center">
                    <input className="table-input center no-print" type="number" value={line.margin} onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}/>
                    <span className="print-only">{line.margin}%</span>
                  </td>
                  <td className="text-right font-bold">${line.sale.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td className="text-right impact-tag">{analysis.totalSale > 0 ? ((line.sale/analysis.totalSale)*100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="footer-flex">
            <div className="info-box"><Info size={14}/> <span>Precios calculados sobre embarque total.</span></div>
            <div className="final-price-pill">
               <span className="fp-label">PRECIO FINAL POR CAJA</span>
               <span className="fp-value">USD {analysis.perBox.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .client-brand { display: flex; gap: 16px; align-items: center; }
        .avatar-box { background: #f0fdf4; color: var(--ff-green); width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; border: 1px solid rgba(0,0,0,0.05); }
        .client-name { margin: 0; font-size: 19px; font-weight: 800; color: #1e293b; }
        .client-meta { display: flex; gap: 15px; margin-top: 2px; }
        .meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #64748b; }

        .actions-cluster { display: flex; gap: 12px; align-items: center; }
        .status-pill-container { position: relative; display: flex; align-items: center; }
        .status-pill-select { 
          appearance: none; border-radius: 100px; padding: 0 35px 0 18px; 
          font-weight: 800; font-size: 11px; height: 38px; cursor: pointer; border: 1px solid transparent;
        }
        .status-pill-select.draft { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
        .status-pill-select.sent { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
        .status-pill-select.won { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
        .pill-icon { position: absolute; right: 12px; pointer-events: none; opacity: 0.7; }
        
        .config-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
        .config-card { padding: 20px; }
        .full-width { width: 100% !important; }

        .analysis-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .analysis-table th { padding: 12px; border-bottom: 2px solid #f8fafc; font-size: 11px; color: #94a3b8; }
        .analysis-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
        .table-input { width: 85px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; text-align: right; font-weight: 700; }
        .table-input.center { text-align: center; width: 60px; color: var(--ff-green); }

        .footer-flex { display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid #f1f5f9; }
        .final-price-pill { background: #f8fafc; border: 2px solid var(--ff-green); padding: 8px 18px; border-radius: 12px; text-align: right; }
        .fp-label { display: block; font-size: 9px; font-weight: 800; color: var(--ff-green); }
        .fp-value { font-size: 22px; font-weight: 900; color: #1e293b; }

        .text-green { color: var(--ff-green); }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .capitalize { text-transform: capitalize; }
        .font-bold { font-weight: 700; }
        .ff-toast { position: fixed; bottom: 24px; right: 24px; background: var(--ff-green); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 800; z-index: 9999; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media print {
          .no-print { display: none !important; }
          .print-only { display: inline !important; }
          .printable-area { padding: 0; }
          .ff-card { border: none; box-shadow: none; }
        }
        .print-only { display: none; }
      `}</style>
    </AdminLayout>
  );
}