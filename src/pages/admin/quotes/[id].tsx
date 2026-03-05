import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Package, Loader2, Building2, Plane, Ship, 
  MapPin, Thermometer, Droplets, Calculator, ChevronLeft 
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

  // COSTOS DINÁMICOS
  const [costs, setCosts] = useState<any>({
    fruta: { base: 13.30, margin: 15, label: "Fruta (Base Cajas)", tip: "Precio por caja." },
    flete: { base: 0, margin: 10, label: "Flete Internacional", tip: "Tarifa * Kg de peso estimado." },
    origen: { base: 0, margin: 10, label: "Gastos de Origen", tip: "Gastos logísticos en Panamá." },
    aduana: { base: 0, margin: 10, label: "Gestión Aduanera", tip: "Trámites aduanales." },
    inspeccion: { base: 60, margin: 0, label: "Inspecciones / Fiton", tip: "Costo fijo inspector." },
    documentos: { base: 100, margin: 0, label: "Documentación / BL", tip: "Costo fijo gestoría." },
    impuestos: { base: 0, margin: 0, label: "Impuestos / Tasas", tip: "Tasas específicas." },
    otros: { base: 0, margin: 0, label: "Otros Gastos", tip: "Imprevistos." }
  });

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    const { data: q, error } = await supabase
      .from("quotes")
      .select(`*, clients (*)`)
      .eq("id", quoteId)
      .single();

    const { data: prods } = await supabase.from("products").select("*");
    if (prods) setProducts(prods);

    if (q) {
      setData(q);
      setStatus(q.status || "draft");
      setBoxes(q.boxes || 0);
      setWeightKg(q.weight_kg || 0);
      setMode(q.mode || "AIR");
      setPlace(q.destination || "");
      setProductId(q.product_id || "");
      
      const p = q.product_details || {};
      setVariety(p.variety || "");
      setColor(p.color || "");
      setBrix(p.brix || "");

      if (q.product_id) fetchVarieties(q.product_id);

      const c = q.costs || {};
      setCosts((prev: any) => ({
        fruta: { ...prev.fruta, base: c.c_fruit ?? 13.30, margin: q.margin_markup || 15 },
        flete: { ...prev.flete, base: c.c_freight || 0, margin: c.m_freight || 10 },
        origen: { ...prev.origen, base: c.c_origin || 0, margin: c.m_origin || 10 },
        aduana: { ...prev.aduana, base: c.c_aduana || 0, margin: c.m_aduana || 10 },
        inspeccion: { ...prev.inspeccion, base: c.c_insp ?? 60, margin: 0 },
        documentos: { ...prev.documentos, base: c.c_doc ?? 100, margin: 0 },
        impuestos: { ...prev.impuestos, base: c.c_tax || 0, margin: 0 },
        otros: { ...prev.otros, base: c.c_other || 0, margin: 0 }
      }));

      setIncoterm(q.totals?.meta?.incoterm || "CIP");
      setPallets(q.totals?.meta?.pallets || 0);
    }
    setLoading(false);
  }

  async function fetchVarieties(pId: string) {
    const { data: p } = await supabase.from("products").select("varieties").eq("id", pId).single();
    if (p?.varieties) setVarieties(p.varieties);
  }

  // --- MOTOR MATEMÁTICO UNIFICADO ---
  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]: [string, any]) => {
      const baseTotal = key === 'fruta' ? val.base * (boxes || 0) : (val.base || 0);
      const marginFact = (val.margin || 0) / 100;
      const saleValue = marginFact < 1 ? baseTotal / (1 - marginFact) : baseTotal;

      return { key, label: val.label, tip: val.tip, baseTotal, sale: saleValue, margin: val.margin };
    });

    const totalCost = lines.reduce((acc, curr) => acc + curr.baseTotal, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.sale, 0);

    return { 
      lines, totalCost, totalSale, 
      profit: totalSale - totalCost, 
      perBox: boxes > 0 ? totalSale / boxes : 0 
    };
  }, [costs, boxes]);

  const updateCostLine = (key: string, field: string, value: number) => {
    setCosts((prev: any) => {
      const current = { ...prev[key] };
      if (field === 'base') current.base = value;
      if (field === 'margin') current.margin = value;
      if (field === 'sale') {
        const baseTotal = key === 'fruta' ? current.base * boxes : current.base;
        if (value > baseTotal && value > 0) {
          current.margin = Number(((1 - (baseTotal / value)) * 100).toFixed(2));
        } else {
          current.margin = 0;
        }
      }
      return { ...prev, [key]: current };
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
        c_tax: costs.impuestos.base, c_other: costs.otros.base,
        m_freight: costs.flete.margin, m_origin: costs.origen.margin, m_aduana: costs.aduana.margin
      },
      totals: { 
        total: analysis.totalSale, profit: analysis.profit, per_box: analysis.perBox, 
        meta: { incoterm, pallets } 
      }
    };
    await supabase.from("quotes").update(payload).eq("id", id);
    setBusy(false);
    setToast("Cambios guardados");
    setTimeout(() => setToast(null), 2000);
  }

  useEffect(() => { if (authOk && id) loadData(id as string); }, [authOk, id]);

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10">Cargando cotización...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${data?.clients?.name || '...'}`}>
      <div className="ff-container">
        
        {/* HEADER MAESTRO UNIFICADO */}
        <div className="ff-card cardHead" style={{ borderBottom: '3px solid #10b981' }}>
          <div className="ff-spread2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* IZQUIERDA: IDENTIDAD */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div className="codeIcon" style={{ background: '#f0fdf4', padding: '12px', borderRadius: '10px' }}>
                <FileText size={22} color="#16a34a" />
              </div>
              <div>
                <div className="code" style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', lineHeight: 1 }}>
                  {data?.quote_number || `Q-2026-${String(id).slice(-4)}`}
                </div>
                <div className="meta" style={{ marginTop: '6px', fontSize: '13px', color: '#64748b' }}>
                  Cliente: <b style={{ color: '#1e293b' }}>{data?.clients?.name || 'N/A'}</b> | TAX ID: <b>{data?.clients?.tax_id || 'N/A'}</b>
                </div>
                <div className="meta" style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Producto: <b>{data?.product_name || 'Piña MD2'}</b> · Variedad: <b>{variety || 'N/A'}</b>
                </div>
              </div>
            </div>

            {/* CENTRO: KPI MÍNIMO */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#16a34a' }}>
                ${analysis.perBox.toFixed(2)} / Cj
              </div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Volumen: {boxes} Cajas
              </div>
            </div>

            {/* DERECHA: ACCIONES */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select 
                className={`status-pill ${status}`} 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">BORRADOR</option>
                <option value="sent">ENVIADA</option>
                <option value="won">GANADA</option>
              </select>
              
              <button className="ff-btn-save" onClick={handleSave} disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>

        <div className="ff-divider" />

        {/* CONTENIDO DE LA PÁGINA (CALIDAD Y LOGÍSTICA) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div className="ff-card row-strip">
            <div className="strip-label"><Package size={14}/> CALIDAD</div>
            <div className="strip-content">
              <div className="s-field">
                <label>Variedad</label>
                <select value={variety} onChange={(e) => setVariety(e.target.value)}>
                  {varieties.map((v, i) => <option key={i} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="s-field"><label>Color</label><input value={color} onChange={e => setColor(e.target.value)} /></div>
              <div className="s-field"><label>Brix</label><input value={brix} onChange={e => setBrix(e.target.value)} /></div>
            </div>
          </div>

          <div className="ff-card row-strip">
            <div className="strip-label"><Ship size={14}/> LOGÍSTICA</div>
            <div className="strip-content">
              <div className="s-field">
                <label>Incoterm</label>
                <select value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                  <option value="CIP">CIP</option><option value="CIF">CIF</option><option value="FOB">FOB</option>
                </select>
              </div>
              <div className="s-field"><label>Cajas</label><input type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))} /></div>
              <div className="s-field"><label>Modo</label>
                <div className="mini-toggle">
                  <button className={mode==='AIR'?'active':''} onClick={()=>setMode('AIR')}><Plane size={12}/></button>
                  <button className={mode==='SEA'?'active':''} onClick={()=>setMode('SEA')}><Ship size={12}/></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TABLA DE ANÁLISIS FINANCIERO CORREGIDA */}
        <div className="ff-card analysis-card">
          <div className="analysis-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Calculator size={20} color="#16a34a" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Análisis de Costos y Ventas</h3>
          </div>
          <table className="analysis-table">
            <thead>
              <tr>
                <th align="left">CONCEPTO</th>
                <th align="right">COSTO BASE (USD)</th>
                <th align="center">MARGEN %</th>
                <th align="right">VENTA ESTIMADA</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.key}>
                  <td className="concept-td">
                    <span className="concept-label">{line.label}</span>
                  </td>
                  <td align="right">
                    <input 
                      className="table-input no-spin" 
                      type="number" 
                      step="0.01"
                      value={costs[line.key].base} 
                      onChange={e => updateCostLine(line.key, 'base', Number(e.target.value))}
                    />
                  </td>
                  <td align="center">
                    <input 
                      className="table-input center no-spin" 
                      type="number" 
                      value={costs[line.key].margin} 
                      onChange={e => updateCostLine(line.key, 'margin', Number(e.target.value))}
                    />
                  </td>
                  <td align="right">
                    <input 
                      className="table-input sale-input no-spin" 
                      type="number" 
                      value={line.sale.toFixed(2)} 
                      onChange={e => updateCostLine(line.key, 'sale', Number(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="footer-stats-grid">
            <div className="stat-pill"><span className="stat-label">COSTO TOTAL</span><span className="stat-value" style={{color: '#64748b'}}>${analysis.totalCost.toFixed(2)}</span></div>
            <div className="stat-pill"><span className="stat-label">VENTA TOTAL</span><span className="stat-value" style={{color: '#10b981'}}>${analysis.totalSale.toFixed(2)}</span></div>
            <div className="stat-pill"><span className="stat-label">UTILIDAD</span><span className="stat-value" style={{color: '#3b82f6'}}>${analysis.profit.toFixed(2)}</span></div>
            <div className="stat-pill featured"><span className="stat-label">PRECIO / CAJA</span><span className="stat-value">USD {analysis.perBox.toFixed(2)}</span></div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .ff-container { padding: 24px; max-width: 1200px; margin: 0 auto; font-family: 'Inter', sans-serif; }
        .ff-card { background: white; border-radius: 12px; border: 1px solid #eef0f2; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .ff-divider { height: 1px; background: #f1f5f9; margin: 24px 0; }
        
        .row-strip { display: flex; align-items: center; gap: 20px; padding: 15px 20px; }
        .strip-label { font-size: 10px; font-weight: 900; color: #10b981; border-right: 1px solid #f1f5f9; width: 85px; letter-spacing: 0.5px; }
        .strip-content { display: flex; flex: 1; gap: 12px; }
        
        .s-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .s-field label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .s-field input, .s-field select { height: 36px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 10px; font-size: 13px; font-weight: 600; }
        
        .mini-toggle { display: flex; background: #f1f5f9; padding: 2px; border-radius: 6px; height: 36px; }
        .mini-toggle button { flex: 1; border: none; background: transparent; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center; }
        .mini-toggle button.active { background: white; color: #10b981; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

        .analysis-table { width: 100%; border-collapse: collapse; }
        .analysis-table th { font-size: 10px; color: #94a3b8; padding: 12px; border-bottom: 2px solid #f8fafc; }
        .analysis-table td { padding: 10px; border-bottom: 1px solid #f8fafc; }
        
        .table-input { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; width: 100px; text-align: right; font-weight: 700; font-size: 13px; }
        .table-input.center { text-align: center; color: #10b981; background: #f0fdf4; }
        .sale-input { background: #f8fafc; border-color: #cbd5e1; }

        .footer-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 25px; }
        .stat-pill { background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; }
        .stat-pill.featured { background: #1e293b; color: white; border: none; }
        .stat-label { font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .stat-value { font-size: 20px; font-weight: 900; }

        .status-pill { border: 1px solid #e2e8f0; border-radius: 20px; padding: 6px 14px; font-size: 11px; font-weight: 800; cursor: pointer; }
        .status-pill.draft { background: #fef9c3; color: #a16207; }
        .status-pill.won { background: #dcfce7; color: #166534; }
        
        .ff-btn-save { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .ff-toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        .no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}