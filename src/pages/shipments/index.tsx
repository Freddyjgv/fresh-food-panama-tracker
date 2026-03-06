import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Calendar, Package, MapPin, RefreshCcw } from "lucide-react";
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
  return d.toLocaleDateString("es-PA", { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ShipmentsPage() {
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [destination, setDestination] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Shipment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total]);

  async function fetchShipments(next?: { page?: number; dir?: "asc" | "desc"; destination?: string; search?: string; }) {
    setLoading(true);
    setErrorMsg("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      setLoading(false);
      setErrorMsg("Sesión inválida.");
      return;
    }

    const params = new URLSearchParams();
    params.set("page", String(next?.page ?? page));
    params.set("pageSize", String(pageSize));
    params.set("dir", next?.dir ?? dir);
    
    const d = next?.destination ?? destination;
    const q = next?.search ?? search;
    if (d) params.set("destination", d);
    if (q) params.set("q", q);

    const res = await fetch(`/.netlify/functions/listShipments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setLoading(false);
      setErrorMsg(`Error (${res.status})`);
      return;
    }

    const json = await res.json();
    setItems((json.items ?? json.data ?? []) as Shipment[]);
    setTotal(Number(json.total ?? json.count ?? 0));
    setLoading(false);
  }

  // ✅ FUNCIÓN CORREGIDA
  async function applySearch() {
    setPage(1);
    await fetchShipments({ page: 1, search });
  }

  useEffect(() => { 
    fetchShipments(); 
  }, [page, dir, destination]);

  return (
    <ClientLayout title="Embarques" subtitle="Gestión de exportaciones." wide>
      <div className="ff-page-container">
        
        {/* Toolbar Minimalista */}
        <div className="ff-toolbar">
          <div className="ff-search-group">
            <Search size={14} color="#94a3b8" />
            <input 
              className="ff-input-clean" 
              placeholder="Buscar código..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          
          <select 
            className="ff-select-clean"
            value={destination}
            onChange={(e) => { setPage(1); setDestination(e.target.value); }}
          >
            <option value="">Destinos</option>
            <option value="MAD">Madrid</option>
            <option value="AMS">Amsterdam</option>
          </select>

          <button className="ff-btn-search" onClick={applySearch}>Buscar</button>
          <button className="ff-btn-icon" onClick={() => fetchShipments()}><RefreshCcw size={14} /></button>
        </div>

        {/* Listado */}
        <div className="ff-list-grid">
          {items.map((s) => (
            <Link key={s.id} href={`/shipments/${s.id}`} className={`ff-card status-l-${s.status}`}>
              <div className="ff-card-layout">
                
                {/* ID / Producto */}
                <div className="ff-section-main">
                  <div className="ff-icon-wrapper">
                    <Package size={16} color="#64748b" />
                  </div>
                  <div>
                    <h3 className="ff-ship-id">{s.code}</h3>
                    <p className="ff-ship-sub">Piña MD2 · 4 Palets</p>
                  </div>
                </div>

                {/* Destino */}
                <div className="ff-section-center">
                  <div className="ff-metric">
                    <MapPin size={13} color="#cbd5e1" />
                    <div>
                      <span className="ff-label-small">DESTINO</span>
                      <span className="ff-value-small">{s.destination || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Fecha */}
                <div className="ff-section-center">
                  <div className="ff-metric">
                    <Calendar size={13} color="#cbd5e1" />
                    <div>
                      <span className="ff-label-small">FECHA</span>
                      <span className="ff-value-small">{formatDate(s.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="ff-section-right">
                  <span className={`ff-pill ${statusBadgeClass(s.status)}`}>
                    {labelStatus(s.status)}
                  </span>
                </div>

              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .ff-page-container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 24px;
        }

        /* Toolbar */
        .ff-toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          align-items: center;
        }
        .ff-search-group {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border: 1px solid #e2e8f0;
          padding: 0 12px;
          border-radius: 6px;
          height: 36px;
        }
        .ff-input-clean {
          border: none;
          outline: none;
          width: 100%;
          font-size: 0.85rem;
          color: #1e293b;
        }
        .ff-select-clean {
          height: 36px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 0 8px;
          font-size: 0.8rem;
          color: #64748b;
          background: #fff;
        }
        .ff-btn-search {
          height: 36px;
          padding: 0 16px;
          background: #1e293b;
          color: white;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .ff-btn-icon {
          width: 36px;
          height: 36px;
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 6px;
          display: grid;
          place-items: center;
          color: #94a3b8;
        }

        /* Cards Minimalistas */
        .ff-card {
          display: block;
          text-decoration: none;
          background: #ffffff !important;
          border: 1px solid #f1f5f9;
          border-radius: 8px;
          margin-bottom: 8px;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .ff-card:hover {
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }

        /* ADN Borde Status */
        .status-l-in_transit { border-left: 3px solid #3b82f6 !important; }
        .status-l-delivered { border-left: 3px solid #10b981 !important; }
        .status-l-pending { border-left: 3px solid #f59e0b !important; }

        .ff-card-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr 0.8fr;
          align-items: center;
          padding: 12px 20px;
        }

        .ff-section-main { display: flex; align-items: center; gap: 12px; }
        .ff-icon-wrapper {
          width: 32px;
          height: 32px;
          background: #f8fafc;
          border-radius: 6px;
          display: grid;
          place-items: center;
        }
        .ff-ship-id { font-size: 0.9rem; font-weight: 700; color: #0f172a; margin: 0; }
        .ff-ship-sub { font-size: 0.75rem; color: #94a3b8; margin: 0; }

        .ff-section-center { display: flex; justify-content: center; }
        .ff-metric { display: flex; align-items: center; gap: 8px; }
        .ff-label-small { display: block; font-size: 0.55rem; font-weight: 800; color: #cbd5e1; letter-spacing: 0.02em; }
        .ff-value-small { display: block; font-size: 0.8rem; font-weight: 600; color: #475569; }

        .ff-section-right { display: flex; justify-content: flex-end; }
        :global(.ff-pill) {
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        :global(.bg-blue-100) { background: #eff6ff !important; color: #2563eb !important; }
        :global(.bg-green-100) { background: #f0fdf4 !important; color: #16a34a !important; }

        @media (max-width: 768px) {
          .ff-card-layout { grid-template-columns: 1fr; gap: 12px; }
          .ff-section-center, .ff-section-right { justify-content: flex-start; }
        }
      `}</style>
    </ClientLayout>
  );
}