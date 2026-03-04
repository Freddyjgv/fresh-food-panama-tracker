// src/pages/admin/shipments/index.tsx
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import {
  ArrowUpDown, Search, Plus, ChevronRight, Calendar,
  MapPin, Ship, Plane, Filter, Users, LayoutGrid, X,
  Package, Truck, CheckCircle2, Box, Anchor, CheckCircle,
  Save, Loader2, Hash, Palette, ThermometerSun, Globe
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { labelStatus } from "../../../lib/shipmentFlow";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

// --- HELPERS ---
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
    <span className={`status-pill ${isFinal ? 'pill-green' : isTransit ? 'pill-blue' : 'pill-gray'}`}>
      <Icon size={14} strokeWidth={2.5} />
      <span className="pill-text">{label}</span>
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

  // FORM STATE
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<'Marítima' | 'Aérea'>('Aérea'); // Preseleccionado Aérea
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
    <AdminLayout title="Logística" subtitle="Administración central de carga.">
      
      {toast && (
        <div className="toast-container">
          <div className="toast-card"><CheckCircle size={18} color="#1f7a3a" /><span>{toast.msg}</span></div>
        </div>
      )}

      {/* HEADER ACTIONS */}
      <div className="stats-bar">
        <div className="stat-card action" onClick={() => setShowModal(true)}>
          <div className="card-icon green"><Plus size={20} /></div>
          <div><p className="card-label">NUEVA CARGA</p><p className="card-val"><b>Crear Embarque</b></p></div>
        </div>
        <div className="stat-card">
          <div className="card-icon blue"><LayoutGrid size={20} /></div>
          <div><p className="card-label">SISTEMA</p><p className="card-val"><b>{items.length}</b> Embarques</p></div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="filter-area">
        <div className="search-pill">
          <Search size={18} />
          <input type="text" placeholder="Buscar por código o cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="sort-pill" onClick={() => setDir(dir === "asc" ? "desc" : "asc")}>
          <ArrowUpDown size={14} /> <span>{dir === 'desc' ? 'Recientes' : 'Antiguos'}</span>
        </button>
      </div>

      {/* LIST */}
      <div className="list-stack">
        {loadingList ? <div className="loading-state">Cargando logística...</div> : 
          items.map((s) => (
          <div key={s.id} className="s-row" onClick={() => router.push(`/admin/shipments/${s.id}`)}>
            <div className="s-col-info">
              <div className={`mode-ico ${s.product_mode === 'Aérea' ? 'air' : 'sea'}`}>
                {s.product_mode === 'Aérea' ? <Plane size={16} /> : <Ship size={16} />}
              </div>
              <div className="id-txt">
                <span className="code">{s.code || 'S/REF'}</span>
                <span className="client">{s.client_name}</span>
              </div>
            </div>
            <div className="s-col-meta">
              <div className="meta-item"><MapPin size={12} /> {s.destination}</div>
              <div className="meta-item gray"><Calendar size={12} /> {fmtDate(s.created_at)}</div>
            </div>
            <div className="s-col-prod">
              <span className="p-n">{s.product_name}</span>
              <span className="p-v">{s.product_variety}</span>
            </div>
            <div className="s-col-stat">
              <StatusPill status={s.status} />
              <ChevronRight size={18} className="chevron" />
            </div>
          </div>
        ))}
      </div>

      {/* POPUP MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div className="header-info">
                <h2>Nuevo Embarque</h2>
                <div className="id-badge">CORRELATIVO AUTOMÁTICO</div>
              </div>
              <button onClick={() => setShowModal(false)} className="close-btn"><X size={24} /></button>
            </header>

            <form onSubmit={handleCreate} className="modal-form">
              
              <section className="form-section">
                <h3><Users size={16} /> DATOS DEL CLIENTE</h3>
                <div className="input-group full-width">
                  <label>Seleccionar Cliente</label>
                  <select required value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})}>
                    <option value="">Buscar cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </section>

              <section className="form-section">
                <h3><Package size={16} /> ESPECIFICACIONES DE PRODUCTO</h3>
                <div className="grid-2">
                  <div className="input-group">
                    <label>Producto</label>
                    <select required value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value, variety_id: ''})}>
                      <option value="">Seleccione...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Variedad</label>
                    <select required disabled={!formData.product_id} value={formData.variety_id} onChange={e => setFormData({...formData, variety_id: e.target.value})}>
                      <option value="">Seleccione variedad</option>
                      {filteredVarieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid-3">
                  <div className="input-group"><label><Hash size={12}/> Calibre</label><input type="text" placeholder="Ej: 5" value={formData.calibre} onChange={e => setFormData({...formData, calibre: e.target.value})} /></div>
                  <div className="input-group"><label><Palette size={12}/> Color</label><input type="text" placeholder="Ej: 2.5" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} /></div>
                  <div className="input-group"><label><ThermometerSun size={12}/> Brix</label><input type="text" value={formData.brix_grade} onChange={e => setFormData({...formData, brix_grade: e.target.value})} /></div>
                </div>

                <div className="grid-3">
                  <div className="input-group"><label>Cajas</label><input type="number" value={formData.boxes} onChange={e => setFormData({...formData, boxes: e.target.value})} /></div>
                  <div className="input-group"><label>Pallets</label><input type="number" value={formData.pallets} onChange={e => setFormData({...formData, pallets: e.target.value})} /></div>
                  <div className="input-group"><label>Peso (Kg)</label><input type="number" step="0.01" value={formData.estimated_weight} onChange={e => setFormData({...formData, estimated_weight: e.target.value})} /></div>
                </div>
              </section>

              <section className="form-section">
                <h3><Globe size={16} /> HUB LOGÍSTICO</h3>
                <div className="logistic-grid">
                  <div className="input-group">
                    <label>Modalidad de Envío</label>
                    <div className="mode-selector">
                      <button type="button" className={mode === 'Marítima' ? 'active' : ''} onClick={() => setMode('Marítima')}><Anchor size={16} /> Marítima</button>
                      <button type="button" className={mode === 'Aérea' ? 'active' : ''} onClick={() => setMode('Aérea')}><Plane size={16} /> Aérea</button>
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Incoterm</label>
                    <select value={formData.incoterm} onChange={e => setFormData({...formData, incoterm: e.target.value})}>
                      {['FOB', 'CIF', 'CIP', 'FCA', 'CFR', 'DDP'].map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="input-group full-width">
                  <label>Lugar de Destino</label>
                  <input list="places-list-admin" required placeholder="Puerto o aeropuerto..." value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
                  <datalist id="places-list-admin">
                    {MASTER_PLACES.map(p => <option key={p.code} value={`${getFlag(p.country)} ${p.name}`} />)}
                  </datalist>
                </div>
              </section>

              <footer className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-abort">Cancelar</button>
                <button type="submit" disabled={submitting || success} className={`btn-submit ${success ? 'success' : ''}`}>
                  {submitting ? <Loader2 className="spin" size={20} /> : success ? <CheckCircle size={20} /> : <Save size={20} />}
                  <span>{success ? 'Registro Exitoso' : 'Crear Embarque'}</span>
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .toast-container { position: fixed; top: 24px; right: 24px; z-index: 3000; animation: slideIn 0.3s ease; }
        .toast-card { background: white; padding: 12px 24px; border-radius: 14px; display: flex; align-items: center; gap: 12px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); border-left: 5px solid #1f7a3a; font-weight: 700; color: #1e293b; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        .stats-bar { display: grid; grid-template-columns: repeat(2, 280px); gap: 16px; margin-bottom: 32px; }
        .stat-card { background: white; padding: 18px; border-radius: 18px; display: flex; align-items: center; gap: 16px; border: 1px solid #f1f5f9; cursor: pointer; transition: 0.2s; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .stat-card.action { background: #1f7a3a; color: white; border: none; }
        .card-icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; }
        .card-icon.green { background: rgba(255,255,255,0.2); }
        .card-icon.blue { background: #eff6ff; color: #2563eb; }
        .card-label { font-size: 10px; font-weight: 800; color: #94a3b8; margin: 0; }
        .action .card-label { color: rgba(255,255,255,0.7); }
        .card-val { font-size: 15px; margin: 0; }

        .filter-area { display: flex; gap: 12px; margin-bottom: 24px; }
        .search-pill { flex: 1; display: flex; align-items: center; gap: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 0 18px; height: 50px; }
        .search-pill input { border: none; outline: none; width: 100%; font-size: 14px; }
        .sort-pill { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 0 18px; height: 50px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 10px; cursor: pointer; }

        .list-stack { display: flex; flex-direction: column; gap: 10px; }
        .s-row { background: white; border: 1px solid #f1f5f9; border-radius: 16px; padding: 18px 24px; display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; align-items: center; cursor: pointer; transition: 0.2s; }
        .s-row:hover { border-color: #1f7a3a; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
        .status-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .pill-green { background: #f0fdf4; color: #166534; }
        .pill-blue { background: #eff6ff; color: #1e40af; }
        .pill-gray { background: #f8fafc; color: #475569; }

        /* MODAL OPTIMIZADO */
        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
        .modal-content { background: white; width: 600px; border-radius: 28px; max-height: 95vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
        .modal-header { padding: 32px 40px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; }
        .header-info h2 { margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; }
        .id-badge { display: inline-block; background: #f0fdf4; color: #166534; padding: 5px 12px; border-radius: 8px; font-family: monospace; font-size: 11px; font-weight: 800; border: 1px solid #dcfce7; margin-top: 10px; }
        .modal-form { padding: 40px; background: #fcfcfd; }
        .form-section { margin-bottom: 35px; }
        .form-section h3 { font-size: 11px; color: #1f7a3a; letter-spacing: 0.12em; margin-bottom: 22px; font-weight: 900; display: flex; align-items: center; gap: 10px; border-left: 4px solid #1f7a3a; padding-left: 12px; }
        
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .logistic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        
        .input-group label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #64748b; margin-bottom: 8px; text-transform: uppercase; }
        
        /* UNIFICACIÓN DE INPUTS Y SELECTS */
        input, select, .mode-selector { 
          width: 100%; 
          box-sizing: border-box; 
          height: 46px; /* Altura unificada */
          border: 1.5px solid #e2e8f0; 
          border-radius: 12px; 
          font-size: 14px; 
          color: #0f172a; 
          background: white; 
          padding: 0 14px;
        }
        
        input:focus, select:focus { border-color: #1f7a3a; outline: none; box-shadow: 0 0 0 3px rgba(31,122,58,0.05); }
        
        /* MODE SELECTOR CONSISTENCIA */
        .mode-selector { display: flex; background: #f1f5f9; padding: 4px; border: none; height: 48px; }
        .mode-selector button { 
          flex: 1; border: none; border-radius: 10px; font-size: 12px; font-weight: 800; 
          cursor: pointer; display: flex; align-items: center; justify-content: center; 
          gap: 8px; color: #64748b; background: transparent; transition: 0.2s; 
        }
        .mode-selector button.active { background: white; color: #1f7a3a; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        
        .modal-footer { display: flex; gap: 15px; margin-top: 25px; }
        .btn-submit { flex: 2; background: #1f7a3a; color: white; border: none; padding: 16px; border-radius: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; }
        .btn-abort { flex: 1; background: #f1f5f9; border: none; border-radius: 14px; color: #64748b; font-weight: 700; cursor: pointer; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}