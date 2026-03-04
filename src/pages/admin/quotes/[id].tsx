import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, Package, Loader2, Building2, Plane, Ship, 
  DollarSign, Info, MapPin, Calculator, TrendingUp
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

  // ESTADOS DE FORMULARIO
  const [status, setStatus] = useState("draft");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [place, setPlace] = useState("");
  const [productId, setProductId] = useState("");
  const [variety, setVariety] = useState("");
  const [color, setColor] = useState("2.75 - 3");
  const [brix, setBrix] = useState("> 13");

  // CONCEPTOS REESTABLECIDOS
  const [costs, setCosts] = useState<any>({
    fruit: { label: "Fruta ($/Cx)", base: 13.30, margin: 15 },
    freight: { label: "Flete Internacional", base: 0, margin: 0 },
    origin: { label: "Gastos en origen", base: 0, margin: 0 },
    docs: { label: "Gestion documental", base: 0, margin: 0 },
    inspeccion: { label: "Inspección", base: 0, margin: 0 },
    other: { label: "Otros gastos", base: 0, margin: 0 }
  });

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    const { data: quote } = await supabase
      .from("quotes")
      .select(`
        *,
        clients!client_id ( name, tax_id, contact_email, country, logo_url )
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
        fruit: { label: "Fruta ($/Cx)", base: c.c_fruit || 13.30, margin: quote.margin_markup || 15 },
        freight: { label: "Flete Internacional", base: c.c_freight || 0, margin: c.m_freight || 0 },
        origin: { label: "Gastos en origen", base: c.c_origin || 0, margin: c.m_origin || 0 },
        docs: { label: "Gestion documental", base: c.c_docs || 0, margin: c.m_docs || 0 },
        inspeccion: { label: "Inspección", base: c.c_inspeccion || 0, margin: c.m_inspeccion || 0 },
        other: { label: "Otros gastos", base: c.c_other || 0, margin: c.m_other || 0 }
      });

      if (quote.product_id) fetchVarieties(quote.product_id);
    }
    const { data: pList } = await supabase.from("products").select("*");
    if (pList) setProducts(pList);
    setLoading(false);
  }

  async function fetchVarieties(pId: string) {
    const { data: vList } = await supabase.from("product_varieties").select("name").eq("product_id", pId);
    if (vList) setVarieties(vList);
  }

  useEffect(() => { if (authOk && id) loadData(id as string); }, [authOk, id]);

  // ANÁLISIS FINANCIERO CON LÓGICA CIRCULAR
  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]: [string, any]) => {
      const base = Number(val.base) || 0;
      const margin = Number(val.margin) || 0;
      const sale = margin < 100 ? base / (1 - (margin / 100)) : base;
      return { key, label: val.label, base, margin, sale };
    });

    const totalBase = lines.reduce((acc, curr) => acc + curr.base, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    const totalProfit = totalSale - totalBase;
    const avgMargin = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

    return { lines, totalBase, totalSale, totalProfit, avgMargin, perBox: totalSale };
  }, [costs]);

  // ACTUALIZACIÓN DE LÓGICA: editar Venta afecta Margen
  const updateCostLine = (key: string, field: 'base' | 'margin' | 'sale', value: number) => {
    setCosts((prev: any) => {
      const current = { ...prev[key] };
      if (field === 'base') {
        current.base = value;
      } else if (field === 'margin') {
        current.margin = value;
      } else if (field === 'sale') {
        // Si edito venta: margen = (venta - costo) / venta
        const newMargin = value > 0 ? ((value - current.base) / value) * 100 : 0;
        current.margin = newMargin;
      }
      return { ...prev, [key]: current };
    });
  };

  async function handleSave() {
    setBusy(true);
    const payload = {
      status, boxes, weight_kg: weightKg, mode, destination: place, product_id: productId,
      product_details: { variety, color, brix },
      costs: { 
        c_fruit: costs.fruit.base, c_freight: costs.freight.base, c_origin: costs.origin.base, 
        c_docs: costs.docs.base, c_inspeccion: costs.inspeccion.base, c_other: costs.other.base,
        m_freight: costs.freight.margin, m_origin: costs.origin.margin, m_docs: costs.docs.margin
      },
      totals: { total_sale: analysis.totalSale * boxes, per_box: analysis.perBox }
    };
    await supabase.from("quotes").update(payload).eq("id", id as string);
    setBusy(false);
    setToast("Cambios guardados");
    setTimeout(() => setToast(null), 2000);
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center">Cargando datos...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.quote_number || '...'}`}>
      <div className="view-container">
        
        <header className="header-pro">
          <div className="header-left">
            <div className="logo-holder">
              {data?.clients?.logo_url ? <img src={data.clients.logo_url} alt="Logo" /> : <Building2 size={24} className="opacity-20" />}
            </div>
            <div className="client-main-info">
              <div className="title-row">
                <h1>{data?.clients?.name || "Cliente no definido"}</h1>
                <span className="quote-number-badge">{data?.quote_number || "S/N"}</span>
              </div>
              <div className="sub-row">
                <span>Tax ID: <strong>{data?.clients?.tax_id || 'N/A'}</strong></span>
                <span className="geo-label"><MapPin size={12}/> {data?.clients?.country || 'N/A'}</span>
              </div>
            </div>
            <div className="header-stats">
              <div className="h-stat">
                <span className="h-stat-label">Estado</span>
                <select className={`status-pill-select ${status}`} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="draft">BORRADOR</option>
                  <option value="sent">ENVIADA</option>
                  <option value="won">GANADA</option>
                </select>
              </div>
              <div className="v-divider"></div>
              <div className="h-stat"><span className="h-stat-label">Cajas</span><span className="h-stat-val">{boxes}</span></div>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-save-mini" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Guardar
            </button>
          </div>
        </header>

        <div className="ff-grid">
          <div className="ff-card">
            <div className="ff-card-label"><Package size={14}/> PRODUCTO Y CALIDAD</div>
            <div className="ff-card-body">
              <label>Fruta Base</label>
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
            <div className="ff-card-label"><Ship size={14}/> LOGÍSTICA</div>
            <div className="ff-card-body">
              <div className="ff-row-between">
                <label>Transporte</label>
                <div className="ff-toggle">
                   <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={14}/></button>
                   <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={14}/></button>
                </div>
              </div>
              <label>Destino</label>
              <LocationSelector mode={mode} value={place} onChange={setPlace} />
              <div className="ff-row-2">
                <div className="ff-metric"><span>Cajas</span><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div>
                <div className="ff-metric"><span>Peso KG</span><input type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
              </div>
            </div>
          </div>

          <div className="ff-card">
            <div className="ff-card-label"><DollarSign size={14}/> COSTO BASE RÁPIDO</div>
            <div className="ff-card-body ff-costs">
               {analysis.lines.slice(0,3).map(line => (
                 <div className="ff-cost-item" key={line.key}>
                   <span>{line.label}</span>
                   <input type="number" value={line.base} onChange={e=>updateCostLine(line.key,'base', Number(e.target.value))}/>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="ff-analysis-card">
          <div className="ff-card-label" style={{border:0, padding: "0 0 15px 0"}}><Calculator size={14}/> ANÁLISIS DE VENTA</div>
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
                  <td className="ff-concept">{line.label}</td>
                  <td align="center"><input className="ff-td-input" type="number" value={line.base} onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}/></td>
                  <td align="center"><input className="ff-td-input green" type="number" value={line.margin.toFixed(1)} onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}/></td>
                  <td align="center"><input className="ff-td-input bold" type="number" value={line.sale.toFixed(2)} onChange={e => updateCostLine(line.key, 'sale', Number(e.target.value))}/></td>
                  <td align="right" className="ff-impact">{analysis.totalSale > 0 ? ((line.sale / analysis.totalSale) * 100).toFixed(0) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="footer-pills-container">
            <div className="f-pill gray">
              <span className="f-pill-lbl">COSTO TOTAL</span>
              <span className="f-pill-val">USD {analysis.totalBase.toFixed(2)}</span>
            </div>
            <div className="f-pill gray">
              <span className="f-pill-lbl">PRECIO DE VENTA</span>
              <span className="f-pill-val">USD {analysis.totalSale.toFixed(2)}</span>
            </div>
            <div className="f-pill green">
              <span className="f-pill-lbl">MARGEN TOTAL</span>
              <span className="f-pill-val">{analysis.avgMargin.toFixed(1)}%</span>
            </div>
            <div className="f-pill dark">
              <span className="f-pill-lbl">VENTA POR CAJA</span>
              <span className="f-pill-val">USD {analysis.perBox.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .view-container { padding: 30px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; font-family: 'Inter', sans-serif; background: #fbfcfd; min-height: 100vh; }
        
        .header-pro { display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 24px; border-radius: 14px; border: 1px solid #eef0f2; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .logo-holder { width: 48px; height: 48px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #eef2f6; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; }
        .client-main-info h1 { font-size: 20px; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.02em; }
        .title-row { display: flex; align-items: center; gap: 10px; }
        .quote-number-badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 800; border: 1px solid #e2e8f0; }
        .sub-row { display: flex; gap: 15px; margin-top: 2px; font-size: 12px; color: #64748b; }
        .header-stats { display: flex; gap: 20px; padding-left: 20px; border-left: 1.5px solid #f1f5f9; margin-left: 5px; }
        .h-stat-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; }
        .h-stat-val { font-size: 15px; font-weight: 800; color: #1e293b; }
        .v-divider { width: 1px; height: 25px; background: #f1f5f9; align-self: center; }
        .status-pill-select { border: none; background: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 6px; cursor: pointer; }

        .ff-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .ff-card { background: white; border: 1px solid #eef0f2; border-radius: 12px; }
        .ff-card-label { padding: 12px 16px; font-size: 10px; font-weight: 800; color: #166534; border-bottom: 1px solid #f8fafc; display: flex; align-items: center; gap: 8px; text-transform: uppercase; }
        .ff-card-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .ff-card-body label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: -6px; }
        .ff-input { width: 100%; padding: 8px 12px; border: 1.5px solid #eef2f6; border-radius: 8px; font-size: 13px; font-weight: 600; outline: none; }
        .ff-metric { background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #eef2f6; text-align: center; }
        .ff-metric span { display: block; font-size: 8px; font-weight: 700; color: #94a3b8; }
        .ff-metric input { width: 100%; background: transparent; border: none; text-align: center; font-weight: 800; font-size: 14px; outline: none; }
        .ff-toggle { background: #f1f5f9; padding: 3px; border-radius: 8px; display: flex; gap: 2px; }
        .ff-toggle button { border: none; background: transparent; padding: 4px 10px; border-radius: 6px; cursor: pointer; color: #94a3b8; }
        .ff-toggle button.active { background: white; color: #166534; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }

        .ff-cost-item { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #f8fafc; }
        .ff-cost-item span { font-size: 12px; font-weight: 600; color: #475569; }
        .ff-cost-item input { width: 70px; text-align: right; border: 1.5px solid #eef2f6; border-radius: 6px; padding: 3px 6px; font-weight: 700; font-size: 12px; }

        .ff-analysis-card { background: white; border: 1px solid #eef0f2; border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.01); }
        .ff-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .ff-table th { padding: 10px; font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 2px solid #f8fafc; text-transform: uppercase; }
        .ff-table td { padding: 10px; border-bottom: 1px solid #f9fafb; font-size: 13px; }
        .ff-concept { font-weight: 600; color: #475569; }
        .ff-td-input { width: 90px; padding: 6px; border: 1.5px solid #eef2f6; border-radius: 8px; text-align: center; font-weight: 700; outline: none; transition: 0.2s; }
        .ff-td-input:focus { border-color: #166534; background: #f0fdf4; }
        .ff-td-input.green { color: #166534; background: #f0fdf4; border-color: #dcfce7; }
        .ff-td-input.bold { font-weight: 900; color: #1e293b; background: #f8fafc; }
        .ff-impact { color: #cbd5e1; font-weight: 800; font-size: 11px; }

        .footer-pills-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; border-top: 2px solid #f8fafc; padding-top: 20px; }
        .f-pill { padding: 12px 20px; border-radius: 12px; display: flex; flex-direction: column; }
        .f-pill.gray { background: #f8fafc; border: 1px solid #eef2f6; }
        .f-pill.green { background: #f0fdf4; border: 1px solid #dcfce7; color: #166534; }
        .f-pill.dark { background: #1e293b; color: white; }
        .f-pill-lbl { font-size: 9px; font-weight: 800; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; }
        .f-pill-val { font-size: 18px; font-weight: 900; }

        .btn-save-mini { background: #166534; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-save-mini:hover { background: #0f4a25; transform: translateY(-1px); }
        .ff-toast { position: fixed; bottom: 25px; right: 25px; background: #1e293b; color: white; padding: 12px 24px; border-radius: 10px; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 1000; }
      `}</style>
    </AdminLayout>
  );
}