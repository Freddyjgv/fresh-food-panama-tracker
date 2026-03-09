import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Calendar, Package, MapPin, RefreshCcw, Plane, PlusCircle, ArrowRight, Plus, Layers } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";
import { ClientLayout } from "../../components/ClientLayout";

type Shipment = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  destination: string;
  product_name: string;
  product_variety: string;
  pallets: number;
  boxes: number;
  awb: string;
  flight_number: string;
  client_name?: string;
  last_event_at?: string; // Nueva propiedad que envía Netlify
  clients?: {
    id: string;
    name: string;
    legal_name: string;
    logo_url?: string | null;
    tax_id?: string | null;
    billing_address?: string | null;
    phone?: string | null;
    website?: string | null;
    country?: string | null;
  }; 
};

export default function ShipmentsPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [destFilter, setDestFilter] = useState("");

  // Helper para el icono dinámico
  const ProductIcon = ({ name }: { name: string }) => {
  const n = name?.toLowerCase() || "";
  
  // Definimos el color según el producto, pero el icono siempre es Package
  let iconColor = "#64748b"; // Gris por defecto
  let bgColorClass = "bg-slate";

  if (n.includes("piña")) {
    iconColor = "#ca8a04"; 
    bgColorClass = "bg-yellow";
  } else if (n.includes("aguacate") || n.includes("avocado")) {
    iconColor = "#16a34a";
    bgColorClass = "bg-green";
  } else if (n.includes("papaya")) {
    iconColor = "#ea580c";
    bgColorClass = "bg-orange";
  }

  return (
    <div className={`md-prod-icon-wrapper ${bgColorClass}`}>
      <Package size={22} color={iconColor} strokeWidth={2.5} />
    </div>
  );
};

  async function fetchShipments() {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const params = new URLSearchParams({
      page: "1",
      pageSize: "40",
      q: search,
      destination: destFilter
    });

    try {
      const res = await fetch(`/.netlify/functions/listShipments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setItems(json.items || []);
      setTotal(json.total || 0);
    } catch (e) {
      console.error("Error fetching shipments:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchShipments(); }, [destFilter]);

  return (
  <ClientLayout title="Panel de Logística" wide>
    {/* 1. Este wrapper es el que controla el ancho completo y el padding lateral */}
    <div className="ff-page-wrapper">
      
      <header className="ff-header-premium">
        {/* LADO IZQUIERDO: PERFIL */}
        <div className="ff-client-profile">
          <div className="ff-logo-wrapper">
            {items[0]?.clients?.logo_url ? (
              <img 
                src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${items[0].clients.logo_url}`} 
                alt="Logo" 
                className="ff-logo-img"
              />
            ) : (
              <div className="ff-logo-placeholder">
                {items[0]?.clients?.name?.charAt(0) || 'C'}
              </div>
            )}
          </div>
          
          <div className="ff-client-info">
            <h1 className="ff-client-name-display">
              {items[0]?.clients?.legal_name || items[0]?.clients?.name || 'Panel de Control'}
            </h1>
            
            <div className="ff-client-meta-stack">
              <div className="ff-meta-row">
                <span className="ff-meta-label">TAX ID:</span>
                <span className="ff-meta-value">{items[0]?.clients?.tax_id || '—'}</span>
              </div>
              
              <div className="ff-meta-row">
                <span className="ff-meta-value">{items[0]?.clients?.billing_address || '—'}</span>
              </div>
              
              <div className="ff-meta-row ff-secondary-meta">
                <span className="ff-meta-value">T: {items[0]?.clients?.phone || '—'}</span>
                {items[0]?.clients?.website && (
                  <>
                    <span className="ff-meta-divider">|</span>
                    <span className="ff-meta-value ff-website-link">{items[0].clients.website}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: BOTÓN */}
        <div className="ff-header-actions">
          <button 
            className="ff-btn-quote-minimal"
            onClick={() => window.open(`https://wa.me/34932620121?text=Hola, deseo solicitar una nueva cotización.`, '_blank')}
          >
            <Plus size={14} />
            <span>SOLICITAR COTIZACIÓN</span>
          </button>
        </div>
      </header>

        <div className="md-toolbar">
          <div className="md-search-box">
            <Search size={18} className="md-icon-muted" />
            <input 
              placeholder="Buscar por código, AWB o producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchShipments()}
            />
          </div>
          
          <div className="md-filters">
            <div className="md-select-group">
              <MapPin size={16} className="md-icon-muted" />
              <select value={destFilter} onChange={(e) => setDestFilter(e.target.value)}>
                <option value="">Todos los Destinos</option>
                <option value="MAD">Madrid (MAD)</option>
                <option value="AMS">Amsterdam (AMS)</option>
                <option value="MIA">Miami (MIA)</option>
              </select>
            </div>
            <button className="md-btn-refresh" onClick={fetchShipments} disabled={loading}>
              <RefreshCcw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        <div className="md-grid">
          {loading ? (
            <div className="md-loading-state">Sincronizando flota...</div>
          ) : (
            items.map((s) => (
              <Link key={s.id} href={`/shipments/${s.id}`} className="md-card-link">
                <div className="md-card">
                  <div className="md-col-info">
  {/* Cambiamos la función por el Componente */}
  <ProductIcon name={s.product_name} /> 
  <div>
    <h2 className="md-ship-code">{s.code}</h2>
    <p className="md-product-sub">
      {s.product_name} <span className="md-variety-dot">•</span> {s.product_variety}
    </p>
  </div>
</div>

                  <div className="md-col-logistics">
                    <div className="md-route">
                      <span className="md-badge-city">PTY</span>
                      <ArrowRight size={14} className="md-arrow" />
                      <span className="md-badge-city active">{s.destination || "TBD"}</span>
                    </div>
                    <div className="md-cargo-details">
                      <Layers size={12} />
                      <span>{s.pallets || 0} Pallets • {s.boxes || 0} Cajas</span>
                    </div>
                  </div>

                  <div className="md-col-flight">
                    <div className="md-flight-row">
                      <Plane size={14} />
                      <span>{s.flight_number || "— — —"}</span>
                    </div>
                    <div className="md-date-row">
                      <Calendar size={14} />
                      <span>{new Date(s.created_at).toLocaleDateString('es-PA', { day:'2-digit', month:'short' }).toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="md-col-status">
                    <span className={`md-status-pill ${statusBadgeClass(s.status)}`}>
                      {labelStatus(s.status)}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .md-container { max-width: 1200px; margin: 0 auto; padding: 40px 24px; zoom: 0.94; }
        .md-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        .md-title { font-size: 32px; font-weight: 800; color: #0f172a; letter-spacing: -1px; margin: 0; }
        .md-subtitle { color: #64748b; font-size: 16px; margin-top: 4px; }
        .md-stat { background: #1e293b; color: white; padding: 12px 24px; border-radius: 18px; text-align: center; }
        .md-stat-val { display: block; font-size: 20px; font-weight: 800; }
        .md-stat-lab { font-size: 10px; font-weight: 700; opacity: 0.6; letter-spacing: 0.1em; }

        .ff-header-premium { padding: 40px 0; border-bottom: 1px solid #f1f5f9; margin-bottom: 40px; }

        .ff-header-portal-clean {
    /* Glassmorphism y Color Naranja 3% (usando hex con opacidad o rgba) */
    background: rgba(255, 122, 0, 0.03); 
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 122, 0, 0.1);
    border-radius: 20px;
    padding: 24px 32px;
    margin-bottom: 30px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
  }

  .ff-header-premium {
    /* Gradiente 3% Naranja según tu especificación */
    background: linear-gradient(135deg, #ffffff 0%, rgba(209, 119, 17, 0.03) 100%);
    padding: 28px 36px;
    border-radius: 24px;
    border: 1px solid rgba(209, 119, 17, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
    box-shadow: 0 10px 30px rgba(209, 119, 17, 0.05);
    backdrop-filter: blur(4px);
    position: relative;
    overflow: hidden;
  }

  .ff-client-profile {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .ff-logo-wrapper {
    width: 70px;
    height: 70px;
    background: white;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(0,0,0,0.03);
    box-shadow: 0 4px 10px rgba(0,0,0,0.02);
  }

  .ff-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 10px;
  }

  .ff-client-name-display {
    font-size: 22px;
    font-weight: 800;
    color: #1a202c;
    margin: 0 0 12px 0;
    letter-spacing: -0.03em;
  }

  .ff-client-meta-stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ff-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #4a5568;
  }

  .ff-meta-label {
    font-weight: 700;
    color: #718096;
    font-size: 10px;
  }

  .ff-meta-divider {
    color: rgba(209, 119, 17, 0.3);
  }

  .ff-secondary-meta {
    opacity: 0.8;
  }

  .ff-website-link {
    color: #d17711;
    font-weight: 500;
  }

  .ff-btn-quote-minimal {
    background: transparent;
    border: 1px solid rgba(209, 119, 17, 0.3);
    color: #d17711;
    padding: 8px 20px;
    border-radius: 50px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .ff-btn-quote-minimal:hover {
    background: rgba(209, 119, 17, 0.05);
    border-color: rgba(209, 119, 17, 0.6);
    transform: translateY(-1px);
  }

  .ff-header-main-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .ff-client-profile-minimal {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .ff-logo-container-glass {
    width: 64px;
    height: 64px;
    background: white;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid #f1f5f9;
  }

  .ff-logo-img-clean {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 8px;
  }

  .ff-logo-placeholder-clean {
    font-size: 24px;
    font-weight: 700;
    color: #ff7a00;
  }

  .ff-client-title {
    font-size: 20px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 4px 0;
    letter-spacing: -0.02em;
  }

  .ff-client-id-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.04);
    padding: 4px 10px;
    border-radius: 6px;
  }

  .ff-id-label {
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
  }

  .ff-id-value {
    font-size: 11px;
    font-weight: 500;
    color: #334155;
  }

  .ff-btn-request-quote {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #1e293b; /* Color oscuro profesional */
    color: white;
    border: none;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .ff-btn-request-quote:hover {
    background: #0f172a;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

.ff-header-top-row { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 32px; 
}

/* Profile Section */
.ff-client-profile { display: flex; align-items: center; gap: 24px; }
.ff-logo-wrapper { 
  width: 76px; height: 76px; border-radius: 20px; 
  background: #f8fafc; border: 1.5px solid #e2e8f0; 
  overflow: hidden; display: grid; place-items: center;
}
.ff-logo-img { width: 100%; height: 100%; object-fit: contain; padding: 10px; }
.ff-logo-placeholder { font-size: 32px; font-weight: 900; color: #cbd5e1; }


.ff-client-meta-row { display: flex; gap: 8px; margin-top: 10px; align-items: center; }
.ff-meta-label { font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em; }
.ff-meta-value { font-size: 13px; font-weight: 700; color: #64748b; }
.ff-meta-divider { color: #e2e8f0; font-weight: 300; }

/* KPI Badge Style */
.ff-id-badge-kpi { 
  display: flex; align-items: center; gap: 18px; 
  background: white; border: 1.5px solid #e2e8f0; 
  padding: 14px 28px; border-radius: 22px; 
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.03);
}
.ff-badge-icon-stack { position: relative; display: flex; align-items: center; }
.ff-badge-number { font-size: 26px; font-weight: 900; color: #0f172a; display: block; line-height: 1; }
.ff-badge-label { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 0.08em; }
:global(.ff-icon-green) { color: #22c55e; }

/* Pulse Animation */
.ff-pulse-dot {
  position: absolute; top: -6px; right: -6px; width: 10px; height: 10px;
  background: #22c55e; border-radius: 50%; border: 2px solid white;
}
.ff-pulse-dot::after {
  content: ''; position: absolute; width: 100%; height: 100%;
  background: #22c55e; border-radius: 50%; animation: pulse 2s infinite;
}
@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }

/* Specs Bar */
.ff-header-specs-bar { 
  display: flex; align-items: center; gap: 32px; 
  background: #f8fafc; padding: 16px 28px; border-radius: 18px; 
}
.ff-spec-item { display: flex; flex-direction: column; }
.ff-spec-label { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 0.08em; margin-bottom: 4px; }
.ff-spec-value { font-size: 14px; font-weight: 800; color: #334155; }
.ff-spec-divider { width: 1px; height: 30px; background: #e2e8f0; }
.ff-spec-divider-heavy { width: 2px; height: 30px; background: #cbd5e1; }
.ff-text-blue { color: #2563eb; }

        .md-toolbar { display: flex; gap: 16px; margin-bottom: 30px; }
        .md-search-box { flex: 1; background: white; border: 1px solid #e2e8f0; border-radius: 16px; display: flex; align-items: center; padding: 0 18px; gap: 12px; }
        .md-search-box input { border: none; outline: none; width: 100%; height: 52px; font-size: 15px; font-weight: 500; }
        .md-filters { display: flex; gap: 12px; }
        .md-select-group { background: white; border: 1px solid #e2e8f0; border-radius: 16px; display: flex; align-items: center; padding: 0 16px; gap: 10px; }
        .md-select-group select { border: none; outline: none; height: 52px; font-size: 14px; font-weight: 700; color: #475569; appearance: none; cursor: pointer; }
        .md-btn-refresh { width: 52px; height: 52px; border-radius: 16px; border: 1px solid #e2e8f0; background: white; display: grid; place-items: center; cursor: pointer; color: #64748b; }

        .md-grid { display: flex; flex-direction: column; gap: 12px; }
        .md-card-link { text-decoration: none; display: block; }
        .md-card { 
          background: white; border: 1px solid #f1f5f9; border-radius: 24px; 
          display: grid; grid-template-columns: 1.8fr 1.2fr 1fr 1fr; 
          align-items: center; padding: 24px 32px; transition: 0.2s ease;
        }
        .md-card-link:hover .md-card { border-color: #cbd5e1; transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0,0,0,0.05); }

        .md-ship-code { font-size: 24px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
        .md-product-sub { font-size: 13px; color: #64748b; font-weight: 600; margin: 4px 0 0; text-transform: uppercase; }
        .md-variety-dot { color: #cbd5e1; margin: 0 4px; }
        .md-product-emoji { width: 52px; height: 52px; background: #f8fafc; border-radius: 16px; display: grid; place-items: center; font-size: 24px; border: 1px solid #f1f5f9; }

        .md-col-info { display: flex; align-items: center; gap: 18px; }
        .md-route { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .md-badge-city { font-size: 11px; font-weight: 800; color: #64748b; background: #f8fafc; padding: 4px 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .md-badge-city.active { color: #2563eb; background: #eff6ff; border-color: #dbeafe; }
        .md-cargo-details { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #94a3b8; }

        .md-col-flight { display: flex; flex-direction: column; gap: 6px; }
        .md-flight-row, .md-date-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #475569; }
        .md-icon-muted { color: #cbd5e1; }
        .md-col-status { display: flex; justify-content: flex-end; }
        
        :global(.md-status-pill) { padding: 8px 16px; border-radius: 100px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .md-loading-state { padding: 40px; text-align: center; color: #94a3b8; font-weight: 600; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        @media (max-width: 1000px) {
          .md-card { grid-template-columns: 1fr; gap: 20px; }
        }
          .md-prod-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

/* Colores de fondo ultra-soft */
.bg-yellow { background-color: #fefce8; border: 1px solid #fef9c3; }
.bg-green  { background-color: #f0fdf4; border: 1px solid #dcfce7; }
.bg-orange { background-color: #fff7ed; border: 1px solid #ffedd5; }
.bg-slate  { background-color: #f8fafc; border: 1px solid #f1f5f9; }

/* El Código de Embarque ahora resalta más */
.md-ship-code { 
  font-size: 20px; 
  font-weight: 800; 
  color: #1e293b; 
  letter-spacing: -0.5px;
  margin: 0;
}

.md-product-sub {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}
      `}</style>
    </ClientLayout>
  );
}