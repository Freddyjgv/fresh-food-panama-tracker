import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Plane, Ship, 
  Thermometer, Droplets, Calculator
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { LocationSelector } from "../../../components/LocationSelector";

export default function AdminQuoteDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  // ESTADOS DE CONTROL
  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<string[]>([]);

  // ESTADOS DE LA COTIZACIÓN
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

  // COSTOS OPERATIVOS (BASE)
  const [costs, setCosts] = useState<any>({
    fruta: { base: 13.30, margin: 15, label: "Fruta (Base Cajas)", tip: "Precio de compra por caja." },
    flete: { base: 0, margin: 10, label: "Flete Internacional", tip: "Costo por Kg estimado." },
    origen: { base: 0, margin: 10, label: "Gastos de Origen", tip: "Transporte interno y manejo PA." },
    aduana: { base: 0, margin: 10, label: "Gestión Aduanera", tip: "Corredor y trámites." },
    inspeccion: { base: 60, margin: 0, label: "Inspecciones / Fiton", tip: "Costo fijo MIDA." },
    documentos: { base: 100, margin: 0, label: "Documentación / BL", tip: "Gestión documental." },
    impuestos: { base: 0, margin: 0, label: "Impuestos / Tasas", tip: "Tasas aeroportuarias/portuarias." },
    otros: { base: 0, margin: 0, label: "Otros Gastos", tip: "Gastos no previstos." }
  });

  // 1. HEADER LOGIC
  const headerInfo = useMemo(() => {
    if (!data) return { name: "Cargando...", tax: "...", code: "Q-2026-0000" };
    const year = data.created_at ? new Date(data.created_at).getFullYear() : 2026;
    const serial = data.id_serial ? String(data.id_serial).padStart(4, '0') : String(id).slice(-4);
    return {
      name: data.clients?.name || "Cliente no asignado",
      tax: data.clients?.tax_id || "N/A",
      code: data.quote_number || `Q-${year}-${serial}`
    };
  }, [data, id]);

  // 2. CÁLCULO DE ANÁLISIS
  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]: [string, any]) => {
      let baseTotal = val.base;
      if (key === 'fruta') baseTotal = val.base * boxes;
      if (key === 'flete') baseTotal = val.base * weightKg;

      let saleValue = val.manualSale;
      if (saleValue === undefined) {
        const marginFact = val.margin / 100;
        saleValue = marginFact < 1 ? baseTotal / (1 - marginFact) : baseTotal;
      }
      return { key, label: val.label, tip: val.tip, baseTotal, sale: saleValue, margin: val.margin };
    });

    const totalCost = lines.reduce((acc, curr) => acc + curr.baseTotal, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);
    return { lines, totalCost, totalSale, profit: totalSale - totalCost, perBox: boxes > 0 ? totalSale / boxes : 0 };
  }, [costs, boxes, weightKg]);

  // CARGA INICIAL
  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  useEffect(() => {
    if (authOk && id) {
      (async () => {
        setLoading(true);
        const [qRes, pRes] = await Promise.all([
          supabase.from("quotes").select(`*, clients (*)`).eq("id", id).single(),
          supabase.from("products").select("*")
        ]);

        if (pRes.data) setProducts(pRes.data);
        if (qRes.data) {
          const q = qRes.data;
          setData(q);
          setStatus(q.status || "draft");
          setBoxes(q.boxes || 0);
          setWeightKg(q.weight_kg || 0);
          setMode(q.mode || "AIR");
          setPlace(q.destination || "");
          setProductId(q.product_id || "");
          
          const det = q.product_details || {};
          setVariety(det.variety || "");
          setColor(det.color || "");
          setBrix(det.brix || "");

          if (q.product_id) {
            const prod = pRes.data?.find(p => p.id === q.product_id);
            if (prod?.varieties) setVarieties(prod.varieties);
          }

          const c = q.costs || {};
          setCosts((prev: any) => ({
            ...prev,
            fruta: { ...prev.fruta, base: c.c_fruit ?? 13.3, margin: q.margin_markup || 15 },
            flete: { ...prev.flete, base: c.c_freight || 0, margin: c.m_freight || 10 },
            origen: { ...prev.origen, base: c.c_origin || 0, margin: c.m_origin || 10 },
            aduana: { ...prev.aduana, base: c.c_aduana || 0, margin: c.m_aduana || 10 }
          }));

          const m = q.totals?.meta || {};
          setIncoterm(m.incoterm || "CIP");
          setPallets(m.pallets || 0);
        }
        setLoading(false);
      })();
    }
  }, [authOk, id]);

  const handleProductChange = async (pId: string) => {
    setProductId(pId);
    setVariety("");
    const selected = products.find(p => p.id === pId);
    setVarieties(selected?.varieties || []);
  };

  const updateCostLine = (key: string, field: string, value: number) => {
    setCosts((prev: any) => {
      const line = { ...prev[key] };
      if (field === 'base') line.base = value;
      else if (field === 'margin') { line.margin = value; delete line.manualSale; }
      else if (field === 'sale') {
        line.manualSale = value;
        const base = key === 'fruta' ? line.base * boxes : (key === 'flete' ? line.base * weightKg : line.base);
        line.margin = value > base ? Number(((1 - (base / value)) * 100).toFixed(2)) : 0;
      }
      return { ...prev, [key]: line };
    });
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
        m_freight: costs.flete.margin, m_origin: costs.origen.margin
      },
      totals: { total: analysis.totalSale, per_box: analysis.perBox, meta: { incoterm, pallets } }
    };
    await supabase.from("quotes").update(payload).eq("id", id);
    setBusy(false);
    setToast("Cambios guardados");
    setTimeout(() => setToast(null), 2500);
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10">Cargando datos...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${headerInfo.name}`}>
      <div className="ff-container">
        
        {/* 1. HEADER */}
        <div className="ff-card head-row">
          <div className="head-info">
            <div className="head-icon"><FileText size={24} color="#16a34a" /></div>
            <div>
              <h1 className="quote-code">{headerInfo.code}</h1>
              <p className="quote-meta">{headerInfo.name} <span>|</span> TAX ID: {headerInfo.tax}</p>
            </div>
          </div>
          <div className="head-actions">
            <div className="kpi-box">
              <span className="kpi-val">${analysis.perBox.toFixed(2)}</span>
              <span className="kpi-lab">VENTA / CAJA</span>
            </div>
            <select className={`status-pill ${status}`} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="draft">BORRADOR</option>
              <option value="sent">ENVIADA</option>
              <option value="won">GANADA</option>
            </select>
            <button className="btn-save" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 className="spin" size={16}/> : <Save size={16}/>} Guardar
            </button>
          </div>
        </div>

        {/* 2. CALIDAD */}
        <div className="ff-card strip">
          <div className="strip-label">CALIDAD</div>
          <div className="strip-grid">
            <div className="f"><label>Producto</label>
              <select value={productId} onChange={e => handleProductChange(e.target.value)}>
                <option value="">Seleccionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="f"><label>Variedad</label>
              <select value={variety} onChange={e => setVariety(e.target.value)}>
                <option value="">Seleccionar...</option>
                {varieties.map((v, i) => <option key={i} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="f"><label><Thermometer size={10}/> Color</label><input placeholder="2.75-3.25" value={color} onChange={e => setColor(e.target.value)} /></div>
            <div className="f"><label><Droplets size={10}/> Brix</label><input placeholder="≥13" value={brix} onChange={e => setBrix(e.target.value)} /></div>
          </div>
        </div>

        {/* 3. LOGÍSTICA */}
        <div className="ff-card strip blue">
          <div className="strip-label">LOGÍSTICA</div>
          <div className="strip-grid">
            <div className="f" style={{flex: 0.6}}>
              <label>Modo</label>
              <div className="toggle">
                <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={14}/></button>
                <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={14}/></button>
              </div>
            </div>
            <div className="f" style={{flex: 0.6}}>
              <label>Incoterm</label>
              <select value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                <option value="EXW">EXW</option><option value="FOB">FOB</option>
                <option value="CIP">CIP</option><option value="CIF">CIF</option><option value="DDP">DDP</option>
              </select>
            </div>
            <div className="f" style={{flex: 2}}><label>Destino</label><LocationSelector mode={mode} value={place} onChange={setPlace}/></div>
            <div className="f small"><label>Cajas</label><input type="number" className="no-spin" value={boxes} onChange={e => setBoxes(Number(e.target.value))}/></div>
            <div className="f small"><label>Pallets</label><input type="number" className="no-spin" value={pallets} onChange={e => setPallets(Number(e.target.value))}/></div>
            <div className="f small"><label>Peso (Kg)</label><input type="number" className="no-spin" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))}/></div>
          </div>
        </div>

        {/* 4. TABLA DE VENTAS */}
        <div className="ff-card">
          <div className="table-h"><Calculator size={18} color="#16a34a"/> <span>Análisis Comercial de la Oferta</span></div>
          <table className="a-table">
            <thead>
              <tr>
                <th align="left">CONCEPTO</th>
                <th align="right">COSTO BASE (USD)</th>
                <th align="center">MARGEN %</th>
                <th align="right">PRECIO VENTA</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map(l => (
                <tr key={l.key}>
                  <td><div className="c-box"><b>{l.label}</b><span>{l.tip}</span></div></td>
                  <td align="right"><input className="in" type="number" value={costs[l.key].base} onChange={e => updateCostLine(l.key, 'base', Number(e.target.value))}/></td>
                  <td align="center"><input className="in c" type="number" value={l.margin} onChange={e => updateCostLine(l.key, 'margin', Number(e.target.value))}/></td>
                  <td align="right"><input className="in s" type="number" value={l.sale.toFixed(2)} onChange={e => updateCostLine(l.key, 'sale', Number(e.target.value))}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="a-footer">
            <div className="stat">COSTO TOTAL <b>${analysis.totalCost.toLocaleString()}</b></div>
            <div className="stat">VENTA TOTAL <b className="g">${analysis.totalSale.toLocaleString()}</b></div>
            <div className="stat">UTILIDAD <b className="b">${analysis.profit.toLocaleString()}</b></div>
            <div className="stat featured">PRECIO/CAJA <b>USD {analysis.perBox.toFixed(2)}</b></div>
          </div>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>

      <style jsx>{`
        .ff-container { padding: 25px; max-width: 1250px; margin: 0 auto; font-family: 'Inter', sans-serif; }
        .ff-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .head-row { display: flex; justify-content: space-between; align-items: center; }
        .head-info { display: flex; gap: 15px; align-items: center; }
        .head-icon { background: #f0fdf4; padding: 12px; border-radius: 10px; }
        .quote-code { font-size: 22px; font-weight: 800; margin: 0; color: #1e293b; }
        .quote-meta { font-size: 13px; color: #64748b; margin: 4px 0 0; }
        .quote-meta span { margin: 0 8px; opacity: 0.3; }
        .head-actions { display: flex; gap: 20px; align-items: center; }
        .kpi-box { text-align: right; border-right: 1px solid #e2e8f0; padding-right: 20px; }
        .kpi-val { display: block; font-size: 20px; font-weight: 900; color: #16a34a; }
        .kpi-lab { font-size: 9px; font-weight: 800; color: #94a3b8; }
        .status-pill { border-radius: 20px; padding: 6px 12px; font-size: 11px; font-weight: 800; border: 1px solid #e2e8f0; }
        .status-pill.draft { background: #fef9c3; color: #854d0e; }
        .btn-save { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; gap: 8px; }
        .strip { display: flex; gap: 20px; align-items: center; padding: 12px 20px; }
        .strip-label { width: 80px; font-size: 10px; font-weight: 900; color: #10b981; border-right: 1px solid #f1f5f9; letter-spacing: 0.5px; }
        .strip.blue .strip-label { color: #3b82f6; }
        .strip-grid { display: flex; flex: 1; gap: 15px; }
        .f { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .f label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .f input, .f select, .toggle { height: 38px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 10px; font-size: 13px; font-weight: 600; outline: none; }
        .f input:focus { border-color: #10b981; }
        .f.small { flex: 0 0 85px; }
        .toggle { display: flex; background: #f1f5f9; padding: 2px; }
        .toggle button { flex: 1; border: none; background: none; cursor: pointer; color: #94a3b8; }
        .toggle button.active { background: white; color: #3b82f6; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .table-h { display: flex; gap: 10px; align-items: center; font-size: 15px; font-weight: 800; margin-bottom: 20px; color: #1e293b; }
        .a-table { width: 100%; border-collapse: collapse; }
        .a-table th { font-size: 10px; color: #94a3b8; padding: 10px; border-bottom: 2px solid #f8fafc; }
        .a-table td { padding: 12px 10px; border-bottom: 1px solid #f8fafc; }
        .c-box b { display: block; font-size: 13px; color: #334155; }
        .c-box span { font-size: 10px; color: #94a3b8; }
        .in { width: 100px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: right; font-weight: 700; font-family: inherit; }
        .in.c { text-align: center; color: #10b981; }
        .in.s { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .a-footer { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 25px; padding-top: 20px; border-top: 2px solid #f1f5f9; }
        .stat { background: #f8fafc; padding: 15px; border-radius: 10px; font-size: 10px; color: #64748b; font-weight: 700; border: 1px solid #e2e8f0; }
        .stat b { display: block; font-size: 18px; color: #1e293b; margin-top: 5px; }
        .stat .g { color: #10b981; }
        .stat .b { color: #3b82f6; }
        .stat.featured { background: #1e293b; border: none; }
        .stat.featured b { color: white; }
        .stat.featured { color: #94a3b8; }
        .toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 12px 25px; border-radius: 10px; font-weight: 700; box-shadow: 0 10px 15px rgba(0,0,0,0.2); }
        .no-spin::-webkit-outer-spin-button, .no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}