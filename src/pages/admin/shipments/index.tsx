// src/pages/admin/shipments/index.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowUpDown,
  Search,
  Package2,
  Plus,
  ChevronRight,
  Calendar,
  MapPin,
  Ship,
  Plane,
  Filter,
  UserPlus,
  LayoutGrid
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { labelStatus } from "../../../lib/shipmentFlow";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import ShipmentDrawer from "../../../components/ShipmentDrawer";

// --- Tipados ---
type ShipmentListItem = {
  id: string;
  code: string;
  destination: string;
  status: string;
  created_at: string;
  client_name?: string | null;
  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;
};

// --- Helpers de Estética ---
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch { return iso; }
}

function badgeTone(status: string): "neutral" | "success" | "warn" | "info" {
  const s = (status || "").toUpperCase();
  if (["PACKED", "DOCS_READY", "AT_DESTINATION", "DELIVERED", "CLOSED"].includes(s)) return "success";
  if (["AT_ORIGIN", "ARRIVED_PTY", "DEPARTED"].includes(s)) return "warn";
  if (["IN_TRANSIT"].includes(s)) return "info";
  return "neutral";
}

function StatusPill({ status }: { status: string }) {
  const tone = badgeTone(status);
  const label = labelStatus(status);
  const colors = {
    success: { bg: "#f0fdf4", border: "#bcf0da", text: "#166534" },
    warn: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
    neutral: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" }
  }[tone];

  return (
    <span className="status-pill" style={{ 
      backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` 
    }}>
      {label}
    </span>
  );
}

export default function AdminShipments() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  
  // UI States
  const [isShipmentDrawerOpen, setIsShipmentDrawerOpen] = useState(false);
  const [items, setItems] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [destination, setDestination] = useState("");

  // Auth Guard
  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) { setAuthOk(true); setAuthChecking(false); }
    })();
  }, []);

  // Fetch Data
  const loadShipments = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams({
        mode: 'admin',
        q: q.trim(),
        dir: dir,
        destination: destination
      });

      const res = await fetch(`/.netlify/functions/listShipments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authOk) loadShipments();
  }, [authOk, q, dir, destination]);

  if (authChecking) return <AdminLayout title="Cargando..." subtitle="Verificando credenciales">...</AdminLayout>;

  return (
    <AdminLayout title="Logística de Exportación" subtitle="Panel administrativo de carga y seguimiento.">
      
      {/* 1. SECCIÓN DE ACCIONES (KPIs Visuales) */}
      <div className="action-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue"><LayoutGrid size={20}/></div>
          <div className="kpi-content">
            <span className="kpi-label">Activos</span>
            <span className="kpi-value">{items.length} Embarques</span>
          </div>
        </div>

        <button className="kpi-card action green" onClick={() => setIsShipmentDrawerOpen(true)}>
          <div className="kpi-icon pulse"><Plus size={20}/></div>
          <div className="kpi-content">
            <span className="kpi-label">Gestión</span>
            <span className="kpi-value">Nuevo Embarque</span>
          </div>
        </button>

        <button className="kpi-card action white" onClick={() => router.push('/admin/users')}>
          <div className="kpi-icon gray"><UserPlus size={20}/></div>
          <div className="kpi-content">
            <span className="kpi-label">Directorio</span>
            <span className="kpi-value">Ver Clientes</span>
          </div>
        </button>
      </div>

      {/* 2. BARRA DE FILTROS */}
      <div className="filter-wrapper">
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Buscar por código, cliente o producto..." 
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <div className="select-wrapper">
            <Filter size={14} className="icon-left" />
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="">Todos los Destinos</option>
              <option value="MAD">Madrid (MAD)</option>
              <option value="BCN">Barcelona (BCN)</option>
              <option value="MIA">Miami (MIA)</option>
              <option value="RTM">Rotterdam (RTM)</option>
            </select>
          </div>
          
          <button className="btn-sort" onClick={() => setDir(dir === "asc" ? "desc" : "asc")}>
            <ArrowUpDown size={16} />
            {dir === "desc" ? "Más recientes" : "Más antiguos"}
          </button>
        </div>
      </div>

      {/* 3. LISTADO COMPACTO */}
      <div className="list-container">
        {loading ? (
          <div className="list-message">Sincronizando con la base de datos...</div>
        ) : items.length === 0 ? (
          <div className="list-message empty">No se encontraron registros coincidentes.</div>
        ) : (
          <div className="shipment-grid">
            {items.map((s) => (
              <div key={s.id} className="shipment-item" onClick={() => router.push(`/admin/shipments/${s.id}`)}>
                <div className="col-main">
                  <div className={`mode-badge ${s.product_mode === 'Aérea' ? 'air' : 'sea'}`}>
                    {s.product_mode === 'Aérea' ? <Plane size={16} /> : <Ship size={16} />}
                  </div>
                  <div className="info-group">
                    <span className="code-text">{s.code}</span>
                    <span className="client-text">{s.client_name || 'Sin cliente asignado'}</span>
                  </div>
                </div>

                <div className="col-details">
                  <div className="meta-info">
                    <MapPin size={14} />
                    <span>{s.destination}</span>
                  </div>
                  <div className="meta-info">
                    <Calendar size={14} />
                    <span>{fmtDate(s.created_at)}</span>
                  </div>
                </div>

                <div className="col-product">
                  <span className="p-name">{s.product_name || 'Producto'}</span>
                  <span className="p-variety">{s.product_variety || 'Variedad'}</span>
                </div>

                <div className="col-status">
                  <StatusPill status={s.status} />
                  <ChevronRight size={18} className="chevron" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DRAWER DE CREACIÓN */}
      <ShipmentDrawer 
        isOpen={isShipmentDrawerOpen}
        onClose={() => setIsShipmentDrawerOpen(false)}
        clientId="" 
        clientName="Nuevo Registro"
        onSuccess={() => {
            loadShipments();
            setIsShipmentDrawerOpen(false);
        }}
      />

      <style jsx>{`
        .action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .kpi-card { 
          background: white; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0;
          display: flex; align-items: center; gap: 12px; transition: all 0.2s ease;
        }
        .kpi-card.action { cursor: pointer; border: none; text-align: left; width: 100%; }
        .kpi-card.green { background: #1f7a3a; color: white; }
        .kpi-card.white:hover { border-color: #1f7a3a; background: #f8fafc; }
        .kpi-card.green:hover { background: #166534; transform: translateY(-2px); }
        
        .kpi-icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; }
        .kpi-icon.blue { background: #eff6ff; color: #1e40af; }
        .kpi-icon.gray { background: #f1f5f9; color: #475569; }
        .kpi-icon.pulse { background: rgba(255,255,255,0.2); color: white; }
        
        .kpi-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; opacity: 0.8; }
        .kpi-value { display: block; font-size: 15px; font-weight: 800; }

        .filter-wrapper { 
          background: white; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0;
          display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center;
        }
        .search-box { position: relative; flex: 1; min-width: 300px; display: flex; align-items: center; background: #f8fafc; border-radius: 8px; padding: 0 12px; border: 1px solid #e2e8f0; }
        .search-box input { width: 100%; padding: 10px; background: transparent; border: none; outline: none; font-size: 14px; }
        .search-box :global(svg) { color: #94a3b8; }

        .filter-controls { display: flex; gap: 10px; }
        .select-wrapper { position: relative; display: flex; align-items: center; }
        .select-wrapper .icon-left { position: absolute; left: 10px; color: #64748b; pointer-events: none; }
        .select-wrapper select { padding: 8px 12px 8px 32px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; appearance: none; background: white; cursor: pointer; }
        
        .btn-sort { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: #475569; }
        .btn-sort:hover { background: #f1f5f9; }

        .shipment-grid { display: flex; flex-direction: column; gap: 8px; }
        .shipment-item { 
          background: white; padding: 12px 16px; border-radius: 12px; border: 1px solid #e2e8f0;
          display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; align-items: center; gap: 16px;
          cursor: pointer; transition: 0.2s;
        }
        .shipment-item:hover { border-color: #1f7a3a; box-shadow: 0 4px 12px rgba(0,0,0,0.04); background: #fcfdfc; }

        .col-main { display: flex; align-items: center; gap: 12px; }
        .mode-badge { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; }
        .mode-badge.air { background: #ecfdf5; color: #059669; }
        .mode-badge.sea { background: #eff6ff; color: #2563eb; }
        .info-group { display: flex; flex-direction: column; }
        .code-text { font-weight: 800; color: #0f172a; font-size: 14px; }
        .client-text { font-size: 12px; color: #64748b; font-weight: 500; }

        .col-details { display: flex; flex-direction: column; gap: 4px; }
        .meta-info { display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 12px; }
        
        .col-product { display: flex; flex-direction: column; }
        .p-name { font-weight: 700; color: #0f172a; font-size: 13px; }
        .p-variety { font-size: 12px; color: #1f7a3a; font-weight: 600; }

        .col-status { display: flex; align-items: center; gap: 12px; justify-content: flex-end; }
        .chevron { color: #cbd5e1; }

        .list-message { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; font-weight: 500; }

        .status-pill { text-transform: uppercase; letter-spacing: 0.02em; }

        @media (max-width: 850px) {
          .shipment-item { grid-template-columns: 1fr auto; }
          .col-details, .col-product { display: none; }
        }
      `}</style>
    </AdminLayout>
  );
}