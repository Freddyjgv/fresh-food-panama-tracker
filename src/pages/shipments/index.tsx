import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Package, MapPin, RefreshCcw } from "lucide-react";
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
      {/* ✅ “Shell” FULL WIDTH para evitar el bloque centrado */}
      <div className="ff-client-shell">
        {/* Toolbar / Filtros */}
        <div className="ff-card ff-card-pad">
          <div className="ff-toolbar">
            <div className="ff-toolbar__left">
              <div className="ff-field">
                <MapPin size={14} color="var(--ff-muted)" />
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
                <Search size={14} color="var(--ff-muted)" />
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
                title="Ordenar por fecha"
                type="button"
              >
                <ArrowUpDown size={16} />
                Fecha {dir === "desc" ? "↓" : "↑"}
              </button>

              <button className="ff-btn ff-btn-ghost" type="button" onClick={() => fetchShipments()} title="Refrescar">
                <RefreshCcw size={16} />
                Refrescar
              </button>
            </div>
          </div>
        </div>

        <div className="ff-divider" />

        {/* Listado */}
        <div className="ff-card ff-card-pad">
          {loading && <p className="ff-sub" style={{ margin: 0 }}>Cargando…</p>}

          {!loading && errorMsg && (
            <div
              className="ff-card ff-card-pad"
              style={{
                borderColor: "rgba(209,119,17,.35)",
                background: "rgba(209,119,17,.08)",
                boxShadow: "none",
              }}
            >
              <p style={{ margin: 0, fontWeight: 800 }}>No se pudo cargar el listado</p>
              <p className="ff-sub" style={{ marginTop: 6 }}>{errorMsg}</p>
            </div>
          )}

          {!loading && !errorMsg && items.length === 0 && (
            <p className="ff-sub" style={{ margin: 0 }}>No hay embarques disponibles.</p>
          )}

          {!loading && !errorMsg && items.length > 0 && (
            <div className="ff-list">
              {items.map((s) => (
                <Link key={s.id} href={`/shipments/${s.id}`} className="ff-listItem">
                  <div className="ff-listItem__left">
                    <div className="ff-ico">
                      <Package size={15} color="var(--ff-green-dark)" />
                    </div>

                    <div className="ff-listItem__meta">
                      <div className="ff-listItem__title">{s.code}</div>
                      <div className="ff-sub">
                        {s.destination ? `Destino: ${s.destination}` : "Destino: —"} · {formatDate(s.created_at)}
                      </div>
                    </div>
                  </div>

                  <span className={statusBadgeClass(s.status)}>{labelStatus(s.status)}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Paginación */}
          {!loading && !errorMsg && totalPages > 1 && (
            <div className="ff-spread" style={{ marginTop: 12 }}>
              <div className="ff-sub">
                Página {page} de {totalPages} · Total: {total}
              </div>

              <div className="ff-row" style={{ gap: 8 }}>
                <button
                  className="ff-btn ff-btn-ghost"
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ height: 32 }}
                >
                  Anterior
                </button>

                <button
                  className="ff-btn ff-btn-ghost"
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ height: 32 }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

{/* ✅ ADN VISUAL REFINADO: Peso Tipográfico Ajustado para Elegancia */}
      <style jsx>{`
        .ff-client-shell {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* 1. Toolbar & Filtros con profundidad */
        .ff-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          padding: 4px 0;
        }

        .ff-toolbar__left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1 1 auto;
          min-width: 280px;
        }

        .ff-field {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
        }

        :global(.ff-field .ff-input) {
          height: 40px; /* Un poco más compacto */
          border: 1px solid #e2e8f0; /* Borde más sutil */
          border-radius: 10px; /* Bordes más suaves */
          padding: 0 12px 0 36px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03); /* Sombra aún más suave */
          transition: all 0.2s ease;
          font-size: 0.9rem;
        }

        :global(.ff-field .ff-input:focus) {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          outline: none;
        }

        :global(.ff-field svg) {
          position: absolute;
          left: 12px;
          z-index: 10;
        }

        /* 2. Listado de Embarques (Cards del ADN Visual) */
        .ff-list {
          display: grid;
          gap: 12px; /* Espacio más compacto entre cards */
          margin-top: 8px;
        }

        .ff-listItem {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px; /* Padding más refinado */
          border: 1px solid #f1f5f9;
          border-radius: 14px; /* Un poco menos redondeado */
          background: #ffffff;
          text-decoration: none;
          /* Sombra sutil de elevación */
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.03);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ff-listItem:hover {
          transform: translateY(-2px); /* Elevación más sutil */
          box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.06), 0 3px 6px -3px rgba(0, 0, 0, 0.04);
          border-color: #bfdbfe; /* Borde azul muy claro */
        }

        .ff-listItem__left {
          display: flex;
          align-items: center;
          gap: 16px; /* Espacio más compacto */
        }

        /* Icono de Paquete con Soft Background */
        .ff-ico {
          width: 38px; /* Un poco más compacto */
          height: 38px;
          border-radius: 10px;
          background: #f0fdf4;
          border: 1px solid #dcfce7;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        /* Título e ID de Embarque (Peso 700 para Elegancia) */
        .ff-listItem__title {
          font-size: 1.1rem; /* Ligeramente más pequeña */
          font-weight: 700; /* Negrita estándar, refinada (ADN Admin) */
          color: #1e293b; /* Gris slate oscuro */
          letter-spacing: -0.01em;
          margin-bottom: 1px;
        }

        .ff-sub {
          font-size: 0.85rem; /* Un poco más pequeña */
          color: #64748b;
          font-weight: 500;
        }

        /* 3. Badges "Soft Pill" */
        :global(.status-badge) {
          padding: 5px 12px;
          border-radius: 100px;
          font-size: 0.7rem; /* Un poco más compacta */
          font-weight: 700; /* Negrita estándar */
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border: 1px solid transparent;
        }

        /* Colores basados en tu shipmentFlow.ts (Mismo esquema visual) */
        :global(.bg-blue-100) { background: #eff6ff !important; color: #1e40af !important; border-color: #dbeafe !important; }
        :global(.bg-green-100) { background: #f0fdf4 !important; color: #166534 !important; border-color: #dcfce7 !important; }
        :global(.bg-yellow-100) { background: #fffbeb !important; color: #92400e !important; border-color: #fef3c7 !important; }

        /* 4. Paginación y Footer */
        .ff-spread {
          margin-top: 20px;
          padding: 14px;
          border-radius: 10px;
          background: #f8fafc;
        }

        :global(.ff-btn) {
          height: 36px; /* Botones más compactos */
          border-radius: 9px;
          font-weight: 600;
        }

        :global(.ff-btn-primary) {
          background: #1e293b; /* Gris slate muy oscuro (ADN Admin) */
          color: white;
          padding: 0 18px;
        }

        :global(.ff-btn-ghost) {
          color: #475569;
          padding: 0 10px;
        }

        @media (max-width: 768px) {
          .ff-listItem {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          :global(.status-badge) {
            align-self: flex-start;
          }
        }
      `}</style>
    </ClientLayout>
  );
}