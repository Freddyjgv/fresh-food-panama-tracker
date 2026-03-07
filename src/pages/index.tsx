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

// ✅ RUTAS CORREGIDAS PARA SRC/PAGES/INDEX.TSX
import { supabase } from "../lib/supabaseClient"; 
import { labelStatus, statusBadgeClass } from "../lib/shipmentFlow";
import { ClientLayout } from "../components/ClientLayout";

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
    <ClientLayout title="Mis Embarques" subtitle="Panel de control logístico" wide>
      <div className="ff-viewport">
        
        {/* TOOLBAR REFINADA */}
        <div className="ff-toolbar">
          <div className="ff-search-bar">
            <Search size={18} color="#94a3b8" />
            <input 
              placeholder="Rastreo por código..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchShipments()}
            />
          </div>
          <select className="ff-select" value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">Destinos</option>
            <option value="MAD">Madrid</option>
            <option value="AMS">Amsterdam</option>
          </select>
          <button className="ff-btn-primary" onClick={fetchShipments}>Buscar</button>
          <button className="ff-btn-white" onClick={() => fetchShipments()}><RefreshCcw size={18} /></button>
        </div>

        {/* LISTADO DE CARDS (DISEÑO BLANCO PURO) */}
        <div className="ff-list">
          {items.map((s) => (
            <Link key={s.id} href={`/shipments/${s.id}`} style={{ textDecoration: 'none' }}>
              <div className={`ff-card-item border-${String(s.status).toLowerCase()}`}>
                
                {/* 1. Icono y ID */}
                <div className="ff-col main">
                  <div className="ff-icon-box">
                    <Package size={22} strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="ff-code">{s.code}</span>
                    <span className="ff-sub">Exportación Fresh Food</span>
                  </div>
                </div>

                {/* 2. Modalidad (AVIÓN/BARCO) */}
                <div className="ff-col center">
                  <div className="ff-meta-group">
                    {s.destination?.includes("MAD") ? <Plane size={16} color="#94a3b8" /> : <Ship size={16} color="#94a3b8" />}
                    <div>
                      <span className="ff-label-mini">MODALIDAD</span>
                      <span className="ff-value-mini">{s.destination || "A definir"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Fecha */}
                <div className="ff-col center">
                  <div className="ff-meta-group">
                    <Calendar size={16} color="#94a3b8" />
                    <div>
                      <span className="ff-label-mini">FECHA SALIDA</span>
                      <span className="ff-value-mini">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Status (Punto de hito) */}
                <div className="ff-col end">
                  <span className={`${statusBadgeClass(s.status)} ff-pill`}>
                    <span className="ff-dot" />
                    {labelStatus(s.status)}
                  </span>
                  <ChevronRight size={20} className="ff-chevron-icon" />
                </div>

              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ff-viewport { max-width: 1080px; margin: 0 auto; padding: 20px; }

        .ff-toolbar {
          display: flex; gap: 10px; background: white; padding: 8px;
          border-radius: 12px; border: 1px solid #eef2f6; margin-bottom: 25px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.01);
        }
        .ff-search-bar {
          flex: 1; display: flex; align-items: center; gap: 10px;
          background: #f8fafc; padding: 0 14px; border-radius: 8px; height: 42px;
        }
        .ff-search-bar input { border: none; background: transparent; width: 100%; outline: none; font-size: 0.9rem; color: #1e293b; }
        .ff-select { border: 1px solid #eef2f6; border-radius: 8px; padding: 0 12px; font-weight: 600; color: #64748b; font-size: 0.85rem; }
        .ff-btn-primary { background: #0f172a; color: white; border: none; padding: 0 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .ff-btn-white { background: white; border: 1px solid #eef2f6; border-radius: 8px; width: 42px; color: #94a3b8; cursor: pointer; display: grid; place-items: center; }

        /* CARDS BLANCAS - ESTILO MOCKUP */
        .ff-card-item {
          background: #ffffff !important;
          border: 1px solid #f1f5f9 !important;
          border-radius: 16px !important;
          display: grid;
          grid-template-columns: 1.3fr 1fr 1fr 1fr;
          align-items: center;
          padding: 18px 25px !important;
          margin-bottom: 12px;
          transition: all 0.2s ease-in-out;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02) !important;
          position: relative;
        }
        .ff-card-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 20px -5px rgba(0,0,0,0.05) !important;
          border-color: #cbd5e1 !important;
        }

        /* LÍNEAS DE STATUS */
        .border-created { border-left: 5px solid #94a3b8 !important; }
        .border-packed { border-left: 5px solid #3b82f6 !important; }
        .border-docs_ready { border-left: 5px solid #8b5cf6 !important; }
        .border-in_transit { border-left: 5px solid #f59e0b !important; }
        .border-at_destination { border-left: 5px solid #10b981 !important; }

        .ff-col { display: flex; align-items: center; gap: 15px; }
        .ff-col.center { justify-content: center; }
        .ff-col.end { justify-content: flex-end; gap: 20px; }

        .ff-icon-box { width: 44px; height: 44px; background: #f0fdf4; color: #16a34a; border-radius: 12px; display: grid; place-items: center; }
        .ff-code { display: block; font-size: 1.1rem; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; }
        .ff-sub { font-size: 0.8rem; color: #94a3b8; font-weight: 500; }

        .ff-meta-group { display: flex; align-items: center; gap: 10px; }
        .ff-label-mini { display: block; font-size: 0.6rem; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; }
        .ff-value-mini { font-size: 0.85rem; font-weight: 600; color: #475569; }

        /* STATUS BADGE */
        :global(.ff-pill) {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 15px !important; border-radius: 100px !important;
          font-size: 0.72rem !important; font-weight: 700 !important;
          text-transform: uppercase;
        }
        .ff-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        /* Colores dinámicos */
        :global(.ff-badge-blue) { background: #eff6ff !important; color: #2563eb !important; }
        :global(.ff-badge-orange) { background: #fff7ed !important; color: #ea580c !important; }
        :global(.ff-badge-green) { background: #f0fdf4 !important; color: #16a34a !important; }

        .ff-chevron-icon { color: #e2e8f0; transition: 0.2s; }
        .ff-card-item:hover .ff-chevron-icon { transform: translateX(4px); color: #64748b; }

        @media (max-width: 900px) { .ff-card-item { grid-template-columns: 1fr; gap: 15px; } }
      `}</style>
    </ClientLayout>
  );
}