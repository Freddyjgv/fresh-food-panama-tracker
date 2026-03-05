import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { 
  Save, FileText, Loader2, Plane, Ship, 
  Thermometer, Droplets, Calculator, MapPin, Shield, ArrowRight, Package 
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { LocationSelector } from "../../../components/LocationSelector";

// --- FUNCIONES AUXILIARES (FUERA DEL COMPONENTE PARA EVITAR ERRORES) ---
const statusBadgeClass = (status: string | undefined) => {
  const s = status?.toLowerCase() || 'draft';
  const base = "pill ";
  switch (s) {
    case 'draft': return base + "gray";
    case 'sent': return base + "blue";
    case 'approved': return base + "green";
    case 'rejected': return base + "red";
    case 'expired': return base + "orange";
    default: return base + "gray";
  }
};

const labelStatus = (status: string | undefined) => {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    approved: 'Aprobada',
    won: 'Aprobada',     // Mapeo doble por seguridad
    rejected: 'Rechazada',
    lost: 'Rechazada',   // Mapeo doble por seguridad
    expired: 'Vencida',
    archived: 'Archivada'
  };
  return labels[status?.toLowerCase() || 'draft'] || 'Borrador';
};

// --- INTERFACES ---
interface CostLine {
  base: number;
  unitSale: number;
  label: string;
  tip: string;
}

