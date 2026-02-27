// src/pages/admin/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Package2,
  Users2,
  ArrowRight,
  TrendingUp,
  Clock,
  PlusCircle,
  Truck,
  Plane,
  Ship,
  FileText,
  MapPin,
  CheckCircle2,
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

function fmtDateShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function fmtDateTiny(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", { year: "numeric", month: "short", day: "2-digit" });
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

function badgeTone(status: string): "neutral" | "success" | "warn" | "info" {
  const s = (status || "").toUpperCase();
  if (["PACKED", "DOCS_READY", "AT_DESTINATION", "DELIVERED", "CLOSED"].includes(s)) return "success";
  if (["AT_ORIGIN", "ARRIVED_PTY", "DEPARTED"].includes(s)) return "warn";
  if (["IN_TRANSIT"].includes(s)) return "info";
  return "neutral";
}

/**
 * 👇 Iconos compactos por hito/estado.
 * Si ya tienes “imágenes” en el detalle del embarque (iconos por hito),
 * puedes sustituir este mapping por el mismo helper/componente del detalle.
 */
function statusIcon(status: string) {
  const s = (status || "").toUpperCase();

  if (s === "CREATED") return <PlusCircle size={16} />;
  if (s === "PACKED") return <Package2 size={16} />;
  if (s === "DOCS_READY") return <FileText size={16} />;
  if (s === "AT_ORIGIN") return <Truck size={16} />;
  if (s === "ARRIVED_PTY") return <MapPin size={16} />;
  if (s === "DEPARTED") return <Plane size={16} />;
  if (s === "IN_TRANSIT") return <Ship size={16} />;
  if (s === "AT_DESTINATION") return <MapPin size={16} />;
  if (s === "DELIVERED" || s === "CLOSED") return <CheckCircle2 size={16} />;

  return <Package2 size={16} />;
}

function StatusMini({ status }: { status: string }) {
  const tone = badgeTone(status);

  const style: React.CSSProperties =
    tone === "success"
      ? { background: "rgba(31,122,58,.10)", borderColor: "rgba(31,122,58,.22)", color: "var(--ff-green-dark)" }
      : tone === "warn"
      ? { background: "rgba(209,119,17,.12)", borderColor: "rgba(209,119,17,.24)", color: "#7a3f00" }
      : tone === "info"
      ? { background: "rgba(59,130,246,.10)", borderColor: "rgba(59,130,246,.22)", color: "rgba(30,64,175,1)" }
      : { background: "rgba(15,23,42,.04)", borderColor: "rgba(15,23,42,.12)", color: "var(--ff-text)" };

  return (
    <span className="statusChip" style={style} title={labelStatus(status)}>
      <span className="statusIco" aria-hidden="true">
        {statusIcon(status)}
      </span>
      <span className="statusTxt">{labelStatus(status)}</span>
    </span>
  );
}

export default function AdminDashboard() {
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
    setShipments(sJson.items?.slice(0, 8) || []);
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

  // ✅ “Activos” = NO En Destino (ni delivered/closed)
  const activeShipments = useMemo(() => {
    const inactive = new Set(["AT_DESTINATION", "DELIVERED", "CLOSED"]);
    return shipments.filter((s) => !inactive.has(String(s.status || "").toUpperCase())).length;
  }, [shipments]);

  return (
    <AdminLayout title="Dashboard" subtitle="Control operativo rápido (compacto + accionable).">
      {/* KPIs (compactos) */}
      <div className="kpiRow">
        <div className="kpi">
          <div className="kpiTop">
            <span className="kpiIco">
              <TrendingUp size={16} />
            </span>
            <span className="kpiLbl">Embarques</span>
          </div>
          <div className="kpiVal">{loading ? "—" : shipmentsTotal}</div>
          <div className="kpiSub">Total en sistema</div>
        </div>

        <div className="kpi">
          <div className="kpiTop">
            <span className="kpiIco">
              <Clock size={16} />
            </span>
            <span className="kpiLbl">Activos</span>
          </div>
          <div className="kpiVal">{loading ? "—" : activeShipments}</div>
          <div className="kpiSub">Excluye “En destino”</div>
        </div>

        <div className="kpi">
          <div className="kpiTop">
            <span className="kpiIco">
              <Users2 size={16} />
            </span>
            <span className="kpiLbl">Clientes</span>
          </div>
          <div className="kpiVal">{loading ? "—" : clientsTotal}</div>
          <div className="kpiSub">Empresas/contactos</div>
        </div>
      </div>

      <div style={{ height: 10 }} />

      {/* 70/30 */}
      <div className="gridMain">
        {/* LEFT: Últimos embarques (compact table) */}
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">Click para abrir. Diseño denso (tipo Odoo/ERP).</div>
            </div>
            <div className="headActions">
              <button className="ghostBtn" type="button" onClick={() => load()} title="Refrescar">
                Refrescar
              </button>
              <Link className="ghostBtn" href="/admin/shipments">
                Ver todos <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div className="divider" />

          {loading ? (
            <div className="muted">Cargando…</div>
          ) : err ? (
            <div className="msgWarn">
              <b>Error</b>
              <div>{err}</div>
            </div>
          ) : shipments.length ? (
            <div className="tableWrap">
              <div className="table">
                <div className="thead">
                  <div>Código</div>
                  <div>Cliente</div>
                  <div>Destino</div>
                  <div className="thRight">Estado</div>
                </div>

                {shipments.map((s) => (
                  <Link key={s.id} href={`/admin/shipments/${s.id}`} className="tr">
                    <div className="td codeCell">
                      <div className="code">{s.code}</div>
                      <div className="tiny">{fmtDateTiny(s.created_at)}</div>
                    </div>

                    <div className="td">
                      <div className="client">{s.client_name || "—"}</div>
                      <div className="tiny ellip">{productInline(s)}</div>
                    </div>

                    <div className="td dest">
                      <span className="destPill">{s.destination}</span>
                      <span className="tiny">{fmtDateShort(s.created_at)}</span>
                    </div>

                    <div className="td tdRight">
                      <StatusMini status={s.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="muted">Aún no hay embarques.</div>
          )}
        </div>

        {/* RIGHT: Acciones rápidas + módulos compactos */}
        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="cardSub">Botones visibles para operar sin pensar.</div>

          <div className="divider" />

          <div className="btnStack">
            <Link className="primaryBtn" href="/admin/shipments">
              <PlusCircle size={16} />
              Crear embarque
            </Link>

            <Link className="primaryBtn" href="/admin/quotes/new">
              <PlusCircle size={16} />
              Nueva cotización
            </Link>

            <div className="btnGrid">
              <Link className="ghostBig" href="/admin/shipments">
                <Package2 size={16} />
                Embarques
              </Link>
              <Link className="ghostBig" href={QUOTE_PATH}>
                <Calculator size={16} />
                Cotizador
              </Link>
              <Link className="ghostBig" href="/admin/users">
                <Users2 size={16} />
                Clientes
              </Link>
              <Link className="ghostBig" href="/admin/quotes">
                <FileText size={16} />
                Historial
              </Link>
            </div>
          </div>

          <div className="divider" style={{ marginTop: 12 }} />

          <div className="miniHint">
            Tip: este panel está diseñado para que **todo sea 1 click**. Si quieres, luego agregamos “Pendientes” (docs/fotos)
            por embarque.
          </div>
        </div>
      </div>

      <style jsx>{`
        .divider {
          height: 1px;
          background: rgba(15, 23, 42, 0.08);
          margin: 10px 0;
        }

        /* KPIs compactos */
        .kpiRow {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 980px) {
          .kpiRow {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .kpi {
          background: var(--ff-surface);
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          box-shadow: var(--ff-shadow);
          padding: 10px 12px;
          position: relative;
          overflow: hidden;
        }
        .kpi:before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(800px 200px at 20% 0%, rgba(31, 122, 58, 0.10), transparent 60%);
          pointer-events: none;
        }
        .kpiTop {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
        }
        .kpiIco {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          border: 1px solid rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.08);
          color: var(--ff-green-dark);
        }
        .kpiLbl {
          font-weight: 950;
          font-size: 12px;
          color: var(--ff-muted);
          letter-spacing: -0.1px;
        }
        .kpiVal {
          margin-top: 8px;
          font-weight: 950;
          font-size: 26px;
          letter-spacing: -0.6px;
          line-height: 28px;
          position: relative;
        }
        .kpiSub {
          margin-top: 4px;
          font-size: 12px;
          color: var(--ff-muted);
          position: relative;
        }

        /* Main grid 70/30 */
        .gridMain {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1100px) {
          .gridMain {
            grid-template-columns: 1.6fr 0.9fr;
            align-items: start;
          }
        }

        .card {
          background: var(--ff-surface);
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          box-shadow: var(--ff-shadow);
          padding: 12px;
        }
        .cardHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
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
        .headActions {
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }

        /* Buttons */
        .primaryBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid rgba(31, 122, 58, 0.35);
          background: var(--ff-green);
          color: #fff;
          border-radius: var(--ff-radius);
          height: 38px;
          padding: 0 12px;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
          text-decoration: none;
        }
        .primaryBtn:hover {
          filter: brightness(0.98);
        }
        .ghostBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--ff-border);
          background: #fff;
          border-radius: var(--ff-radius);
          height: 34px;
          padding: 0 10px;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
          text-decoration: none;
          color: var(--ff-text);
          white-space: nowrap;
        }
        .ghostBtn:hover {
          background: rgba(15, 23, 42, 0.03);
        }

        .btnStack {
          display: grid;
          gap: 10px;
        }
        .btnGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr 1fr;
        }
        .ghostBig {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--ff-border);
          background: #fff;
          border-radius: var(--ff-radius);
          height: 40px;
          padding: 0 12px;
          font-weight: 950;
          font-size: 12px;
          cursor: pointer;
          text-decoration: none;
          color: var(--ff-text);
          white-space: nowrap;
        }
        .ghostBig:hover {
          background: rgba(15, 23, 42, 0.03);
        }

        .miniHint {
          font-size: 12px;
          color: var(--ff-muted);
          line-height: 16px;
        }

        /* Compact table */
        .tableWrap {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: var(--ff-radius);
          overflow: hidden;
          background: #fff;
        }
        .table {
          display: grid;
        }
        .thead {
          display: grid;
          grid-template-columns: 1.1fr 1.5fr 0.7fr 0.9fr;
          gap: 0;
          padding: 10px 10px;
          font-size: 12px;
          font-weight: 950;
          color: var(--ff-muted);
          background: rgba(15, 23, 42, 0.02);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }
        .thRight {
          text-align: right;
        }

        .tr {
          display: grid;
          grid-template-columns: 1.1fr 1.5fr 0.7fr 0.9fr;
          gap: 0;
          padding: 10px 10px;
          text-decoration: none;
          color: var(--ff-text);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          align-items: center;
        }
        .tr:hover {
          background: rgba(31, 122, 58, 0.04);
        }
        .tr:last-child {
          border-bottom: 0;
        }

        .td {
          min-width: 0;
        }
        .tdRight {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }

        .codeCell .code {
          font-weight: 950;
          font-size: 13px;
          letter-spacing: -0.1px;
          line-height: 16px;
        }
        .tiny {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          line-height: 14px;
        }
        .client {
          font-weight: 950;
          font-size: 13px;
          line-height: 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ellip {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dest {
          display: flex;
          flex-direction: column;
          gap: 2px;
          align-items: flex-start;
        }
        .destPill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 950;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(15, 23, 42, 0.02);
        }

        /* Status chip mini con icono (hito) */
        .statusChip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          border: 1px solid;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }
        .statusIco {
          width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
        }
        .statusTxt {
          line-height: 14px;
        }

        /* Mobile: colapsar tabla */
        @media (max-width: 860px) {
          .thead {
            display: none;
          }
          .tr {
            grid-template-columns: 1fr;
            gap: 8px;
            align-items: start;
          }
          .tdRight {
            justify-content: flex-start;
          }
          .dest {
            flex-direction: row;
            align-items: center;
            gap: 8px;
          }
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
      `}</style>
    </AdminLayout>
  );
}