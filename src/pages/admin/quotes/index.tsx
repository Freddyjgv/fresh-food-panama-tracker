// src/pages/admin/quotes/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { 
  ArrowUpDown, PlusCircle, Search, Plane, Ship, FileText, 
  CheckCircle, Clock, SortAsc, CalendarDays 
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { CompactRow } from "../../../components/CompactRow";

// --- TYPES ---
type QuoteRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  mode: "AIR" | "SEA";
  currency: "USD" | "EUR";
  destination: string;
  boxes: number;
  weight_kg?: number | null;
  margin_markup: number;
  client_name?: string | null;
  client_email?: string | null;
  total?: number | null;
};

type ApiResponse = {
  items: QuoteRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: { field: string; dir: "asc" | "desc" };
};

type Dir = "asc" | "desc";
type SortField = "created_at" | "client_name";

// --- HELPERS ---
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA");
  } catch {
    return iso;
  }
}

function StatusPill({ v }: { v: string }) {
  const s = String(v || "").toLowerCase();
  const tone = s === "won" ? "success" : s === "sent" ? "info" : s === "lost" ? "warn" : "neutral";

  const style: React.CSSProperties =
    tone === "success"
      ? { background: "rgba(31,122,58,.10)", borderColor: "rgba(31,122,58,.22)", color: "var(--ff-green-dark)" }
      : tone === "warn"
      ? { background: "rgba(209,119,17,.12)", borderColor: "rgba(209,119,17,.24)", color: "#7a3f00" }
      : tone === "info"
      ? { background: "rgba(59,130,246,.10)", borderColor: "rgba(59,130,246,.22)", color: "rgba(30,64,175,1)" }
      : { background: "rgba(15,23,42,.04)", borderColor: "rgba(15,23,42,.12)", color: "var(--ff-text)" };

  const label =
    s === "draft" ? "Borrador" : s === "sent" ? "Enviada" : s === "won" ? "Ganada" : s === "lost" ? "Perdida" : "Archivada";

  return <span className="statusPill" style={style}>{label}</span>;
}

