import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import {
  Search, PlusCircle, ChevronRight, Ship, Plane, 
  Package, Anchor, CheckCircle, Save, Loader2, 
  TrendingUp, LayoutGrid, X, Users, Globe, Hash, 
  Palette, ThermometerSun, SortAsc, Truck, CheckCircle2
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { labelStatus } from "../../../lib/shipmentFlow";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

// --- HELPERS (Sin cambios en lógica) ---
const getFlag = (code: string) => {
  if (!code) return '🌐';
  const codePoints = code.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const MASTER_PLACES = [
  { code: 'MAD', name: 'Madrid-Barajas', country: 'ES' },
  { code: 'BCN', name: 'Puerto de Barcelona', country: 'ES' },
  { code: 'MIA', name: 'Miami International', country: 'US' },
];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function StatusPill({ status }: { status: string }) {
  const label = labelStatus(status);
  const s = status.toUpperCase();
  const isFinal = ["AT_DESTINATION", "DELIVERED", "CLOSED"].includes(s);
  const isTransit = ["IN_TRANSIT", "DEPARTED", "ARRIVED_PTY"].includes(s);
  let Icon = (isTransit) ? Truck : (isFinal) ? CheckCircle2 : Package;
  return (
    <span className={`status-pill-modern ${isFinal ? 'pill-green' : isTransit ? 'pill-blue' : 'pill-gray'}`}>
      <Icon size={12} strokeWidth={2} />
      <span>{label}</span>
    </span>
  );
}

export default function AdminShipments() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [items, setItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [allVarieties, setAllVarieties] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // FORM STATE (Sin cambios)
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<'Marítima' | 'Aérea'>('Aérea'); 
  const [formData, setFormData] = useState({
    client_id: '', product_id: '', variety_id: '', calibre: '', color: '',
    brix_grade: '>13', boxes: '', pallets: '', estimated_weight: '',
    incoterm: 'FOB', destination: '',
  });

  const [toast, setToast] = useState<{show: boolean, msg: string} | null>(null);
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  const loadBaseData = async () => {
    setLoadingList(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const params = new URLSearchParams({ mode: 'admin', q: q.trim(), dir });
    const res = await fetch(`/.netlify/functions/listShipments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setItems(json.items || []);
    }

    const { data: c } = await supabase.from('clients').select('id, name').order('name');
    const { data: p } = await supabase.from('products').select('*').order('name');
    const { data: v } = await supabase.from('product_varieties').select('*').order('name');
    
    setClients(c || []);
    setProducts(p || []);
    setAllVarieties(v || []);
    setLoadingList(false);
  };

  useEffect(() => { if (authOk) loadBaseData(); }, [authOk, q, dir]);

  const filteredVarieties = useMemo(() => {
    if (!formData.product_id) return [];
    return allVarieties.filter(v => v.product_id === formData.product_id);
  }, [formData.product_id, allVarieties]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const selectedProduct = products.find(p => p.id === formData.product_id);
      const selectedVariety = allVarieties.find(v => v.id === formData.variety_id);

      const payload = {
        clientId: formData.client_id,
        destination: formData.destination,
        incoterm: formData.incoterm,
        boxes: formData.boxes ? parseInt(formData.boxes) : null,
        pallets: formData.pallets ? parseInt(formData.pallets) : null,
        weight_kg: formData.estimated_weight ? parseFloat(formData.estimated_weight) : null,
        product_name: selectedProduct?.name || 'Piña',
        product_variety: selectedVariety?.name || 'MD2 Golden',
        product_mode: mode,
        calibre: formData.calibre,
        color: formData.color,
        brix_grade: formData.brix_grade
      };

      const response = await fetch('/.netlify/functions/createShipment', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.ok) {
        setSuccess(true);
        setToast({ show: true, msg: "Éxito. Redirigiendo..." });
        setTimeout(() => {
          router.push(`/admin/shipments/${result.shipmentId || result.id}`);
        }, 1200);
      } else throw new Error(result.message);
    } catch (err: any) {
      alert("Error: " + err.message);
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout title="Logística" subtitle="Administración central de embarques y carga activa.">
      
      {toast && (
        <div className="toast-container">
          <div className="toast-card"><CheckCircle size={18} color="#16a34a" /><span>{toast.msg}</span></div>
        </div>
      )}

      {/* 1. HEADER: 4 GRIDS (CLON DE QUOTES) */}
      <div className="statsGrid">
       <div className="statCard action" onClick={() => setShowModal(true)} style={{ cursor: 'pointer', position: 'relative', zIndex: 999 }}>
        <div className="iconBox green">
        <PlusCircle size={18} strokeWidth={1.5} />
        </div>
        <div className="statInfo">
      <span className="statValueAction">Nuevo Embarque</span>
    </div>
  </div>
        <div className="statCard">
          <div className="iconBox blue"><LayoutGrid size={18} strokeWidth={1.5} /></div>
          <div className="statInfo">
            <span className="statLabel">TOTAL ACTIVOS</span>
            <span className="statValue">{items.length}</span>
          </div>
        </div>
        <div className="statCard">
          <div className="iconBox orange"><Truck size={18} strokeWidth={1.5} /></div>
          <div className="statInfo">
            <span className="statLabel">EN TRÁNSITO</span>
            <span className="statValue">{items.filter(i => i.status?.includes('TRANSIT')).length}</span>
          </div>
        </div>
        <div className="statCard">
          <div className="iconBox slate"><TrendingUp size={18} strokeWidth={1.5} /></div>
          <div className="statInfo">
            <span className="statLabel">KPI MES</span>
            <span className="statValue">Operativo</span>
          </div>
        </div>
      </div>

      <div className="mainCard">
        {/* 2. TOOLBAR REFINADO */}
        <div className="toolbar">
          <div className="searchModern">
            <Search size={16} className="searchIcon" strokeWidth={1.5} />
            <input 
              placeholder="Buscar por cliente, destino o # embarque..." 
              value={q} 
              onChange={e => setQ(e.target.value)} 
            />
          </div>
          <button className="btnOutline" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
            <SortAsc size={14} /> {dir === 'desc' ? 'Recientes' : 'Antiguos'}
          </button>
        </div>

        {/* 3. LISTADO: 4 COLUMNAS */}
        <div className="listContainer">
          {loadingList ? (
            <div className="loadingState">Cargando logística...</div>
          ) : (
            items.map((s: any) => (
              <div key={s.id} className="rowWrapper" onClick={() => router.push(`/admin/shipments/${s.id}`)}>
                <div className="rowGrid">
                  
                  {/* COL 1: IDENTIDAD */}
                  <div className="colIdent">
                    <div className="badgeLine">
                      <span className="idBadge">{s.code || 'S/REF'}</span>
                      <span className="techBadge">
                        {s.product_mode === 'Aérea' ? <Plane size={10} strokeWidth={2} /> : <Ship size={10} strokeWidth={2} />}
                        <span style={{ marginLeft: '4px' }}>{s.product_name || 'Carga'}</span>
                      </span>
                    </div>
                    <span className="clientName">{s.client_name}</span>
                  </div>

                  {/* COL 2: LOGÍSTICA (RUTA) */}
                  <div className="colLogis">
                    <div className="routeLine">
                      <span className="city">PTY</span>
                      <span className="arrow">→</span>
                      <span className="city">{s.destination}</span>
                    </div>
                  </div>

                  {/* COL 3: FECHA / INFO */}
                  <div className="colMonto">
                    <span className="dateText">{fmtDate(s.created_at)}</span>
                  </div>

                  {/* COL 4: STATUS */}
                  <div className="colStatus">
                    <StatusPill status={s.status} />
                    <ChevronRight size={16} className="chevron" strokeWidth={1.5} />
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* POPUP MODAL COMPLETO, UNIFICADO Y CLEAN */}
      {/* EL POPUP (Se activa con el click) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div className="header-info">
                <h2 className="modal-title">Nuevo Embarque</h2>
                <span className="modal-subtitle">Configuración de carga logística</span>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="close-btn"><X size={20} /></button>
            </header>

            <form onSubmit={handleCreate} className="modal-form">
              {/* Sección Cliente */}
              <div className="input-group">
                <label>Cliente Final</label>
                <select required value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})}>
                  <option value="">Selecciona...</option>
                  {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Especificaciones en Grilla */}
              <div className="grid-2">
                 <div className="input-group">
                    <label>Producto</label>
                    <select required value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value})}>
                       {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                 </div>
                 <div className="input-group">
                    <label>Variedad</label>
                    <select value={formData.variety_id} onChange={e => setFormData({...formData, variety_id: e.target.value})}>
                       {allVarieties?.filter(v => v.product_id === formData.product_id).map(v => (
                         <option key={v.id} value={v.id}>{v.name}</option>
                       ))}
                    </select>
                 </div>
              </div>

              {/* Calidad y Cantidad */}
              <div className="grid-3">
                <div className="input-group"><label>Calibre</label><input value={formData.calibre} onChange={e => setFormData({...formData, calibre: e.target.value})} /></div>
                <div className="input-group"><label>Color</label><input value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} /></div>
                <div className="input-group"><label>Brix</label><input value={formData.brix_grade} onChange={e => setFormData({...formData, brix_grade: e.target.value})} /></div>
              </div>

              <div className="grid-3">
                <div className="input-group"><label>Cajas</label><input type="number" value={formData.boxes} onChange={e => setFormData({...formData, boxes: e.target.value})} /></div>
                <div className="input-group"><label>Pallets</label><input type="number" value={formData.pallets} onChange={e => setFormData({...formData, pallets: e.target.value})} /></div>
                <div className="input-group"><label>Peso (Kg)</label><input type="number" value={formData.estimated_weight} onChange={e => setFormData({...formData, estimated_weight: e.target.value})} /></div>
              </div>

              <footer className="modal-footer-clean">
                <button type="button" onClick={() => setShowModal(false)} className="btn-cancel">Cancelar</button>
                <button type="submit" className="btn-save">Confirmar Embarque</button>
              </footer>
            </form>
          </div>
        </div>
      )}
      {/* 2. EL CSS QUE REPARA LA ESTÉTICA (Cópialo todo) */}
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .modal-content {
          background: white;
          width: 100%;
          max-width: 520px;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: slideIn 0.2s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-header { padding: 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
        .modal-title { font-size: 18px; font-weight: 600; color: #1e293b; margin: 0; }
        .modal-subtitle { font-size: 13px; color: #64748b; }
        .modal-form { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .input-group label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
        input, select { width: 100%; height: 42px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 12px; font-size: 14px; }
        .modal-footer-clean { display: flex; gap: 12px; margin-top: 10px; }
        .btn-save { flex: 2; background: #16a34a; color: white; border: none; height: 44px; border-radius: 10px; font-weight: 600; cursor: pointer; }
        .btn-cancel { flex: 1; background: #f1f5f9; color: #64748b; border: none; border-radius: 10px; cursor: pointer; }
      `}</style>

    </AdminLayout>
  );
}