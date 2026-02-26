// src/pages/admin/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Calculator,
  Package2,
  Users2,
  ArrowRight,
  TrendingUp,
  Clock,
  PlusCircle,
  FileText,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { labelStatus } from "../../lib/shipmentFlow";

type ShipmentListItem = {
  id: string;
  code: string;
  destination: string;
  status: string;
  created_at: string;
  client_name?: string | null;
  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;
};

type ShipmentsApiResponse = {
  items: ShipmentListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: { field: string; dir: "asc" | "desc" };
};

type ClientListItem = {
  id: string;
  name: string;
  contact_email: string;
  contact_name?: string | null;
  phone?: string | null;
  status?: string | null;
  country?: string | null;
};

type ClientsApiResponse = {
  items: ClientListItem[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
};

const QUOTE_PATH = "/admin/quotes";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function productInline(s: ShipmentListItem) {
  const name = (s.product_name || "").trim() || "Piña";
  const variety = (s.product_variety || "").trim() || "MD2 Golden";
  const mode = (s.product_mode || "").trim() || "Aérea";
  return `${name} · ${variety} · ${mode}`;
}

function statusTone(status: string): "neutral" | "success" | "warn" | "info" {
  const s = String(status || "").toUpperCase();
  // Ajusta si tu flujo usa otros nombres:
  if (["AT_DESTINATION", "DELIVERED", "CLOSED", "DOCS_READY", "PACKED"].includes(s)) return "success";
  if (["AT_ORIGIN", "ARRIVED_PTY", "DEPARTED"].includes(s)) return "warn";
  if (["IN_TRANSIT"].includes(s)) return "info";
  return "neutral";
}

function StatusPill({ status }: { status: string }) {
  const tone = statusTone(status);
  const style: React.CSSProperties =
    tone === "success"
      ? { background: "rgba(31,122,58,.10)", borderColor: "rgba(31,122,58,.22)", color: "var(--ff-green-dark)" }
      : tone === "warn"
      ? { background: "rgba(209,119,17,.12)", borderColor: "rgba(209,119,17,.24)", color: "#7a3f00" }
      : tone === "info"
      ? { background: "rgba(59,130,246,.10)", borderColor: "rgba(59,130,246,.22)", color: "rgba(30,64,175,1)" }
      : { background: "rgba(15,23,42,.04)", borderColor: "rgba(15,23,42,.12)", color: "var(--ff-text)" };

  return (
    <span
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: "1px solid",
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {labelStatus(status)}
    </span>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);

  const [clientsTotal, setClientsTotal] = useState<number>(0);

  const [err, setErr] = useState<string | null>(null);

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
      setAuthReady(true);
    })();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    // 1) Últimos embarques + total
    const qs = new URLSearchParams();
    qs.set("page", "1");
    qs.set("dir", "desc");
    qs.set("mode", "admin");

    const sRes = await fetch(`/.netlify/functions/listShipments?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!sRes.ok) {
      const t = await sRes.text().catch(() => "");
      setErr(t || "No se pudieron cargar embarques");
      setLoading(false);
      return;
    }

    const sJson = (await sRes.json()) as ShipmentsApiResponse;
    setShipments(sJson.items?.slice(0, 8) || []); // un poco más, pero en tabla compacta no molesta
    setShipmentsTotal(sJson.total ?? (sJson.items?.length || 0));

    // 2) Total clientes
    const cRes = await fetch(`/.netlify/functions/listClients`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (cRes.ok) {
      const cJson = (await cRes.json()) as ClientsApiResponse;
      const inferredTotal = typeof cJson.total === "number" ? cJson.total : (cJson.items?.length || 0);
      setClientsTotal(inferredTotal);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!authReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  // Activos: TODO lo que NO esté "En destino"
  const activeShipments = useMemo(() => {
    const isDone = (s: string) => {
      const u = String(s || "").toUpperCase();
      // “En destino” + estados finales fuera de activos:
      return ["AT_DESTINATION", "DELIVERED", "CLOSED"].includes(u);
    };
    return shipments.filter((x) => !isDone(x.status)).length;
  }, [shipments]);

  const quickCards = [
    {
      title: "Cotizador",
      desc: "Cotizaciones rápidas (CIP/FOB/CIF) + historial.",
      href: QUOTE_PATH,
      icon: <Calculator size={16} />,
      tone: "green" as const,
    },
    {
      title: "Embarques",
      desc: "Hitos, documentos, fotos y seguimiento.",
      href: "/admin/shipments",
      icon: <Package2 size={16} />,
      tone: "neutral" as const,
    },
    {
      title: "Clientes",
      desc: "Fichas tipo CRM, contactos y país.",
      href: "/admin/users",
      icon: <Users2 size={16} />,
      tone: "neutral" as const,
    },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle="Vista general para operar rápido.">
      {/* KPIs */}
      <div className="kpiGrid">
        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiIcon">
              <TrendingUp size={16} />
            </div>
            <div className="kpiLabel">Embarques</div>
          </div>
          <div className="kpiValue">{loading ? "—" : shipmentsTotal}</div>
          <div className="kpiSub">Total en el sistema</div>
        </div>

        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiIcon">
              <Clock size={16} />
            </div>
            <div className="kpiLabel">Activos</div>
          </div>
          <div className="kpiValue">{loading ? "—" : activeShipments}</div>
          <div className="kpiSub">Excluye “En destino”</div>
        </div>

        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiIcon">
              <Users2 size={16} />
            </div>
            <div className="kpiLabel">Clientes</div>
          </div>
          <div className="kpiValue">{loading ? "—" : clientsTotal}</div>
          <div className="kpiSub">Empresas / contactos</div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="grid2">
        {/* Accesos + Atajos */}
        <div className="card">
          <div className="cardTitle">Accesos</div>
          <div className="cardSub">Entradas directas a los módulos.</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="quickGrid">
            {quickCards.map((q) => (
              <Link key={q.title} href={q.href} className={`quickCard ${q.tone === "green" ? "isGreen" : ""}`}>
                <div className={`quickIcon ${q.tone === "green" ? "isGreen" : ""}`}>{q.icon}</div>
                <div className="quickText">
                  <div className="quickTitle">{q.title}</div>
                  <div className="quickDesc">{q.desc}</div>
                </div>
                <div className="quickArrow">
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="cardTitle" style={{ fontSize: 13 }}>Atajos operativos</div>
          <div className="cardSub">Acciones típicas de 1 click.</div>

          <div style={{ height: 10 }} />

          <div className="actionsGrid">
            <Link href="/admin/shipments" className="actionBtn">
              <PlusCircle size={16} />
              <span>Crear embarque</span>
            </Link>

            <Link href="/admin/quotes/new" className="actionBtn isGreen">
              <FileText size={16} />
              <span>Nueva cotización</span>
            </Link>
          </div>
        </div>

        {/* Últimos embarques compactos */}
        <div className="card">
          <div className="spread">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">Compacto, escaneable, 1 click para entrar.</div>
            </div>

            <div className="spreadRight">
              <button className="btnGhost" type="button" onClick={() => load()} disabled={loading}>
                {loading ? "Actualizando…" : "Actualizar"}
              </button>
              <Link className="btnSmall" href="/admin/shipments">
                Ver todos
              </Link>
            </div>
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          {loading ? (
            <div className="muted">Cargando…</div>
          ) : err ? (
            <div className="msgWarn">
              <b>Error</b>
              <div>{err}</div>
            </div>
          ) : shipments.length ? (
            <div className="tableWrap">
              <div className="thead">
                <div>Código</div>
                <div>Cliente</div>
                <div>Destino</div>
                <div>Producto</div>
                <div>Fecha</div>
                <div style={{ textAlign: "right" }}>Status</div>
              </div>

              {shipments.map((s) => (
                <Link key={s.id} href={`/admin/shipments/${s.id}`} className="trow" title="Abrir embarque">
                  <div className="codeCell">{s.code}</div>
                  <div className="cell ellipsis">{s.client_name || "—"}</div>
                  <div className="cell">{s.destination}</div>
                  <div className="cell ellipsis">{productInline(s)}</div>
                  <div className="cell">{fmtDate(s.created_at)}</div>
                  <div className="cell" style={{ textAlign: "right" }}>
                    <StatusPill status={s.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="muted">Aún no hay embarques.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .kpiGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 980px) {
          .kpiGrid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .kpiCard {
          background: var(--ff-surface);
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          box-shadow: var(--ff-shadow);
          padding: 12px;
        }
        .kpiTop {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .kpiIcon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(15, 23, 42, 0.03);
        }
        .kpiLabel {
          font-weight: 900;
          font-size: 12px;
          color: var(--ff-muted);
          letter-spacing: -0.1px;
        }
        .kpiValue {
          margin-top: 8px;
          font-weight: 950;
          font-size: 24px;
          letter-spacing: -0.5px;
          line-height: 28px;
        }
        .kpiSub {
          margin-top: 4px;
          font-size: 12px;
          color: var(--ff-muted);
        }

        .grid2 {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1100px) {
          .grid2 {
            grid-template-columns: 1fr 1.2fr;
          }
        }

        .card {
          background: var(--ff-surface);
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          box-shadow: var(--ff-shadow);
          padding: 12px;
        }
        .cardTitle {
          font-weight: 950;
          font-size: 14px;
          letter-spacing: -0.2px;
        }
        .cardSub {
          margin-top: 4px;
          font-size: 12px;
          color: var(--ff-muted);
        }

        .spread {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .spreadRight {
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }

        .btnSmall {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 10px;
          border-radius: var(--ff-radius);
          border: 1px solid var(--ff-border);
          background: #fff;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          color: var(--ff-text);
          text-decoration: none;
          white-space: nowrap;
        }
        .btnSmall:hover {
          background: rgba(15, 23, 42, 0.03);
        }

        .btnGhost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 10px;
          border-radius: var(--ff-radius);
          border: 1px dashed rgba(15, 23, 42, 0.18);
          background: rgba(15, 23, 42, 0.02);
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          color: var(--ff-text);
          white-space: nowrap;
        }
        .btnGhost:hover {
          background: rgba(15, 23, 42, 0.04);
        }
        .btnGhost:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .quickGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }

        .quickCard {
          text-decoration: none;
          color: var(--ff-text);
          border: 1px solid var(--ff-border);
          background: #fff;
          border-radius: var(--ff-radius);
          padding: 10px;
          display: grid;
          grid-template-columns: 36px 1fr 18px;
          align-items: center;
          gap: 10px;
        }
        .quickCard:hover {
          background: rgba(15, 23, 42, 0.02);
        }
        .quickCard.isGreen {
          border-color: rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.04);
        }
        .quickIcon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(15, 23, 42, 0.03);
        }
        .quickIcon.isGreen {
          border-color: rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.08);
          color: var(--ff-green-dark);
        }
        .quickText {
          min-width: 0;
        }
        .quickTitle {
          font-weight: 950;
          font-size: 13px;
          letter-spacing: -0.1px;
          line-height: 18px;
        }
        .quickDesc {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          line-height: 16px;
        }
        .quickArrow {
          color: rgba(15, 23, 42, 0.45);
          display: grid;
          place-items: center;
        }

        .actionsGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .actionsGrid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .actionBtn {
          text-decoration: none;
          color: var(--ff-text);
          border: 1px solid var(--ff-border);
          background: #fff;
          border-radius: var(--ff-radius);
          padding: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 950;
          font-size: 12px;
          min-height: 44px;
        }
        .actionBtn:hover {
          background: rgba(15, 23, 42, 0.02);
        }
        .actionBtn.isGreen {
          border-color: rgba(31, 122, 58, 0.24);
          background: rgba(31, 122, 58, 0.08);
          color: var(--ff-green-dark);
        }

        .tableWrap {
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          overflow: hidden;
          background: #fff;
        }

        .thead {
          display: grid;
          grid-template-columns: 1.1fr 1.2fr 0.5fr 1.5fr 0.7fr 0.8fr;
          gap: 10px;
          padding: 10px;
          font-size: 12px;
          font-weight: 950;
          color: var(--ff-muted);
          background: rgba(15, 23, 42, 0.02);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }

        .trow {
          display: grid;
          grid-template-columns: 1.1fr 1.2fr 0.5fr 1.5fr 0.7fr 0.8fr;
          gap: 10px;
          padding: 10px;
          text-decoration: none;
          color: var(--ff-text);
          align-items: center;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }
        .trow:last-child {
          border-bottom: 0;
        }
        .trow:hover {
          background: rgba(15, 23, 42, 0.02);
        }

        .cell {
          font-size: 12px;
          min-width: 0;
        }
        .codeCell {
          font-size: 12px;
          font-weight: 950;
          letter-spacing: -0.1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ellipsis {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .muted {
          font-size: 12px;
          color: var(--ff-muted);
        }

        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
        }

        /* Responsive: en pantallas pequeñas reducimos columnas */
        @media (max-width: 980px) {
          .thead {
            display: none;
          }
          .trow {
            grid-template-columns: 1fr;
            gap: 6px;
          }
          .trow > div:nth-child(2),
          .trow > div:nth-child(4),
          .trow > div:nth-child(5) {
            color: var(--ff-muted);
          }
          .trow > div:last-child {
            text-align: left !important;
          }
        }
      `}</style>
    </AdminLayout>
  );
}