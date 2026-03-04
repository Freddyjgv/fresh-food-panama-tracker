import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, 
  Globe, DollarSign, Calculator, MapPin, ChevronDown, Info
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

  // --- ESTADOS DE FORMULARIO (Mantenemos tu lógica original) ---
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
    // FIX CRÍTICO: Probamos con 'clients' (tu código anterior) y fallback a 'client' 
    const { data: quote } = await supabase
      .from("quotes")
      .select(`*, clients ( name, tax_id, contact_email )`)
      .eq("id", quoteId)
      .single();

    if (quote) {
      setData(quote);
      setStatus(quote.status || "draft");
      setBoxes(quote.boxes || 0);
      setWeightKg(quote.weight_kg || 0);
      setPallets(quote.pallets || 0);
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

  async function fetchVarieties(pId: string) {
    if (!pId) return;
    const { data: vList } = await supabase.from("product_varieties").select("name").eq("product_id", pId);
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
    return { lines, totalSale, perBox: boxes > 0 ? totalSale / boxes : 0 };
  }, [costs, boxes]);

  const updateCostLine = (key: string, field: 'base' | 'margin', value: number) => {
    setCosts((prev: any) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  async function handleSave() {
    setBusy(true);
    const payload = {
      status, boxes, weight_kg: weightKg, pallets, mode, destination: place, product_id: productId,
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

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center">Cargando...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${data?.quote_number || id}`}>
      <div className="ff-container">
        
        {/* NUEVO HEADER PRO (Basado en Captura) */}
        <div className="ff-header-pro">
          <div className="ff-hp-left">
            <div className="ff-hp-icon"><Building2 size={24} /></div>
            <div className="ff-hp-client-info">
              <div className="ff-hp-title-row">
                <h1>{data?.clients?.name || data?.client_name || "Cliente no definido"}</h1>
                <span className="ff-hp-badge">{data?.quote_number}</span>
              </div>
              <div className="ff-hp-sub-row">
                <span>Tax ID: <strong>{data?.clients?.tax_id || "Pendiente"}</strong></span>
                <span><MapPin size={12}/> {place || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="ff-hp-right">
            <div className="ff-hp-stat">
              <label>ESTADO</label>
              <div className={`ff-hp-pill ${status}`}>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="draft">BORRADOR</option>
                  <option value="sent">ENVIADA</option>
                  <option value="won">GANADA</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
            <div className="ff-hp-stat">
              <label>CAJAS</label>
              <strong>{boxes}</strong>
            </div>
            <div className="ff-hp-stat">
              <label>TOTAL VENTA</label>
              <strong className="ff-hp-total">USD {analysis.totalSale.toLocaleString(undefined, {minimumFractionDigits:0})}</strong>
            </div>
            <button className="ff-hp-btn-save" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Guardar
            </button>
          </div>
        </div>

        {/* CUADRICULA DE CONFIGURACIÓN (Tus 3 cards originales) */}
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

        {/* TABLA DE ANÁLISIS (Mantenemos tu lógica de tabla) */}
        <div className="ff-analysis-card">
          <div className="ff-analysis-header">
            <div className="ff-ah-left"><Calculator size={18}/> <h3>Análisis de Venta</h3></div>
            <div className="ff-ah-right">
              <div className="ff-tag">Subtotal: <b>${analysis.totalSale.toFixed(0)}</b></div>
            </div>
          </div>

          <table className="ff-table">
            <thead>
              <tr>
                <th align="left">CONCEPTO</th>
                <th align="center">COSTO BASE</th>
                <th align="center">MARGEN (%)</th>
                <th align="center">PRECIO VENTA</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.key}>
                  <td className="ff-concept">{line.key === 'fruit' ? 'Fruta (Total)' : line.key}</td>
                  <td align="center"><input className="ff-td-input" type="number" value={costs[line.key].base} onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}/></td>
                  <td align="center"><input className="ff-td-input green" type="number" value={line.margin} onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}/></td>
                  <td align="center" className="ff-td-bold">USD {line.sale.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ff-footer">
            <div className="ff-footer-info"><Info size={14}/> <span>Precios editables según margen.</span></div>
            <div className="ff-final-price">
              <span className="ff-fp-label">PRECIO FINAL POR CAJA</span>
              <span className="ff-fp-value">USD {analysis.perBox.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .ff-container { padding: 25px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; background: #fbfcfd; }
        
        /* HEADER PRO STYLE */
        .ff-header-pro { background: white; padding: 20px 30px; border-radius: 16px; border: 1px solid #eef0f2; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .ff-hp-left { display: flex; align-items: center; gap: 20px; }
        .ff-hp-icon { width: 50px; height: 50px; background: #f8fafc; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; color: #1e293b; }
        .ff-hp-title-row { display: flex; align-items: center; gap: 12px; }
        .ff-hp-title-row h1 { margin: 0; font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; }
        .ff-hp-badge { background: #f1f5f9; color: #475569; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid #e2e8f0; }
        .ff-hp-sub-row { margin-top: 4px; display: flex; gap: 15px; font-size: 13px; color: #64748b; }
        
        .ff-hp-right { display: flex; align-items: center; gap: 35px; }
        .ff-hp-stat { display: flex; flex-direction: column; gap: 2px; }
        .ff-hp-stat label { font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em; }
        .ff-hp-stat strong { font-size: 18px; font-weight: 800; color: #1e293b; }
        .ff-hp-total { font-size: 20px !important; color: #166534 !important; }

        .ff-hp-pill { position: relative; background: #f0fdf4; color: #166534; padding: 6px 12px; border-radius: 8px; border: 1px solid #dcfce7; display: flex; align-items: center; }
        .ff-hp-pill select { appearance: none; background: transparent; border: none; font-weight: 800; font-size: 11px; cursor: pointer; outline: none; padding-right: 15px; color: inherit; }

        .ff-hp-btn-save { background: white; border: 1.5px solid #e2e8f0; color: #475569; padding: 10px 20px; border-radius: 10px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; }
        .ff-hp-btn-save:hover { background: #f8fafc; border-color: #cbd5e1; }

        /* GRID & CARDS */
        .ff-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .ff-card { background: white; border: 1px solid #eef0f2; border-radius: 14px; }
        .ff-card-label { padding: 14px 20px; font-size: 10px; font-weight: 800; color: #166534; border-bottom: 1px solid #f8fafc; display: flex; align-items: center; gap: 8px; }
        .ff-card-body { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .ff-card-body label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .ff-input { padding: 10px; border: 1.5px solid #eef2f6; border-radius: 8px; font-size: 14px; font-weight: 600; outline: none; }
        .ff-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ff-row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .ff-row-between { display: flex; justify-content: space-between; align-items: center; }
        .ff-toggle { background: #f1f5f9; padding: 3px; border-radius: 8px; display: flex; }
        .ff-toggle button { border: none; background: transparent; padding: 5px 12px; border-radius: 6px; cursor: pointer; color: #94a3b8; }
        .ff-toggle button.active { background: white; color: #166534; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .ff-metric { background: #f8fafc; padding: 8px; border-radius: 8px; border: 1.5px solid #eef2f6; text-align: center; }
        .ff-metric span { display: block; font-size: 8px; font-weight: 800; color: #94a3b8; }
        .ff-metric input { width: 100%; background: transparent; border: none; text-align: center; font-weight: 800; outline: none; }
        .ff-cost-item { display: flex; justify-content: space-between; align-items: center; }
        .ff-cost-item input { width: 80px; text-align: right; border: 1.5px solid #eef2f6; border-radius: 6px; padding: 4px 8px; font-weight: 700; }

        /* ANALYSIS */
        .ff-analysis-card { background: white; border: 1px solid #eef0f2; border-radius: 14px; padding: 25px; }
        .ff-analysis-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .ff-tag { padding: 5px 12px; background: #f0fdf4; color: #166534; border-radius: 20px; font-size: 12px; font-weight: 700; }
        .ff-table { width: 100%; border-collapse: collapse; }
        .ff-table th { text-align: left; padding: 12px; font-size: 10px; color: #94a3b8; border-bottom: 2px solid #f8fafc; }
        .ff-td-input { width: 80px; padding: 6px; border: 1.5px solid #eef2f6; border-radius: 6px; text-align: center; font-weight: 700; }
        .ff-td-bold { font-weight: 800; color: #1e293b; }

        .ff-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f5f9; }
        .ff-footer-info { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; }
        .ff-final-price { background: #1e293b; color: white; padding: 12px 25px; border-radius: 12px; text-align: right; }
        .ff-fp-label { display: block; font-size: 9px; opacity: 0.6; font-weight: 700; }
        .ff-fp-value { font-size: 24px; font-weight: 900; }
        
        .ff-toast { position: fixed; bottom: 20px; right: 20px; background: #1e293b; color: white; padding: 12px 20px; border-radius: 8px; font-weight: 700; }
      `}</style>
    </AdminLayout>
  );
}