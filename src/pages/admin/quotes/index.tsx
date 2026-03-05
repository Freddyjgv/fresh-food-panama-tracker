// src/pages/admin/quotes/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { 
  PlusCircle, Search, Plane, Ship, FileText, 
  CheckCircle, Clock, SortAsc, CalendarDays, 
  Package, ArrowRight, AlertCircle, TrendingUp
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { CompactRow } from "../../../components/CompactRow";

// --- TYPES ---
type QuoteRow = {
  id: string;
  quote_number?: string;
  created_at: string;
  status: string;
  mode: "AIR" | "SEA";
  currency: "USD" | "EUR";
  destination: string;
  boxes: number;
  client_name?: string | null;
  total?: number | null;
};

type ApiResponse = {
  items: QuoteRow[];
  total: number;
};

// --- HELPERS ---
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

function StatusPill({ v }: { v: string }) {
  const s = String(v || "").toLowerCase();
  const labels: Record<string, string> = {
    draft: 'Borrador', sent: 'Enviada', approved: 'Aprobada',
    rejected: 'Rechazada', expired: 'Vencida'
  };

  const colors: Record<string, any> = {
    approved: { bg: "#dcfce7", border: "#bbf7d0", text: "#166534" },
    sent: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
    rejected: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
    expired: { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412" },
    draft: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" }
  };

  const theme = colors[s] || colors.draft;
  return (
    <span className="statusPill" style={{ 
      background: theme.bg, borderColor: theme.border, color: theme.text 
    }}>
      {labels[s] || s}
    </span>
  );
}

export default function AdminQuotesIndex() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [items, setItems] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y Sort
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "client_name">("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  // KPIs Dinámicos basados en la carga actual
  const stats = useMemo(() => {
    const approved = items.filter(i => i.status === 'approved');
    const pipeline = items.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    return {
      countApproved: approved.length,
      pipeline: pipeline,
      countTotal: items.length
    };
  }, [items]);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("dir", dir);
    p.set("sortField", sortField);
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [dir, sortField, status, q]);

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. CREAMOS UN TIMESTAMP PARA ROMPER EL CACHE
      const t = new Date().getTime();
      
      // 2. AGREGAMOS EL TIMESTAMP A LA URL
      const url = `/.netlify/functions/listQuotes?${queryString}&t=${t}`;

      const res = await fetch(url, {
        headers: { 
          Authorization: `Bearer ${session?.access_token}`,
          // 3. HEADERS EXTRA PARA ASEGURAR DATOS FRESCOS
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
      });
      const json = await res.json() as ApiResponse;
      setItems(json.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authOk) load();
  }, [authOk, queryString]);

  if (!authOk) return null;

  return (
    <AdminLayout title="Cotizaciones" subtitle="Gestión comercial y pipeline de ventas.">
      
      {/* SECCIÓN DE RESUMEN (KPIs FINANCIEROS) */}
      <div className="statsGrid">
        <div className="statCard">
          <div className="iconBox blue"><TrendingUp size={20} /></div>
          <div className="statInfo">
            <span className="statLabel">Pipeline Total</span>
            <span className="statValue">USD {stats.pipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
        <div className="statCard">
          <div className="iconBox green"><CheckCircle size={20} /></div>
          <div className="statInfo">
            <span className="statLabel">Aprobadas</span>
            <span className="statValue">{stats.countApproved}</span>
          </div>
        </div>
        <div className="statCard">
          <div className="iconBox slate"><FileText size={20} /></div>
          <div className="statInfo">
            <span className="statLabel">Total Ofertas</span>
            <span className="statValue">{stats.countTotal}</span>
          </div>
        </div>
      </div>

      <div className="mainCard">
        <div className="cardHeader">
          <div>
            <h2 className="sectionTitle">Historial Comercial</h2>
            <p className="sectionSub">Seguimiento de ofertas y procesos de negociación.</p>
          </div>
          <Link href="/admin/quotes/new" className="btnNewPrimary">
            <PlusCircle size={18} /> Nueva Cotización
          </Link>
        </div>

        {/* TOOLBAR PROFESIONAL */}
        <div className="toolbar">
          <div className="filterSide">
            <select className="selectModern" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="approved">Aprobada</option>
              <option value="rejected">Rechazada</option>
            </select>

            <div className="searchModern">
              <Search size={18} className="searchIcon" />
              <input
                placeholder="Buscar cliente o destino..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="sortSide">
            <div className="toggleGroup">
              <button 
                className={sortField === 'created_at' ? 'active' : ''} 
                onClick={() => { setSortField('created_at'); setDir(dir === 'desc' ? 'asc' : 'desc'); }}
              >
                <CalendarDays size={14} /> {dir === 'desc' && sortField === 'created_at' ? 'Recientes' : 'Fecha'}
              </button>
              <button 
                className={sortField === 'client_name' ? 'active' : ''} 
                onClick={() => { setSortField('client_name'); setDir(dir === 'asc' ? 'desc' : 'asc'); }}
              >
                <SortAsc size={14} /> A-Z
              </button>
            </div>
          </div>
        </div>

        {/* LISTADO DE RESULTADOS */}
        <div className="listContainer">
  {loading && <div className="loadingState">Sincronizando con base de datos...</div>}
  
  {items.map((r: any) => (
  <CompactRow
    key={r.id}
    href={`/admin/quotes/${r.id}`}
    title={
      <div className="rowMainLayout">
        {/* COLUMNA 1: IDENTIFICACIÓN (240px según tu CSS) */}
        <div className="idAndClient">
          <div className="quoteIdBadge">{r.quote_number || "S/N"}</div>
          <span className="clientName">{r.client_name || "Sin Cliente"}</span>
        </div>

        {/* COLUMNA 2: LOGÍSTICA (1fr - ocupa el centro) */}
        <div className="logisticsInfo">
          <div className="routeTag">
             <span>PTY</span>
             <span style={{ margin: '0 8px', opacity: 0.5 }}>→</span>
             <span>{r.destination || 'TBD'}</span>
          </div>
          <div className="rowSub">
            <span>{r.boxes} Cajas</span>
            <span style={{ margin: '0 4px' }}>•</span>
            <span>{fmtDate(r.created_at)}</span>
          </div>
        </div>

        {/* COLUMNA 3: FINANZAS (auto - se pega a la derecha) */}
        <div className="rightSide">
          <div className="totalAmount">
            {r.total && Number(r.total) > 0 
              ? `${r.currency} ${Number(r.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
              : "Pendiente"}
          </div>
          
          <StatusPill v={r.status} />

          <div className="editAction">
             {/* Flecha simple para edición limpia */}
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </div>
      </div>
    }
    /* Dejamos estos vacíos para que no interfieran con nuestro layout grid */
    subtitle={null}
    status={null}
    actionLabel={null}
  />
))}
</div>
      </div>

      <style jsx>{`
    .idAndClient {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quoteIdBadge {
  background: #f1f5f9;
  color: #64748b;
  font-family: monospace;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}

.clientName {
  font-weight: 700;
  color: #1e293b;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logisticsInfo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.routeTag {
  font-weight: 600;
  color: #475569;
  font-size: 14px;
}

.rowSub {
  font-size: 12px;
  color: #94a3b8;
}
        .statsGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
        .statCard { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .iconBox { padding: 10px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .iconBox.blue { background: #eff6ff; color: #3b82f6; }
        .iconBox.green { background: #f0fdf4; color: #16a34a; }
        .iconBox.slate { background: #f8fafc; color: #64748b; }
        .statLabel { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .statValue { font-size: 20px; font-weight: 900; color: #1e293b; display: block; margin-top: 2px; }

        .mainCard { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden; }
        .cardHeader { padding: 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
        .sectionTitle { font-size: 18px; font-weight: 900; color: #1e293b; margin: 0; }
        .sectionSub { font-size: 13px; color: #64748b; margin-top: 2px; }

        .btnNewPrimary { background: #16a34a; color: white; padding: 10px 20px; border-radius: 10px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; text-decoration: none; transition: 0.2s; }
        .btnNewPrimary:hover { background: #15803d; transform: translateY(-1px); }

        .toolbar { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; background: #fcfcfd; border-bottom: 1px solid #f1f5f9; }
        .filterSide { display: flex; align-items: center; gap: 12px; flex: 1; }
        .selectModern { padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #475569; outline: none; cursor: pointer; }
        .searchModern { position: relative; flex: 1; max-width: 350px; }
        .searchIcon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .searchModern input { width: 100%; padding: 9px 12px 9px 38px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; outline: none; }
        .searchModern input:focus { border-color: #16a34a; }

        .toggleGroup { display: flex; background: #f1f5f9; padding: 4px; border-radius: 10px; gap: 4px; }
        .toggleGroup button { border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; color: #64748b; background: transparent; }
        .toggleGroup button.active { background: white; color: #1e293b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .listContainer { padding: 20px 24px; display: grid; gap: 12px; }
        .rowMainLayout { display: flex; align-items: center; gap: 20px; }
        .quoteIdBadge {
  background: #1e293b;
  color: #ffffff;
  padding: 4px 12px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 11px;
  font-weight: 700;
  min-width: 120px; /* Un poco más ancho para el nuevo formato */
  text-align: center;
  letter-spacing: 0.5px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
}

.noPrice {
  color: #94a3b8;
  font-style: italic;
  font-size: 11px;
}
        .clientName { font-weight: 800; color: #1e293b; font-size: 15px; }
        .routeTag { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; }
        
        .rowSub { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #64748b; margin-top: 4px; }
        .dataItem { display: flex; align-items: center; gap: 4px; }
        .totalAmount { color: #16a34a; font-weight: 900; font-size: 13px; }
        .dot { color: #cbd5e1; }
        
        .statusPill { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 6px; border: 1px solid; padding: 4px 10px; }
        .emptyState { padding: 60px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .loadingState { padding: 40px; text-align: center; color: #64748b; font-weight: 600; }
      `}</style>
    </AdminLayout>
  );
}