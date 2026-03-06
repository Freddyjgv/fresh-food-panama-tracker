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
        <div className="statCard action" onClick={() => setShowModal(true)}>
          <div className="iconBox green"><PlusCircle size={18} strokeWidth={1.5} /></div>
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
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div className="header-info">
                <h2 className="modal-title">Nuevo Embarque</h2>
                <span className="modal-subtitle">Registra la carga en el sistema logístico</span>
              </div>
              <button onClick={() => setShowModal(false)} className="close-btn"><X size={20} strokeWidth={1.5} /></button>
            </header>

            <form onSubmit={handleCreate} className="modal-form">
              
              {/* 1. SECCIÓN CLIENTE */}
              <section className="form-section">
                <div className="section-header">
                  <Users size={15} strokeWidth={1.5} />
                  <span>Información del Cliente</span>
                </div>
                <div className="input-group">
                  <label>Cliente Final</label>
                  <select required value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})}>
                    <option value="">Selecciona un cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </section>

              {/* 2. SECCIÓN ESPECIFICACIONES (PRODUCTO + CALIDAD + CANTIDAD) */}
              <section className="form-section">
                <div className="section-header">
                  <Package size={15} strokeWidth={1.5} />
                  <span>Detalles de Mercancía</span>
                </div>
                
                <div className="grid-2">
                  <div className="input-group">
                    <label>Producto</label>
                    <select required value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value, variety_id: ''})}>
                      <option value="">Producto...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Variedad</label>
                    <select required disabled={!formData.product_id} value={formData.variety_id} onChange={e => setFormData({...formData, variety_id: e.target.value})}>
                      <option value="">Variedad...</option>
                      {filteredVarieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Calidad: Calibre, Color y Brix */}
                <div className="grid-3" style={{ marginBottom: '16px' }}>
                  <div className="input-group">
                    <label><Hash size={11} style={{marginRight: '4px'}}/> Calibre</label>
                    <input type="text" placeholder="Ej: 6" value={formData.calibre} onChange={e => setFormData({...formData, calibre: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label><Palette size={11} style={{marginRight: '4px'}}/> Color</label>
                    <input type="text" placeholder="Ej: 2.5" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label><ThermometerSun size={11} style={{marginRight: '4px'}}/> Brix</label>
                    <input type="text" placeholder=">13" value={formData.brix_grade} onChange={e => setFormData({...formData, brix_grade: e.target.value})} />
                  </div>
                </div>

                {/* Cantidades: Cajas, Pallets y Peso */}
                <div className="grid-3">
                  <div className="input-group"><label>Cajas</label><input type="number" placeholder="0" value={formData.boxes} onChange={e => setFormData({...formData, boxes: e.target.value})} /></div>
                  <div className="input-group"><label>Pallets</label><input type="number" placeholder="0" value={formData.pallets} onChange={e => setFormData({...formData, pallets: e.target.value})} /></div>
                  <div className="input-group"><label>Peso (Kg)</label><input type="number" step="0.01" placeholder="0.00" value={formData.estimated_weight} onChange={e => setFormData({...formData, estimated_weight: e.target.value})} /></div>
                </div>
              </section>

              {/* 3. SECCIÓN LOGÍSTICA (RUTA UNIFICADA) */}
              <section className="form-section">
                <div className="section-header">
                  <Globe size={15} strokeWidth={1.5} />
                  <span>Ruta y Destino</span>
                </div>
                <div className="grid-2">
                  <div className="input-group">
                    <label>Modalidad</label>
                    <div className="mode-selector-clean">
                      <button type="button" className={mode === 'Marítima' ? 'active' : ''} onClick={() => setMode('Marítima')}><Anchor size={14} /> Marítimo</button>
                      <button type="button" className={mode === 'Aérea' ? 'active' : ''} onClick={() => setMode('Aérea')}><Plane size={14} /> Aéreo</button>
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Incoterm</label>
                    <select value={formData.incoterm} onChange={e => setFormData({...formData, incoterm: e.target.value})}>
                      {['FOB', 'CIF', 'CIP', 'FCA', 'CFR', 'DDP'].map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="input-group">
                  <label>Destino Final (Aeropuerto/Puerto)</label>
                  <input list="places-list-admin" required placeholder="Ej: 🇪🇸 MAD Madrid-Barajas" value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
                  <datalist id="places-list-admin">
                    {MASTER_PLACES.map(p => <option key={p.code} value={`${getFlag(p.country)} ${p.name}`} />)}
                  </datalist>
                </div>
              </section>

              <footer className="modal-footer-clean">
                <button type="button" onClick={() => setShowModal(false)} className="btn-cancel">Cancelar</button>
                <button type="submit" disabled={submitting || success} className="btn-save">
                  {submitting ? <Loader2 className="spin" size={18} /> : <span>Confirmar Embarque</span>}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        /* --- ESTILOS MAESTROS (Fieles a Quotes) --- */
        .statsGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .statCard { background: white; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; }
        .statCard.action { border: 1px solid #dcfce7; cursor: pointer; transition: 0.2s; gap: 16px; }
        .statCard.action:hover { background: #f0fdf4; border-color: #86efac; transform: translateY(-1px); }
        
        .iconBox { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; }
        .iconBox.green { background: #f0fdf4; color: #16a34a; }
        .iconBox.blue { background: #eff6ff; color: #3b82f6; }
        .iconBox.orange { background: #fff7ed; color: #ea580c; }
        .iconBox.slate { background: #f8fafc; color: #64748b; }

        .statLabel { font-size: 10px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .statValue { font-size: 16px; font-weight: 500; color: #1e293b; display: block; }
        .statValueAction { font-size: 14px; font-weight: 500; color: #16a34a; letter-spacing: -0.01em; }

        .mainCard { background: white; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
        .toolbar { padding: 16px 24px; display: flex; justify-content: space-between; border-bottom: 1px solid #f8fafc; }
        
        .searchModern { position: relative; display: flex; align-items: center; width: 380px; }
        .searchIcon { position: absolute; left: 14px; color: #94a3b8; pointer-events: none; z-index: 10; }
        .searchModern input { width: 100%; padding: 10px 16px 10px 40px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 13.5px; outline: none; transition: 0.2s; }
        .searchModern input:focus { background: white; border-color: #cbd5e1; }

        .btnOutline { background: white; border: 1px solid #f1f5f9; padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 500; color: #64748b; display: flex; align-items: center; gap: 8px; cursor: pointer; }

        .listContainer { padding: 8px 0; }
        .rowWrapper { padding: 0 24px; cursor: pointer; transition: 0.1s; border-bottom: 1px solid #f8fafc; }
        .rowWrapper:hover { background: #fbfcfe; }
        .rowGrid { display: grid; grid-template-columns: 240px 1fr 140px 140px; align-items: center; padding: 14px 0; }

        .badgeLine { display: flex; gap: 6px; margin-bottom: 4px; }
        .idBadge { background: #f8fafc; color: #64748b; font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 5px; }
        .techBadge { background: #f0fdf4; color: #16a34a; font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 5px; display: flex; align-items: center; gap: 4px; }
        
        .clientName { font-size: 13.5px; font-weight: 400; color: #1e293b; }
        .routeLine { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; }
        .arrow { color: #cbd5e1; }
        .colMonto { text-align: right; }
        .dateText { color: #64748b; font-size: 13px; font-weight: 400; }
        .colStatus { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
        .status-pill-modern { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
        .pill-green { background: #f0fdf4; color: #166534; }
        .pill-blue { background: #eff6ff; color: #1e40af; }
        .pill-gray { background: #f8fafc; color: #475569; }

        .loadingState { padding: 40px; text-align: center; color: #94a3b8; font-size: 13px; }
        .toast-container { position: fixed; top: 24px; right: 24px; z-index: 3000; }
        .toast-card { background: white; padding: 12px 24px; border-radius: 14px; display: flex; align-items: center; gap: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }

        /* SELECT MODERNO Y LIGERO */
select {
  appearance: none; /* Quitamos la flecha fea del navegador */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 16px;
  
  width: 100%;
  height: 46px;
  padding: 0 40px 0 16px; /* Más espacio a la derecha por la flecha */
  background-color: #f8fafc; /* Un fondo casi blanco, muy ligero */
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 400; /* Fuente fina para ligereza */
  color: #1e293b;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

select:focus {
  background-color: #ffffff;
  border-color: #16a34a; /* Tu verde esmeralda */
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.05);
  outline: none;
}

/* EFECTO HOVER */
select:hover {
  border-color: #cbd5e1;
}

/* LABEL ULTRA FINO */
.input-group label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8; /* Gris azulado suave */
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  display: block;
}
      `}</style>
    </AdminLayout>
  );
}