interface CostState {
  [key: string]: CostLine;
}

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

  const [costs, setCosts] = useState<CostState>({
    fruta: { base: 13.30, unitSale: 0, label: "Fruta (Base Cajas)", tip: "Precio de compra por caja." },
    flete: { base: 0, unitSale: 0, label: "Flete Internacional", tip: "Costo por Kg estimado." },
    origen: { base: 0, unitSale: 0, label: "Gastos de Origen", tip: "Transporte interno y manejo PA." },
    aduana: { base: 0, unitSale: 0, label: "Gestión Aduanera", tip: "Corredor y trámites." },
    inspeccion: { base: 0, unitSale: 0, label: "Inspecciones / Fiton", tip: "Costo fijo MIDA." },
    itbms: { base: 0, unitSale: 0, label: "ITBMS / Tasas", tip: "Impuestos aplicables." },
    handling: { base: 0, unitSale: 0, label: "Handling", tip: "Manejo de carga." },
    otros: { base: 0, unitSale: 0, label: "Otros Gastos", tip: "Gastos no previstos." }
  });

  const headerInfo = useMemo(() => {
    if (!data) return { name: "Cargando...", tax: "...", code: "Q-2026-0000" };
    return {
      name: data.clients?.name || "Cliente no asignado",
      tax: data.clients?.tax_id || "N/A",
      code: data.quote_number || `Q-2026-XXXX`
    };
  }, [data]);

  const handleProductChange = (id: string) => {
  setProductId(id);
  const selectedProd = products.find(p => p.id === id);
  
  if (selectedProd && selectedProd.variety) {
    // Si es un array lo usamos, si es un string lo metemos en un array
    const vList = Array.isArray(selectedProd.variety) 
      ? selectedProd.variety 
      : [selectedProd.variety];
    setVarieties(vList);
  } else {
    setVarieties([]);
  }
  setVariety(""); 
};

  const analysis = useMemo(() => {
    const lines = Object.entries(costs).map(([key, val]) => {
      let qty = 1;
      if (key === 'fruta') qty = boxes;
      if (key === 'flete') qty = weightKg;
      const baseTotalCost = val.base * qty;
      const totalSaleRow = val.unitSale * qty;
      const currentMargin = totalSaleRow > 0 
        ? ((1 - (baseTotalCost / totalSaleRow)) * 100).toFixed(2) 
        : "0.00";
      return { key, ...val, qty, baseTotalCost, totalSaleRow, margin: currentMargin };
    });
    const totalCost = lines.reduce((acc, curr) => acc + curr.baseTotalCost, 0);
    const totalSale = lines.reduce((acc, curr) => acc + curr.totalSaleRow, 0);
    const profit = totalSale - totalCost;
    const perBox = boxes > 0 ? totalSale / boxes : 0;
    return { lines, totalCost, totalSale, profit, perBox };
  }, [costs, boxes, weightKg]);

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
            setVarieties(prod?.varieties || []);
          }
          const c = q.costs || {};
          setCosts({
            fruta: { base: c.c_fruit || 0, unitSale: c.s_fruit || 0, label: "Fruta (Base Cajas)", tip: "Precio de compra." },
            flete: { base: c.c_freight || 0, unitSale: c.s_freight || 0, label: "Flete Internacional", tip: "Costo por Kg." },
            origen: { base: c.c_origin || 0, unitSale: c.s_origin || 0, label: "Gastos de Origen", tip: "Manejo local." },
            aduana: { base: c.c_aduana || 0, unitSale: c.s_aduana || 0, label: "Gestión Aduanera", tip: "Corredor." },
            inspeccion: { base: c.c_insp || 0, unitSale: c.s_insp || 0, label: "Inspecciones / Fiton", tip: "MIDA." },
            itbms: { base: c.c_itbms || 0, unitSale: c.s_itbms || 0, label: "ITBMS / Tasas", tip: "Impuestos." },
            handling: { base: c.c_handling || 0, unitSale: c.s_handling || 0, label: "Handling", tip: "Manejo carga." },
            otros: { base: c.c_other || 0, unitSale: c.s_other || 0, label: "Otros Gastos", tip: "Extras." }
          });
          const m = q.totals?.meta || {};
          setIncoterm(m.incoterm || "CIP");
          setPallets(m.pallets || 0);
        }
        setLoading(false);
      })();
    }
  }, [authOk, id]);

  const updateCostLine = (key: string, field: 'base' | 'unitSale', value: string) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    setCosts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: numValue } }));
  };

 async function handleSave() {
  if (!id) return;
  setBusy(true);

  try {
    // 1. CÁLCULO DEL TOTAL (Sumando lo que el cliente va a pagar)
    // Usamos los nombres que vienen de tu estado de React: costs.categoria.unitSale
    const totalVentaCientifico = 
      Number(costs.fruta?.unitSale || 0) +
      Number(costs.flete?.unitSale || 0) +
      Number(costs.origen?.unitSale || 0) +
      Number(costs.aduana?.unitSale || 0) +
      Number(costs.inspeccion?.unitSale || 0) +
      Number(costs.itbms?.unitSale || 0) +
      Number(costs.handling?.unitSale || 0) +
      Number(costs.otros?.unitSale || 0);

    const payload = {
      // CAMPOS DE TEXTO Y LOGÍSTICA
      terms: incoterm, 
      currency: data?.currency || 'USD', 
      status: status,
      mode: mode,
      destination: place,
      boxes: Number(boxes),
      weight_kg: Number(weightKg),
      
      // EL TOTAL PARA EL INDEX
      total: totalVentaCientifico, 

      // OBJETO JSONB (Mapeado a los nombres s_ y c_ que verificamos en la DB)
      costs: {
        c_fruit: Number(costs.fruta.base),
        s_fruit: Number(costs.fruta.unitSale),
        c_freight: Number(costs.flete.base),
        s_freight: Number(costs.flete.unitSale),
        c_origin: Number(costs.origen.base),
        s_origin: Number(costs.origen.unitSale),
        c_aduana: Number(costs.aduana.base),
        s_aduana: Number(costs.aduana.unitSale),
        c_insp: Number(costs.inspeccion.base),
        s_insp: Number(costs.inspeccion.unitSale),
        c_itbms: Number(costs.itbms.base),
        s_itbms: Number(costs.itbms.unitSale),
        c_handling: Number(costs.handling.base),
        s_handling: Number(costs.handling.unitSale),
        c_other: Number(costs.otros.base),
        s_other: Number(costs.otros.unitSale)
      },
      product_id: productId && productId !== "" ? productId : null,
      product_details: { variety, color, brix }
    };

    const { error } = await supabase.from("quotes").update(payload).eq("id", id);
    if (error) throw error;
    
    setToast("Guardado con éxito");
    // Forzamos regreso al index para ver el nuevo total
    setTimeout(() => router.push('/admin/quotes'), 1500);

  } catch (err) {
    console.error("Error:", err.message);
    setToast("Error: " + err.message);
  } finally {
    setBusy(false);
  }
}

  if (loading) return <AdminLayout title="Cargando..."><div className="p-10">Cargando...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización: ${headerInfo.name}`}>
      <div className="ff-container">
        
        {/* HERO HEADER - CLON EXACTO DE SHIPMENTS */}
        <div className="hero">
          <div className="heroLeft">
            <div className="codeRow">
              <div className="codeIcon">
                <FileText size={20} color="var(--ff-green-dark)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="heroLabel">Identificador Único</div>
                <div className="code">{data?.quote_number || 'S/N'}</div>
                <div className="productLine">
                  <span style={{fontWeight: 600}}>{data?.clients?.name || 'Cliente no definido'}</span>
                  {data?.product_name && ` • ${data.product_name}`}
                </div>
              </div>
            </div>
          </div>

          <div className="heroRight">
            <div className="head-actions">
               <div className="kpi-box">
                  <span className="kpi-val">USD {analysis.perBox.toFixed(2)}</span>
                  <span className="kpi-lab">PRECIO POR CAJA</span>
               </div>
               <button className="btn-save" onClick={handleSave} disabled={busy}>
                 {busy ? <Loader2 size={18} className="spin"/> : <Save size={18}/>}
                 {busy ? 'Guardando...' : 'Guardar'}
               </button>
            </div>
            {/* Pill de Ruta - AHORA REACTIVO AL SELECTOR DE ABAJO */}
<span className="pill green">
  <MapPin size={14}/> 
  {/* El origen suele ser fijo (Panamá/PTY), si lo tienes en un estado úsalo aquí */}
  {"PTY"} 
  <ArrowRight size={12} style={{margin: '0 4px'}}/> 
  {place || 'Destino'} 
</span>
  {/* Pill de Incoterm - AHORA USA EL ESTADO LOCAL 'incoterm' */}
  <span className="pill blue">
    <Shield size={14}/> {incoterm}
  </span>
           {/* Badge de Estado - AHORA ES UN SELECT INTERACTIVO */}
  <select 
    className={statusBadgeClass(status)} 
    value={status} 
    onChange={(e) => setStatus(e.target.value)}
    style={{ cursor: 'pointer', border: 'none', outline: 'none', appearance: 'none', WebkitAppearance: 'none' }}
  >
    <option value="draft">Borrador</option>
    <option value="sent">Enviada</option>
    <option value="approved">Aprobada (Ganada)</option>
    <option value="rejected">Rechazada (Perdida)</option>
    <option value="expired">Vencida</option>
  </select>
</div>
        </div>

        {/* CALIDAD - SIN TOCAR LOGICA */}
        <div className="ff-card strip">
          <div className="strip-label">CALIDAD</div>
          <div className="strip-grid">
            <div className="f">
  <label>Producto</label>
  <select 
    value={productId} 
    onChange={e => handleProductChange(e.target.value)}
  >
    <option value="">Seleccionar...</option>
    {products.map(p => (
      <option key={p.id} value={p.id}>{p.name}</option>
    ))}
  </select>
</div>

<div className="f">
  <label>Variedad</label>
  <select value={variety} onChange={e => setVariety(e.target.value)}>
    <option value="">Seleccionar...</option>
    {varieties.map((v, i) => (
      <option key={i} value={v}>{v}</option>
    ))}
  </select>
</div>
            <div className="f"><label><Thermometer size={10}/> Color</label><input placeholder="2.75-3.25" value={color} onChange={e => setColor(e.target.value)} /></div>
            <div className="f"><label><Droplets size={10}/> Brix</label><input placeholder="≥13" value={brix} onChange={e => setBrix(e.target.value)} /></div>
          </div>
        </div>

        {/* LOGÍSTICA - SIN TOCAR LOGICA */}
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
                <option value="EXW">EXW</option><option value="FOB">FOB</option><option value="CIP">CIP</option><option value="CIF">CIF</option><option value="DDP">DDP</option>
              </select>
            </div>
            <div className="f" style={{flex: 2}}><label>Destino</label><LocationSelector mode={mode} value={place} onChange={setPlace}/></div>
            <div className="f small"><label>Cajas</label><input type="number" className="no-spin" value={boxes} onChange={e => setBoxes(Number(e.target.value))}/></div>
            <div className="f small"><label>Pallets</label><input type="number" className="no-spin" value={pallets} onChange={e => setPallets(Number(e.target.value))}/></div>
            <div className="f small"><label>Peso (Kg)</label><input type="number" className="no-spin" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))}/></div>
          </div>
        </div>

       {/* TABLA DE VENTAS DINÁMICA - RESTAURADA */}
        <div className="ff-card">
          <div className="table-h"><Calculator size={18} color="#16a34a"/> <span>Análisis Comercial de la Oferta</span></div>
          <table className="a-table">
            <thead>
              <tr>
                <th align="left">CONCEPTO</th>
                <th align="right">COSTO UNIT.</th>
                <th align="center">CANT.</th>
                <th align="right">P. UNIT. VENTA</th>
                <th align="right">VENTA TOTAL</th>
                <th align="center">MARGEN %</th>
              </tr>
            </thead>
            <tbody>
              {analysis.lines.map(l => (
                <tr key={l.key}>
                  <td><div className="c-box"><b>{l.label}</b><span>{l.tip}</span></div></td>
                  <td align="right">
                    <input className="in no-spin" type="number" step="any" value={costs[l.key].base || ""} onChange={e => updateCostLine(l.key, 'base', e.target.value)} />
                  </td>
                  <td align="center" style={{fontWeight: 800, color: '#64748b'}}>{l.qty}</td>
                  <td align="right">
                    <input className="in s no-spin" type="number" step="any" value={costs[l.key].unitSale || ""} onChange={e => updateCostLine(l.key, 'unitSale', e.target.value)} />
                  </td>
                  <td align="right" style={{fontWeight: 700, paddingRight: '10px'}}>
                    ${l.totalSaleRow.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                  <td align="center"><span className="m-badge">{l.margin}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="a-footer">
            <div className="stat">COSTO OPERATIVO <b>${analysis.totalCost.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className="stat">VALOR VENTA <b className="g">${analysis.totalSale.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className="stat">UTILIDAD <b className="b">${analysis.profit.toLocaleString(undefined, {minimumFractionDigits:2})}</b></div>
            <div className="stat featured">PRECIO/CAJA <b>USD {analysis.perBox.toFixed(2)}</b></div>
          </div>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>

      <style jsx>{`
        .ff-container { padding: 30px; max-width: 1250px; margin: 0 auto; font-family: 'Inter', sans-serif; }
        .ff-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        
        /* HERO STYLES */
        .hero { display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .heroLeft { display: flex; align-items: center; flex: 1; }
        .codeRow { display: flex; gap: 15px; align-items: center; }
        .codeIcon { width: 44px; height: 44px; background: var(--ff-green-light, #f0fdf4); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .heroLabel { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .code { font-size: 22px; font-weight: 900; color: #1e293b; line-height: 1.2; }
        .productLine { font-size: 13px; color: #64748b; margin-top: 2px; }
        
        .heroRight { display: flex; gap: 10px; align-items: center; }
        .head-actions { display: flex; gap: 20px; align-items: center; margin-right: 15px; border-right: 1px solid #e2e8f0; padding-right: 20px; }
        .kpi-box { text-align: right; }
        .kpi-val { display: block; font-size: 18px; font-weight: 900; color: #16a34a; }
        .kpi-lab { font-size: 9px; font-weight: 800; color: #94a3b8; }
        
        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid transparent; }
        .pill.green { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
        .pill.blue { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
        .pill.gray { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
        .pill.red { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
        .pill.orange { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }

        .btn-save { background: #10b981; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: all 0.2s; }
        .btn-save:hover { background: #059669; transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

        /* REST OF STRIP STYLES */
        .strip { display: flex; gap: 20px; align-items: center; padding: 12px 20px; }
        .strip-label { width: 80px; font-size: 10px; font-weight: 900; color: #10b981; border-right: 1px solid #f1f5f9; }
        .strip.blue .strip-label { color: #3b82f6; }
        .strip-grid { display: flex; flex: 1; gap: 15px; }
        .f { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .f label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .f input, .f select, .toggle { height: 38px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 10px; font-size: 13px; font-weight: 600; }
        .f.small { flex: 0 0 85px; }
        .toggle { display: flex; background: #f1f5f9; padding: 2px; }
        .toggle button { flex: 1; border: none; background: none; cursor: pointer; color: #94a3b8; }
        .toggle button.active { background: white; color: #3b82f6; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        
        .table-h { display: flex; gap: 10px; align-items: center; font-size: 15px; font-weight: 800; margin-bottom: 20px; }
        .a-table { width: 100%; border-collapse: collapse; }
        .a-table th { font-size: 10px; color: #94a3b8; padding: 10px; border-bottom: 2px solid #f8fafc; }
        .a-table td { padding: 12px 10px; border-bottom: 1px solid #f8fafc; }
        .c-box b { display: block; font-size: 13px; color: #334155; }
        .c-box span { font-size: 10px; color: #94a3b8; }
        .in { width: 105px; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: right; font-weight: 700; }
        .in.s { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .no-spin::-webkit-outer-spin-button, .no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spin { -moz-appearance: textfield; }
        .m-badge { background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; }
        
        .a-footer { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 25px; padding-top: 20px; border-top: 2px solid #f1f5f9; }
        .stat { background: #f8fafc; padding: 15px; border-radius: 10px; font-size: 10px; color: #64748b; font-weight: 700; }
        .stat b { display: block; font-size: 18px; color: #1e293b; margin-top: 5px; }
        .stat .g { color: #10b981; }
        .stat .b { color: #3b82f6; }
        .stat.featured { background: #1e293b; color: #94a3b8; }
        .stat.featured b { color: white; }
        
        .toast { position: fixed; bottom: 30px; right: 30px; background: #1e293b; color: white; padding: 12px 25px; border-radius: 10px; font-weight: 700; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 100; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}