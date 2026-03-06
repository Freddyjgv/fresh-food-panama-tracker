import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Calendar, 
  Package, 
  MapPin, 
  RefreshCcw, 
  Plane, 
  Ship, 
  ChevronRight 
} from "lucide-react";

// --- VERIFICA ESTAS RUTAS ---
import { supabase } from "../../lib/supabaseClient"; 
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";
import { ClientLayout } from "../../components/ClientLayout";

export default function ShipmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState("");

  const fetchShipments = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const res = await fetch(`/.netlify/functions/listShipments?q=${search}&destination=${destination}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || json.data || []);
      }
    } catch (e) {
      console.error("Error cargando embarques");
    }
  };

  useEffect(() => { fetchShipments(); }, [destination]);

  return (
    <ClientLayout title="Mis Embarques" subtitle="Gestión logística" wide>
      <div className="modern-container">
        
        {/* BUSCADOR ESTILO MOCKUP */}
        <div className="modern-toolbar">
          <div className="search-box">
            <Search size={18} color="#94a3b8" />
            <input 
              placeholder="Buscar por código..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchShipments()}
            />
          </div>
          <select className="modern-select" value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">Todos los destinos</option>
            <option value="MAD">Madrid</option>
            <option value="AMS">Amsterdam</option>
          </select>
          <button className="btn-search" onClick={fetchShipments}>Buscar</button>
          <button className="btn-icon" onClick={() => fetchShipments()}><RefreshCcw size={18} /></button>
        </div>

        {/* LISTADO DE TARJETAS BLANCAS (MOCKUP STYLE) */}
        <div className="shipments-list">
          {items.map((s) => (
            <Link key={s.id} href={`/shipments/${s.id}`} className="card-link">
              <div className={`ship-card status-border-${String(s.status).toLowerCase()}`}>
                
                {/* 1. Icono y ID */}
                <div className="card-col main-info">
                  <div className="icon-frame">
                    <Package size={22} strokeWidth={1.5} />
                  </div>
                  <div className="id-texts">
                    <span className="code-id">{s.code}</span>
                    <span className="sub-detail">Piña MD2 · 4 Palets</span>
                  </div>
                </div>

                {/* 2. Modalidad de Envío */}
                <div className="card-col center-content">
                  <div className="metric-item">
                    {s.destination?.includes("MAD") ? <Plane size={16} color="#94a3b8" /> : <Ship size={16} color="#94a3b8" />}
                    <div className="metric-texts">
                      <span className="m-label">MODALIDAD / DESTINO</span>
                      <span className="m-value">{s.destination || "Pendiente"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Fecha */}
                <div className="card-col center-content">
                  <div className="metric-item">
                    <Calendar size={16} color="#94a3b8" />
                    <div className="metric-texts">
                      <span className="m-label">FECHA SALIDA</span>
                      <span className="m-value">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString('es-PA') : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Status Badge con punto de hito */}
                <div className="card-col end-content">
                  <span className={`${statusBadgeClass(s.status)} status-pill-modern`}>
                    <span className="pill-dot" />
                    {labelStatus(s.status)}
                  </span>
                  <ChevronRight size={20} className="arrow-icon" />
                </div>

              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .modern-container { max-width: 1100px; margin: 0 auto; padding: 20px; }

        .modern-toolbar {
          display: flex; gap: 12px; background: white; padding: 10px;
          border-radius: 12px; border: 1px solid #eef2f6; margin-bottom: 30px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.02);
        }
        .search-box {
          flex: 1; display: flex; align-items: center; gap: 10px;
          background: #f8fafc; padding: 0 15px; border-radius: 10px; height: 44px;
        }
        .search-box input { border: none; background: transparent; width: 100%; outline: none; font-size: 0.9rem; }
        .modern-select { border: 1px solid #eef2f6; border-radius: 10px; padding: 0 12px; font-weight: 600; color: #64748b; font-size: 0.85rem; }
        .btn-search { background: #1e293b; color: white; border: none; padding: 0 20px; border-radius: 10px; font-weight: 600; cursor: pointer; }
        .btn-icon { background: white; border: 1px solid #eef2f6; border-radius: 10px; padding: 10px; color: #94a3b8; cursor: pointer; }

        /* TARJETA BLANCA DISEÑO MOCKUP */
        .card-link { text-decoration: none; display: block; }
        .ship-card {
          background: #ffffff !important;
          border: 1px solid #f1f5f9 !important;
          border-radius: 16px !important;
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1fr;
          align-items: center;
          padding: 18px 24px !important;
          margin-bottom: 15px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.02) !important;
          position: relative;
        }
        .ship-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 30px rgba(0,0,0,0.05) !important;
          border-color: #cbd5e1 !important;
        }

        /* BORDES DE COLOR SEGÚN STATUS */
        .status-border-created { border-left: 5px solid #94a3b8 !important; }
        .status-border-packed { border-left: 5px solid #3b82f6 !important; }
        .status-border-docs_ready { border-left: 5px solid #8b5cf6 !important; }
        .status-border-in_transit { border-left: 5px solid #f59e0b !important; }
        .status-border-at_destination { border-left: 5px solid #10b981 !important; }

        .card-col { display: flex; align-items: center; gap: 16px; }
        .center-content { justify-content: center; }
        .end-content { justify-content: flex-end; gap: 20px; }

        .icon-frame {
          width: 48px; height: 48px; background: #f0fdf4; color: #16a34a;
          border-radius: 12px; display: grid; place-items: center;
        }
        .code-id { display: block; font-size: 1.15rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
        .sub-detail { font-size: 0.8rem; color: #94a3b8; font-weight: 500; }

        .metric-item { display: flex; align-items: center; gap: 12px; }
        .metric-texts { display: flex; flex-direction: column; }
        .m-label { font-size: 0.6rem; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; }
        .m-value { font-size: 0.9rem; font-weight: 600; color: #475569; }

        /* BADGE MODERNIZADO */
        :global(.status-pill-modern) {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 16px !important; border-radius: 100px !important;
          font-size: 0.75rem !important; font-weight: 700 !important;
          text-transform: uppercase;
        }
        .pill-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        :global(.ff-badge-blue) { background: #eff6ff !important; color: #2563eb !important; }
        :global(.ff-badge-orange) { background: #fff7ed !important; color: #ea580c !important; }
        :global(.ff-badge-green) { background: #f0fdf4 !important; color: #16a34a !important; }

        .arrow-icon { color: #e2e8f0; transition: transform 0.2s; }
        .ship-card:hover .arrow-icon { transform: translateX(5px); color: #64748b; }

        @media (max-width: 900px) { .ship-card { grid-template-columns: 1fr; gap: 20px; } }
      `}</style>
    </ClientLayout>
  );
}