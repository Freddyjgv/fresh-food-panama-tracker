import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, 
  Globe, DollarSign, Thermometer, Droplets, Info, Calculator, ChevronDown
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
  const [varieties, setVarieties] = useState<any[]>([]);

  // --- ESTADOS DE FORMULARIO ---
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

  // CARGA DE DATOS INICIAL
  async function loadData(quoteId: string) {
    setLoading(true);
    const { data: quote } = await supabase
      .from("quotes")
      .select(`
        *,
        clients ( name, tax_id, contact_email )
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

      if (quote.product_id) fetchVarieties(quote.product_id);
    }
    
    const { data: pList } = await supabase.from("products").select("*");
    if (pList) setProducts(pList);
    setLoading(false);
  }

  // EVOLUCIÓN: Carga desde la tabla product_varieties
  async function fetchVarieties(pId: string) {
    if (!pId) return;
    const { data: vList } = await supabase
      .from("product_varieties")
      .select("name")
      .eq("product_id", pId);
    if (vList) setVarieties(vList);
  }

  useEffect(() => { if (authOk && id) loadData(id as string); }, [authOk, id]);

  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]: [string, any]) => {
      const baseTotal = key === 'fruit' ? val.base * (boxes || 1) : val.base;
      const marginFact = val.margin / 100;
      const sale = marginFact < 1 ? baseTotal / (1 - marginFact) : baseTotal;
      return { key, baseTotal, sale, margin: val.margin };
    });
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    return {
      lines, 
      totalSale,
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
      totals: { total: analysis.totalSale, per_box: analysis.perBox }
    };
    await supabase.from("quotes").update(payload).eq("id", id as string);
    setBusy(false);
    setToast("Cambios guardados");
    setTimeout(() => setToast(null), 2000);
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center text-slate-400">Cargando cotización...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${data?.quote_number || id?.slice(0,8)}`}>
      <div className="ff-container">
        
        {/* CABECERA DE CLIENTE */}
        <div className="ff-header">
          <div className="ff-header-info">
            <div className="ff-icon-box"><Building2 size={22} /></div>
            <div className="ff-header-text">
              <h1>{data?.clients?.name || "Cliente no definido"}</h1>
              <p>
                <FileText size={12}/> {data?.clients?.tax_id || "Sin TAX ID"} &nbsp;•&nbsp; 
                <Globe size={12}/> {data?.clients?.contact_email || "N/A"}
              </p>
            </div>
          </div>
          <div className="ff-header-actions">
            <div className="ff-status-wrapper">
               <select className={`ff-status-select ${status}`} value={status} onChange={e => setStatus(e.target.value)}>
                 <option value="draft">BORRADOR</option>
                 <option value="sent">ENVIADA</option>
                 <option value="won">GANADA</option>
               </select>
               <ChevronDown size={14} className="ff-chevron"/>
            </div>
            <button className="ff-btn-top-save" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Guardar
            </button>
          </div>
        </div>

        {/* CUADRICULA DE CONFIGURACIÓN */}
        <div className="ff-grid">
          <div className="ff-card">
            <div className="ff-card-label"><Package size={14}/> PRODUCTO Y CALIDAD</div>
            <div className="ff-card-body">
              <label>Producto Base</label>
              <select className="ff-input" value={productId} onChange={e => { setProductId(e.target.value); fetchVarieties(e.target.value); }}>
                <option value="">Seleccionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label>Variedad</label>
              <select className="ff-input" value={variety} onChange={e => setVariety(e.target.value)}>
                 <option value="">Seleccionar variedad...</option>
                 {varieties.map((v, i) => <option key={i} value={v.name}>{v.name}</option>)}
              </select>
              <div className="ff-row-2">
                <div><label>Color</label><input className="ff-input" value={color} onChange={e => setColor(e.target.value)} /></div>
                <div><label>Brix</label><input className="ff-input" value={brix} onChange={e => setBrix(e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="ff-card">
            <div className="ff-card-label"><Ship size={14}/> CONFIGURACIÓN LOGÍSTICA</div>
            <div className="ff-card-body">
              <div className="ff-row-between">
                <label>Transporte</label>
                <div className="ff-toggle">
                   <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={14}/></button>
                   <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={14}/></button>
                </div>
              </div>
              <label>Incoterm</label>
              <select className="ff-input" value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                <option value="CIP">CIP</option><option value="CIF">CIF</option><option value="FOB">FOB</option>
              </select>
              <label>Destino</label>
              <LocationSelector mode={mode} value={place} onChange={setPlace} />
              <div className="ff-row-3">
                <div className="ff-metric"><span>Cajas</span><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div>
                <div className="ff-metric"><span>Pallets</span><input type="number" value={pallets} onChange={e=>setPallets(Number(e.target.value))}/></div>
                <div className="ff-metric"><span>Peso KG</span><input type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
              </div>
            </div>
          </div>

          <div className="ff-card">
            <div className="ff-card-label"><DollarSign size={14}/> ESTRUCTURA DE COSTOS BASE</div>
            <div className="ff-card-body ff-costs">
               <div className="ff-cost-item"><span>Fruta ($/u)</span><input type="number" step="0.01" value={costs.fruit.base} onChange={e=>updateCostLine('fruit','base', Number(e.target.value))}/></div>
               <div className="ff-cost-item"><span>Flete Int.</span><input type="number" value={costs.freight.base} onChange={e=>updateCostLine('freight','base', Number(e.target.value))}/></div>
               <div className="ff-cost-item"><span>Origen</span><input type="number" value={costs.origin.base} onChange={e=>updateCostLine('origin','base', Number(e.target.value))}/></div>
               <div className="ff-cost-item"><span>Aduana</span><input type="number" value={costs.aduana.base} onChange={e=>updateCostLine('aduana','base', Number(e.target.value))}/></div>
               <div className="ff-cost-item"><span>Otros</span><input type="number" value={costs.other.base} onChange={e=>updateCostLine('other','base', Number(e.target.value))}/></div>
            </div>
          </div>
        </div>

        {/* TABLA RESUMEN (Alineado y Centrado Restaurado) */}
        <div className="ff-analysis-card">
          <div className="ff-analysis-header">
            <div className="ff-ah-left"><Calculator size={18}/> <h3>Resumen de Venta</h3></div>
            <div className="ff-ah-right">
              <div className="ff-tag">Costo: <b>$0</b></div>
              <div className="ff-tag green">Venta: <b>$0</b></div>
            </div>
          </div>

          <table className="ff-table">
            <thead>
              <tr>
                <th align="left">CONCEPTO</th>
                <th align="center">COSTO BASE</th>
                <th align="center">MARGEN (%)</th>
                <th align="center">PRECIO VENTA</th>
                <th align="right">IMPACTO</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.key}>
                  <td className="ff-concept">{line.key === 'fruit' ? 'Fruta (Total)' : line.key}</td>
                  <td align="center"><input className="ff-td-input" type="number" value={costs[line.key].base} onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}/></td>
                  <td align="center"><input className="ff-td-input green" type="number" value={line.margin} onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}/></td>
                  <td align="center" className="ff-td-bold">USD {line.sale.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                  <td align="right" className="ff-impact">0%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* BOTONES FINALES ARMONICOS (Basado en imagen_c9e521.png) */}
          <div className="ff-footer">
            <div className="ff-footer-info">
              <Info size={14}/> <span>Precios editables. El cambio de margen afecta el precio de venta.</span>
            </div>
            <div className="ff-footer-actions">
              <button className="ff-btn-save-final" onClick={handleSave} disabled={busy}>
                <Save size={16}/> {busy ? "Guardando..." : "Guardar Cambios"}
              </button>
              <div className="ff-final-price">
                <span className="ff-fp-label">PRECIO FINAL POR CAJA</span>
                <span className="ff-fp-value">USD {analysis.perBox.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .ff-container { padding: 30px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
        
        /* HEADER */
        .ff-header { background: white; padding: 18px 24px; border-radius: 12px; border: 1px solid #eef0f2; display: flex; justify-content: space-between; align-items: center; }
        .ff-header-info { display: flex; align-items: center; gap: 16px; }
        .ff-icon-box { width: 44px; height: 44px; background: #f0fdf4; color: #166534; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #dcfce7; }
        .ff-header-text h1 { margin: 0; font-size: 20px; font-weight: 800; color: #1e293b; letter-spacing: -0.02em; }
        .ff-header-text p { margin: 4px 0 0; font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 4px; }
        
        .ff-header-actions { display: flex; gap: 12px; align-items: center; }
        .ff-status-wrapper { position: relative; }
        .ff-status-select { appearance: none; padding: 10px 35px 10px 18px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-weight: 700; font-size: 12px; background: #f8fafc; cursor: pointer; color: #475569; }
        .ff-chevron { position: absolute; right: 12px; top: 12px; opacity: 0.5; }
        .ff-btn-top-save { background: #386e42; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; }

        /* GRID & CARDS */
        .ff-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .ff-card { background: white; border: 1px solid #eef0f2; border-radius: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .ff-card-label { padding: 14px 20px; font-size: 11px; font-weight: 800; color: #166534; border-bottom: 1px solid #f8fafc; display: flex; align-items: center; gap: 8px; letter-spacing: 0.05em; }
        .ff-card-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .ff-card-body label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: -8px; }

        .ff-input { width: 100%; padding: 10px 14px; border: 1.5px solid #eef2f6; border-radius: 10px; font-size: 14px; font-weight: 600; outline: none; transition: 0.2s; }
        .ff-input:focus { border-color: #386e42; }
        .ff-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ff-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 5px; }
        .ff-row-between { display: flex; justify-content: space-between; align-items: center; }

        .ff-toggle { background: #f1f5f9; padding: 4px; border-radius: 10px; display: flex; gap: 4px; }
        .ff-toggle button { border: none; background: transparent; padding: 6px 14px; border-radius: 8px; cursor: pointer; color: #94a3b8; }
        .ff-toggle button.active { background: white; color: #166534; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .ff-metric { background: #f8fafc; padding: 10px; border-radius: 10px; border: 1.5px solid #eef2f6; text-align: center; }
        .ff-metric span { display: block; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .ff-metric input { width: 100%; background: transparent; border: none; text-align: center; font-weight: 800; font-size: 15px; color: #1e293b; outline: none; }

        .ff-cost-item { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #f8fafc; }
        .ff-cost-item span { font-size: 14px; font-weight: 600; color: #475569; }
        .ff-cost-item input { width: 90px; text-align: right; border: 1.5px solid #eef2f6; border-radius: 8px; padding: 6px 10px; font-weight: 700; color: #1e293b; }

        /* ANALYSIS TABLE */
        .ff-analysis-card { background: white; border: 1px solid #eef0f2; border-radius: 14px; padding: 30px; }
        .ff-analysis-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .ff-ah-left { display: flex; align-items: center; gap: 12px; color: #1e293b; }
        .ff-ah-left h3 { font-size: 19px; font-weight: 800; margin: 0; }
        .ff-tag { padding: 6px 16px; border-radius: 100px; background: #f8fafc; font-size: 12px; border: 1px solid #e2e8f0; color: #64748b; }
        .ff-tag.green { background: #f0fdf4; color: #166534; border-color: #dcfce7; }

        .ff-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        .ff-table th { padding: 15px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; border-bottom: 2px solid #f8fafc; letter-spacing: 0.05em; }
        .ff-table td { padding: 16px 15px; border-bottom: 1px solid #f9fafb; font-size: 14px; }
        .ff-concept { font-weight: 600; color: #334155; text-transform: capitalize; }
        .ff-td-input { width: 100px; padding: 8px; border: 1.5px solid #eef2f6; border-radius: 8px; text-align: center; font-weight: 700; color: #1e293b; outline: none; }
        .ff-td-input.green { color: #166534; border-color: #dcfce7; }
        .ff-td-bold { font-weight: 800; color: #1e293b; }
        .ff-impact { color: #94a3b8; font-weight: 700; font-size: 12px; }

        /* FOOTER ACTIONS ARMONICOS */
        .ff-footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 30px; border-top: 1px solid #f1f5f9; }
        .ff-footer-info { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #94a3b8; font-style: italic; }
        .ff-footer-actions { display: flex; align-items: center; gap: 20px; }
        
        .ff-btn-save-final { background: #386e42; color: white; border: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; gap: 10px; font-size: 15px; transition: 0.2s; }
        .ff-btn-save-final:hover { transform: translateY(-1px); background: #2d5a35; }

        .ff-final-price { background: #1e293b; color: white; padding: 12px 30px; border-radius: 12px; text-align: right; min-width: 220px; }
        .ff-fp-label { display: block; font-size: 10px; font-weight: 700; opacity: 0.6; letter-spacing: 0.1em; }
        .ff-fp-value { font-size: 26px; font-weight: 900; letter-spacing: -1px; }

        .ff-toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 14px 28px; border-radius: 12px; font-weight: 700; z-index: 1000; box-shadow: 0 10px 20px rgba(0,0,0,0.15); }
      `}</style>
    </AdminLayout>
  );
}