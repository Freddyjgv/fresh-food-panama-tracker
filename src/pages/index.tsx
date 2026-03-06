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
  /* 1. Fondo de página para que resalte el blanco de las cards */
  :global(body) {
    background-color: #f8fafc !important; 
  }

  .ff-viewport { 
    max-width: 1100px; 
    margin: 0 auto; 
    padding: 40px 20px; 
  }

  /* 2. Toolbar más limpia y elevada */
  .ff-toolbar {
    display: flex; 
    gap: 12px; 
    background: white; 
    padding: 12px;
    border-radius: 16px; 
    border: 1px solid #e2e8f0; 
    margin-bottom: 32px;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
  }

  .ff-search-bar {
    flex: 1; 
    display: flex; 
    align-items: center; 
    gap: 12px;
    background: #f1f5f9; 
    padding: 0 16px; 
    border-radius: 12px; 
    height: 48px;
    transition: all 0.2s;
  }
  
  .ff-search-bar:focus-within {
    background: #fff;
    box-shadow: 0 0 0 2px #e2e8f0;
  }

  .ff-search-bar input { 
    border: none; 
    background: transparent; 
    width: 100%; 
    outline: none; 
    font-size: 1rem; 
    color: #1e293b; 
  }

  /* 3. Tarjetas con sombras dinámicas y bordes definidos */
  .ff-card-item {
    background: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 20px !important;
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr;
    align-items: center;
    padding: 24px 30px !important;
    margin-bottom: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    cursor: pointer;
  }

  .ff-card-item:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02) !important;
    border-color: #cbd5e1 !important;
  }

  /* 4. Indicador de status más grueso (ADN Premium) */
  .border-created { border-left: 8px solid #94a3b8 !important; }
  .border-packed { border-left: 8px solid #3b82f6 !important; }
  .border-docs_ready { border-left: 8px solid #8b5cf6 !important; }
  .border-in_transit { border-left: 8px solid #f59e0b !important; }
  .border-at_destination { border-left: 8px solid #10b981 !important; }

  .ff-col { display: flex; align-items: center; gap: 20px; }
  .ff-col.center { justify-content: center; }
  .ff-col.end { justify-content: flex-end; gap: 24px; }

  /* 5. Iconos y Textos con mejores pesos */
  .ff-icon-box { 
    width: 52px; 
    height: 52px; 
    background: #f0fdf4; 
    color: #16a34a; 
    border-radius: 14px; 
    display: grid; 
    place-items: center; 
  }

  .ff-code { 
    display: block; 
    font-size: 1.25rem; 
    font-weight: 800; 
    color: #0f172a; 
    letter-spacing: -0.03em; 
    line-height: 1.2;
  }

  .ff-sub { 
    font-size: 0.85rem; 
    color: #64748b; 
    font-weight: 500; 
  }

  .ff-meta-group { display: flex; align-items: center; gap: 14px; }
  .ff-label-mini { 
    display: block; 
    font-size: 0.65rem; 
    font-weight: 800; 
    color: #94a3b8; 
    letter-spacing: 0.1em; 
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .ff-value-mini { 
    font-size: 0.95rem; 
    font-weight: 600; 
    color: #334155; 
  }

  /* 6. Badges estilo "Pill" con contraste real */
  :global(.ff-pill) {
    display: inline-flex; 
    align-items: center; 
    gap: 8px;
    padding: 8px 16px !important; 
    border-radius: 12px !important; /* Menos redondeado para look moderno */
    font-size: 0.75rem !important; 
    font-weight: 700 !important;
    letter-spacing: 0.02em;
  }

  .ff-dot { 
    width: 8px; 
    height: 8px; 
    border-radius: 50%; 
    background: currentColor; 
  }

  /* Colores dinámicos reforzados */
  :global(.ff-badge-blue) { background: #dbeafe !important; color: #1e40af !important; }
  :global(.ff-badge-orange) { background: #ffedd5 !important; color: #9a3412 !important; }
  :global(.ff-badge-green) { background: #dcfce7 !important; color: #166534 !important; }

  .ff-chevron-icon { 
    color: #cbd5e1; 
    transition: all 0.2s; 
  }
  
  .ff-card-item:hover .ff-chevron-icon { 
    color: #1e293b; 
    transform: translateX(6px); 
  }

  @media (max-width: 900px) { 
    .ff-card-item { grid-template-columns: 1fr; gap: 20px; padding: 20px !important; } 
  }
`}</style>
    </ClientLayout>
  );
}