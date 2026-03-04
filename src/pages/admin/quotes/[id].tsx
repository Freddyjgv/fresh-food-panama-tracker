import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, 
  MapPin, DollarSign, Thermometer, Droplets, Calculator, 
  ChevronDown, Download, FileUp, Info 
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
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<string[]>([]);

  // --- ESTADOS DE LA COTIZACIÓN ---
  const [status, setStatus] = useState("draft");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [pallets, setPallets] = useState(0);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [incoterm, setIncoterm] = useState("CIP");
  const [place, setPlace] = useState("");
  const [productId, setProductId] = useState("");
  const [variety, setVariety] = useState("");
  const [color, setColor] = useState("");
  const [brix, setBrix] = useState("");

  // COSTOS INTEGRADOS EN ESPAÑOL
  const [costs, setCosts] = useState<any>({
    fruta: { base: 0, margin: 0, label: "Fruta (Base Cajas)" },
    flete: { base: 0, margin: 0, label: "Flete Internacional" },
    origen: { base: 0, margin: 0, label: "Gastos de Origen" },
    aduana: { base: 0, margin: 0, label: "Gestión Aduanera" },
    inspeccion: { base: 0, margin: 0, label: "Inspecciones / Fiton" },
    documentos: { base: 0, margin: 0, label: "Documentación / BL" },
    impuestos: { base: 0, margin: 0, label: "Impuestos / Tasas" },
    otros: { base: 0, margin: 0, label: "Otros Gastos" }
  });

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    const { data: quote } = await supabase.from("quotes").select(`*, clients (*)`).eq("id", quoteId).single();
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
      setColor(p.color || "");
      setBrix(p.brix || "");

      const c = quote.costs || {};
      setCosts({
        fruta: { base: c.c_fruit || 0, margin: quote.margin_markup || 0, label: "Fruta (Base Cajas)" },
        flete: { base: c.c_freight || 0, margin: c.m_freight || 0, label: "Flete Internacional" },
        origen: { base: c.c_origin || 0, margin: c.m_origin || 0, label: "Gastos de Origen" },
        aduana: { base: c.c_aduana || 0, margin: c.m_aduana || 0, label: "Gestión Aduanera" },
        inspeccion: { base: c.c_insp || 0, margin: c.m_insp || 0, label: "Inspecciones / Fiton" },
        documentos: { base: c.c_doc || 0, margin: c.m_doc || 0, label: "Documentación / BL" },
        impuestos: { base: c.c_tax || 0, margin: c.m_tax || 0, label: "Impuestos / Tasas" },
        otros: { base: c.c_other || 0, margin: c.m_other || 0, label: "Otros Gastos" }
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

  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]: [string, any]) => {
      const baseTotal = key === 'fruta' ? val.base * boxes : val.base;
      const marginFact = val.margin / 100;
      const sale = marginFact < 1 ? baseTotal / (1 - marginFact) : baseTotal;
      return { key, label: val.label, baseTotal, sale, margin: val.margin };
    });
    const totalCost = lines.reduce((acc, curr) => acc + curr.baseTotal, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    const profit = totalSale - totalCost;
    const perBox = boxes > 0 ? totalSale / boxes : 0;
    return { lines, totalCost, totalSale, profit, perBox };
  }, [costs, boxes]);

  const updateCostLine = (key: string, field: 'base' | 'margin', value: number) => {
    setCosts((prev: any) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  async function handleSave() {
    setBusy(true);
    const payload = {
      status, boxes, weight_kg: weightKg, mode, destination: place, product_id: productId,
      margin_markup: costs.fruta.margin,
      product_details: { variety, color, brix },
      costs: { 
        c_fruit: costs.fruta.base, c_freight: costs.flete.base, c_origin: costs.origen.base, 
        c_aduana: costs.aduana.base, c_insp: costs.inspeccion.base, c_doc: costs.documentos.base, 
        c_tax: costs.impuestos.base, c_other: costs.otros.base,
        m_freight: costs.flete.margin, m_origin: costs.origen.margin, m_aduana: costs.aduana.margin
      },
      totals: { total: analysis.totalSale, profit: analysis.profit, per_box: analysis.perBox, meta: { incoterm, pallets } }
    };
    await supabase.from("quotes").update(payload).eq("id", id);
    setBusy(false);
    setToast("Cambios guardados correctamente");
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => { if (authOk && id) loadData(id as string); }, [authOk, id]);

  if (loading) return <AdminLayout title="Cargando..."><div className="loader-container">Cargando datos maestros...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${data?.clients?.name || 'Cargando'}`}>
      <div className="ff-container">
        
        {/* HEADER PRO */}
        <div className="ff-card header-pro">
          <div className="header-left">
            <div className="logo-holder">
              {data?.clients?.logo_url ? <img src={data.clients.logo_url} alt="Logo" /> : <Building2 size={24} className="opacity-20" />}
            </div>
            <div className="client-main-info">
              <h1>{data?.clients?.name}</h1>
              <div className="sub-row">
                <span><FileText size={12}/> {data?.clients?.tax_id}</span>
                <span><MapPin size={12}/> {data?.clients?.country}</span>
              </div>
            </div>
            <div className="header-stats-group">
              <div className="h-stat"><span className="h-stat-label">Cajas</span><span className="h-stat-val">{boxes}</span></div>
              <div className="h-stat"><span className="h-stat-label">Venta Total</span><span className="h-stat-val">${analysis.totalSale.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="actions-cluster">
            <select className={`status-pill-select ${status}`} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="draft">BORRADOR</option>
              <option value="sent">ENVIADA</option>
              <option value="won">GANADA</option>
            </select>
            <button className="ff-btn-primary" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin"/> : <Save size={16}/>} Guardar
            </button>
          </div>
        </div>

        {/* FILA 1: CALIDAD */}
        <div className="ff-card row-strip">
          <div className="strip-label"><Package size={14}/> CALIDAD</div>
          <div className="strip-content">
            <div className="s-field">
              <label>Producto</label>
              <select value={productId} onChange={e => { setProductId(e.target.value); fetchVarieties(e.target.value); }}>
                <option value="">Seleccionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="s-field">
              <label>Variedad</label>
              <select value={variety} onChange={e => setVariety(e.target.value)}>
                <option value="">Seleccionar...</option>
                {varieties.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="s-field"><label>Color</label><input value={color} onChange={e => setColor(e.target.value)} /></div>
            <div className="s-field"><label>Brix</label><input value={brix} onChange={e => setBrix(e.target.value)} /></div>
          </div>
        </div>

        {/* FILA 2: LOGÍSTICA */}
        <div className="ff-card row-strip">
          <div className="strip-label"><Ship size={14}/> LOGÍSTICA</div>
          <div className="strip-content">
            <div className="s-field">
              <label>Modo</label>
              <div className="mini-toggle">
                <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={12}/></button>
                <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={12}/></button>
              </div>
            </div>
            <div className="s-field">
              <label>Incoterm</label>
              <select value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                <option value="CIP">CIP</option><option value="CIF">CIF</option><option value="FOB">FOB</option><option value="DDP">DDP</option>
              </select>
            </div>
            <div className="s-field" style={{flex: 2}}><label>Destino</label><LocationSelector mode={mode} value={place} onChange={setPlace} /></div>
            <div className="s-field small"><label>Cajas</label><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))} /></div>
            <div className="s-field small"><label>Pallets</label><input type="number" value={pallets} onChange={e=>setPallets(Number(e.target.value))} /></div>
          </div>
        </div>

        {/* FILA 3: ANÁLISIS FINANCIERO */}
        <div className="ff-card analysis-card">
          <div className="analysis-header">
            <Calculator size={18} /> <h3>Análisis de Costos y Márgenes</h3>
          </div>
          <table className="analysis-table">
            <thead>
              <tr>
                <th align="left">CONCEPTO</th>
                <th align="right">COSTO BASE (USD)</th>
                <th align="center">MARGEN (%)</th>
                <th align="right">VENTA TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.key}>
                  <td>{line.label}</td>
                  <td align="right"><input className="table-input" type="number" step="0.01" value={costs[line.key].base} onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}/></td>
                  <td align="center"><input className="table-input center" type="number" value={line.margin} onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}/></td>
                  <td align="right" className="font-bold">${line.sale.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FOOTER CON 4 PILLS */}
          <div className="footer-stats-grid">
            <div className="stat-pill">
              <span className="stat-label">COSTO TOTAL</span>
              <span className="stat-value text-gray">${analysis.totalCost.toLocaleString()}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">VENTA TOTAL</span>
              <span className="stat-value text-green">${analysis.totalSale.toLocaleString()}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">GANANCIA TOTAL</span>
              <span className="stat-value text-blue">${analysis.profit.toLocaleString()}</span>
            </div>
            <div className="stat-pill featured">
              <span className="stat-label">PRECIO POR CAJA</span>
              <span className="stat-value">USD {analysis.perBox.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .ff-container { padding: 20px; max-width: 1200px; margin: 0 auto; font-family: 'Inter', sans-serif; }
        .ff-card { background: white; border-radius: 12px; border: 1px solid #eef0f2; margin-bottom: 16px; padding: 20px; }
        
        .header-pro { display: flex; justify-content: space-between; align-items: center; }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .logo-holder { width: 50px; height: 50px; background: #f8fafc; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; }
        .client-main-info h1 { font-size: 18px; margin: 0; color: #1e293b; }
        .sub-row { display: flex; gap: 12px; font-size: 12px; color: #64748b; margin-top: 4px; }
        .header-stats-group { display: flex; gap: 24px; margin-left: 24px; padding-left: 24px; border-left: 1px solid #e2e8f0; }
        .h-stat { display: flex; flex-direction: column; }
        .h-stat-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .h-stat-val { font-size: 16px; font-weight: 800; color: #1e293b; }

        .row-strip { display: flex; align-items: center; padding: 12px 20px; gap: 30px; }
        .strip-label { width: 100px; font-size: 11px; font-weight: 900; color: #10b981; border-right: 1px solid #f1f5f9; }
        .strip-content { display: flex; flex: 1; gap: 20px; align-items: flex-end; }
       /* 1. Contenedor de la fila con alineación central */
.strip-content { 
  display: flex; 
  flex: 1; 
  gap: 16px; 
  align-items: flex-end; /* Alinea todos los inputs por la base */
}

/* 2. El campo individual */
.s-field { 
  display: flex; 
  flex-direction: column; 
  gap: 6px; 
  flex: 1; 
  min-width: 0; /* Evita que el contenido rompa el layout */
}

/* 3. Campos pequeños con ancho fijo */
.s-field.small { 
  flex: 0 0 90px; 
}

/* 4. Estandarización total de Inputs y Selects */
.s-field input, 
.s-field select { 
  width: 100%;
  height: 36px; /* Altura idéntica para ambos */
  padding: 0 10px;
  border: 1px solid #e2e8f0; 
  border-radius: 6px; 
  font-size: 13px; 
  font-weight: 600; 
  outline: none;
  background-color: #ffffff;
  box-sizing: border-box; /* Fundamental para que el padding no ensanche el campo */
  transition: border-color 0.2s;
}

.s-field input:focus, 
.s-field select:focus {
  border-color: #10b981;
}

/* 5. Etiquetas consistentes */
.s-field label { 
  font-size: 10px; 
  font-weight: 800; 
  color: #94a3b8; 
  text-transform: uppercase;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

        .mini-toggle { display: flex; background: #f1f5f9; padding: 2px; border-radius: 6px; width: fit-content; }
        .mini-toggle button { border: none; background: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; color: #94a3b8; }
        .mini-toggle button.active { background: white; color: #10b981; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

        .analysis-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .analysis-table th { padding: 12px; border-bottom: 2px solid #f8fafc; font-size: 10px; color: #94a3b8; text-transform: uppercase; }
        .analysis-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .table-input { width: 100%; max-width: 110px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: right; font-weight: 700; }
        .table-input.center { text-align: center; color: #10b981; background: #f0fdf4; }

        .footer-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9; }
        .stat-pill { background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; }
        .stat-pill.featured { background: #1e293b; color: white; border: none; }
        .stat-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; }
        .stat-pill.featured .stat-label { color: #94a3b8; }
        .stat-value { font-size: 18px; font-weight: 800; }
        
        .text-green { color: #10b981; }
        .text-blue { color: #3b82f6; }
        .text-gray { color: #1e293b; }
        .font-bold { font-weight: 700; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .ff-toast { position: fixed; bottom: 20px; right: 20px; background: #1e293b; color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600; }
        .status-pill-select { border: 1px solid #e2e8f0; border-radius: 20px; padding: 6px 16px; font-size: 11px; font-weight: 800; cursor: pointer; background: white; }
        .ff-btn-primary { background: #10b981; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
      `}</style>
    </AdminLayout>
  );
}