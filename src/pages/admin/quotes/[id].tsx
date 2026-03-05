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

  // --- ESTO ES LO QUE TE FALTA DEFINIR ---
  const headerInfo = useMemo(() => {
    // 1. Si la data aún no carga, mostramos valores por defecto
    if (!data) return { name: "Cargando...", tax: "...", code: "Q-2026-0000" };
    
    // 2. Calculamos el año y el serial (igual que en Shipments)
    const year = data.created_at ? new Date(data.created_at).getFullYear() : 2026;
    const serial = data.id_serial ? String(data.id_serial).padStart(4, '0') : String(id).slice(-4).padStart(4, '0');
    
    // 3. Retornamos el objeto procesado
    return {
      name: data.clients?.name || "Cliente no asignado",
      tax: data.clients?.tax_id || "N/A",
      code: data.quote_number || `Q-${year}-${serial}`
    };
  }, [data, id]); // Se actualiza solo cuando cambia la data o el ID

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

  // Variables de apoyo (Vinculadas a la data real)
  const clientName = data?.clients?.name || "Cargando cliente...";
  const clientTaxId = data?.clients?.tax_id || "N/A";
  const quoteCode = data?.quote_number || (data?.created_at 
    ? `Q-${new Date(data.created_at).getFullYear()}-${String(data.id_serial || id).slice(-4).padStart(4, '0')}`
    : `Q-2026-0000`);

  // COSTOS CON MONTOS FIJOS Y TIPS
  const [costs, setCosts] = useState<any>({
    fruta: { base: 13.30, margin: 15, label: "Fruta (Base Cajas)", tip: "Precio por caja." },
    flete: { base: 0, margin: 10, label: "Flete Internacional", tip: "Tarifa * Kg de peso estimado." },
    origen: { base: 0, margin: 10, label: "Gastos de Origen", tip: "Gastos logísticos en Panamá, transporte interno y manejo." },
    aduana: { base: 0, margin: 10, label: "Gestión Aduanera", tip: "Honorarios del corredor de aduanas y trámites." },
    inspeccion: { base: 60, margin: 0, label: "Inspecciones / Fiton", tip: "Costo inspector." },
    documentos: { base: 100, margin: 0, label: "Documentación / BL", tip: "Costo gestora documental." },
    impuestos: { base: 0, margin: 0, label: "Impuestos / Tasas", tip: "Tasas portuarias, aeroportuarias o impuestos específicos." },
    otros: { base: 0, margin: 0, label: "Otros Gastos", tip: "Imprevistos o gastos no categorizados." }
  });

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadData(quoteId: string) {
    setLoading(true);
    const [quoteRes, productsRes] = await Promise.all([
      supabase.from("quotes").select(`*, clients (*)`).eq("id", quoteId).single(),
      supabase.from("products").select("*")
    ]);

    if (productsRes.data) setProducts(productsRes.data);
    const q = quoteRes.data;

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

      if (q.product_id) {
        const { data: prodData } = await supabase.from("products").select("varieties").eq("id", q.product_id).single();
        if (prodData?.varieties) setVarieties(prodData.varieties);
      }

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

      const m = q.totals?.meta || {};
      setIncoterm(m.incoterm || "CIP");
      setPallets(m.pallets || 0);
    }
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
      let saleValue = val.manualSale;
      
      if (saleValue === undefined) {
        const marginFact = val.margin / 100;
        saleValue = marginFact < 1 ? baseTotal / (1 - marginFact) : baseTotal;
      }

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
      const currentLine = { ...prev[key] };
      if (field === 'base') {
        currentLine.base = value;
      } else if (field === 'margin') {
        currentLine.margin = value;
        delete currentLine.manualSale;
      } else if (field === 'sale') {
        currentLine.manualSale = value;
        const baseTotal = key === 'fruta' ? currentLine.base * boxes : currentLine.base;
        if (value > 0 && value > baseTotal) {
          const newMargin = (1 - (baseTotal / value)) * 100;
          currentLine.margin = Number(newMargin.toFixed(2));
        } else if (value <= baseTotal && value > 0) {
          currentLine.margin = 0;
        }
      }
      return { ...prev, [key]: currentLine };
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
      totals: { total: analysis.totalSale, profit: analysis.profit, per_box: analysis.perBox, meta: { incoterm, pallets } }
    };
    await supabase.from("quotes").update(payload).eq("id", id);
    setBusy(false);
    setToast("Cambios guardados correctamente");
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => { if (authOk && id) loadData(id as string); }, [authOk, id]);

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10">Cargando datos maestros...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${clientName}`}>
      <div className="ff-container">
        
       {/* HEADER CLONADO DE SHIPMENTS (ROBUSTO Y REACTIVO) */}
