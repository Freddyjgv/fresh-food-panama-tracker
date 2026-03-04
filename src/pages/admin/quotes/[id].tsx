import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, Package, Loader2, Building2, Plane, Ship, 
  DollarSign, Info, MapPin, Calculator, TrendingUp, ChevronRight
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
    
    // 1. Intento de carga con Join Relacional
    const { data: quote, error } = await supabase
      .from("quotes")
      .select(`*, clients:client_id ( name, tax_id, logo_url, country )`)
      .eq("id", quoteId)
      .single();

    if (quote) {
      let finalQuote = { ...quote };

      // 2. DEBUG: Si el join falló (clients es null), buscamos al cliente manualmente
      if (!quote.clients && quote.client_id) {
        const { data: clientBackup } = await supabase
          .from("clients")
          .select("name, tax_id, logo_url, country")
          .eq("id", quote.client_id)
          .single();
        if (clientBackup) finalQuote.clients = clientBackup;
      }

      setData(finalQuote);
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

  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]: [string, any]) => {
      const base = Number(val.base) || 0;
      const margin = Number(val.margin) || 0;
      const sale = margin < 100 ? base / (1 - (margin / 100)) : base;
      return { key, label: val.label, base, margin, sale };
    });
    const totalBase = lines.reduce((acc, curr) => acc + curr.base, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    const avgMargin = totalSale > 0 ? ((totalSale - totalBase) / totalSale) * 100 : 0;
    return { lines, totalBase, totalSale, avgMargin, perBox: totalSale };
  }, [costs]);

  // Lógica de edición sin restricciones de entrada (flechas eliminadas en CSS)
  const updateCostLine = (key: string, field: 'base' | 'margin' | 'sale', valStr: string) => {
    const value = parseFloat(valStr) || 0;
    setCosts((prev: any) => {
      const current = { ...prev[key] };
      if (field === 'base') {
        current.base = value;
      } else if (field === 'margin') {
        current.margin = value;
      } else if (field === 'sale') {
        // Al editar venta, recalculamos margen
        current.margin = value > 0 ? ((value - current.base) / value) * 100 : 0;
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
    setToast("Cotización actualizada correctamente");
    setTimeout(() => setToast(null), 2500);
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center">Iniciando cotizador profesional...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.quote_number || '...'}`}>
      <div className="view-container">
        
        {/* HEADER CON CLIENTE Y TAX ID GARANTIZADO */}
        <header className="header-pro">
          <div className="header-left">
            <div className="logo-holder">
              {data?.clients?.logo_url ? <img src={data.clients.logo_url} alt="Logo" /> : <Building2 size={24} className="opacity-20" />}
            </div>
            <div className="client-main-info">
              <div className="title-row">
                <h1>{data?.clients?.name || "Cliente no detectado"}</h1>
                <span className="quote-number-badge">{data?.quote_number || "Q-2026-XXXX"}</span>
              </div>
              <div className="sub-row">
                <span>TAX ID: <strong>{data?.clients?.tax_id || 'PENDIENTE'}</strong></span>
                <span className="geo-label"><MapPin size={12}/> {data?.clients?.country || 'GLOBAL'}</span>
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
            </div>
          </div>
          <button className="btn-save-mini" onClick={handleSave} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Guardar Cotización
          </button>
        </header>

        {/* FILA 1: PRODUCTO Y CALIDAD (UNA SOLA FILA) */}
        <div className="ff-card single-row-card">
          <div className="row-label"><Package size={14}/> PRODUCTO</div>
          <div className="row-body-horizontal">
            <div className="input-group">
              <label>Fruta Base</label>
              <select className="ff-input" value={productId} onChange={e => { setProductId(e.target.value); fetchVarieties(e.target.value); }}>
                <option value="">Seleccionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Variedad</label>
              <select className="ff-input" value={variety} onChange={e => setVariety(e.target.value)}>
                 <option value="">Seleccionar...</option>
                 {varieties.map((v, i) => <option key={i} value={v.name}>{v.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Color</label>
              <input className="ff-input" value={color} onChange={e => setColor(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Brix</label>
              <input className="ff-input" value={brix} onChange={e => setBrix(e.target.value)} />
            </div>
          </div>
        </div>

        {/* FILA 2: LOGÍSTICA (UNA SOLA FILA) */}
        <div className="ff-card single-row-card">
          <div className="row-label"><Ship size={14}/> LOGÍSTICA</div>
          <div className="row-body-horizontal">
            <div className="input-group" style={{minWidth: '120px'}}>
              <label>Transporte</label>
              <div className="ff-toggle">
                 <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={14}/></button>
                 <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={14}/></button>
              </div>
            </div>
            <div className="input-group" style={{flex: 2}}>
              <label>Destino</label>
              <LocationSelector mode={mode} value={place} onChange={setPlace} />
            </div>
            <div className="input-group">
              <label>Cajas</label>
              <input type="number" className="ff-input" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/>
            </div>
            <div className="input-group">
              <label>Peso KG</label>
              <input type="number" className="ff-input" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/>
            </div>
          </div>
        </div>

        {/* TABLA DE ANÁLISIS (SIN TARJETA RÁPIDA) */}
        <div className="ff-analysis-card">
          <div className="analysis-header">
            <Calculator size={16} /> <h2>ANÁLISIS DE COSTOS Y VENTA</h2>
          </div>
          <table className="ff-table">
            <thead>
              <tr>
                <th align="left">CONCEPTO</th>
                <th align="center">COSTO BASE ($)</th>
                <th align="center">MARGEN (%)</th>
                <th align="center">PRECIO VENTA ($)</th>
                <th align="right">IMPACTO</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.key}>
                  <td className="ff-concept">{line.label}</td>
                  <td align="center">
                    <input className="ff-td-input" type="text" value={line.base} onChange={e => updateCostLine(line.key, 'base', e.target.value)}/>
                  </td>
                  <td align="center">
                    <input className="ff-td-input green" type="text" value={line.margin.toFixed(2)} onChange={e => updateCostLine(line.key, 'margin', e.target.value)}/>
                  </td>
                  <td align="center">
                    <input className="ff-td-input bold" type="text" value={line.sale.toFixed(2)} onChange={e => updateCostLine(line.key, 'sale', e.target.value)}/>
                  </td>
                  <td align="right" className="ff-impact">{analysis.totalSale > 0 ? ((line.sale / analysis.totalSale) * 100).toFixed(0) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FOOTER CON LAS 4 PILLS SOLICITADAS */}
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
              <span className="f-pill-lbl">PRECIO VENTA POR CAJA</span>
              <span className="f-pill-val">USD {analysis.perBox.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .view-container { padding: 30px; max-width: 1300px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; font-family: 'Inter', sans-serif; background: #fbfcfd; }
        
        /* HEADER */
        .header-pro { display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 24px; border-radius: 14px; border: 1px solid #eef0f2; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .logo-holder { width: 48px; height: 48px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #eef2f6; display: flex; align-items: center; justify-content: center; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; }
        .client-main-info h1 { font-size: 20px; font-weight: 800; color: #1e293b; margin: 0; }
        .title-row { display: flex; align-items: center; gap: 10px; }
        .quote-number-badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; }
        .sub-row { display: flex; gap: 15px; margin-top: 2px; font-size: 12px; color: #64748b; }
        .header-stats { padding-left: 20px; border-left: 1.5px solid #f1f5f9; }
        .status-pill-select { border: none; background: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 6px; cursor: pointer; }

        /* CARDS SINGLE ROW */
        .single-row-card { background: white; border: 1px solid #eef0f2; border-radius: 12px; display: flex; align-items: center; padding: 0 20px; min-height: 80px; }
        .row-label { font-size: 10px; font-weight: 800; color: #166534; display: flex; align-items: center; gap: 8px; min-width: 140px; text-transform: uppercase; }
        .row-body-horizontal { display: flex; flex: 1; gap: 20px; align-items: flex-end; padding: 15px 0; }
        .input-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .input-group label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .ff-input { width: 100%; padding: 8px 12px; border: 1.5px solid #eef2f6; border-radius: 8px; font-size: 13px; font-weight: 600; outline: none; }
        .ff-toggle { background: #f1f5f9; padding: 3px; border-radius: 8px; display: flex; gap: 2px; }
        .ff-toggle button { border: none; background: transparent; padding: 5px 12px; border-radius: 6px; cursor: pointer; color: #94a3b8; }
        .ff-toggle button.active { background: white; color: #166534; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }

        /* TABLE */
        .ff-analysis-card { background: white; border: 1px solid #eef0f2; border-radius: 12px; padding: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.01); }
        .analysis-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; color: #166534; }
        .analysis-header h2 { font-size: 14px; font-weight: 800; margin: 0; }
        .ff-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .ff-table th { padding: 12px; font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 2px solid #f8fafc; text-transform: uppercase; }
        .ff-table td { padding: 12px; border-bottom: 1px solid #f9fafb; font-size: 14px; }
        .ff-concept { font-weight: 600; color: #475569; }
        
        /* INPUTS SIN FLECHAS */
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .ff-td-input { width: 110px; padding: 8px; border: 1.5px solid #eef2f6; border-radius: 8px; text-align: center; font-weight: 700; outline: none; transition: 0.2s; }
        .ff-td-input:focus { border-color: #166534; background: #f0fdf4; }
        .ff-td-input.green { color: #166534; background: #f0fdf4; border-color: #dcfce7; }
        .ff-td-input.bold { font-weight: 900; color: #1e293b; background: #f8fafc; }
        .ff-impact { color: #cbd5e1; font-weight: 800; font-size: 12px; }

        /* PILLS FOOTER */
        .footer-pills-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; border-top: 2px solid #f8fafc; padding-top: 25px; }
        .f-pill { padding: 15px 20px; border-radius: 14px; display: flex; flex-direction: column; }
        .f-pill.gray { background: #f8fafc; border: 1px solid #eef2f6; }
        .f-pill.green { background: #f0fdf4; border: 1px solid #dcfce7; color: #166534; }
        .f-pill.dark { background: #1e293b; color: white; }
        .f-pill-lbl { font-size: 9px; font-weight: 800; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; }
        .f-pill-val { font-size: 20px; font-weight: 900; margin-top: 4px; }

        .btn-save-mini { background: #166534; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-save-mini:hover { background: #0f4a25; transform: translateY(-1px); }
        .ff-toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 15px 30px; border-radius: 12px; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 1000; }
      `}</style>
    </AdminLayout>
  );
}