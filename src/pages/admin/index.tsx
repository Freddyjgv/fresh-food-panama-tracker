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

const QUOTE_PATH = "/admin/quotes"; // <-- cambia si tu cotizador está en otra ruta

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
  if (["PACKED", "DOCS_READY", "DELIVERED", "CLOSED"].includes(s)) return "success";
  if (["AT_ORIGIN", "ARRIVED_PTY", "DEPARTED"].includes(s)) return "warn";
  if (["IN_TRANSIT"].includes(s)) return "info";
  if (["AT_DESTINATION"].includes(s)) return "neutral"; // “final” pero no necesariamente closed
  return "neutral";
}

function pillStyle(status: string): React.CSSProperties {
  const tone = statusTone(status);
  if (tone === "success") {
    return {
      background: "rgba(31,122,58,.10)",
      borderColor: "rgba(31,122,58,.22)",
      color: "var(--ff-green-dark)",
    };
  }
  if (tone === "warn") {
    return {
      background: "rgba(209,119,17,.12)",
      borderColor: "rgba(209,119,17,.24)",
      color: "#7a3f00",
    };
  }
  if (tone === "info") {
    return {
      background: "rgba(59,130,246,.10)",
      borderColor: "rgba(59,130,246,.22)",
      color: "rgba(30,64,175,1)",
    };
  }
  return {
    background: "rgba(15,23,42,.04)",
    borderColor: "rgba(15,23,42,.12)",
    color: "var(--ff-text)",
  };
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

    // 1) Últimos embarques (page=1 desc) + total
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
    setShipments(sJson.items?.slice(0, 6) || []);
    setShipmentsTotal(sJson.total ?? (sJson.items?.length || 0));

    // 2) Total clientes (ideal: que listClients devuelva total)
    const cRes = await fetch(`/.netlify/functions/listClients`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (cRes.ok) {
      const cJson = (await cRes.json()) as ClientsApiResponse;
      const inferredTotal =
        typeof cJson.total === "number" ? cJson.total : cJson.items?.length || 0;
      setClientsTotal(inferredTotal);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!authReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  // KPI: Activos = NO En Destino (ni finales)
  const activeShipments = useMemo(() => {
    const INACTIVE = new Set(["AT_DESTINATION", "DELIVERED", "CLOSED"]);
    return shipments.filter((s) => !INACTIVE.has(String(s.status || "").toUpperCase()))
      .length;
  }, [shipments]);

  const quick = [
    {
      title: "Cotizador",
      desc: "Genera cotizaciones rápidas (CIP/FOB/CIF) y guarda historial.",
      href: QUOTE_PATH,
      icon: <Calculator size={16} />,
      tone: "green" as const,
      cta: "Abrir",
    },
    {
      title: "Embarques",
      desc: "Crear embarques, actualizar hitos, cargar documentos y fotos.",
      href: "/admin/shipments",
      icon: <Package2 size={16} />,
      tone: "neutral" as const,
      cta: "Gestionar",
    },
    {
      title: "Clientes",
      desc: "Fichas tipo CRM: contactos, país, estado y relación con embarques.",
      href: "/admin/users",
      icon: <Users2 size={16} />,
      tone: "neutral" as const,
      cta: "Ver fichas",
    },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle="Vista general (estilo Odoo) para operar rápido.">
      {/* KPIs */}
      <div className="kpiGrid">
        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiIcon">
              <TrendingUp size={16} />
            </div>
            <div className="kpiLabel">Embarques (total)</div>
          </div>
          <div className="kpiValue">{loading ? "—" : shipmentsTotal}</div>
          <div className="kpiSub">Total en el sistema</div>
        </div>

        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiIcon">
              <Clock size={16} />
            </div>
            <div className="kpiLabel">Embarques activos</div>
          </div>
          <div className="kpiValue">{loading ? "—" : activeShipments}</div>
          <div className="kpiSub">Muestra (últimos 6) · excluye “En destino”</div>
        </div>

        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiIcon">
              <Users2 size={16} />
            </div>
            <div className="kpiLabel">Clientes</div>
          </div>
          <div className="kpiValue">{loading ? "—" : clientsTotal}</div>
          <div className="kpiSub">Contactos / empresas</div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="grid2">
        {/* Accesos + Atajos */}
        <div className="card">
          <div className="cardTitle">Accesos</div>
          <div className="cardSub">Entradas directas a los módulos principales.</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="quickGrid">
            {quick.map((q) => (
              <Link
                key={q.title}
                href={q.href}
                className={`quickCard ${q.tone === "green" ? "isGreen" : ""}`}
              >
                <div className="quickHead">
                  <div className={`quickIcon ${q.tone === "green" ? "isGreen" : ""}`}>
                    {q.icon}
                  </div>
                  <div className="quickText">
                    <div className="quickTitle">{q.title}</div>
                    <div className="quickDesc">{q.desc}</div>
                  </div>
                </div>

                <div className="quickCta">
                  <span>{q.cta}</span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="ops">
            <div className="opsTitle">Atajos operativos</div>
            <div className="opsGrid">
              <Link className="opsBtn" href="/admin/shipments">
                <PlusCircle size={16} />
                Crear embarque
              </Link>
              <Link className="opsBtn primary" href="/admin/quotes/new">
                <PlusCircle size={16} />
                Nueva cotización
              </Link>
            </div>
          </div>
        </div>

        {/* Últimos embarques (tabla compacta) */}
        <div className="card">
          <div className="spread">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">Actividad reciente para entrar en 1 click.</div>
            </div>
            <Link className="btnSmall" href="/admin/shipments">
              Ver todos
            </Link>
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
                <div style={{ textAlign: "right" }}>Status</div>
              </div>

              <div className="tbody">
                {shipments.map((s) => (
                  <Link key={s.id} href={`/admin/shipments/${s.id}`} className="trow">
                    <div className="tcode">
                      <div className="code">{s.code}</div>
                      <div className="meta">{fmtDate(s.created_at)}</div>
                    </div>

                    <div className="tclient" title={s.client_name || ""}>
                      <div className="client">{s.client_name || "—"}</div>
                      <div className="meta">{productInline(s)}</div>
                    </div>

                    <div className="tdest">{s.destination}</div>

                    <div className="tstatus" style={{ textAlign: "right" }}>
                      <span className="pill" style={pillStyle(s.status)}>
                        {labelStatus(s.status)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
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
            grid-template-columns: 1fr 1fr;
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

        /* Quick actions (más compactos) */
        .quickGrid {
          display: grid;
          gap: 8px;
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
          gap: 8px;
        }
        .quickCard:hover {
          background: rgba(15, 23, 42, 0.02);
        }
        .quickCard.isGreen {
          border-color: rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.04);
        }

        .quickHead {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          min-width: 0;
        }
        .quickIcon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(15, 23, 42, 0.03);
          flex: 0 0 auto;
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

        .quickCta {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-weight: 900;
          font-size: 12px;
          color: var(--ff-green-dark);
        }

        /* Atajos operativos */
        .opsTitle {
          font-weight: 950;
          font-size: 13px;
          letter-spacing: -0.1px;
          margin-bottom: 8px;
        }
        .opsGrid {
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 520px) {
          .opsGrid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .opsBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 36px;
          padding: 0 12px;
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
        .opsBtn:hover {
          background: rgba(15, 23, 42, 0.03);
        }
        .opsBtn.primary {
          border: 1px solid rgba(31, 122, 58, 0.35);
          background: var(--ff-green);
          color: #fff;
        }
        .opsBtn.primary:hover {
          filter: brightness(0.98);
        }

        /* Tabla compacta últimos embarques */
        .tableWrap {
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          overflow: hidden;
          background: #fff;
        }
        .thead {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr 0.7fr 0.8fr;
          gap: 10px;
          padding: 10px;
          font-size: 12px;
          font-weight: 950;
          color: var(--ff-muted);
          background: rgba(15, 23, 42, 0.02);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }

        .tbody {
          display: grid;
        }

        .trow {
          display: grid;
          grid-template-columns: 0.9fr 1.4fr 0.7fr 0.8fr;
          gap: 10px;
          padding: 10px;
          text-decoration: none;
          color: var(--ff-text);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          align-items: center;
        }
        .trow:hover {
          background: rgba(15, 23, 42, 0.02);
        }
        .trow:last-child {
          border-bottom: 0;
        }

        .code {
          font-weight: 950;
          font-size: 13px;
          letter-spacing: -0.1px;
          line-height: 18px;
        }
        .client {
          font-weight: 900;
          font-size: 12px;
          line-height: 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .meta {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tdest {
          font-weight: 900;
          font-size: 12px;
        }

        .pill {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          border: 1px solid;
          white-space: nowrap;
          display: inline-flex;
          justify-content: flex-end;
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

        /* Responsive: si está muy angosto, ocultamos la cabecera y apilamos */
        @media (max-width: 720px) {
          .thead {
            display: none;
          }
          .trow {
            grid-template-columns: 1fr;
            gap: 6px;
            align-items: flex-start;
          }
          .tstatus {
            text-align: left !important;
          }
        }
      `}</style>
    </AdminLayout>
  );
}