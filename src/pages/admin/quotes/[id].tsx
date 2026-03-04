// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { 
  ArrowLeft, Save, FileText, Package, CheckCircle2, AlertCircle, 
  Loader2, Building2, MapPin, Plane, Ship, Boxes, Weight, 
  ChevronDown, ChevronUp, Globe, DollarSign, Thermometer, Droplets 
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { LocationSelector } from "../../../components/LocationSelector"; // ✅ Importado

// --- TYPES ---
type QuoteDetail = {
  id: string;
  status: "draft" | "sent" | "won" | "lost" | "archived";
  mode: "AIR" | "SEA";
  currency: "USD" | "EUR";
  destination: string;
  boxes: number;
  weight_kg?: number | null;
  margin_markup: number;
  client_id: string;
  client_snapshot?: { name?: string; contact_email?: string; tax_id?: string } | null;
  totals?: any;
  costs?: any;
  product_id?: string;
  product_details?: { variety?: string; color?: string; brix?: string };
};

type Incoterm = "CIP" | "CPT" | "DAP" | "DDP" | "FCA" | "FOB" | "CIF";

export default function AdminQuoteDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [data, setData] = useState<QuoteDetail | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  // Estados Editables
  const [status, setStatus] = useState<QuoteDetail["status"]>("draft");
  const [boxes, setBoxes] = useState(0);
  const [weightKg, setWeightKg] = useState(0);
  const [pallets, setPallets] = useState(0);
  const [margin, setMargin] = useState(15);
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [incoterm, setIncoterm] = useState<Incoterm>("CIP");
  const [place, setPlace] = useState("");
  
  // Estado de Producto
  const [productId, setProductId] = useState("");
  const [variety, setVariety] = useState("");
  const [color, setColor] = useState("2.75 - 3");
  const [brix, setBrix] = useState("> 13");

  // Estructura de Costos
  const [cFruit, setCFruit] = useState(13.30); // ✅ Valor inicial por defecto
  const [cFreight, setCFreight] = useState(0);
  const [cOrigin, setCOrigin] = useState(0);
  const [cAduana, setCAduana] = useState(0);
  const [cInsp, setCInsp] = useState(0);
  const [cDoc, setCDoc] = useState(0);
  const [cTax, setCTax] = useState(0);
  const [cOther, setCOther] = useState(0);

  const [showCosts, setShowCosts] = useState(true);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadProducts() {
    const { data } = await supabase.from("products").select("*");
    if (data) setProducts(data);
  }

  async function load(quoteId: string) {
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;

    const res = await fetch(`/.netlify/functions/getQuote?id=${encodeURIComponent(quoteId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) { setError("Error cargando cotización"); setLoading(false); return; }

    const json = (await res.json()) as QuoteDetail;
    setData(json);
    setStatus(json.status);
    setBoxes(Number(json.boxes || 0));
    setWeightKg(Number(json.weight_kg || 0));
    setMargin(Number(json.margin_markup || 15));
    setMode(json.mode || "AIR");
    setCurrency(json.currency || "USD");

    // Cargar Producto y Detalles
    setProductId(json.product_id || "");
    setVariety(json.product_details?.variety || "");
    setColor(json.product_details?.color || "2.75 - 3");
    setBrix(json.product_details?.brix || "> 13");

    const meta = json.totals?.meta || {};
    setIncoterm(meta.incoterm || "CIP");
    setPlace(meta.place || json.destination || "");
    setPallets(meta.pallets || 0);

    const c = json.costs || {};
    setCFruit(Number(c.c_fruit || 13.30));
    setCFreight(Number(c.c_freight || 0));
    setCOrigin(Number(c.c_origin || 0));
    setCAduana(Number(c.c_aduana || 0));
    setCInsp(Number(c.c_insp || 0));
    setCDoc(Number(c.c_doc || 0));
    setCTax(Number(c.c_tax || 0));
    setCOther(Number(c.c_other || 0));
    
    await loadProducts();
    setLoading(false);
  }

  useEffect(() => { if (authOk && typeof id === "string") load(id); }, [authOk, id]);

  const computed = useMemo(() => {
    const totalCost = (cFruit * boxes) + cFreight + cOrigin + cAduana + cInsp + cDoc + cTax + cOther;
    const m = margin / 100;
    const totalSale = m < 1 ? totalCost / (1 - m) : totalCost;
    const profit = totalSale - totalCost;

    return {
      totalCost,
      totalSale,
      profit,
      perBox: boxes > 0 ? totalSale / boxes : 0
    };
  }, [boxes, margin, cFruit, cFreight, cOrigin, cAduana, cInsp, cDoc, cTax, cOther]);

  async function handleSave() {
    setBusy(true);
    const { data: sess } = await supabase.auth.getSession();
    
    const payload = {
      id: data?.id,
      status, 
      boxes, 
      weight_kg: weightKg, 
      margin_markup: margin, 
      mode, 
      currency,
      destination: place,
      product_id: productId,
      product_details: { variety, color, brix },
      costs: { 
        c_fruit: cFruit, c_freight: cFreight, c_origin: cOrigin, 
        c_aduana: cAduana, c_insp: cInsp, c_doc: cDoc, c_tax: cTax, c_other: cOther 
      },
      totals: {
        total: computed.totalSale,
        profit: computed.profit,
        per_box: computed.perBox,
        meta: { incoterm, place, pallets, weight_kg: weightKg }
      }
    };

    const res = await fetch("/.netlify/functions/updateQuote", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token}` },
      body: JSON.stringify(payload),
    });

    setBusy(false);
    if (res.ok) showToast("¡Cambios guardados con éxito!");
  }

  if (!authOk || loading) return <AdminLayout title="Cargando..."><div className="loader">Sincronizando datos...</div></AdminLayout>;

  return (
    <AdminLayout title={`Cotización ${data?.id.slice(0, 8)}`}>
      {/* HEADER */}
      <div className="quoteHeader ff-card2">
        <div className="clientInfo">
          <div className="clientAvatar"><Building2 size={24} /></div>
          <div className="clientDetails">
            <h2>{data?.client_snapshot?.name || "Cliente General"}</h2>
            <div className="metaRow">
              <span><FileText size={14} /> Tax ID: <b>{data?.client_snapshot?.tax_id || "N/A"}</b></span>
              <span><Globe size={14} /> {data?.client_snapshot?.contact_email}</span>
            </div>
          </div>
        </div>
        <div className="statusActions">
           <select className={`statusSelect ${status}`} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="draft">BORRADOR</option>
              <option value="sent">ENVIADA</option>
              <option value="won">GANADA (WON)</option>
              <option value="lost">PERDIDA</option>
           </select>
           <button className="btnSave" onClick={handleSave} disabled={busy}>
             {busy ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
             Guardar Cambios
           </button>
        </div>
      </div>

      <div className="mainGrid">
        <div className="leftCol">
          
          {/* ✅ NUEVO: ESPECIFICACIONES DEL PRODUCTO */}
          <div className="card">
            <div className="cardHeader">
              <div className="titleWithIcon"><Package size={18} /> <h3>Producto y Calidad</h3></div>
            </div>
            <div className="productGrid">
              <div className="field">
                <label>Producto</label>
                <select value={productId} onChange={e => {
                   const p = products.find(x => x.id === e.target.value);
                   setProductId(e.target.value);
                   if(p) setVariety(p.variety || "");
                }}>
                  <option value="">Seleccionar Producto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Variedad</label>
                <input value={variety} onChange={e => setVariety(e.target.value)} placeholder="Ej: MD2 Gold" />
              </div>
              <div className="field">
                <label><Thermometer size={12}/> Color</label>
                <input value={color} onChange={e => setColor(e.target.value)} />
              </div>
              <div className="field">
                <label><Droplets size={12}/> Brix</label>
                <input value={brix} onChange={e => setBrix(e.target.value)} />
              </div>
            </div>
          </div>

          {/* CONFIGURACIÓN LOGÍSTICA */}
          <div className="card">
            <div className="cardHeader">
              <div className="titleWithIcon"><Ship size={18} /> <h3>Configuración Logística</h3></div>
              <div className="segmentedControl">
                <button className={mode === 'AIR' ? 'active' : ''} onClick={() => setMode('AIR')}><Plane size={14}/> Aéreo</button>
                <button className={mode === 'SEA' ? 'active' : ''} onClick={() => setMode('SEA')}><Ship size={14}/> Marítimo</button>
              </div>
            </div>

            <div className="formGrid">
              <div className="field">
                <label>Incoterm</label>
                <select value={incoterm} onChange={e => setIncoterm(e.target.value as any)}>
                  <option value="FOB">FOB</option><option value="CIF">CIF</option>
                  <option value="CIP">CIP</option><option value="DDP">DDP</option>
                </select>
              </div>
              <div className="field">
                <label>Destino (Place)</label>
                {/* ✅ INTEGRACIÓN SELECTOR CON BANDERAS */}
                <LocationSelector 
                  mode={mode} 
                  value={place} 
                  onChange={(val) => setPlace(val)} 
                />
              </div>
            </div>

            <div className="logisticsGrid">
               <div className="logBox">
                 <Boxes size={16} />
                 <div className="logData"><label>Cajas</label><input type="number" value={boxes} onChange={e => setBoxes(Number(e.target.value))} /></div>
               </div>
               <div className="logBox">
                 <Package size={16} />
                 <div className="logData"><label>Pallets</label><input type="number" value={pallets} onChange={e => setPallets(Number(e.target.value))} /></div>
               </div>
               <div className="logBox">
                 <Weight size={16} />
                 <div className="logData"><label>Peso estimado (KG)</label><input type="number" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} /></div>
               </div>
            </div>
          </div>

          {/* COSTOS */}
          <div className="card">
            <div className="cardHeader">
              <div className="titleWithIcon"><DollarSign size={18} /> <h3>Estructura de Costos ({currency})</h3></div>
              <button className="btnToggle" onClick={() => setShowCosts(!showCosts)}>
                {showCosts ? <><ChevronUp size={16}/> Ocultar</> : <><ChevronDown size={16}/> Editar</>}
              </button>
            </div>
            {showCosts && (
              <div className="costsGrid">
                <div className="field"><label>Costo Fruta (Caja)</label><input type="number" step="0.01" value={cFruit} onChange={e => setCFruit(Number(e.target.value))} /></div>
                <div className="field"><label>Flete Internacional</label><input type="number" value={cFreight} onChange={e => setCFreight(Number(e.target.value))} /></div>
                <div className="field"><label>Gastos Origen</label><input type="number" value={cOrigin} onChange={e => setCOrigin(Number(e.target.value))} /></div>
                <div className="field"><label>Aduana</label><input type="number" value={cAduana} onChange={e => setCAduana(Number(e.target.value))} /></div>
                <div className="field"><label>Inspección</label><input type="number" value={cInsp} onChange={e => setCInsp(Number(e.target.value))} /></div>
                <div className="field"><label>Otros</label><input type="number" value={cOther} onChange={e => setCOther(Number(e.target.value))} /></div>
              </div>
            )}
          </div>
        </div>

        {/* RESUMEN DERECHO */}
        <div className="rightCol">
          <div className="card summaryCard">
            <h3>Resumen Financiero</h3>
            <div className="marginControl">
              <label>Margen Deseado (%)</label>
              <input type="number" value={margin} onChange={e => setMargin(Number(e.target.value))} />
            </div>

            <div className="summaryList">
              <div className="summaryItem"><span>Inversión Total</span><b>{currency} {computed.totalCost.toLocaleString()}</b></div>
              <div className="summaryItem sale"><span>Precio de Venta</span><b>{currency} {computed.totalSale.toLocaleString()}</b></div>
              <div className="summaryItem utility"><span>Utilidad Bruta</span><b>{currency} {computed.profit.toLocaleString()}</b></div>
            </div>

            <div className="boxValue">
              <div className="label">VALOR FINAL POR CAJA</div>
              <div className="value">{currency} {computed.perBox.toFixed(2)}</div>
            </div>

            {toast && <div className="toast-msg">{toast}</div>}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ... TUS ESTILOS ORIGINALES ... */
        .productGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .toast-msg { background: #22c55e; color: white; padding: 10px; border-radius: 8px; margin-top: 15px; text-align: center; font-weight: bold; animation: slideDown 0.3s ease; }
        /* Reutiliza el resto de tus estilos de .card, .mainGrid, etc. */
        ${/* Aquí van todos los estilos que ya tenías en tu archivo original */''}
      `}</style>
    </AdminLayout>
  );
}