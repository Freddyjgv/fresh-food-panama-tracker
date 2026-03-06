import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Calendar, Package, MapPin, RefreshCcw, Plane, Ship, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";
import { ClientLayout } from "../../components/ClientLayout";

type Shipment = {
  id: string;
  code: string;
  destination?: string | null;
  status: string;
  created_at?: string;
};

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-PA", { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
}

export default function ShipmentsPage() {
  const [page, setPage] = useState(1);
  const [destination, setDestination] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchShipments(next?: { page?: number; search?: string; }) {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const params = new URLSearchParams({
      page: String(next?.page ?? page),
      pageSize: "20",
      q: next?.search ?? search,
      destination: destination
    });

    const res = await fetch(`/.netlify/functions/listShipments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const json = await res.json();
      setItems(json.items || []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchShipments(); }, [page, destination]);

  const applySearch = () => { setPage(1); fetchShipments({ page: 1, search }); };

  return (
    <ClientLayout title="Mis Embarques" subtitle="Rastreo y gestión de logística de exportación." wide>
      <div className="ff-container">
        
        {/* Barra de Búsqueda Estilo Premium */}
        <div className="ff-toolbar">
          <div className="ff-search-field">
            <Search size={18} color="#94a3b8" strokeWidth={2} />
            <input 
              placeholder="Buscar por código (ej: EXP-2026)..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          <select className="ff-select-modern" value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">Todos los destinos</option>
            <option value="MAD">Madrid (MAD)</option>
            <option value="AMS">Amsterdam (AMS)</option>
          </select>
          <button className="ff-btn-search" onClick={applySearch}>Buscar</button>
          <button className="ff-btn-reload" onClick={() => fetchShipments()} title="Actualizar">
            <RefreshCcw size={18} />
          </button>
        </div>

        {/* Listado de Embarques */}
        <div className="ff-list-stack">
          {items.map((s) => (
            <Link key={s.id} href={`/shipments/${s.id}`} className="ff-card-wrapper">
              <div className={`ff-card status-indicator-${s.status.toLowerCase()}`}>
                
                {/* 1. Identificación Principal */}
                <div className="ff-col-id">
                  <div className="ff-package-icon">
                    <Package size={22} strokeWidth={1.5} />
                  </div>
                  <div className="ff-id-meta">
                    <span className="ff-id-title">{s.code}</span>
                    <span className="ff-id-sub">Piña MD2 · 4 Palets</span>
                  </div>
                </div>

                {/* 2. Modalidad y Destino (Centrado) */}
                <div className="ff-col-center">
                  <div className="ff-metric-item">
                    {/* Icono dinámico según destino: MAD/AMS suele ser avión */}
                    {["MAD", "AMS", "CDG"].includes(s.destination || "") ? <Plane size={16} /> : <Ship size={16} />}
                    <div className="ff-metric-content">
                      <span className="ff-metric-label">MODALIDAD / DESTINO</span>
                      <span className="ff-metric-value">{s.destination || "Pendiente"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Fecha (Centrado) */}
                <div className="ff-col-center">
                  <div className="ff-metric-item">
                    <Calendar size={16} />
                    <div className="ff-metric-content">
                      <span className="ff-metric-label">FECHA SALIDA</span>
                      <span className="ff-metric-value">{formatDate(s.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Badge de Estatus sincronizado con shipmentFlow.ts */}
                <div className="ff-col-status">
                  <span className={statusBadgeClass(s.status)}>
                    <i className="ff-status-dot" />
                    {labelStatus(s.status)}
                  </span>
                  <ChevronRight size={20} className="ff-chevron-link" />
                </div>

              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ff-container { max-width: 1140px; margin: 0 auto; padding: 20px; }

        /* Toolbar Superior */
        .ff-toolbar {
          display: flex; gap: 12px; align-items: center; background: #fff;
          padding: 8px; border-radius: 14px; border: 1px solid #eef2f6;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03); margin-bottom: 28px;
        }
        .ff-search-field { 
          flex: 1; display: flex; align-items: center; gap: 12px; 
          background: #f8fafc; padding: 0 16px; border-radius: 10px; height: 44px;
        }
        .ff-search-field input { 
          border: none; background: transparent; width: 100%; outline: none; 
          font-size: 0.9rem; color: #1e293b; font-weight: 500;
        }
        .ff-select-modern { 
          height: 44px; border: 1px solid #eef2f6; border-radius: 10px; 
          padding: 0 12px; color: #64748b; font-size: 0.85rem; font-weight: 600; outline: none;
        }
        .ff-btn-search { 
          height: 44px; padding: 0 20px; background: #1e293b; color: white; 
          border-radius: 10px; font-weight: 600; border: none; cursor: pointer; font-size: 0.85rem;
        }
        .ff-btn-reload {
          width: 44px; height: 44px; border-radius: 10px; border: 1px solid #eef2f6;
          background: #fff; color: #94a3b8; cursor: pointer; display: grid; place-items: center;
        }

        /* Tarjetas de Listado */
        .ff-list-stack { display: flex; flex-direction: column; gap: 12px; }
        .ff-card-wrapper { text-decoration: none; display: block; }
        .ff-card {
          background: #ffffff !important; border: 1px solid #f1f5f9; border-radius: 16px;
          display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; align-items: center;
          padding: 16px 24px; transition: all 0.25s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          position: relative; overflow: hidden;
        }
        .ff-card:hover {
          transform: translateY(-2px); border-color: #cbd5e1;
          box-shadow: 0 10px 20px rgba(0,0,0,0.04);
        }

        /* Indicadores de Estatus (Línea lateral) */
        .status-indicator-created { border-left: 5px solid #94a3b8; }
        .status-indicator-packed { border-left: 5px solid #3b82f6; }
        .status-indicator-docs_ready { border-left: 5px solid #8b5cf6; }
        .status-indicator-at_origin { border-left: 5px solid #f59e0b; }
        .status-indicator-in_transit { border-left: 5px solid #f59e0b; }
        .status-indicator-at_destination { border-left: 5px solid #10b981; }

        .ff-col-id { display: flex; align-items: center; gap: 16px; }
        .ff-package-icon { 
          width: 44px; height: 44px; background: #f0fdf4; color: #16a34a; 
          border-radius: 10px; display: grid; place-items: center;
        }
        .ff-id-title { display: block; font-size: 1.1rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
        .ff-id-sub { font-size: 0.8rem; color: #94a3b8; font-weight: 500; }

        .ff-col-center { display: flex; justify-content: center; }
        .ff-metric-item { display: flex; align-items: center; gap: 10px; color: #94a3b8; }
        .ff-metric-content { display: flex; flex-direction: column; }
        .ff-metric-label { font-size: 0.6rem; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; }
        .ff-metric-value { font-size: 0.85rem; font-weight: 600; color: #475569; }

        .ff-col-status { display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
        
        /* Badges basados en tus clases de shipmentFlow.ts */
        :global(.ff-badge) {
          display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
          border-radius: 100px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
          background: #f1f5f9; color: #475569; border: 1px solid transparent;
        }
        .ff-status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

        :global(.ff-badge-blue) { background: #eff6ff !important; color: #2563eb !important; border-color: #dbeafe !important; }
        :global(.ff-badge-purple) { background: #f5f3ff !important; color: #7c3aed !important; border-color: #ddd6fe !important; }
        :global(.ff-badge-orange) { background: #fff7ed !important; color: #ea580c !important; border-color: #ffedd5 !important; }
        :global(.ff-badge-green) { background: #f0fdf4 !important; color: #16a34a !important; border-color: #dcfce7 !important; }

        .ff-chevron-link { color: #e2e8f0; transition: transform 0.2s ease; }
        .ff-card:hover .ff-chevron-link { transform: translateX(4px); color: #94a3b8; }

        @media (max-width: 900px) {
          .ff-card { grid-template-columns: 1fr; gap: 16px; }
          .ff-col-center, .ff-col-status { justify-content: flex-start; }
        }
      `}</style>
    </ClientLayout>
  );
}