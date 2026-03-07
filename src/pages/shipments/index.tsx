import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Calendar, Package, MapPin, RefreshCcw, Plane, ArrowRight, Layers } from "lucide-react";
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
  clients?: { name: string }; 
};

export default function ShipmentsPage() {
  const [items, setItems] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [destFilter, setDestFilter] = useState("");

  // Helper para el icono dinámico
  const getProductIcon = (productName: string) => {
    const name = productName?.toLowerCase() || "";
    if (name.includes("piña")) return "🍍";
    if (name.includes("aguacate") || name.includes("avocado")) return "🥑";
    if (name.includes("papaya")) return "🥭";
    return "📦";
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
      <div className="md-container">
        
        <header className="md-header">
          <div className="md-header-left">
            <h1 className="md-title">Historial de Embarques</h1>
            <p className="md-subtitle">Gestionando <strong>{total}</strong> operaciones activas</p>
          </div>
          <div className="md-quick-stats">
            <div className="md-stat">
              <span className="md-stat-val">{total}</span>
              <span className="md-stat-lab">ENVÍOS</span>
            </div>
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
                    <div className="md-product-emoji">{getProductIcon(s.product_name)}</div>
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
      `}</style>
    </ClientLayout>
  );
}