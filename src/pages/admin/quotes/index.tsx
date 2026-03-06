// src/pages/admin/quotes/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { 
  PlusCircle, Search, Plane, Ship, FileText, 
  CheckCircle, Clock, SortAsc, CalendarDays, 
  Package, ArrowRight, AlertCircle, TrendingUp, ChevronRight
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
} // <--- LLAVE DE CIERRE CORRECTA

const getFlag = (dest: string) => {
  if (!dest) return "📍";
  const d = dest.toUpperCase();
  const flags: Record<string, string> = {
    "AMSTERDAM": "🇳🇱", "HOLANDA": "🇳🇱", "NETHERLANDS": "🇳🇱",
    "PARIS": "🇫🇷", "FRANCIA": "🇫🇷",
    "BELGICA": "🇧🇪", "BELGIUM": "🇧🇪",
    "POLONIA": "🇵🇱", "POLAND": "🇵🇱",
    "PANAMA": "🇵🇦", "PTY": "🇵🇦",
    "ESPAÑA": "🇪🇸", "MADRID": "🇪🇸",
    "USA": "🇺🇸", "MIAMI": "🇺🇸",
    "COLOMBIA": "🇨🇴", "BOGOTA": "🇨🇴"
  };
  const found = Object.keys(flags).find(key => d.includes(key));
  return found ? flags[found] : "✈️"; 
};

export default function AdminQuotesIndex() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [items, setItems] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "client_name">("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

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
      const t = new Date().getTime();
      const url = `/.netlify/functions/listQuotes?${queryString}&t=${t}`;
      const res = await fetch(url, {
        headers: { 
          Authorization: `Bearer ${session?.access_token}`,
          "Cache-Control": "no-cache"
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
              <input placeholder="Buscar cliente o destino..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="sortSide">
            <div className="toggleGroup">
              <button className={sortField === 'created_at' ? 'active' : ''} onClick={() => { setSortField('created_at'); setDir(dir === 'desc' ? 'asc' : 'desc'); }}>
                <CalendarDays size={14} /> {dir === 'desc' && sortField === 'created_at' ? 'Recientes' : 'Fecha'}
              </button>
              <button className={sortField === 'client_name' ? 'active' : ''} onClick={() => { setSortField('client_name'); setDir(dir === 'asc' ? 'desc' : 'asc'); }}>
                <SortAsc size={14} /> A-Z
              </button>
            </div>
          </div>
        </div>

        <div className="listContainer">
          {loading && <div className="loadingState">Sincronizando con base de datos...</div>}
          {items.map((r: any) => (
            <CompactRow
              key={r.id}
              href={`/admin/quotes/${r.id}`}
              title={
                <div className="rowMainLayout">
                  <div className="leftBlock">
                    <span className="quoteIdBadge">{r.quote_number || "SIN NÚMERO"}</span>
                    <span className="clientName">{r.client_name || "Cliente No Registrado"}</span>
                  </div>

                  <div className="centerBlock">
                    <div className="routeWithFlag">
                      <span className="originText">PTY</span>
                      <span className="routeArrow">→</span>
                      <span className="destinationText">
                        {getFlag(r.destination)} {r.destination}
                      </span>
                    </div>
                    <div className="metaInfoGreyed">
                      <span>{r.boxes} cajas</span>
                      <span className="dot">•</span>
                      <span>{fmtDate(r.created_at)}</span>
                    </div>
                  </div>

                  <div className="rightBlock">
                    <div className="priceContainerVertical">
                      <span className="totalAmountBig">
                        {r.currency} {Number(r.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <StatusPill v={r.status} />
                    </div>
                    <div className="actionArrow">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .rowMainLayout {
          display: grid;
          grid-template-columns: 240px 1fr 200px; 
          align-items: center;
          width: 100%;
          padding: 8px 0;
          gap: 20px;
        }

        .leftBlock {
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .quoteIdBadge {
          background-color: #f1f5f9;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          width: fit-content;
          text-transform: uppercase;
        }

        .clientName { 
          font-weight: 700; 
          color: #0f172a; 
          font-size: 15px; 
        }

        .centerBlock {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .routeWithFlag {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }

        .originText { color: #94a3b8; }
        .routeArrow { color: #cbd5e1; }

        .metaInfoGreyed {
          display: flex;
          gap: 8px;
          font-size: 11px;
          color: #94a3b8; /* El efecto greyed out */
          font-weight: 400;
          margin-top: 4px;
        }

        .rightBlock {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 15px;
        }

        .priceContainerVertical {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .totalAmountBig {
          color: #10b981;
          font-weight: 800;
          font-size: 16px;
        }

        .actionArrow { color: #cbd5e1; }

        /* Resto de estilos del Dashboard */
        .statsGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
        .statCard { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; }
        .iconBox { padding: 10px; border-radius: 12px; }
        .iconBox.blue { background: #eff6ff; color: #3b82f6; }
        .iconBox.green { background: #f0fdf4; color: #16a34a; }
        .iconBox.slate { background: #f8fafc; color: #64748b; }
        .statLabel { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .statValue { font-size: 20px; font-weight: 900; color: #1e293b; }

        .mainCard { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
        .cardHeader { padding: 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
        .sectionTitle { font-size: 18px; font-weight: 900; color: #1e293b; }
        
        .btnNewPrimary { background: #16a34a; color: white; padding: 10px 20px; border-radius: 10px; font-weight: 800; text-decoration: none; display: flex; gap: 8px; align-items: center; }
        
        .toolbar { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; background: #fcfcfd; border-bottom: 1px solid #f1f5f9; }
        .filterSide { display: flex; gap: 12px; flex: 1; }
        .selectModern { padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; font-weight: 700; }
        .searchModern { position: relative; flex: 1; max-width: 350px; }
        .searchModern input { width: 100%; padding: 8px 8px 8px 35px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .searchIcon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); }

        .toggleGroup { display: flex; background: #f1f5f9; padding: 4px; border-radius: 10px; }
        .toggleGroup button { border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; color: #64748b; background: transparent; }
        .toggleGroup button.active { background: white; color: #1e293b; }

        .listContainer { padding: 20px 24px; display: grid; gap: 12px; }
        .statusPill { font-size: 10px; font-weight: 900; text-transform: uppercase; border-radius: 6px; border: 1px solid; padding: 2px 8px; }
        .loadingState { padding: 40px; text-align: center; color: #64748b; font-weight: 600; }
      `}</style>
    </AdminLayout>
  );
}