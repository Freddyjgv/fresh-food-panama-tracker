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
  return d.toLocaleDateString("es-PA");
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

  async function fetchShipments(next?: {
    page?: number;
    dir?: "asc" | "desc";
    destination?: string;
    search?: string;
  }) {
    setLoading(true);
    setErrorMsg("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      setLoading(false);
      setErrorMsg("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }

    const params = new URLSearchParams();
    params.set("page", String(next?.page ?? page));
    params.set("pageSize", String(pageSize));
    params.set("dir", next?.dir ?? dir);

    const dest = next?.destination ?? destination;
    const q = next?.search ?? search;

    if (dest) params.set("destination", dest);
    if (q) params.set("q", q);

    const res = await fetch(`/.netlify/functions/listShipments?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      setLoading(false);
      setErrorMsg(`Error listando embarques (${res.status}). ${txt ? txt.slice(0, 160) : ""}`);
      return;
    }

    const json = await res.json();
    const newItems: Shipment[] = (json.items ?? json.data ?? []) as Shipment[];
    const newTotal: number = Number(json.total ?? json.count ?? newItems.length ?? 0);

    setItems(newItems);
    setTotal(newTotal);
    setLoading(false);
  }

  useEffect(() => {
    fetchShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dir, destination]);

  async function applySearch() {
    const nextPage = 1;
    setPage(nextPage);
    await fetchShipments({ page: nextPage, search });
  }

  return (
    <ClientLayout
      title="Embarques"
      subtitle="Consulta estado, documentos y fotos del proceso de exportación."
      wide
    >
      <div className="ff-client-shell">
        {/* Toolbar / Filtros */}
        <div className="ff-card ff-card-pad">
          <div className="ff-toolbar">
            <div className="ff-toolbar__left">
              <div className="ff-field">
                <MapPin size={16} color="#94a3b8" />
                <select
                  className="ff-input"
                  value={destination}
                  onChange={(e) => {
                    setPage(1);
                    setDestination(e.target.value);
                  }}
                >
                  <option value="">Todos los destinos</option>
                  <option value="MAD">Madrid (MAD)</option>
                  <option value="AMS">Amsterdam (AMS)</option>
                  <option value="CDG">Paris (CDG)</option>
                </select>
              </div>

              <div className="ff-field ff-field--grow">
                <Search size={16} color="#94a3b8" />
                <input
                  className="ff-input"
                  placeholder="Buscar por número de embarque…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch();
                  }}
                />
              </div>
            </div>

            <div className="ff-toolbar__right">
              <button className="ff-btn ff-btn-primary" type="button" onClick={applySearch}>
                Buscar
              </button>

              <button
                className="ff-btn ff-btn-ghost"
                onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
                type="button"
              >
                <ArrowUpDown size={16} />
                Fecha {dir === "desc" ? "↓" : "↑"}
              </button>

              <button className="ff-btn ff-btn-ghost" type="button" onClick={() => fetchShipments()}>
                <RefreshCcw size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="ff-divider" />

        {/* Listado de Cards */}
        <div className="ff-list-container">
          {loading && <p className="ff-sub">Cargando…</p>}

          {!loading && errorMsg && (
            <div className="ff-card ff-card-pad" style={{ borderColor: "#fca5a5" }}>
              <p style={{ margin: 0, fontWeight: 800 }}>No se pudo cargar el listado</p>
              <p className="ff-sub">{errorMsg}</p>
            </div>
          )}

          {!loading && !errorMsg && items.length === 0 && (
            <p className="ff-sub">No hay embarques disponibles.</p>
          )}

          {!loading && !errorMsg && items.length > 0 && (
            <div className="ff-list">
              {items.map((s) => (
                <Link key={s.id} href={`/shipments/${s.id}`} className="ff-listItem">
                  <div className="ff-listItem__main">
                    {/* Bloque Izquierdo: ID y Producto */}
                    <div className="ff-listItem__left">
                      <div className="ff-ico">
                        <Package size={20} color="#16a34a" />
                      </div>
                      <div className="ff-listItem__meta">
                        <div className="ff-listItem__title">{s.code}</div>
                        <div className="ff-sub">Piña MD2 · 4 Palets</div>
                      </div>
                    </div>

                    {/* Bloque Central: Destino */}
                    <div className="ff-listItem__center">
                      <div className="ff-metric">
                        <MapPin size={16} color="#94a3b8" />
                        <div className="ff-metric__content">
                          <span className="ff-metric__label">DESTINO</span>
                          <span className="ff-metric__value">{s.destination || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bloque Derecho: Fecha */}
                    <div className="ff-listItem__right-meta">
                      <div className="ff-metric">
                        <Calendar size={16} color="#94a3b8" />
                        <div className="ff-metric__content">
                          <span className="ff-metric__label">FECHA</span>
                          <span className="ff-metric__value">{formatDate(s.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="ff-listItem__status">
                    <span className={`${statusBadgeClass(s.status)} status-badge`}>
                      {labelStatus(s.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Paginación */}
          {!loading && !errorMsg && totalPages > 1 && (
            <div className="ff-spread">
              <div className="ff-sub">
                Página {page} de {totalPages} · {total} embarques
              </div>
              <div className="ff-row" style={{ gap: 8 }}>
                <button
                  className="ff-btn ff-btn-ghost"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Anterior
                </button>
                <button
                  className="ff-btn ff-btn-ghost"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .ff-client-shell {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .ff-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .ff-toolbar__left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1 1 auto;
        }

        .ff-field {
          display: flex;
          align-items: center;
          position: relative;
        }

        .ff-field--grow {
          flex: 1;
        }

        :global(.ff-field .ff-input) {
          height: 40px;
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 12px 0 40px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          font-size: 0.9rem;
        }

        :global(.ff-field svg) {
          position: absolute;
          left: 14px;
          z-index: 10;
        }

        .ff-list {
          display: grid;
          gap: 12px;
          margin-top: 10px;
        }

        .ff-listItem {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border: 1px solid #f1f5f9;
          border-radius: 14px;
          background: #ffffff;
          text-decoration: none;
          color: inherit;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
          transition: all 0.2s ease;
        }

        .ff-listItem:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08);
          border-color: #bfdbfe;
        }

        .ff-listItem__main {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          align-items: center;
          gap: 20px;
          flex: 1;
        }

        .ff-listItem__left { display: flex; align-items: center; gap: 16px; }
        .ff-listItem__center, .ff-listItem__right-meta { display: flex; justify-content: center; }

        .ff-ico {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          display: grid;
          place-items: center;
        }

        .ff-listItem__title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.2;
        }

        .ff-sub { font-size: 0.85rem; color: #64748b; font-weight: 500; }

        .ff-metric { display: flex; align-items: center; gap: 10px; }
        .ff-metric__content { display: flex; flex-direction: column; }
        .ff-metric__label { font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .ff-metric__value { font-size: 0.9rem; font-weight: 600; color: #334155; }

        :global(.status-badge) {
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        :global(.bg-blue-100) { background: #eff6ff !important; color: #1e40af !important; border: 1px solid #dbeafe !important; }
        :global(.bg-green-100) { background: #f0fdf4 !important; color: #166534 !important; border: 1px solid #dcfce7 !important; }

        .ff-spread {
          margin-top: 20px;
          padding: 16px;
          border-radius: 12px;
          background: #f8fafc;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        @media (max-width: 900px) {
          .ff-listItem__main { grid-template-columns: 1fr; gap: 12px; }
          .ff-listItem { flex-direction: column; align-items: flex-start; }
          .ff-listItem__status { margin-top: 12px; }
        }
      `}</style>
    </ClientLayout>
  );
}