// src/pages/admin/quotes/[id].tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

type QuoteDetail = {
  id: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "sent" | "won" | "lost" | "archived";
  mode: "AIR" | "SEA";
  currency: "USD" | "EUR";
  destination: string;
  boxes: number;
  weight_kg?: number | null;
  margin_markup: number;
  client_snapshot?: {
    name?: string;
    contact_email?: string;
  } | null;
  totals?: Record<string, any>;
  costs?: Record<string, any>;
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PA");
}

export default function AdminQuoteDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QuoteDetail | null>(null);

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
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      setAuthOk(true);
    })();
  }, []);

  useEffect(() => {
    if (!authOk) return;
    if (typeof id !== "string") return;

    (async () => {
      setLoading(true);
      setError(null);

      const token = await getTokenOrRedirect();
      if (!token) return;

      const res = await fetch(`/.netlify/functions/getQuote?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setError(t || "No se pudo cargar la cotización");
        setLoading(false);
        return;
      }

      const json = (await res.json()) as QuoteDetail;
      setData(json);
      setLoading(false);
    })();
  }, [authOk, id]);

  if (!authOk) {
    return (
      <AdminLayout title="Cotización" subtitle="Verificando permisos…">
        <div className="ff-card2">Cargando…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Detalle de cotización" subtitle="Editor y control de estado.">
      <div className="ff-spread2" style={{ marginBottom: 12 }}>
        <Link href="/admin/quotes" className="ff-btnSmall">
          <ArrowLeft size={16} />
          Volver
        </Link>
      </div>

      <div className="ff-card2" style={{ padding: 12 }}>
        {loading ? (
          <div className="muted">Cargando…</div>
        ) : error ? (
          <div className="msgWarn">{error}</div>
        ) : data ? (
          <>
            <div style={{ fontWeight: 950, fontSize: 15 }}>
              {data.client_snapshot?.name || "Cliente sin nombre"}
            </div>

            <div className="muted" style={{ marginTop: 4 }}>
              {data.client_snapshot?.contact_email || "—"}
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="kv"><span>Estado</span><b>{data.status}</b></div>
            <div className="kv"><span>Modo</span><b>{data.mode}</b></div>
            <div className="kv"><span>Destino</span><b>{data.destination}</b></div>
            <div className="kv"><span>Moneda</span><b>{data.currency}</b></div>
            <div className="kv"><span>Cajas</span><b>{data.boxes}</b></div>
            <div className="kv"><span>Peso</span><b>{data.weight_kg ? `${data.weight_kg} kg` : "—"}</b></div>
            <div className="kv"><span>Markup</span><b>{data.margin_markup}%</b></div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="muted">
              Creada: {fmtDateTime(data.created_at)} <br />
              Última actualización: {fmtDateTime(data.updated_at)}
            </div>
          </>
        ) : null}
      </div>

      <style jsx>{`
        .kv {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid rgba(15,23,42,.06);
          font-size: 13px;
        }
        .muted {
          font-size: 12px;
          color: var(--ff-muted);
        }
        .msgWarn {
          border: 1px solid rgba(209,119,17,.35);
          background: rgba(209,119,17,.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
          font-weight: 800;
        }
      `}</style>
    </AdminLayout>
  );
}