export default function AdminQuotesIndex() {
  const [authOk, setAuthOk] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [items, setItems] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  
  // Nuevo Estado para Sorting Avanzado
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [dir, setDir] = useState<Dir>("desc");

  const stats = useMemo(() => ({
    drafts: items.filter(i => i.status === 'draft').length,
    won: items.filter(i => i.status === 'won').length,
    total: items.length
  }), [items]);

  async function getTokenOrRedirect() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      return null;
    }
    return token;
  }

  useEffect(() => {
    (async () => {
      setAuthChecking(true);
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      setAuthOk(true);
      setAuthChecking(false);
    })();
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("dir", dir);
    p.set("sortField", sortField); // Asegúrate que tu función soporte este parámetro
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [page, dir, sortField, status, q]);

  async function load() {
    setLoading(true);
    setError(null);
    const token = await getTokenOrRedirect();
    if (!token) return;

    try {
      const res = await fetch(`/.netlify/functions/listQuotes?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Error cargando cotizaciones");
      }
      const json = (await res.json()) as ApiResponse;
      setItems(json.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authOk) return;
    load();
  }, [authOk, queryString]);

  if (authChecking) return <AdminLayout title="Cotizaciones" subtitle="Verificando acceso…"><div className="ff-card2">Cargando…</div></AdminLayout>;
  if (!authOk) return null;

  return (
    <AdminLayout title="Cotizaciones" subtitle="Gestión comercial de exportaciones.">
      
      {/* 1. SECCIÓN DE RESUMEN (KPIs) */}
      <div className="statsGrid">
        <div className="statCard">
          <Clock size={20} className="icon draft" />
          <div className="statInfo">
            <span className="statLabel">Borradores</span>
            <span className="statValue">{stats.drafts}</span>
          </div>
        </div>
        <div className="statCard">
          <CheckCircle size={20} className="icon won" />
          <div className="statInfo">
            <span className="statLabel">Ganadas</span>
            <span className="statValue">{stats.won}</span>
          </div>
        </div>
        <div className="statCard">
          <FileText size={20} className="icon total" />
          <div className="statInfo">
            <span className="statLabel">Total Carga</span>
            <span className="statValue">{stats.total}</span>
          </div>
        </div>
      </div>

      <div className="mainCard">
        {/* HEADER CON BOTÓN VERDE FRESH FOOD */}
        <div className="cardHeader">
          <div>
            <h2 className="sectionTitle">Historial Comercial</h2>
            <p className="sectionSub">Administra y da seguimiento a tus ofertas activas.</p>
          </div>
          <Link href="/admin/quotes/new" className="btnNewPrimary">
            <PlusCircle size={18} />
            Nueva cotización
          </Link>
        </div>

        {/* TOOLBAR: FILTROS Y TOGGLE SORT (ALINEADOS) */}
        <div className="toolbar">
          <div className="filterSide">
            <select className="selectModern" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="won">Ganada</option>
              <option value="lost">Perdida</option>
              <option value="archived">Archivada</option>
            </select>

            <div className="searchModern">
              <Search size={18} className="searchIcon" />
              <input
                placeholder="Buscar cliente o destino..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          <div className="sortSide">
            <div className="toggleGroup">
              <button 
                className={sortField === 'created_at' ? 'active' : ''} 
                onClick={() => { setSortField('created_at'); setDir(dir === 'desc' ? 'asc' : 'desc'); }}
              >
                <CalendarDays size={14} />
                {sortField === 'created_at' && (dir === 'desc' ? 'Recientes ↓' : 'Antiguas ↑')}
                {sortField !== 'created_at' && 'Fecha'}
              </button>
              <button 
                className={sortField === 'client_name' ? 'active' : ''} 
                onClick={() => { setSortField('client_name'); setDir(dir === 'asc' ? 'desc' : 'asc'); }}
              >
                <SortAsc size={14} />
                Nombre {sortField === 'client_name' && (dir === 'asc' ? 'A-Z' : 'Z-A')}
              </button>
            </div>
          </div>
        </div>

        {/* LISTADO DE RESULTADOS */}
        <div className="listContainer">
          {loading && <div className="loadingState">Actualizando listado...</div>}
          
          {!loading && error && (
            <div className="msg errorMsg"><b>Error:</b> {error}</div>
          )}

          {!loading && !error && items.map((r) => (
            <CompactRow
              key={r.id}
              href={`/admin/quotes/${r.id}`}
              title={
                <div className="rowTitle">
                  <span className="clientName">{r.client_name || "Cliente sin asignar"}</span>
                  <div className="modeTag">
                    {r.mode === 'AIR' ? <Plane size={12} /> : <Ship size={12} />}
                    {r.destination}
                  </div>
                </div>
              }
              subtitle={
                <div className="rowSub">
                  <span>Cajas: <b>{r.boxes}</b></span>
                  <span className="dot">•</span>
                  <span>{fmtDate(r.created_at)}</span>
                  {r.total ? (
                    <>
                      <span className="dot">•</span>
                      <span className="price">{r.currency} {Number(r.total).toLocaleString()}</span>
                    </>
                  ) : null}
                </div>
              }
              status={<StatusPill v={r.status} />}
              actionLabel="Gestionar"
            />
          ))}

          {!loading && !error && items.length === 0 && (
            <div className="emptyState">No se encontraron cotizaciones.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .statsGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .statCard { background: white; padding: 16px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; }
        .statInfo { display: flex; flex-direction: column; }
        .statLabel { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .statValue { font-size: 18px; font-weight: 900; color: #1e293b; }
        .icon { padding: 8px; border-radius: 10px; }
        .icon.draft { background: #f1f5f9; color: #475569; }
        .icon.won { background: #f0fdf4; color: #16a34a; }
        .icon.total { background: #eff6ff; color: #3b82f6; }

        .mainCard { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden; }
        
        .cardHeader { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
        .sectionTitle { font-size: 18px; font-weight: 900; color: #1e293b; margin: 0; }
        .sectionSub { font-size: 13px; color: #64748b; margin: 2px 0 0 0; }

        .btnNewPrimary { 
          background: #1f7a3a; /* Verde FreshFood */
          color: white; 
          padding: 10px 18px; 
          border-radius: 12px; 
          font-weight: 800; 
          font-size: 13px; 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          text-decoration: none; 
          transition: all 0.2s; 
        }
        .btnNewPrimary:hover { background: #165c2b; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(31,122,58,0.2); }

        .toolbar { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #fcfcfd; border-bottom: 1px solid #f1f5f9; }
        .filterSide { display: flex; align-items: center; gap: 12px; flex: 1; }
        
        .selectModern { 
          padding: 8px 12px; 
          border-radius: 10px; 
          border: 1px solid #e2e8f0; 
          font-size: 13px; 
          font-weight: 700; 
          outline: none; 
          background: white;
          color: #475569;
          cursor: pointer;
        }

        .searchModern { 
          position: relative; 
          flex: 1; 
          max-width: 380px; 
          display: flex; 
          align-items: center; 
        }
        .searchIcon { position: absolute; left: 12px; color: #94a3b8; }
        .searchModern input { 
          width: 100%; 
          padding: 9px 12px 9px 38px; 
          border-radius: 10px; 
          border: 1px solid #e2e8f0; 
          font-size: 13px; 
          outline: none; 
          transition: border 0.2s;
        }
        .searchModern input:focus { border-color: #1f7a3a; }

        /* Sort Toggle Group */
        .sortSide { display: flex; align-items: center; }
        .toggleGroup { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; gap: 4px; }
        .toggleGroup button { 
          border: none; 
          padding: 6px 12px; 
          border-radius: 8px; 
          font-size: 11px; 
          font-weight: 800; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          gap: 6px;
          color: #64748b;
          background: transparent;
          transition: 0.2s;
          white-space: nowrap;
        }
        .toggleGroup button.active { background: white; color: #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .listContainer { padding: 16px 24px 24px 24px; display: grid; gap: 10px; }
        .rowTitle { display: flex; align-items: center; gap: 10px; }
        .clientName { font-weight: 800; color: #1e293b; }
        .modeTag { display: flex; align-items: center; gap: 4px; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 900; color: #64748b; }
        .rowSub { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; margin-top: 2px; }
        .dot { color: #cbd5e1; }
        .price { color: #1f7a3a; font-weight: 800; }
        .statusPill { font-size: 11px; font-weight: 900; border-radius: 999px; border: 1px solid; padding: 4px 12px; white-space: nowrap; }
        
        .emptyState, .loadingState { padding: 48px; text-align: center; color: #94a3b8; font-size: 14px; font-weight: 600; }
        .errorMsg { background: #fef2f2; color: #b91c1c; padding: 12px; border-radius: 10px; border: 1px solid #fee2e2; font-size: 13px; }
      `}</style>
    </AdminLayout>
  );
}