<div className="ff-card cardHead">
  <div className="ff-spread2" style={{ alignItems: "flex-start", display: "flex", justifyContent: "space-between" }}>
    
    {/* BLOQUE IZQUIERDO: IDENTIDAD DEL DOCUMENTO */}
    <div style={{ minWidth: 0 }}>
      <div className="codeRow" style={{ display: "flex", gap: "15px" }}>
        <span className="codeIcon" style={{ padding: "10px", background: "#f0fdf4", borderRadius: "8px", display: "flex", alignItems: "center" }}>
          <FileText size={20} color="#16a34a" />
        </span>
        <div style={{ minWidth: 0 }}>
          {/* El código reacciona al ID o al correlativo de la DB */}
          <div className="code" style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>
            {headerInfo.code}
          </div>
          <div className="meta" style={{ marginTop: 4, fontSize: "14px", color: "#64748b" }}>
            Cliente: <b style={{ color: "#1e293b" }}>{headerInfo.name}</b> 
            <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
            TAX ID: <b>{headerInfo.tax}</b>
          </div>
          <div className="meta" style={{ marginTop: 2, fontSize: "13px" }}>
            Producto: <b>{data?.product_name || 'Piña MD2'}</b> · Variedad: <b>{variety || 'N/A'}</b>
          </div>
        </div>
      </div>
    </div>

    {/* BLOQUE CENTRAL: KPI DE VENTA (SÓLO LECTURA) */}
    <div style={{ textAlign: "center", padding: "0 20px", borderLeft: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9" }}>
       <div style={{ fontSize: "18px", fontWeight: "900", color: "#16a34a" }}>
         ${analysis.perBox.toFixed(2)} / Cj
       </div>
       <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>
         Precio de Venta
       </div>
    </div>

    {/* BLOQUE DERECHO: ACCIONES Y ESTADO */}
    <div className="ff-row2" style={{ display: "flex", gap: 8, alignItems: "center" }}>
       <select 
         className={`status-pill ${status}`} 
         value={status} 
         onChange={e => setStatus(e.target.value)}
       >
          <option value="draft">BORRADOR</option>
          <option value="sent">ENVIADA</option>
          <option value="won">GANADA</option>
       </select>
       
       <button 
         className="ff-btn-primary" 
         onClick={handleSave} 
         disabled={busy} 
         style={{ 
           background: "#10b981", 
           color: "white", 
           padding: "8px 16px", 
           borderRadius: "8px", 
           border: "none", 
           fontWeight: "700", 
           cursor: "pointer", 
           display: "flex", 
           alignItems: "center", 
           gap: "8px" 
         }}
       >
          {busy ? <Loader2 size={16} className="spin"/> : <Save size={16}/>} 
          Guardar
       </button>
    </div>
  </div>
</div>

        <div className="ff-divider" style={{ height: "1px", background: "#e2e8f0", margin: "20px 0" }} />

        {/* FILA 1: CALIDAD (RESTAURADA) */}
        <div className="ff-card row-strip">
          <div className="strip-label"><Package size={14}/> CALIDAD</div>
          <div className="strip-content">
            <div className="s-field">
              <label>Producto</label>
              <select value={productId} onChange={(e) => { setProductId(e.target.value); setVariety(""); fetchVarieties(e.target.value); }}>
                <option value="">Seleccionar...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="s-field">
              <label>Variedad</label>
              <select value={variety} onChange={(e) => setVariety(e.target.value)}>
                <option value="">Seleccionar...</option>
                {varieties.map((v, i) => <option key={i} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="s-field"><label><Thermometer size={10}/> Color</label><input value={color} onChange={e => setColor(e.target.value)} /></div>
            <div className="s-field"><label><Droplets size={10}/> Brix</label><input value={brix} onChange={e => setBrix(e.target.value)} /></div>
          </div>
        </div>

        {/* FILA 2: LOGÍSTICA (SOLO CAMPO VISUAL DE PESO) */}
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
    
    {/* BLOQUE DE CANTIDADES (SOLO ESTADOS) */}
    <div className="s-field small"><label>Cajas</label><input className="no-spin" type="number" value={boxes} onChange={e=>setBoxes(Number(e.target.value))} /></div>
    <div className="s-field small"><label>Pallets</label><input className="no-spin" type="number" value={pallets} onChange={e=>setPallets(Number(e.target.value))} /></div>
    <div className="s-field small">
      <label>Peso (Kg)</label>
      <input 
        className="no-spin" 
        type="number" 
        value={weightKg} 
        onChange={e => setWeightKg(Number(e.target.value))} 
      />
    </div>
  </div>
</div>
        {/* FILA 3: ANÁLISIS (USANDO TU LÓGICA DE 4 COLUMNAS) */}
        <div className="ff-card analysis-card">
          <div className="analysis-header"><Calculator size={18} /> <h3>Análisis de Costos y Ventas</h3></div>
          <table className="analysis-table">
            <thead>
              <tr>
                <th align="left">CONCEPTO</th>
                <th align="right">COSTO BASE (USD)</th>
                <th align="center">MARGEN %</th>
                <th align="right">PRECIO DE VENTA</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map((line) => (
                <tr key={line.key}>
                  <td className="concept-td">
                    <span className="concept-label">{line.label}</span>
                    <span className="info-icon" title={line.tip}>?</span>
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
            <div className="stat-pill"><span className="stat-label">COSTO TOTAL</span><span className="stat-value text-gray">${analysis.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <div className="stat-pill"><span className="stat-label">VENTA TOTAL</span><span className="stat-value text-green">${analysis.totalSale.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <div className="stat-pill"><span className="stat-label">GANANCIA TOTAL</span><span className="stat-value text-blue">${analysis.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <div className="stat-pill featured"><span className="stat-label">PRECIO POR CAJA</span><span className="stat-value">USD {analysis.perBox.toFixed(2)}</span></div>
          </div>
        </div>

        {toast && <div className="ff-toast">{toast}</div>}
      </div>

      <style jsx>{`
        .ff-container { padding: 20px; max-width: 1240px; margin: 0 auto; font-family: 'Inter', sans-serif; }
        .ff-card { background: white; border-radius: 12px; border: 1px solid #eef0f2; margin-bottom: 16px; padding: 20px; }
        .codeIcon { min-width: 40px; }
        .row-strip { display: flex; align-items: center; padding: 12px 20px; gap: 20px; }
        .strip-label { width: 90px; font-size: 10px; font-weight: 900; color: #10b981; border-right: 1px solid #f1f5f9; letter-spacing: 1px; }
        .strip-content { display: flex; flex: 1; gap: 16px; align-items: flex-end; }
        .s-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
        .s-field.small { flex: 0 0 100px !important; }
        .s-field label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; display: block; height: 12px; }
        .s-field input, .s-field select, .mini-toggle { height: 38px !important; box-sizing: border-box; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 10px; font-size: 13px; font-weight: 600; }
        .mini-toggle { display: flex; background: #f1f5f9; padding: 2px; width: 100%; }
        .mini-toggle button { flex: 1; border: none !important; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #94a3b8; }
        .mini-toggle button.active { background: white; color: #10b981; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .analysis-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .analysis-table th { padding: 12px; border-bottom: 2px solid #f8fafc; font-size: 10px; color: #94a3b8; text-transform: uppercase; }
        .analysis-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .concept-td { display: flex; align-items: center; gap: 8px; }
        .concept-label { font-size: 13px; font-weight: 600; color: #334155; }
        .info-icon { width: 14px; height: 14px; background: #f1f5f9; color: #94a3b8; border-radius: 50%; font-size: 9px; display: flex; align-items: center; justify-content: center; cursor: help; border: 1px solid #e2e8f0; }
        .table-input { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; width: 110px; font-size: 13px; font-weight: 700; text-align: right; outline: none; }
        .table-input.center { text-align: center; color: #10b981; }
        .sale-input { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .no-spin::-webkit-outer-spin-button, .no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spin { -moz-appearance: textfield; }
        .footer-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f5f9; }
        .stat-pill { background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; }
        .stat-pill.featured { background: #1e293b; color: white; border: none; }
        .stat-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .stat-value { font-size: 18px; font-weight: 800; }
        .text-green { color: #10b981; }
        .text-blue { color: #3b82f6; }
        .ff-toast { position: fixed; bottom: 25px; right: 25px; background: #1e293b; color: white; padding: 12px 24px; border-radius: 10px; font-weight: 700; box-shadow: 0 10px 15px rgba(0,0,0,0.1); z-index: 100; }
        .status-pill { border: 1px solid #e2e8f0; border-radius: 20px; padding: 6px 16px; font-size: 11px; font-weight: 800; cursor: pointer; }
        .status-pill.draft { background: #fef9c3; color: #854d0e; }
        .status-pill.sent { background: #dbeafe; color: #1e40af; }
        .status-pill.won { background: #dcfce7; color: #166534; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}