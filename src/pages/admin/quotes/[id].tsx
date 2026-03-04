import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, Boxes, Weight, 
  Globe, DollarSign, Thermometer, Droplets, Info, TrendingUp, Calculator
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

  // --- ESTADOS DE CONFIGURACIÓN ---
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

  // --- ESTADOS DE COSTOS Y MÁRGENES ---
  // Inicializamos márgenes individuales para el análisis detallado
  const [costs, setCosts] = useState({
    fruit: { base: 13.30, margin: 15 },
    freight: { base: 0, margin: 10 },
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
    const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();

    if (quote) {
      setData(quote);
      setStatus(quote.status);
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
      // Mapeo dinámico para mantener la estructura de la tabla
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
    }
    const { data: pList } = await supabase.from("products").select("*");
    if (pList) setProducts(pList);
    setLoading(false);
  }

  useEffect(() => { if (authOk && id) loadData(id as string); }, [authOk, id]);

  // --- LÓGICA DE CÁLCULO ANALÍTICO ---
  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]) => {
      const baseTotal = key === 'fruit' ? val.base * boxes : val.base;
      const marginFact = val.margin / 100;
      const sale = marginFact < 1 ? baseTotal / (1 - marginFact) : baseTotal;
      return { key, baseTotal, sale, margin: val.margin };
    });

    const totalCost = lines.reduce((acc, curr) => acc + curr.baseTotal, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    const profit = totalSale - totalCost;

    return {
      lines,
      totalCost,
      totalSale,
      profit,
      perBox: boxes > 0 ? totalSale / boxes : 0
    };
  }, [costs, boxes]);

  const updateCostLine = (key: string, field: 'base' | 'margin', value: number) => {
    setCosts(prev => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof costs], [field]: value }
    }));
  };

  async function handleSave() {
    setBusy(true);
    const payload = {
      status, boxes, weight_kg: weightKg, mode, destination: place, product_id: productId,
      margin_markup: costs.fruit.margin, // Mantenemos el principal para compatibilidad
      product_details: { variety, color, brix },
      costs: { 
        c_fruit: costs.fruit.base, c_freight: costs.freight.base, c_origin: costs.origin.base, 
        c_aduana: costs.aduana.base, c_insp: costs.insp.base, c_doc: costs.doc.base, 
        c_tax: costs.tax.base, c_other: costs.other.base,
        // Guardamos los márgenes individuales
        m_freight: costs.freight.margin, m_origin: costs.origin.margin, m_aduana: costs.aduana.margin
      },
      totals: { total: analysis.totalSale, profit: analysis.profit, per_box: analysis.perBox, meta: { incoterm, pallets, place } }
    };
    const { error } = await supabase.from("quotes").update(payload).eq("id", id);
    setBusy(false);
    if (!error) { setToast("Cotización actualizada"); setTimeout(() => setToast(null), 2000); }
  }

  return (
    <AdminLayout title={`Cotización ${data?.quote_number || '...'}`}>
      <div className="ff-content ff-content--wide">
        
        {/* BARRA SUPERIOR ESTATICA */}
        <div className="ff-card ff-card-pad header-flex">
          <div className="client-brand">
            <div className="avatar-box"><Building2 size={18} /></div>
            <div>
              <h2 className="client-name">{data?.client_snapshot?.name || "Cargando..."}</h2>
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

        {/* FILA DE CONFIGURACION: 3 COLUMNAS (33% cada una) */}
        <div className="config-row">
          <div className="ff-card config-card">
            <div className="card-label"><Package size={14}/> Producto y Calidad</div>
            <div className="config-grid">
              <div className="field full">
                <label>Producto Base</label>
                <select className="ff-input" value={productId} onChange={e => setProductId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field full"><label>Variedad</label><input className="ff-input" value={variety} onChange={e => setVariety(e.target.value)} /></div>
              <div className="field"><label>Color</label><input className="ff-input" value={color} onChange={e => setColor(e.target.value)} /></div>
              <div className="field"><label>Brix</label><input className="ff-input" value={brix} onChange={e => setBrix(e.target.value)} /></div>
            </div>
          </div>

          <div className="ff-card config-card">
            <div className="card-label"><Ship size={14}/> Configuración Logística</div>
            <div className="config-grid">
              <div className="field full" style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <label>Modo</label>
                <div className="mini-toggle">
                  <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={12}/></button>
                  <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={12}/></button>
                </div>
              </div>
              <div className="field"><label>Incoterm</label>
                <select className="ff-input" value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                  <option value="CIP">CIP</option><option value="CIF">CIF</option><option value="FOB">FOB</option><option value="DDP">DDP</option>
                </select>
              </div>
              <div className="field full"><label>Destino</label><LocationSelector mode={mode} value={place} onChange={setPlace} /></div>
              <div className="mini-stats">
                 <div className="ms-item"><span>Cajas</span><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div>
                 <div className="ms-item"><span>Pallets</span><input type="number" value={pallets} onChange={e=>setPallets(Number(e.target.value))}/></div>
                 <div className="ms-item"><span>Peso KG</span><input type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
              </div>
            </div>
          </div>

          <div className="ff-card config-card">
            <div className="card-label"><DollarSign size={14}/> Estructura de Costos Base</div>
            <div className="costs-entry-list">
               <div className="ce-item"><span>Fruta ($/caja)</span><input type="number" step="0.01" value={costs.fruit.base} onChange={e=>updateCostLine('fruit','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Flete Int.</span><input type="number" value={costs.freight.base} onChange={e=>updateCostLine('freight','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Gastos Origen</span><input type="number" value={costs.origin.base} onChange={e=>updateCostLine('origin','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Aduana</span><input type="number" value={costs.aduana.base} onChange={e=>updateCostLine('aduana','base', Number(e.target.value))}/></div>
               <div className="ce-item"><span>Otros</span><input type="number" value={costs.other.base} onChange={e=>updateCostLine('other','base', Number(e.target.value))}/></div>
            </div>
          </div>
        </div>

        {/* RESUMEN ANALITICO INFERIOR (CENTRADO 75%) */}
        <div className="analysis-container">
          <div className="ff-card analysis-card">
            <div className="analysis-header">
              <div className="ah-title">
                <Calculator size={20}/>
                <h3>Resumen Financiero y Análisis de Venta</h3>
              </div>
              <div className="mini-badges">
                <div className="m-badge">Costo: <b>${analysis.totalCost.toLocaleString()}</b></div>
                <div className="m-badge green">Venta: <b>${analysis.totalSale.toLocaleString()}</b></div>
                <div className="m-badge alt">Utilidad: <b>${analysis.profit.toLocaleString()}</b></div>
              </div>
            </div>

            <table className="analysis-table">
              <thead>
                <tr>
                  <th>CONCEPTO</th>
                  <th className="text-right">COSTO BASE (USD)</th>
                  <th className="text-center">MARGEN (%)</th>
                  <th className="text-right">PRECIO VENTA</th>
                  <th className="text-right">IMPACTO</th>
                </tr>
              </thead>
              <tbody>
                {analysis.lines.map((line) => (
                  <tr key={line.key}>
                    <td className="capitalize">{line.key === 'fruit' ? 'Fruta (Total Cajas)' : line.key}</td>
                    <td className="text-right">
                      <input 
                        className="table-input" 
                        type="number" 
                        value={costs[line.key as keyof typeof costs].base} 
                        onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}
                      />
                    </td>
                    <td className="text-center">
                      <input 
                        className="table-input center" 
                        type="number" 
                        value={line.margin} 
                        onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}
                      />
                    </td>
                    <td className="text-right font-bold">USD {line.sale.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td className="text-right impact-text">
                      {analysis.totalSale > 0 ? ((line.sale / analysis.totalSale) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTALES</td>
                  <td className="text-right">USD {analysis.totalCost.toLocaleString()}</td>
                  <td className="text-center">-</td>
                  <td className="text-right sale-total">USD {analysis.totalSale.toLocaleString()}</td>
                  <td className="text-right">100%</td>
                </tr>
              </tfoot>
            </table>

            <div className="final-unit-badge">
               <div className="sub">PRECIO FINAL POR CAJA SUGERIDO</div>
               <div className="val">USD {analysis.perBox.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .client-brand { display: flex; gap: 12px; align-items: center; }
        .avatar-box { background: var(--ff-bg); color: var(--ff-green); padding: 8px; border-radius: 8px; border: 1px solid var(--ff-border); }
        .client-name { margin: 0; font-size: 16px; font-weight: 800; }
        .client-meta { display: flex; gap: 10px; font-size: 11px; color: var(--ff-muted); margin-top: 2px; }
        .client-meta span { display: flex; align-items: center; gap: 4px; }
        
        /* FILA SUPERIOR */
        .config-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
        .config-card { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
        .card-label { font-size: 11px; font-weight: 900; text-transform: uppercase; color: var(--ff-green); display: flex; align-items: center; gap: 6px; }
        .config-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 45%; min-width: 0; }
        .field.full { flex: 1 1 100%; }
        .field label { font-size: 10px; font-weight: 700; color: var(--ff-muted); }
        
        .mini-toggle { display: flex; background: var(--ff-bg); padding: 2px; border-radius: 6px; }
        .mini-toggle button { border: none; background: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; color: #94a3b8; }
        .mini-toggle button.active { background: #fff; color: var(--ff-green); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        .mini-stats { display: flex; gap: 8px; width: 100%; margin-top: 4px; }
        .ms-item { flex: 1; background: var(--ff-bg); padding: 6px; border-radius: 6px; text-align: center; border: 1px solid var(--ff-border); }
        .ms-item span { display: block; font-size: 9px; font-weight: 700; color: var(--ff-muted); }
        .ms-item input { width: 100%; border: none; background: transparent; text-align: center; font-weight: 800; font-size: 12px; outline: none; }

        .costs-entry-list { display: flex; flex-direction: column; gap: 6px; }
        .ce-item { display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
        .ce-item span { font-weight: 600; color: #475569; }
        .ce-item input { width: 80px; text-align: right; border: 1px solid var(--ff-border); border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 700; }

        /* ANALISIS INFERIOR */
        .analysis-container { display: flex; justify-content: center; padding-bottom: 40px; }
        .analysis-card { width: 75%; padding: 24px; border-top: 4px solid var(--ff-green); }
        .analysis-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .ah-title { display: flex; align-items: center; gap: 12px; color: var(--ff-text); }
        .ah-title h3 { margin: 0; font-size: 18px; font-weight: 800; }
        
        .mini-badges { display: flex; gap: 10px; }
        .m-badge { background: #f8fafc; padding: 6px 12px; border-radius: 20px; font-size: 11px; border: 1px solid var(--ff-border); }
        .m-badge.green { background: #f0fdf4; color: var(--ff-green); border-color: #dcfce7; }
        .m-badge.alt { background: #eff6ff; color: #2563eb; border-color: #dbeafe; }

        .analysis-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .analysis-table th { font-size: 10px; font-weight: 800; color: var(--ff-muted); padding: 10px; border-bottom: 2px solid var(--ff-bg); text-align: left; }
        .analysis-table td { padding: 12px 10px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
        .table-input { width: 90px; border: 1px solid var(--ff-border); border-radius: 4px; padding: 4px 8px; font-size: 12px; font-weight: 700; font-family: inherit; }
        .table-input.center { text-align: center; width: 60px; color: var(--ff-green); }
        .impact-text { color: var(--ff-muted); font-weight: 600; font-size: 11px; }
        .sale-total { font-weight: 900; color: var(--ff-green); font-size: 14px; }
        
        .analysis-table tfoot td { font-weight: 800; padding: 16px 10px; background: #f8fafc; }

        .final-unit-badge { background: var(--ff-green); color: #fff; padding: 20px; border-radius: 12px; text-align: center; }
        .final-unit-badge .sub { font-size: 10px; font-weight: 700; opacity: 0.8; margin-bottom: 4px; }
        .final-unit-badge .val { font-size: 32px; font-weight: 900; letter-spacing: -1px; }

        .capitalize { text-transform: capitalize; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        
        .ff-toast { position: fixed; bottom: 20px; right: 20px; background: var(--ff-green); color: white; padding: 12px 24px; border-radius: 6px; font-weight: 700; box-shadow: var(--ff-shadow); z-index: 100; font-size: 12px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}