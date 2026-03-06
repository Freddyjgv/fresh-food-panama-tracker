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

// ✅ Estas rutas DEBEN ser las que ya te funcionaban
import { supabase } from "../../lib/supabaseClient"; 
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";
import { ClientLayout } from "../../components/ClientLayout";

export default function ShipmentsPage() {
  // Usamos any[] para evitar errores de interfaz mientras arreglamos el diseño
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const res = await fetch(`/.netlify/functions/listShipments?q=${search}&destination=${destination}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        // Ajuste por si la respuesta viene en .data o .items
        setItems(json.items || json.data || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [destination]);

  return (
    <ClientLayout title="Mis Embarques" subtitle="Gestión logística" wide>
      <div className="ff-main-container">
        
        {/* TOOLBAR PREMIUM */}
        <div className="ff-toolbar">
          <div className="ff-input-group">
            <Search size={18} color="#94a3b8" />
            <input 
              className="ff-search-input"
              placeholder="Buscar..." 
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
          <button className="ff-btn-icon" onClick={() => fetchShipments()}><RefreshCcw size={18} /></button>
        </div>

        {/* LISTADO DE CARDS - DISEÑO MOCKUP 100% */}
        <div className="ff-stack">
          {items.map((s) => (
            <Link key={s.id} href={`/shipments/${s.id}`} style={{ textDecoration: 'none' }}>
              <div className={`ff-ship-card st-line-${String(s.status).toLowerCase()}`}>
                
                {/* 1. ID e Icono */}
                <div className="ff-card-col">
                  <div className="ff-icon-bg">
                    <Package size={22} strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="ff-ship-code">{s.code}</span>
                    <span className="ff-ship-sub">Piña MD2 · 4 Palets</span>
                  </div>
                </div>

                {/* 2. Modalidad / Destino */}
                <div className="ff-card-col ff-j-center">
                  <div className="ff-metric">
                    {s.destination?.includes("MAD") ? <Plane size={16} /> : <Ship size={16} />}
                    <div className="ff-metric-text">
                      <span className="ff-m-label">MODALIDAD / DESTINO</span>
                      <span className="ff-m-val">{s.destination || "Pendiente"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Fecha */}
                <div className="ff-card-col ff-j-center">
                  <div className="ff-metric">
                    <Calendar size={16} />
                    <div className="ff-metric-text">
                      <span className="ff-m-label">FECHA SALIDA</span>
                      <span className="ff-m-val">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Status Pill */}
                <div className="ff-card-col ff-j-end">
                  <span className={`${statusBadgeClass(s.status)} ff-custom-badge`}>
                    <span className="ff-dot-status" />
                    {labelStatus(s.status)}
                  </span>
                  <ChevronRight size={18} className="ff-arrow" />
                </div>

              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ff-main-container { max-width: 1100px; margin: 0 auto; padding: 20px; }

        /* Barra de herramientas */
        .ff-toolbar {
          display: flex; gap: 12px; background: #fff; padding: 8px;
          border-radius: 12px; border: 1px solid #eef2f6; margin-bottom: 24px;
        }
        .ff-input-group {
          flex: 1; display: flex; align-items: center; gap: 10px;
          background: #f8fafc; padding: 0 12px; border-radius: 8px; height: 40px;
        }
        .ff-search-input { border: none; background: transparent; width: 100%; outline: none; font-size: 0.9rem; }
        .ff-select { border: 1px solid #eef2f6; border-radius: 8px; padding: 0 10px; font-size: 0.85rem; background: #fff; }
        .ff-btn-primary { background: #0f172a; color: #fff; border: none; padding: 0 15px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .ff-btn-icon { background: #fff; border: 1px solid #eef2f6; padding: 10px; border-radius: 8px; color: #94a3b8; cursor: pointer; }

        /* TARJETA BLANCA DISEÑO MOCKUP */
        .ff-ship-card {
          background: #ffffff !important;
          border: 1px solid #f1f5f9 !important;
          border-radius: 12px !important;
          display: grid;
          grid-template-columns: 1.3fr 1fr 1fr 1fr;
          padding: 16px 24px !important;
          margin-bottom: 12px;
          align-items: center;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02) !important;
          position: relative;
        }
        .ff-ship-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.05) !important;
          border-color: #cbd5e1 !important;
        }

        /* Bordes de estatus */
        .st-line-created { border-left: 5px solid #94a3b8 !important; }
        .st-line-packed { border-left: 5px solid #3b82f6 !important; }
        .st-line-docs_ready { border-left: 5px solid #8b5cf6 !important; }
        .st-line-in_transit { border-left: 5px solid #f59e0b !important; }
        .st-line-at_destination { border-left: 5px solid #10b981 !important; }

        .ff-card-col { display: flex; align-items: center; gap: 12px; }
        .ff-j-center { justify-content: center; }
        .ff-j-end { justify-content: flex-end; gap: 15px; }

        .ff-icon-bg { width: 40px; height: 40px; background: #f0fdf4; color: #16a34a; border-radius: 10px; display: grid; place-items: center; }
        .ff-ship-code { display: block; font-size: 1.05rem; font-weight: 800; color: #0f172a; }
        .ff-ship-sub { font-size: 0.75rem; color: #94a3b8; }

        .ff-metric { display: flex; align-items: center; gap: 10px; color: #94a3b8; }
        .ff-m-label { display: block; font-size: 0.55rem; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; }
        .ff-m-val { display: block; font-size: 0.85rem; font-weight: 600; color: #475569; }

        /* Badge Pill */
        :global(.ff-custom-badge) {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px !important; border-radius: 100px !important;
          font-size: 0.7rem !important; font-weight: 700 !important;
          text-transform: uppercase;
        }
        .ff-dot-status { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

        /* Fallbacks de color */
        :global(.ff-badge-blue) { background: #eff6ff !important; color: #2563eb !important; }
        :global(.ff-badge-orange) { background: #fff7ed !important; color: #ea580c !important; }
        :global(.ff-badge-green) { background: #f0fdf4 !important; color: #16a34a !important; }

        .ff-arrow { color: #e2e8f0; transition: 0.2s; }
        .ff-ship-card:hover .ff-arrow { color: #64748b; transform: translateX(3px); }

        @media (max-width: 900px) { .ff-ship-card { grid-template-columns: 1fr; gap: 15px; } }
      `}</style>
    </ClientLayout>
  );
}