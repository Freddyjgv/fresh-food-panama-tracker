// src/pages/admin/quotes/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, PlusCircle, Search } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

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

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA");
  } catch {
    return iso;
  }
}

function StatusPill({ v }: { v: string }) {
  const s = String(v || "").toLowerCase();
  const tone =
    s === "won" ? "success" : s === "sent" ? "info" : s === "lost" ? "warn" : "neutral";

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

  return (
    <span
      style={{
        ...style,
        fontSize: 12,
        fontWeight: 900,
        borderRadius: 999,
        border: "1px solid",
        padding: "6px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function AdminQuotesIndex() {
  const [authOk, setAuthOk] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [items, setItems] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dir, setDir] = useState<Dir>("desc");
  const [page, setPage] = useState(1);

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
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [page, dir, status, q]);

  async function load() {
    setLoading(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch(`/.netlify/functions/listQuotes?${queryString}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      setError(t || "Error cargando cotizaciones");
      setLoading(false);
      return;
    }

    const json = (await res.json()) as ApiResponse;
    setItems(json.items || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!authOk) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOk, queryString]);

  if (authChecking) {
    return (
      <AdminLayout title="Cotizaciones" subtitle="Verificando acceso…">
        <div className="ff-card2">Cargando…</div>
      </AdminLayout>
    );
  }
  if (!authOk) return null;

  return (
    <AdminLayout title="Cotizaciones" subtitle="Cotizador + historial tipo CRM (Odoo).">
      <div className="ff-card2" style={{ padding: 12 }}>
        <div className="ff-spread2">
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "-.2px" }}>
              Listado <span style={{ marginLeft: 8, color: "var(--ff-muted)", fontWeight: 800 }}>({items.length})</span>
            </div>
            <div style={{ marginTop: 2, color: "var(--ff-muted)", fontSize: 12 }}>
              Borradores, enviadas y ganadas/perdidas.
            </div>
          </div>

          <Link className="ff-primary" href="/admin/quotes/new">
            <PlusCircle size={16} />
            Nueva cotización
          </Link>
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        <div className="row3" style={{ gridTemplateColumns: "1fr 1.2fr auto auto" }}>
          <select className="in2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="sent">Enviada</option>
            <option value="won">Ganada</option>
            <option value="lost">Perdida</option>
            <option value="archived">Archivada</option>
          </select>

          <div className="inputIcon">
            <Search size={16} />
            <input
              className="in2"
              style={{ border: 0, height: 36, padding: 0 }}
              placeholder="Buscar por destino o cliente…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <button
            className="ff-btnSmall"
            type="button"
            onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
          >
            <ArrowUpDown size={16} />
            Fecha {dir === "desc" ? "↓" : "↑"}
          </button>

          <button className="ff-primary" type="button" onClick={() => setPage(1)}>
            Aplicar
          </button>
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        {loading ? <div style={{ color: "var(--ff-muted)", fontSize: 12 }}>Cargando…</div> : null}
        {!loading && error ? (
          <div className="msg" style={{ borderColor: "rgba(209,119,17,.35)", background: "rgba(209,119,17,.08)" }}>
            <b style={{ display: "block", marginBottom: 4 }}>No se pudo cargar</b>
            <span style={{ color: "var(--ff-muted)" }}>{error}</span>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div style={{ color: "var(--ff-muted)", fontSize: 12 }}>No hay cotizaciones.</div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((r) => (
              <Link
                key={r.id}
                href={`/admin/quotes/${r.id}`}
                className="ff-row2"
                style={{
                  padding: "10px 10px",
                  border: "1px solid var(--ff-border)",
                  background: "var(--ff-surface)",
                  borderRadius: "var(--ff-radius)",
                  textDecoration: "none",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, lineHeight: "18px" }}>
                    {r.client_name || "Cliente (sin asignar)"}
                    <span style={{ marginLeft: 8, color: "var(--ff-muted)", fontWeight: 800 }}>
                      · {r.mode} · {r.destination} · {r.currency}
                    </span>
                  </div>
                  <div style={{ marginTop: 2, color: "var(--ff-muted)", fontSize: 12 }}>
                    Cajas: <b>{r.boxes}</b> · Creada: {fmtDate(r.created_at)}
                  </div>
                </div>

                <StatusPill v={r.status} />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .row3 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .row3 {
            grid-template-columns: 1fr 1.2fr auto auto;
          }
        }
        .inputIcon {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--ff-border);
          background: #fff;
          padding: 0 10px;
          border-radius: var(--ff-radius);
          height: 38px;
        }
        .in2 {
          width: 100%;
          height: 38px;
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          padding: 0 10px;
          font-size: 13px;
          outline: none;
          background: #fff;
        }
        .ff-btnSmall {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--ff-border);
          background: #fff;
          border-radius: var(--ff-radius);
          height: 34px;
          padding: 0 10px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
          text-decoration: none;
          color: var(--ff-text);
          white-space: nowrap;
        }
        .ff-btnSmall:hover {
          background: rgba(15, 23, 42, 0.03);
        }
        .ff-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(31, 122, 58, 0.35);
          background: var(--ff-green);
          color: #fff;
          border-radius: var(--ff-radius);
          height: 36px;
          padding: 0 12px;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
          text-decoration: none;
        }
        .msg {
          border: 1px solid rgba(31, 122, 58, 0.3);
          background: rgba(31, 122, 58, 0.08);
          border-radius: var(--ff-radius);
          padding: 10px;
          font-weight: 800;
          font-size: 12px;
        }
      `}</style>
    </AdminLayout>
  );
}