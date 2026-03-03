// src/pages/admin/shipments/index.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowUpDown, Search, Plus, ChevronRight, Calendar,
  MapPin, Ship, Plane, Filter, Users, LayoutGrid, X,
  Package, Truck, CheckCircle2, Box, Anchor, Scale
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { labelStatus } from "../../../lib/shipmentFlow";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

type ShipmentListItem = {
  id: string; code: string; destination: string; status: string; created_at: string;
  client_name?: string | null; product_name?: string | null; 
  product_variety?: string | null; product_mode?: string | null;
  pallets?: number | null;
};

const INITIAL_FORM = {
  client_id: '', code: '', product_mode: 'Aérea', product_name: '',
  product_variety: '', caliber: '', color: '', boxes: '', 
  pallets: '', weight: '', incoterm: '', destination: '', status: 'CREATED'
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// Hitos mejorados: Espaciado corregido y colores agradables
function StatusPill({ status }: { status: string }) {
  const label = labelStatus(status);
  const s = status.toUpperCase();
  
  const isFinal = ["AT_DESTINATION", "DELIVERED", "CLOSED"].includes(s);
  const isTransit = ["IN_TRANSIT", "DEPARTED", "ARRIVED_PTY"].includes(s);

  let Icon = CheckCircle2;
  if (isTransit) Icon = Truck;
  if (s === "PACKED") Icon = Box;
  if (s === "CREATED") Icon = Package;

  return (
    <span className={`status-pill ${isFinal ? 'pill-green' : isTransit ? 'pill-blue' : 'pill-gray'}`}>
      <Icon size={14} className="pill-icon" />
      <span className="pill-text">{label}</span>
    </span>
  );
}

export default function AdminShipments() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<ShipmentListItem[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(INITIAL_FORM);

  // Filtros
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const params = new URLSearchParams({ mode: 'admin', q: q.trim(), dir, destination });
    const res = await fetch(`/.netlify/functions/listShipments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setItems(json.items || []);
    }
    
    const { data: cData } = await supabase.from('clients').select('id, name').order('name');
    if (cData) setClients(cData);
    setLoading(false);
  };

  useEffect(() => { if (authOk) loadData(); }, [authOk, q, dir, destination]);

  const handleCreate = async () => {
    if (!formData.client_id) return alert("Selecciona un cliente");
    try {
      const { error } = await supabase.from('shipments').insert([formData]);
      if (error) throw error;
      setShowModal(false);
      setFormData(INITIAL_FORM);
      loadData();
    } catch (err: any) { alert("Error: " + err.message); }
  };

  return (
    <AdminLayout title="Logística" subtitle="Gestión integral de embarques.">
      
      {/* KPI BAR */}
      <div className="stats-bar">
        <div className="stat-chip">
          <LayoutGrid size={14} />
          <span><b>{items.length}</b> Embarques</span>
        </div>
        <div className="spacer" />
        <div className="nav-actions">
          <button className="btn-nav" onClick={() => router.push('/admin/users')}>
            <Users size={14} /> Clientes
          </button>
          <button className="btn-add-main" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nuevo Embarque
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filter-area">
        <div className="search-pill">
          <Search size={16} />
          <input type="text" placeholder="Buscar código o cliente..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select-pill" value={destination} onChange={(e) => setDestination(e.target.value)}>
          <option value="">Destinos</option>
          <option value="MAD">MAD</option>
          <option value="MIA">MIA</option>
        </select>
        <button className="sort-pill" onClick={() => setDir(dir === "asc" ? "desc" : "asc")}>
          <ArrowUpDown size={14} />
        </button>
      </div>

      {/* LISTADO */}
      <div className="list-stack">
        <div className="list-header">
          <span>REFERENCIA</span>
          <span>LOGÍSTICA</span>
          <span>PRODUCTO</span>
          <span style={{textAlign: 'center'}}>VOLUMEN</span>
          <span style={{textAlign: 'right'}}>ESTADO</span>
        </div>
        
        {loading ? <div className="loading-state">Actualizando listado...</div> : 
          items.map((s) => (
          <div key={s.id} className="s-row" onClick={() => router.push(`/admin/shipments/${s.id}`)}>
            <div className="s-col-info">
              <div className={`mode-ico ${s.product_mode === 'Aérea' ? 'air' : 'sea'}`}>
                {s.product_mode === 'Aérea' ? <Plane size={14} /> : <Ship size={14} />}
              </div>
              <div className="id-txt">
                <span className="code">{s.code || 'S/N'}</span>
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
            <div className="s-col-pallets">
                <div className="pallet-badge">
                    <Box size={12} />
                    <span>{s.pallets || 0} PLT</span>
                </div>
            </div>
            <div className="s-col-stat">
              <StatusPill status={s.status} />
              <ChevronRight size={16} className="chevron" />
            </div>
          </div>
        ))}
      </div>

      {/* MODAL / POPUP COMPLETO */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3>Crear Embarque</h3>
                <p>Configura los datos técnicos del nuevo envío</p>
              </div>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <div className="modal-body">
              
              <div className="form-section">
                <div className="section-title"><Users size={14}/> General</div>
                <div className="form-grid">
                    <div className="f-group full">
                        <label>Cliente</label>
                        <select className="f-input" value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})}>
                            <option value="">Selecciona un cliente</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="f-group">
                        <label>Referencia</label>
                        <input className="f-input" placeholder="Ej: FF-100" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                    </div>
                    <div className="f-group">
                        <label>Hub Logístico</label>
                        <select className="f-input" value={formData.product_mode} onChange={e => setFormData({...formData, product_mode: e.target.value})}>
                            <option value="Aérea">Aérea</option>
                            <option value="Marítima">Marítima</option>
                        </select>
                    </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title"><Box size={14}/> Producto</div>
                <div className="form-grid">
                    <div className="f-group">
                        <label>Producto</label>
                        <input className="f-input" placeholder="Piña" value={formData.product_name} onChange={e => setFormData({...formData, product_name: e.target.value})} />
                    </div>
                    <div className="f-group">
                        <label>Variedad</label>
                        <input className="f-input" placeholder="MD2" value={formData.product_variety} onChange={e => setFormData({...formData, product_variety: e.target.value})} />
                    </div>
                    <div className="f-group">
                        <label>Calibre / Color</label>
                        <div className="dual-input">
                            <input className="f-input" placeholder="Cal." value={formData.caliber} onChange={e => setFormData({...formData, caliber: e.target.value})} />
                            <input className="f-input" placeholder="Col." value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} />
                        </div>
                    </div>
                    <div className="f-group">
                        <label>Volumen y Peso</label>
                        <div className="triple-input">
                            <input className="f-input" placeholder="Cjs" value={formData.boxes} onChange={e => setFormData({...formData, boxes: e.target.value})} />
                            <input className="f-input" placeholder="Plt" value={formData.pallets} onChange={e => setFormData({...formData, pallets: e.target.value})} />
                            <input className="f-input" placeholder="Kg" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
                        </div>
                    </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title"><Anchor size={14}/> Destino Final</div>
                <div className="form-grid">
                    <div className="f-group">
                        <label>Incoterm</label>
                        <input className="f-input" placeholder="FOB, EXW..." value={formData.incoterm} onChange={e => setFormData({...formData, incoterm: e.target.value})} />
                    </div>
                    <div className="f-group">
                        <label>Lugar de Destino</label>
                        <input className="f-input" placeholder="Puerto / Ciudad" value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
                    </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn-save" onClick={handleCreate}>Crear Embarque</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .stats-bar { display: flex; align-items: center; margin-bottom: 24px; }
        .stat-chip { background: #f1f5f9; padding: 6px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }
        .spacer { flex: 1; }
        .nav-actions { display: flex; gap: 8px; }
        .btn-nav { background: white; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-add-main { background: #1f7a3a; color: white; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }

        .filter-area { display: flex; gap: 10px; margin-bottom: 20px; }
        .search-pill { flex: 1; display: flex; align-items: center; gap: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 12px; }
        .search-pill input { border: none; outline: none; padding: 10px 0; width: 100%; font-size: 14px; }
        .select-pill, .sort-pill { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 12px; font-size: 13px; font-weight: 600; cursor: pointer; }

        .list-stack { display: flex; flex-direction: column; gap: 6px; }
        .list-header { display: grid; grid-template-columns: 1.5fr 1fr 1fr 0.8fr 1fr; padding: 0 20px 8px; font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em; }
        .s-row { 
          background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 20px; 
          display: grid; grid-template-columns: 1.5fr 1fr 1fr 0.8fr 1fr; align-items: center; cursor: pointer; transition: 0.15s;
        }
        .s-row:hover { border-color: #1f7a3a; transform: translateX(4px); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }

        .s-col-info { display: flex; align-items: center; gap: 12px; }
        .mode-ico { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; }
        .mode-ico.air { background: #ecfdf5; color: #059669; }
        .mode-ico.sea { background: #eff6ff; color: #2563eb; }
        .id-txt { display: flex; flex-direction: column; }
        .code { font-weight: 800; font-size: 14px; color: #0f172a; }
        .client { font-size: 12px; color: #64748b; font-weight: 600; }

        .meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #475569; }
        .meta-item.gray { color: #94a3b8; }

        .p-n { display: block; font-weight: 700; font-size: 13px; color: #1e293b; }
        .p-v { display: block; font-size: 11px; font-weight: 800; color: #1f7a3a; text-transform: uppercase; }

        .pallet-badge { display: flex; align-items: center; gap: 6px; background: #f8fafc; padding: 4px 8px; border-radius: 6px; width: fit-content; margin: 0 auto; font-size: 11px; font-weight: 700; color: #475569; border: 1px solid #e2e8f0; }

        .s-col-stat { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
        .chevron { color: #cbd5e1; }

        /* Hitos / Status Pills Premium - Espaciado Mejorado */
        .status-pill { 
          display: inline-flex; 
          align-items: center; 
          gap: 8px; 
          padding: 6px 14px; 
          border-radius: 99px; 
          font-size: 11px; 
          font-weight: 800; 
          border: 1px solid transparent; 
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .pill-icon { flex-shrink: 0; }
        .pill-text { line-height: 1; }
        
        .pill-green { background: #f0fdf4; color: #166534; border-color: #dcfce7; }
        .pill-blue { background: #eff6ff; color: #1e40af; border-color: #dbeafe; }
        .pill-gray { background: #f8fafc; color: #475569; border-color: #f1f5f9; }

        /* Modal PopUp Refined */
        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal-content { background: white; width: 100%; max-width: 600px; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); overflow: hidden; max-height: 90vh; overflow-y: auto; }
        .modal-header { padding: 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #fcfdfc; }
        .modal-header h3 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
        .modal-header p { margin: 2px 0 0; font-size: 13px; color: #64748b; font-weight: 500; }
        .modal-body { padding: 24px; }
        
        .form-section { margin-bottom: 24px; }
        .section-title { font-size: 12px; font-weight: 800; color: #1f7a3a; text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f0fdf4; padding-bottom: 8px; }
        
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .f-group.full { grid-column: span 2; }
        .f-group label { display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }
        .f-input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-weight: 500; transition: 0.2s; background: #fcfcfc; }
        .f-input:focus { border-color: #1f7a3a; outline: none; background: white; box-shadow: 0 0 0 3px rgba(31,122,58,0.1); }
        
        .dual-input { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .triple-input { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

        .modal-footer { display: flex; gap: 12px; margin-top: 32px; }
        .btn-save { flex: 2; background: #1f7a3a; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; transition: 0.2s; }
        .btn-cancel { flex: 1; background: #f1f5f9; color: #475569; border: none; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; }
        .btn-save:hover { background: #166534; transform: translateY(-1px); }

        @media (max-width: 900px) {
          .s-row, .list-header { grid-template-columns: 1.5fr 1fr auto; }
          .s-col-prod, .s-col-pallets, .list-header span:nth-child(3), .list-header span:nth-child(4) { display: none; }
        }
      `}</style>
    </AdminLayout>
  );
}