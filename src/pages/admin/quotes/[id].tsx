import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, 
  Globe, DollarSign, Info, Calculator, ChevronDown, MapPin, FileUp
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
    other: { base: 0, margin: 0 }
  });

  // Formateador de número de cotización
  const getQuoteNumber = (quote: any) => {
    if (quote?.quote_number) return quote.quote_number;
    const shortId = String(id).replace(/\D/g, "").slice(-4) || "0001";
    return `Q-2026-${shortId.padStart(4, '0')}`;
  };

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    // Carga de Cotización + Datos de Cliente por ID
    const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();

    if (quote) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("name, tax_id, contact_email, country, logo_url")
        .eq("id", quote.client_id)
        .single();

      setData({ ...quote, clients: clientData });
      setStatus(quote.status || "draft");
      setBoxes(quote.boxes || 0);
      setWeightKg(quote.weight_kg || 0);
      setMode(quote.mode || "AIR");
      setPlace(quote.destination || "");
      setProductId(quote.product_id || "");
      
      const p = quote.product_details || {};
      setVariety(p.variety || "");
      
      const c = quote.costs || {};
      setCosts({
        fruit: { base: c.c_fruit || 13.30, margin: quote.margin_markup || 15 },
        freight: { base: c.c_freight || 0, margin: c.m_freight || 0 },
        origin: { base: c.c_origin || 0, margin: c.m_origin || 0 },
        aduana: { base: c.c_aduana || 0, margin: c.m_aduana || 0 },
        other: { base: c.c_other || 0, margin: c.m_other || 0 }
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
      status, boxes, weight_kg: weightKg, mode, destination: place, product_id: productId,
      margin_markup: costs.fruit.margin,
      product_details: { ...data?.product_details, variety },
      costs: { 
        c_fruit: costs.fruit.base, c_freight: costs.freight.base, c_origin: costs.origin.base, 
        c_aduana: costs.aduana.base, c_other: costs.other.base,
        m_freight: costs.freight.margin, m_origin: costs.origin.margin
      },
      totals: { total: analysis.totalSale, per_box: analysis.perBox }
    };
    await supabase.from("quotes").update(payload).eq("id", id as string);
    setBusy(false);
    setToast("Cotización actualizada");
    setTimeout(() => setToast(null), 2000);
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center text-slate-400 font-bold">Cargando...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${getQuoteNumber(data)}`}>
      <div className="view-container">
        
        {/* HEADER ESTILO CLIENTE [id] */}
        <header className="header-pro">
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
                <h1>{data?.clients?.name || "Cliente no definido"}</h1>
                <span className="quote-number-badge">{getQuoteNumber(data)}</span>
              </div>
              <div className="sub-row">
                <span className="tax-label">
                   Tax ID: <strong>{data?.clients?.tax_id || 'Pendiente'}</strong>
                </span>
                <span className="geo-label"><MapPin size={12}/> {data?.clients?.country || 'N/A'}</span>
              </div>
            </div>

            <div className="header-stats">
              <div className="h-stat">
                <span className="h-stat-label">Estado</span>
                <div className="status-mini-wrapper">
                   <select className={`status-pill-select ${status}`} value={status} onChange={e => setStatus(e.target.value)}>
                     <option value="draft">BORRADOR</option>
                     <option value="sent">ENVIADA</option>
                     <option value="won">GANADA</option>
                   </select>
                </div>
              </div>
              <div className="v-divider"></div>
              <div className="h-stat">
                <span className="h-stat-label">Cajas</span>
                <span className="h-stat-val">{boxes}</span>
              </div>
              <div className="v-divider"></div>
              <div className="h-stat">
                <span className="h-stat-label">Total Venta</span>
                <span className="h-stat-val">USD {analysis.totalSale.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button className="btn-refine-white" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Guardar
            </button>
          </div>
        </header>

        {/* GRID DE CONFIGURACIÓN */}
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
              <div className="ff-row-3">
                <div className="ff-metric"><span>Cajas</span><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div>
                <div className="ff-metric"><span>Peso KG</span><input type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
              </div>
            </div>
          </div>

          <div className="ff-card">
            <div className="ff-card-label"><DollarSign size={14}/> COSTOS BASE</div>
            <div className="ff-card-body ff-costs">
               <div className="ff-cost-item"><span>Fruta $/u</span><input type="number" value={costs.fruit.base} onChange={e=>updateCostLine('fruit','base', Number(e.target.value))}/></div>
               <div className="ff-cost-item"><span>Flete Int.</span><input type="number" value={costs.freight.base} onChange={e=>updateCostLine('freight','base', Number(e.target.value))}/></div>
               <div className="ff-cost-item"><span>Gastos Origen</span><input type="number" value={costs.origin.base} onChange={e=>updateCostLine('origin','base', Number(e.target.value))}/></div>
            </div>
          </div>
        </div>

        {/* TABLA DE RESUMEN FINANCIERO */}
        <div className="ff-analysis-card">
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
                  <td className="ff-concept">{line.key}</td>
                  <td align="center"><input className="ff-td-input" type="number" value={costs[line.key].base} onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}/></td>
                  <td align="center"><input className="ff-td-input green" type="number" value={line.margin} onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}/></td>
                  <td align="center" className="ff-td-bold">USD {line.sale.toFixed(2)}</td>
                  <td align="right" className="ff-impact">{analysis.totalSale > 0 ? ((line.sale / analysis.totalSale) * 100).toFixed(0) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FOOTER MINIATURIZADO */}
          <div className="mini-footer">
            <div className="footer-info-text"><Info size={12}/> Precios basados en margen de contribución.</div>
            <div className="footer-actions-group">
              <button className="btn-save-mini" onClick={handleSave} disabled={busy}>
                <Save size={14}/> {busy ? "..." : "Actualizar"}
              </button>
              <div className="price-pill-mini">
                <span className="pill-label">PRECIO CAJA</span>
                <span className="pill-value">USD {analysis.perBox.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .view-container { padding: 30px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; font-family: 'Inter', sans-serif; }
        
        /* HEADER PRO (ESPEJO DE CLIENTES) */
        .header-pro { display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 24px; border-radius: 14px; border: 1px solid #eef0f2; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .logo-holder { width: 48px; height: 48px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #eef2f6; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; }
        .client-main-info h1 { font-size: 20px; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.02em; }
        .title-row { display: flex; align-items: center; gap: 10px; }
        .quote-number-badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 800; border: 1px solid #e2e8f0; }
        .sub-row { display: flex; gap: 15px; margin-top: 2px; font-size: 12px; color: #64748b; }
        .header-stats { display: flex; gap: 20px; padding-left: 20px; border-left: 1.5px solid #f1f5f9; margin-left: 5px; }
        .h-stat { display: flex; flex-direction: column; justify-content: center; }
        .h-stat-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .h-stat-val { font-size: 15px; font-weight: 800; color: #1e293b; }
        .v-divider { width: 1px; height: 25px; background: #f1f5f9; align-self: center; }
        .status-pill-select { border: none; background: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 5px; cursor: pointer; outline: none; }
        .btn-refine-white { background: white; border: 1.5px solid #e2e8f0; padding: 8px 16px; border-radius: 8px; font-weight: 700; color: #64748b; cursor: pointer; display: flex; gap: 8px; font-size: 13px; }

        /* GRID & CARDS */
        .ff-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .ff-card { background: white; border: 1px solid #eef0f2; border-radius: 12px; }
        .ff-card-label { padding: 12px 16px; font-size: 10px; font-weight: 800; color: #166534; border-bottom: 1px solid #f8fafc; display: flex; align-items: center; gap: 8px; }
        .ff-card-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .ff-card-body label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: -6px; }
        .ff-input { width: 100%; padding: 8px 12px; border: 1.5px solid #eef2f6; border-radius: 8px; font-size: 13px; font-weight: 600; outline: none; }
        .ff-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ff-row-3 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px; }
        .ff-metric { background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #eef2f6; text-align: center; }
        .ff-metric span { display: block; font-size: 8px; font-weight: 700; color: #94a3b8; }
        .ff-metric input { width: 100%; background: transparent; border: none; text-align: center; font-weight: 800; font-size: 14px; outline: none; }
        .ff-toggle { background: #f1f5f9; padding: 3px; border-radius: 8px; display: flex; gap: 2px; }
        .ff-toggle button { border: none; background: transparent; padding: 4px 10px; border-radius: 6px; cursor: pointer; color: #94a3b8; }
        .ff-toggle button.active { background: white; color: #166534; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }

        /* COST ITEMS */
        .ff-cost-item { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #f8fafc; }
        .ff-cost-item span { font-size: 13px; font-weight: 600; color: #475569; }
        .ff-cost-item input { width: 80px; text-align: right; border: 1.5px solid #eef2f6; border-radius: 6px; padding: 4px 8px; font-weight: 700; }

        /* TABLE */
        .ff-analysis-card { background: white; border: 1px solid #eef0f2; border-radius: 12px; padding: 20px; }
        .ff-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .ff-table th { padding: 10px; font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 2px solid #f8fafc; }
        .ff-table td { padding: 12px 10px; border-bottom: 1px solid #f9fafb; font-size: 13px; }
        .ff-td-input { width: 80px; padding: 5px; border: 1.5px solid #eef2f6; border-radius: 6px; text-align: center; font-weight: 700; outline: none; }
        .ff-td-input.green { color: #166534; background: #f0fdf4; border-color: #dcfce7; }
        .ff-td-bold { font-weight: 800; color: #1e293b; }
        .ff-impact { color: #94a3b8; font-weight: 700; font-size: 11px; }

        /* FOOTER MINI */
        .mini-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 15px; }
        .footer-info-text { font-size: 11px; color: #94a3b8; font-style: italic; display: flex; align-items: center; gap: 5px; }
        .footer-actions-group { display: flex; align-items: center; gap: 10px; }
        .btn-save-mini { background: #166534; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-save-mini:hover { background: #0f4a25; }
        .price-pill-mini { background: #1e293b; color: white; padding: 6px 14px; border-radius: 8px; text-align: right; min-width: 130px; }
        .pill-label { display: block; font-size: 8px; font-weight: 700; opacity: 0.6; }
        .pill-value { font-size: 18px; font-weight: 900; }

        .ff-toast { position: fixed; bottom: 20px; right: 20px; background: #1e293b; color: white; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      `}</style>
    </AdminLayout>
  );
}