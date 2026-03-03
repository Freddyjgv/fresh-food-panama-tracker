// src/pages/admin/shipments/index.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowUpDown, Search, Plus, ChevronRight, Calendar,
  MapPin, Ship, Plane, Filter, Users, LayoutGrid, X
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { labelStatus } from "../../../lib/shipmentFlow";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

// --- Tipos y Helpers ---
type ShipmentListItem = {
  id: string; code: string; destination: string; status: string; created_at: string;
  client_name?: string | null; product_name?: string | null; product_variety?: string | null; product_mode?: string | null;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function StatusPill({ status }: { status: string }) {
  const label = labelStatus(status);
  const isFinal = ["AT_DESTINATION", "DELIVERED", "CLOSED"].includes(status.toUpperCase());
  return <span className={`status-pill ${isFinal ? 'pill-green' : 'pill-gray'}`}>{label}</span>;
}

export default function AdminShipments() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  
  // UI States
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<ShipmentListItem[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) { setAuthOk(true); setAuthChecking(false); }
    })();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Cargar Embarques
    const params = new URLSearchParams({ mode: 'admin', q: q.trim(), dir, destination });
    const res = await fetch(`/.netlify/functions/listShipments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setItems(json.items || []);
    }
    
    // Cargar Clientes para el Modal
    const { data: cData } = await supabase.from('clients').select('id, name').order('name');
    if (cData) setClients(cData);
    
    setLoading(false);
  };

  useEffect(() => { if (authOk) loadData(); }, [authOk, q, dir, destination]);

  return (
    <AdminLayout title="Logística" subtitle="Control de carga y exportaciones.">
      
      {/* KPI SECTION - COMPACTA */}
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
        {loading ? <div className="loading-state">Actualizando...</div> : 
          items.map((s) => (
          <div key={s.id} className="s-row" onClick={() => router.push(`/admin/shipments/${s.id}`)}>
            <div className="s-col-info">
              <div className={`mode-ico ${s.product_mode === 'Aérea' ? 'air' : 'sea'}`}>
                {s.product_mode === 'Aérea' ? <Plane size={14} /> : <Ship size={14} />}
              </div>
              <div className="id-txt">
                <span className="code">{s.code}</span>
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
              <ChevronRight size={16} className="chevron" />
            </div>
          </div>
        ))}
      </div>

      {/* MODAL POPUP - CREACIÓN COMPLETA */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Crear Nuevo Embarque</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="f-group full">
                  <label>Cliente</label>
                  <select className="f-input">
                    <option>Selecciona un cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="f-group">
                  <label>Referencia/Código</label>
                  <input className="f-input" placeholder="Ej: EXP-101" />
                </div>
                <div className="f-group">
                  <label>Destino</label>
                  <input className="f-input" placeholder="MAD, MIA..." />
                </div>
                <div className="f-group">
                  <label>Producto</label>
                  <input className="f-input" placeholder="Ej: Piña" />
                </div>
                <div className="f-group">
                  <label>Variedad</label>
                  <input className="f-input" placeholder="Ej: MD2" />
                </div>
              </div>
              <button className="btn-save" onClick={() => setShowModal(false)}>
                Crear Embarque
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* KPIs & Header */
        .stats-bar { display: flex; align-items: center; margin-bottom: 24px; }
        .stat-chip { background: #f1f5f9; padding: 6px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }
        .spacer { flex: 1; }
        .nav-actions { display: flex; gap: 8px; }
        .btn-nav { background: white; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-add-main { background: #1f7a3a; color: white; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }

        /* Filtros */
        .filter-area { display: flex; gap: 10px; margin-bottom: 20px; }
        .search-pill { flex: 1; display: flex; align-items: center; gap: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 12px; }
        .search-pill input { border: none; outline: none; padding: 10px 0; width: 100%; font-size: 14px; }
        .select-pill, .sort-pill { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 12px; font-size: 13px; font-weight: 600; cursor: pointer; }

        /* Filas Listado */
        .list-stack { display: flex; flex-direction: column; gap: 6px; }
        .s-row { 
          background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 16px; 
          display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; align-items: center; cursor: pointer; transition: 0.15s;
        }
        .s-row:hover { border-color: #1f7a3a; transform: translateX(3px); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }

        .s-col-info { display: flex; align-items: center; gap: 12px; }
        .mode-ico { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; }
        .mode-ico.air { background: #ecfdf5; color: #059669; }
        .mode-ico.sea { background: #eff6ff; color: #2563eb; }
        .id-txt { display: flex; flex-direction: column; }
        .code { font-weight: 800; font-size: 14px; color: #0f172a; }
        .client { font-size: 12px; color: #64748b; font-weight: 500; }

        .meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #475569; }
        .meta-item.gray { color: #94a3b8; }

        .p-n { display: block; font-weight: 700; font-size: 13px; color: #1e293b; }
        .p-v { display: block; font-size: 11px; font-weight: 700; color: #1f7a3a; text-transform: uppercase; }

        .s-col-stat { display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
        .chevron { color: #cbd5e1; }

        /* Modal PopUp */
        .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal-content { background: white; width: 100%; max-width: 500px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; }
        .modal-header { padding: 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
        .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; }
        .modal-body { padding: 24px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .f-group.full { grid-column: span 2; }
        .f-group label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }
        .f-input { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; }
        .f-input:focus { border-color: #1f7a3a; }
        .btn-save { width: 100%; background: #1f7a3a; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px; cursor: pointer; transition: 0.2s; }
        .btn-save:hover { background: #166534; }

        /* Pills */
        .status-pill { padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; border: 1px solid transparent; }
        .pill-green { background: #f0fdf4; color: #166534; border-color: #dcfce7; }
        .pill-gray { background: #f8fafc; color: #475569; border-color: #f1f5f9; }

        @media (max-width: 800px) {
          .s-row { grid-template-columns: 1fr auto; }
          .s-col-meta, .s-col-prod { display: none; }
        }
      `}</style>
    </AdminLayout>
  );
}