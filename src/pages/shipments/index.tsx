import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Calendar, Package, MapPin, RefreshCcw, ChevronRight } from "lucide-react";
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
  return d.toLocaleDateString("es-PA", { day: '2-digit', month: 'short', year: 'numeric' });
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
    if (next?.destination ?? destination) params.set("destination", next?.destination ?? destination);
    if (next?.search ?? search) params.set("q", next?.search ?? search);

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

  useEffect(() => { fetchShipments(); }, [page, dir, destination]);

  return (
    <ClientLayout title="Mis Embarques" subtitle="Gestiona y rastrea tus exportaciones en tiempo real." wide>
      <div className="ff-client-shell">
        
        {/* Header / Search Bar */}
        <div className="ff-search-section">
          <div className="ff-search-container">
            <div className="ff-input-wrapper">
              <Search size={18} className="ff-icon-search" />
              <input 
                className="ff-main-input" 
                placeholder="Buscar por código de embarque..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchShipments({ page: 1, search })}
              />
            </div>
            
            <select 
              className="ff-select-minimal"
              value={destination}
              onChange={(e) => { setPage(1); setDestination(e.target.value); }}
            >
              <option value="">Todos los destinos</option>
              <option value="MAD">Madrid (MAD)</option>
              <option value="AMS">Amsterdam (AMS)</option>
              <option value="CDG">Paris (CDG)</option>
            </select>

            <button className="ff-btn-refresh" onClick={() => fetchShipments()}>
              <RefreshCcw size={18} />
            </button>
          </div>
        </div>

        {/* Listado */}
        <div className="ff-list-wrapper">
          {loading ? (
            <div className="ff-loading-state">Cargando embarques...</div>
          ) : items.length === 0 ? (
            <div className="ff-empty-state">No se encontraron embarques.</div>
          ) : (
            <div className="ff-grid-list">
              {items.map((s) => (
                <Link key={s.id} href={`/shipments/${s.id}`} className={`ff-card-item status-border-${s.status}`}>
                  <div className="ff-card-content">
                    
                    {/* Col 1: ID & Info */}
                    <div className="ff-col-info">
                      <div className="ff-icon-box">
                        <Package size={22} />
                      </div>
                      <div>
                        <h3 className="ff-ship-code">{s.code}</h3>
                        <p className="ff-ship-sub">Piña MD2 · 4 Palets</p>
                      </div>
                    </div>

                    {/* Col 2: Destino (Centrado) */}
                    <div className="ff-col-center">
                      <div className="ff-meta-item">
                        <MapPin size={16} />
                        <div>
                          <span className="ff-meta-label">DESTINO</span>
                          <span className="ff-meta-value">{s.destination || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Col 3: Fecha (Centrado) */}
                    <div className="ff-col-center">
                      <div className="ff-meta-item">
                        <Calendar size={16} />
                        <div>
                          <span className="ff-meta-label">FECHA SALIDA</span>
                          <span className="ff-meta-value">{formatDate(s.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Col 4: Status & Action */}
                    <div className="ff-col-status">
                      <span className={`ff-badge-pill ${statusBadgeClass(s.status)}`}>
                        {labelStatus(s.status)}
                      </span>
                      <ChevronRight size={20} className="ff-arrow-icon" />
                    </div>

                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Paginación Simple */}
        {totalPages > 1 && (
          <div className="ff-pagination">
            <span className="ff-sub">Página {page} de {totalPages}</span>
            <div className="ff-nav-btns">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="ff-btn-nav">Anterior</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="ff-btn-nav">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .ff-client-shell {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 20px;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        /* Search Section */
        .ff-search-section { margin-bottom: 32px; }
        .ff-search-container {
          display: flex;
          gap: 12px;
          align-items: center;
          background: #fff;
          padding: 8px;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          border: 1px solid #f1f5f9;
        }
        .ff-input-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          align-items: center;
        }
        .ff-icon-search {
          position: absolute;
          left: 16px;
          color: #94a3b8;
        }
        .ff-main-input {
          width: 100%;
          height: 48px;
          padding: 0 16px 0 48px;
          border: none;
          background: #f8fafc;
          border-radius: 12px;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.2s;
        }
        .ff-main-input:focus { background: #fff; box-shadow: inset 0 0 0 2px #e2e8f0; }

        .ff-select-minimal {
          height: 48px;
          padding: 0 16px;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          background: #fff;
          color: #64748b;
          font-weight: 500;
          outline: none;
        }

        .ff-btn-refresh {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid #f1f5f9;
          background: #fff;
          color: #64748b;
          cursor: pointer;
        }

        /* Grid List */
        .ff-grid-list { display: grid; gap: 16px; }
        
        .ff-card-item {
          display: block;
          text-decoration: none;
          background: #fff;
          border-radius: 20px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .ff-card-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.06);
          border-color: #e2e8f0;
        }

        /* Border Dinámico Izquierdo */
        .status-border-in_transit { border-left: 6px solid #3b82f6; }
        .status-border-delivered { border-left: 6px solid #10b981; }
        .status-border-pending { border-left: 6px solid #f59e0b; }

        .ff-card-content {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1.2fr;
          align-items: center;
          padding: 24px 32px;
        }

        /* Columnas */
        .ff-col-info { display: flex; align-items: center; gap: 20px; }
        .ff-icon-box {
          width: 52px;
          height: 52px;
          background: #f0fdf4;
          color: #16a34a;
          border-radius: 14px;
          display: grid;
          place-items: center;
        }
        .ff-ship-code {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .ff-ship-sub { font-size: 0.85rem; color: #64748b; margin: 2px 0 0 0; font-weight: 500; }

        .ff-col-center { display: flex; justify-content: center; }
        .ff-meta-item { display: flex; align-items: center; gap: 12px; color: #94a3b8; }
        .ff-meta-content { display: flex; flex-direction: column; }
        .ff-meta-label { display: block; font-size: 0.65rem; font-weight: 800; color: #cbd5e1; letter-spacing: 0.05em; }
        .ff-meta-value { display: block; font-size: 0.95rem; font-weight: 600; color: #334155; }

        .ff-col-status { display: flex; align-items: center; justify-content: flex-end; gap: 20px; }
        
        /* Soft Pills */
        :global(.ff-badge-pill) {
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        :global(.bg-blue-100) { background: #eff6ff !important; color: #2563eb !important; }
        :global(.bg-green-100) { background: #ecfdf5 !important; color: #059669 !important; }
        :global(.bg-yellow-100) { background: #fffbeb !important; color: #d97706 !important; }

        .ff-arrow-icon { color: #cbd5e1; transition: transform 0.2s; }
        .ff-card-item:hover .ff-arrow-icon { transform: translateX(4px); color: #64748b; }

        /* Pagination */
        .ff-pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid #f1f5f9;
        }
        .ff-btn-nav {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #fff;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
        }
        .ff-btn-nav:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 900px) {
          .ff-card-content { grid-template-columns: 1fr; gap: 20px; padding: 24px; }
          .ff-col-center { justify-content: flex-start; }
          .ff-col-status { justify-content: space-between; }
        }
      `}</style>
    </ClientLayout>
  );
}