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
    "ESPAÑA": "🇪🇸", "MADRID": "🇪🇸", "BARAJAS": "🇪🇸",
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
      
      {/* 1. HEADER: 4 GRIDS DE RESUMEN (ESTILO FINO) */}
      <div className="statsGrid">
  <div className="statCard action" onClick={() => router.push('/admin/quotes/new')}>
    <div className="iconBox green"><PlusCircle size={18} strokeWidth={1.5} /></div>
    <div className="statInfo">
      <span className="statValueSmall">Nueva Cotización</span>
    </div>
  </div>
  <div className="statCard">
    <div className="iconBox blue"><TrendingUp size={18} strokeWidth={1.5} /></div>
    <div className="statInfo">
      <span className="statLabel">PIPELINE TOTAL</span>
      {/* Usamos stats.pipeline que sí existe */}
      <span className="statValue">USD {stats.pipeline?.toLocaleString() || '0'}</span>
    </div>
  </div>
  <div className="statCard">
    <div className="iconBox orange"><FileText size={18} strokeWidth={1.5} /></div>
    <div className="statInfo">
      <span className="statLabel">TOTAL</span>
      {/* Cambié .drafts por .countTotal que es lo que tienes en tu tipo */}
      <span className="statValue">{stats.countTotal || '0'}</span>
    </div>
  </div>
  <div className="statCard">
    <div className="iconBox slate"><CheckCircle size={18} strokeWidth={1.5} /></div>
    <div className="statInfo">
      <span className="statLabel">APROBADAS</span>
      {/* Cambié .approved por .countApproved según tu error de TypeScript */}
      <span className="statValue">{stats.countApproved || '0'}</span>
    </div>
  </div>
</div>

      <div className="mainCard">
        {/* 2. TOOLBAR MINIMALISTA */}
        <div className="toolbar">
          <div className="searchModern">
            <Search size={16} className="searchIcon" strokeWidth={1.5} />
            <input placeholder="Buscar cliente o destino..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="btnOutline" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
            <SortAsc size={14} /> {dir === 'desc' ? 'Recientes' : 'Antiguos'}
          </button>
        </div>

          {/* 3. LISTADO: 4 COLUMNAS (GRID MODERNO) */}
        <div className="listContainer">
          {loading ? (
            <div className="loadingState">Cargando...</div>
          ) : (
            items.map((r: any) => (
              <div key={r.id} className="rowWrapper" onClick={() => router.push(`/admin/quotes/${r.id}`)}>
                <div className="rowGrid">
                  
                  {/* COL 1: IDENTIDAD */}
                  <div className="colIdent">
                    <div className="badgeLine">
                      <span className="idBadge">{r.quote_number || r.code || 'S/N'}</span>
                      <span className="techBadge">
                        {(r.product_mode === 'Marítima' || r.mode === 'Marítima') ? <Ship size={10} strokeWidth={2} /> : <Plane size={10} strokeWidth={2} />}
                        <span style={{ marginLeft: '4px' }}>{r.boxes || 0} boxes</span>
                      </span>
                    </div>
                    <span className="clientName">{r.client_name || 'Sin nombre'}</span>
                  </div>

                  {/* COL 2: LOGÍSTICA */}
                  <div className="colLogis">
                    <div className="routeLine">
                      <span className="city">PTY</span>
                      <span className="arrow">→</span>
                      <span className="city">{getFlag(r.destination)} {r.destination}</span>
                    </div>
                  </div>

                  {/* COL 3: MONTO */}
                  <div className="colMonto">
                    <span className="priceText">
                      USD {(r.total_amount || r.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* COL 4: STATUS */}
                  <div className="colStatus">
                    <StatusPill v={r.status} />
                    <ChevronRight size={16} className="chevron" strokeWidth={1.5} />
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        /* --- FUENTES Y LAYOUT --- */
        .statsGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .statCard { background: white; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; }
        .statCard.action { border: 1px solid #dcfce7; cursor: pointer; transition: 0.2s; }
        .statCard.action:hover { background: #f0fdf4; }
        
        .iconBox { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; }
        .iconBox.green { background: #f0fdf4; color: #16a34a; }
        .iconBox.blue { background: #eff6ff; color: #3b82f6; }
        .iconBox.orange { background: #fff7ed; color: #ea580c; }
        .iconBox.slate { background: #f8fafc; color: #64748b; }

        .statLabel { font-size: 10px; font-weight: 500; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .statValue { font-size: 16px; font-weight: 500; color: #1e293b; display: block; }
        .statValueSmall { font-size: 13px; font-weight: 500; color: #16a34a; }

        .mainCard { background: white; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
        .toolbar { padding: 16px 24px; display: flex; justify-content: space-between; border-bottom: 1px solid #f8fafc; }
        
        .searchModern { 
  position: relative; 
  display: flex;
  align-items: center;
  width: 380px;
  /* Margen externo por si quieres separar TODO el buscador de otros elementos */
  margin-left: 10px; 
}

.searchIcon { 
  position: absolute; 
  /* Separamos la lupa del borde izquierdo del rectángulo gris */
  left: 14px; 
  color: #94a3b8; 
  z-index: 10;
}

.searchModern input { 
  width: 100%; 
  /* Bajamos de 60px a 40px: el texto ahora empieza a una distancia 
     estándar de la lupa, pero la lupa tiene aire a su izquierda */
  padding: 10px 16px 10px 40px; 
  border-radius: 12px; 
  border: 1px solid #e2e8f0; 
  background: #f8fafc; 
  font-size: 13.5px; 
  outline: none;
}
        .btnOutline { background: white; border: 1px solid #f1f5f9; padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 500; color: #64748b; display: flex; align-items: center; gap: 8px; cursor: pointer; }

        /* --- GRID DE 4 COLUMNAS --- */
        .listContainer { padding: 8px 0; }
        .rowWrapper { padding: 0 24px; cursor: pointer; transition: 0.1s; border-bottom: 1px solid #f8fafc; }
        .rowWrapper:hover { background: #fbfcfe; }
        .rowGrid { display: grid; grid-template-columns: 240px 1fr 140px 140px; align-items: center; padding: 14px 0; }

        .badgeLine { display: flex; gap: 6px; margin-bottom: 4px; }
        .idBadge { background: #f8fafc; color: #64748b; font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 5px; }
        .techBadge { background: #f0fdf4; color: #16a34a; font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 5px; display: flex; align-items: center; gap: 4px; }
        
        .clientName { font-size: 13.5px; font-weight: 400; color: #1e293b; }

        .routeLine { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; font-weight: 400; }
        .arrow { color: #cbd5e1; }
        
        .colMonto { text-align: right; }
        .priceText { color: #10b981; font-size: 14px; font-weight: 400; }

        .colStatus { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
        .chevron { color: #cbd5e1; }

        .loadingState { padding: 40px; text-align: center; color: #94a3b8; font-size: 13px; }
      `}</style>
    </AdminLayout>
  );
}