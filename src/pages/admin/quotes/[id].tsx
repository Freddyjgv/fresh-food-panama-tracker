import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, 
  Globe, DollarSign, Calculator, MapPin, ChevronDown
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

  // USAMOS STRINGS PARA QUE LOS INPUTS SEAN EDITABLES SIN BLOQUEOS
  const [costs, setCosts] = useState<any>({
    fruit: { label: "Fruta ($/u)", base: "13.30", margin: "15" },
    freight: { label: "Flete Internacional", base: "0", margin: "0" },
    origin: { label: "Gastos en origen", base: "0", margin: "0" },
    aduana: { label: "Aduana", base: "0", margin: "0" },
    insp: { label: "Inspección", base: "0", margin: "0" },
    doc: { label: "Gestión Documental", base: "0", margin: "0" },
    other: { label: "Otros Gastos", base: "0", margin: "0" }
  });

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    // Intento 1: Join relacional
    const { data: quote } = await supabase
      .from("quotes")
      .select(`*, clients ( name, tax_id, contact_email )`)
      .eq("id", quoteId)
      .single();

    if (quote) {
      let finalQuote = { ...quote };
      // DEBUG: Si el join falla, forzamos búsqueda de cliente
      if (!quote.clients && quote.client_id) {
        const { data: cData } = await supabase.from("clients").select("name, tax_id, contact_email").eq("id", quote.client_id).single();
        if (cData) finalQuote.clients = cData;
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
        fruit: { label: "Fruta ($/u)", base: String(c.c_fruit || 13.30), margin: String(quote.margin_markup || 15) },
        freight: { label: "Flete Internacional", base: String(c.c_freight || 0), margin: String(c.m_freight || 0) },
        origin: { label: "Gastos en origen", base: String(c.c_origin || 0), margin: String(c.m_origin || 0) },
        aduana: { label: "Aduana", base: String(c.c_aduana || 0), margin: String(c.m_aduana || 0) },
        insp: { label: "Inspección", base: String(c.c_insp || 0), margin: String(c.m_insp || 0) },
        doc: { label: "Gestión Documental", base: String(c.c_doc || 0), margin: String(c.m_doc || 0) },
        other: { label: "Otros Gastos", base: String(c.c_other || 0), margin: String(c.m_other || 0) }
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
      const bNum = parseFloat(val.base) || 0;
      const mNum = parseFloat(val.margin) || 0;
      // El costo de fruta se multiplica por cajas en el total del analisis
      const baseTotal = key === 'fruit' ? bNum * (boxes || 1) : bNum;
      const sale = mNum < 100 ? baseTotal / (1 - (mNum / 100)) : baseTotal;
      return { key, label: val.label, baseTotal, sale, margin: mNum, baseUnit: bNum };
    });
    const totalBase = lines.reduce((acc, curr) => acc + curr.baseTotal, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    const avgMargin = totalSale > 0 ? ((totalSale - totalBase) / totalSale) * 100 : 0;
    return { lines, totalBase, totalSale, avgMargin, perBox: boxes > 0 ? totalSale / boxes : 0 };
  }, [costs, boxes]);

  const updateCostLine = (key: string, field: 'base' | 'margin' | 'sale', valStr: string) => {
    setCosts((prev: any) => {
      const current = { ...prev[key] };
      if (field === 'base') current.base = valStr;
      else if (field === 'margin') current.margin = valStr;
      else if (field === 'sale') {
        const bNum = parseFloat(current.base) || 0;
        const sNum = parseFloat(valStr) || 0;
        // Si editamos venta por caja (en la tabla), recalculamos margen de esa linea
        const lineBase = key === 'fruit' ? bNum * (boxes || 1) : bNum;
        current.margin = sNum > 0 ? (((sNum - lineBase) / sNum) * 100).toFixed(2) : "0";
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
        c_origin: parseFloat(costs.origin.base), c_aduana: parseFloat(costs.aduana.base),
        c_insp: parseFloat(costs.insp.base), c_doc: parseFloat(costs.doc.base), c_other: parseFloat(costs.other.base),
        m_freight: parseFloat(costs.freight.margin), m_origin: parseFloat(costs.origin.margin)
      },
      totals: { total: analysis.totalSale, per_box: analysis.perBox }
    };
    await supabase.from("quotes").update(payload).eq("id", id as string);
    setBusy(false);
    setToast("Cotización guardada");
    setTimeout(() => setToast(null), 2000);
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10 text-center">Analizando datos...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${data?.quote_number || id}`}>
      <div className="ff-container">
        
        {/* HEADER RESTAURADO Y CORREGIDO */}
        <div className="ff-header">
          <div className="ff-header-info">
            <div className="ff-icon-box"><Building2 size={22} /></div>
            <div className="ff-header-text">
              <div className="ff-title-row">
                <h1>{data?.clients?.name || "Cargando Cliente..."}</h1>
                <span className="ff-q-number">{data?.quote_number}</span>
              </div>
              <p>
                <FileText size={12}/> {data?.clients?.tax_id || "SIN TAX ID"} &nbsp;•&nbsp; 
                <Globe size={12}/> {data?.clients?.contact_email}
              </p>
            </div>
          </div>
          <div className="ff-header-actions">
            <div className={`ff-status-pill ${status}`}>
               <select value={status} onChange={e => setStatus(e.target.value)}>
                 <option value="draft">BORRADOR</option>
                 <option value="sent">ENVIADA</option>
                 <option value="won">GANADA</option>
               </select>
               <ChevronDown size={14} />
            </div>
            <button className="ff-btn-top-save" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Guardar
            </button>
          </div>
        </div>

        {/* FILA 1: PRODUCTO (HORIZONTAL) */}
        <div className="ff-row-card">
          <div className="ff-row-label"><Package size={14}/> PRODUCTO</div>
          <div className="ff-row-inputs">
            <div className="ff-field">
              <label>Fruta Base</label>
              <select className="ff-input" value={productId} onChange={e => { setProductId(e.target.value); fetchVarieties(e.target.value); }}>
                <option value="">Seleccionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="ff-field">
              <label>Variedad</label>
              <select className="ff-input" value={variety} onChange={e => setVariety(e.target.value)}>
                 <option value="">Seleccionar...</option>
                 {varieties.map((v, i) => <option key={i} value={v.name}>{v.name}</option>)}
              </select>
            </div>
            <div className="ff-field"><label>Color</label><input className="ff-input" value={color} onChange={e => setColor(e.target.value)} /></div>
            <div className="ff-field"><label>Brix</label><input className="ff-input" value={brix} onChange={e => setBrix(e.target.value)} /></div>
          </div>
        </div>

        {/* FILA 2: LOGISTICA (HORIZONTAL) */}
        <div className="ff-row-card">
          <div className="ff-row-label"><Ship size={14}/> LOGÍSTICA</div>
          <div className="ff-row-inputs">
            <div className="ff-field" style={{maxWidth: '120px'}}>
              <label>Transporte</label>
              <div className="ff-toggle">
                 <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={14}/></button>
                 <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={14}/></button>
              </div>
            </div>
            <div className="ff-field" style={{flex: 2}}>
              <label>Destino</label>
              <LocationSelector mode={mode} value={place} onChange={setPlace} />
            </div>
            <div className="ff-field"><label>Cajas</label><input className="ff-input" type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))}/></div>
            <div className="ff-field"><label>Peso KG</label><input className="ff-input" type="number" value={weightKg} onChange={e=>setWeightKg(Number(e.target.value))}/></div>
          </div>
        </div>

        {/* TABLA DE ANÁLISIS */}
        <div className="ff-analysis-card">
          <div className="ff-analysis-header"><Calculator size={18}/> <h3>ANÁLISIS DE VENTA</h3></div>
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

          {/* FOOTER CON LAS 4 PILLS SOLICITADAS */}
          <div className="ff-pills-footer">
            <div className="ff-pill gray"><span>COSTO TOTAL</span><strong>USD {analysis.totalBase.toFixed(2)}</strong></div>
            <div className="ff-pill gray"><span>VENTA TOTAL</span><strong>USD {analysis.totalSale.toFixed(2)}</strong></div>
            <div className="ff-pill green"><span>MARGEN PROMEDIO</span><strong>{analysis.avgMargin.toFixed(1)}%</strong></div>
            <div className="ff-pill dark"><span>VENTA POR CAJA</span><strong>USD {analysis.perBox.toFixed(2)}</strong></div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .ff-container { padding: 30px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; background: #fbfcfd; }
        
        .ff-header { background: white; padding: 18px 24px; border-radius: 12px; border: 1px solid #eef0f2; display: flex; justify-content: space-between; align-items: center; }
        .ff-header-info { display: flex; align-items: center; gap: 16px; }
        .ff-icon-box { width: 44px; height: 44px; background: #f0fdf4; color: #166534; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #dcfce7; }
        .ff-title-row { display: flex; align-items: center; gap: 10px; }
        .ff-title-row h1 { margin: 0; font-size: 20px; font-weight: 800; color: #1e293b; }
        .ff-q-number { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; }
        .ff-header-text p { margin: 4px 0 0; font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 4px; }
        
        .ff-status-pill { position: relative; background: #dcfce7; color: #166534; padding: 8px 15px; border-radius: 10px; display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 12px; }
        .ff-status-pill select { appearance: none; background: transparent; border: none; color: inherit; font-weight: inherit; font-size: inherit; cursor: pointer; outline: none; padding-right: 15px; }
        
        .ff-btn-top-save { background: #386e42; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }

        .ff-row-card { background: white; border: 1px solid #eef0f2; border-radius: 12px; display: flex; align-items: center; padding: 15px 25px; gap: 40px; }
        .ff-row-label { font-size: 10px; font-weight: 800; color: #166534; min-width: 120px; display: flex; align-items: center; gap: 8px; }
        .ff-row-inputs { display: flex; flex: 1; gap: 20px; align-items: flex-end; }
        .ff-field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .ff-field label { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .ff-input { width: 100%; padding: 8px 12px; border: 1.5px solid #eef2f6; border-radius: 8px; font-size: 14px; font-weight: 600; outline: none; }
        
        .ff-toggle { background: #f1f5f9; padding: 4px; border-radius: 8px; display: flex; gap: 4px; }
        .ff-toggle button { border: none; background: transparent; padding: 4px 12px; border-radius: 6px; cursor: pointer; color: #94a3b8; }
        .ff-toggle button.active { background: white; color: #166534; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .ff-analysis-card { background: white; border: 1px solid #eef0f2; border-radius: 14px; padding: 30px; }
        .ff-analysis-header { color: #166534; margin-bottom: 25px; display: flex; align-items: center; gap: 10px; }
        .ff-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .ff-table th { padding: 12px; font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 2px solid #f8fafc; text-transform: uppercase; }
        .ff-td-input { width: 110px; padding: 8px; border: 1.5px solid #eef2f6; border-radius: 8px; text-align: center; font-weight: 700; outline: none; }
        .ff-td-input.green { color: #166534; background: #f0fdf4; }
        .ff-td-input.bold { background: #f8fafc; font-weight: 900; }

        .ff-pills-footer { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; border-top: 2px solid #f8fafc; padding-top: 25px; }
        .ff-pill { padding: 15px; border-radius: 12px; display: flex; flex-direction: column; }
        .ff-pill.gray { background: #f8fafc; border: 1px solid #eef2f6; }
        .ff-pill.green { background: #f0fdf4; border: 1px solid #dcfce7; color: #166534; }
        .ff-pill.dark { background: #1e293b; color: white; }
        .ff-pill span { font-size: 9px; font-weight: 800; opacity: 0.7; }
        .ff-pill strong { font-size: 19px; font-weight: 900; }
        
        .ff-toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 12px 25px; border-radius: 10px; z-index: 1000; font-weight: 700; }
      `}</style>
    </AdminLayout>
  );
}