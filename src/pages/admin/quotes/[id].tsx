import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, Package, Loader2, Building2, Plane, Ship, 
  DollarSign, MapPin, Calculator, ChevronRight
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

  // USAMOS STRINGS PARA LOS INPUTS (Evita el bug de no poder borrar o poner puntos)
  const [costs, setCosts] = useState<any>({
    fruit: { label: "Fruta ($/Cx)", base: "13.30", margin: "15" },
    freight: { label: "Flete Internacional", base: "0", margin: "0" },
    origin: { label: "Gastos en origen", base: "0", margin: "0" },
    docs: { label: "Gestion documental", base: "0", margin: "0" },
    inspeccion: { label: "Inspección", base: "0", margin: "0" },
    other: { label: "Otros gastos", base: "0", margin: "0" }
  });

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    
    // CONSULTA CORREGIDA: Usamos la relación exacta 'clients(...)'
    const { data: quote, error } = await supabase
      .from("quotes")
      .select(`
        *,
        clients (
          name,
          tax_id,
          logo_url,
          country
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
        fruit: { label: "Fruta ($/Cx)", base: String(c.c_fruit || 13.30), margin: String(quote.margin_markup || 15) },
        freight: { label: "Flete Internacional", base: String(c.c_freight || 0), margin: String(c.m_freight || 0) },
        origin: { label: "Gastos en origen", base: String(c.c_origin || 0), margin: String(c.m_origin || 0) },
        docs: { label: "Gestion documental", base: String(c.c_docs || 0), margin: String(c.m_docs || 0) },
        inspeccion: { label: "Inspección", base: String(c.c_inspeccion || 0), margin: String(c.m_inspeccion || 0) },
        other: { label: "Otros gastos", base: String(c.c_other || 0), margin: String(c.m_other || 0) }
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

  // CÁLCULOS: Aquí convertimos los strings a números para operar
  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]: [string, any]) => {
      const base = parseFloat(val.base) || 0;
      const margin = parseFloat(val.margin) || 0;
      const sale = margin < 100 ? base / (1 - (margin / 100)) : base;
      return { key, label: val.label, base, margin, sale };
    });
    const totalBase = lines.reduce((acc, curr) => acc + curr.base, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    const avgMargin = totalSale > 0 ? ((totalSale - totalBase) / totalSale) * 100 : 0;
    return { lines, totalBase, totalSale, avgMargin, perBox: totalSale };
  }, [costs]);

  // ACTUALIZACIÓN DE LÓGICA CIRCULAR (Editables corregidos)
  const updateCostLine = (key: string, field: 'base' | 'margin' | 'sale', valStr: string) => {
    setCosts((prev: any) => {
      const current = { ...prev[key] };
      const numericInput = parseFloat(valStr) || 0;

      if (field === 'base') {
        current.base = valStr;
      } else if (field === 'margin') {
        current.margin = valStr;
      } else if (field === 'sale') {
        const baseNum = parseFloat(current.base) || 0;
        // Si editas venta: nuevo_margen = (venta - costo) / venta
        const newMargin = numericInput > 0 ? ((numericInput - baseNum) / numericInput) * 100 : 0;
        current.margin = newMargin.toFixed(2);
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
        c_fruit: parseFloat(costs.fruit.base), c_freight: parseFloat(costs.freight.base), 
        c_origin: parseFloat(costs.origin.base), c_docs: parseFloat(costs.docs.base), 
        c_inspeccion: parseFloat(costs.inspeccion.base), c_other: parseFloat(costs.other.base),
        m_freight: parseFloat(costs.freight.margin), m_origin: parseFloat(costs.origin.margin)
      },
      totals: { total_sale: analysis.totalSale * boxes, per_box: analysis.perBox }
    };
    await supabase.from("quotes").update(payload).eq("id", id as string);
    setBusy(false);
    setToast("Guardado con éxito");
    setTimeout(() => setToast(null), 2000);
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center">Cargando Cotización...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.quote_number || ''}`}>
      <div className="view-container">
        
        {/* HEADER: Fix definitivo de Cliente y Tax ID */}
        <header className="header-pro">
          <div className="header-left">
            <div className="logo-holder">
              {data?.clients?.logo_url ? <img src={data.clients.logo_url} alt="Logo" /> : <Building2 size={24} className="opacity-20" />}
            </div>
            <div className="client-main-info">
              <div className="title-row">
                <h1>{data?.clients?.name || "Nombre no disponible"}</h1>
                <span className="quote-badge">{data?.quote_number || "S/N"}</span>
              </div>
              <div className="sub-row">
                <span>Tax ID: <strong>{data?.clients?.tax_id || 'N/A'}</strong></span>
                <span className="geo-label"><MapPin size={12}/> {data?.clients?.country || 'N/A'}</span>
              </div>
            </div>
          </div>
          <button className="btn-save-mini" onClick={handleSave} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Guardar
          </button>
        </header>

        {/* FILA 1: PRODUCTO (UNA SOLA LÍNEA) */}
        <div className="ff-card-row">
          <div className="row-label"><Package size={14}/> PRODUCTO</div>
          <div className="row-inputs">
            <div className="field">
              <label>Fruta Base</label>
              <select className="ff-input" value={productId} onChange={e => { setProductId(e.target.value); fetchVarieties(e.target.value); }}>
                <option value="">Seleccionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Variedad</label>
              <select className="ff-input" value={variety} onChange={e => setVariety(e.target.value)}>
                 <option value="">Seleccionar variedad...</option>
                 {varieties.map((v, i) => <option key={i} value={v.name}>{v.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Color</label><input className="ff-input" value={color} onChange={e => setColor(e.target.value)} /></div>
            <div className="field"><label>Brix</label><input className="ff-input" value={brix} onChange={e => setBrix(e.target.value)} /></div>
          </div>
        </div>

        {/* FILA 2: LOGÍSTICA (UNA SOLA LÍNEA) */}
        <div className="ff-card-row">
          <div className="row-label"><Ship size={14}/> LOGÍSTICA</div>
          <div className="row-inputs">
            <div className="field" style={{maxWidth: '120px'}}>
              <label>Transporte</label>
              <div className="ff-toggle">
                 <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={14}/></button>
                 <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={14}/></button>
              </div>
            </div>
            <div className="field" style={{flex: 2}}>
              <label>Destino</label>
              <LocationSelector mode={mode} value={place} onChange={setPlace} />
            </div>
            <div className="field"><label>Cajas</label><input type="number" className="ff-input" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div>
            <div className="field"><label>Peso KG</label><input type="number" className="ff-input" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
          </div>
        </div>

        {/* TABLA DE ANÁLISIS EDITABLE */}
        <div className="ff-analysis-card">
          <div className="analysis-header"><Calculator size={16}/> ANÁLISIS DE VENTA</div>
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
                    <input className="ff-td-input" type="text" value={costs[line.key].base} onChange={e => updateCostLine(line.key, 'base', e.target.value)}/>
                  </td>
                  <td align="center">
                    <input className="ff-td-input green" type="text" value={costs[line.key].margin} onChange={e => updateCostLine(line.key, 'margin', e.target.value)}/>
                  </td>
                  <td align="center">
                    <input className="ff-td-input bold" type="text" value={line.sale.toFixed(2)} onChange={e => updateCostLine(line.key, 'sale', e.target.value)}/>
                  </td>
                  <td align="right" className="ff-impact">{analysis.totalSale > 0 ? ((line.sale / analysis.totalSale) * 100).toFixed(0) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="footer-pills">
            <div className="pill gray"><span>COSTO TOTAL</span><strong>USD {analysis.totalBase.toFixed(2)}</strong></div>
            <div className="pill gray"><span>PRECIO VENTA</span><strong>USD {analysis.totalSale.toFixed(2)}</strong></div>
            <div className="pill green"><span>MARGEN TOTAL</span><strong>{analysis.avgMargin.toFixed(1)}%</strong></div>
            <div className="pill dark"><span>VENTA POR CAJA</span><strong>USD {analysis.perBox.toFixed(2)}</strong></div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .view-container { padding: 25px; max-width: 1300px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; font-family: 'Inter', sans-serif; background: #fbfcfd; }
        
        .header-pro { display: flex; justify-content: space-between; align-items: center; background: white; padding: 16px 24px; border-radius: 14px; border: 1px solid #eef0f2; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .logo-holder { width: 45px; height: 45px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #eef2f6; display: flex; align-items: center; justify-content: center; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; }
        .client-main-info h1 { font-size: 19px; font-weight: 800; color: #1e293b; margin: 0; }
        .quote-badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; }
        .sub-row { display: flex; gap: 15px; font-size: 12px; color: #64748b; margin-top: 2px; }

        .ff-card-row { background: white; border: 1px solid #eef0f2; border-radius: 12px; display: flex; align-items: center; padding: 15px 20px; gap: 30px; }
        .row-label { font-size: 10px; font-weight: 800; color: #166534; min-width: 120px; display: flex; align-items: center; gap: 8px; }
        .row-inputs { display: flex; flex: 1; gap: 15px; align-items: flex-end; }
        .field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .field label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .ff-input { width: 100%; padding: 8px 12px; border: 1.5px solid #eef2f6; border-radius: 8px; font-size: 13px; font-weight: 600; outline: none; }
        
        .ff-toggle { background: #f1f5f9; padding: 3px; border-radius: 8px; display: flex; gap: 2px; }
        .ff-toggle button { border: none; background: transparent; padding: 5px 12px; border-radius: 6px; cursor: pointer; color: #94a3b8; }
        .ff-toggle button.active { background: white; color: #166534; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }

        .ff-analysis-card { background: white; border: 1px solid #eef0f2; border-radius: 12px; padding: 25px; }
        .analysis-header { font-size: 13px; font-weight: 800; color: #166534; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .ff-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .ff-table th { padding: 10px; font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 2px solid #f8fafc; }
        .ff-table td { padding: 12px 10px; border-bottom: 1px solid #f9fafb; }
        .ff-td-input { width: 100px; padding: 8px; border: 1.5px solid #eef2f6; border-radius: 8px; text-align: center; font-weight: 700; outline: none; }
        .ff-td-input.green { color: #166534; background: #f0fdf4; border-color: #dcfce7; }
        .ff-td-input.bold { font-weight: 900; background: #f8fafc; color: #1e293b; }

        .footer-pills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; border-top: 2px solid #f8fafc; padding-top: 20px; }
        .pill { padding: 15px; border-radius: 12px; display: flex; flex-direction: column; gap: 4px; }
        .pill.gray { background: #f8fafc; border: 1px solid #eef2f6; }
        .pill.green { background: #f0fdf4; border: 1px solid #dcfce7; color: #166534; }
        .pill.dark { background: #1e293b; color: white; }
        .pill span { font-size: 9px; font-weight: 800; opacity: 0.7; }
        .pill strong { font-size: 18px; font-weight: 900; }

        .btn-save-mini { background: #166534; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .ff-toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 15px 25px; border-radius: 10px; font-weight: 700; z-index: 1000; }
      `}</style>
    </AdminLayout>
  );
}