// src/pages/admin/index.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RefreshCcw,
  PackagePlus,
  FilePlus2,
  Package2,
  Calculator,
  Users2,
  History,
  MapPin,
  Truck,
  PackageCheck,
  FileText,
  ArrowRight,
  TrendingUp,
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

function isActiveStatus(raw: string) {
  const s = String(raw || "").toUpperCase();
  // Todo lo “En Destino” o finalizado NO es activo
  if (["AT_DESTINATION", "DELIVERED", "CLOSED"].includes(s)) return false;
  return true;
}

function milestoneTone(raw: string): "neutral" | "success" | "warn" | "info" {
  const s = String(raw || "").toUpperCase();
  if (["PACKED", "DOCS_READY"].includes(s)) return "success";
  if (["AT_ORIGIN", "ARRIVED_PTY", "DEPARTED"].includes(s)) return "warn";
  if (["IN_TRANSIT"].includes(s)) return "info";
  return "neutral";
}

function MiniMilestone({ status }: { status: string }) {
  const tone = milestoneTone(status);
  const label = labelStatus(status);

  const up = String(status || "").toUpperCase();
  const Icon =
    up === "AT_DESTINATION"
      ? MapPin
      : up === "IN_TRANSIT"
      ? Truck
      : up === "DOCS_READY"
      ? FileText
      : up === "PACKED"
      ? PackageCheck
      : Package2;

  const style: React.CSSProperties =
    tone === "success"
      ? {
          background: "rgba(31,122,58,.10)",
          borderColor: "rgba(31,122,58,.22)",
          color: "var(--ff-green-dark)",
        }
      : tone === "warn"
      ? {
          background: "rgba(209,119,17,.12)",
          borderColor: "rgba(209,119,17,.24)",
          color: "#7a3f00",
        }
      : tone === "info"
      ? {
          background: "rgba(59,130,246,.10)",
          borderColor: "rgba(59,130,246,.22)",
          color: "rgba(30,64,175,1)",
        }
      : {
          background: "rgba(15,23,42,.04)",
          borderColor: "rgba(15,23,42,.12)",
          color: "var(--ff-text)",
        };

  return (
    <span className="miniMilestone" style={style} title={label}>
      <Icon size={14} />
      <span className="miniMilestoneTxt">{label}</span>
    </span>
  );
}

// Fetch helper con timeout (evita “minutos” si algo se queda colgado)
async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 12000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function getTokenOrRedirect() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = "/login";
    return null;
  }
  return token;
}

export default function AdminDashboard() {
  const [authReady, setAuthReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);
  const [clientsTotal, setClientsTotal] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  const inFlightRef = useRef(false);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      setAuthReady(true);
    })();
  }, []);

  const activeShipments = useMemo(
    () => shipments.filter((s) => isActiveStatus(s.status)).length,
    [shipments]
  );

  async function load() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setLoading(true);
    setErr(null);

    const token = await getTokenOrRedirect();
    if (!token) {
      inFlightRef.current = false;
      return;
    }

    try {
      const qs = new URLSearchParams();
      qs.set("page", "1");
      qs.set("dir", "desc");
      qs.set("mode", "admin");

      const [sRes, cRes] = await Promise.allSettled([
        fetchWithTimeout(`/.netlify/functions/listShipments?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeoutMs: 12000,
        }),
        fetchWithTimeout(`/.netlify/functions/listClients`, {
          headers: { Authorization: `Bearer ${token}` },
          timeoutMs: 12000,
        }),
      ]);

      // Shipments
      if (sRes.status === "fulfilled") {
        if (!sRes.value.ok) {
          const t = await sRes.value.text().catch(() => "");
          setErr(t || "No se pudieron cargar embarques");
        } else {
          const sJson = (await sRes.value.json()) as ShipmentsApiResponse;
          setShipments(sJson.items?.slice(0, 10) || []);
          setShipmentsTotal(sJson.total ?? (sJson.items?.length || 0));
        }
      } else {
        setErr("Timeout o error de red cargando embarques");
      }

      // Clients total (no bloquea el dashboard si falla)
      if (cRes.status === "fulfilled" && cRes.value.ok) {
        const cJson = (await cRes.value.json()) as ClientsApiResponse;
        const inferredTotal =
          typeof cJson.total === "number" ? cJson.total : cJson.items?.length || 0;
        setClientsTotal(inferredTotal);
      }
    } catch {
      setErr("Error inesperado cargando dashboard");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (!authReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria en 1 click. Rápido, denso, estilo ERP.">
      {/* KPIs compactos */}
      <div className="kpiStrip">
        <div className="kpiChip">
          <span className="kpiLbl">Embarques</span>
          <span className="kpiVal">{loading ? "—" : shipmentsTotal}</span>
        </div>
        <div className="kpiChip">
          <span className="kpiLbl">Activos</span>
          <span className="kpiVal">{loading ? "—" : activeShipments}</span>
        </div>
        <div className="kpiChip">
          <span className="kpiLbl">Clientes</span>
          <span className="kpiVal">{loading ? "—" : clientsTotal}</span>
        </div>

        <button className="btnGhost" type="button" onClick={load} disabled={loading} title="Refrescar">
          <RefreshCcw size={16} />
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div className="mainGrid">
        {/* LEFT: shipments */}
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">Código · Cliente · Destino · Hito</div>
            </div>

            <Link className="btnSmall" href="/admin/shipments">
              Ver todos <ArrowRight size={16} />
            </Link>
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          {err ? (
            <div className="msgWarn">
              <b>Error</b>
              <div>{err}</div>
            </div>
          ) : loading ? (
            <div className="tEmpty">Cargando…</div>
          ) : shipments.length === 0 ? (
            <div className="tEmpty">Aún no hay embarques.</div>
          ) : (
            <div className="denseList">
              {shipments.map((s) => (
                <Link key={s.id} href={`/admin/shipments/${s.id}`} className="denseRow">
                  {/* Col 1: Código */}
                  <div className="c1">
                    <div className="top">{s.code}</div>
                    <div className="sub">{fmtDate(s.created_at)}</div>
                  </div>

                  {/* Col 2: Cliente */}
                  <div className="c2">
                    <div className="top">{s.client_name || "—"}</div>
                    <div className="sub">{productInline(s)}</div>
                  </div>

                  {/* Col 3: Destino */}
                  <div className="c3">
                    <div className="top">{(s.destination || "—").toUpperCase()}</div>
                    <div className="sub">&nbsp;</div>
                  </div>

                  {/* Col 4: Hito */}
                  <div className="c4">
                    <MiniMilestone status={s.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: quick actions */}
        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="cardSub">Botones grandes, claros y con feedback (hover).</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="qaGrid">
            <Link className="qaTile isPrimary" href="/admin/shipments">
              <div className="qaIcon">
                <PackagePlus size={22} />
              </div>
              <div className="qaTitle">Crear embarque</div>
              <div className="qaDesc">Operación · define destino y cliente.</div>
              <div className="qaGo">
                <span>Abrir</span>
                <TrendingUp size={16} />
              </div>
            </Link>

            <Link className="qaTile" href="/admin/quotes/new">
              <div className="qaIcon">
                <FilePlus2 size={22} />
              </div>
              <div className="qaTitle">Nueva cotización</div>
              <div className="qaDesc">Ventas · rápida y guardada en historial.</div>
              <div className="qaGo">
                <span>Crear</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          </div>

          <div style={{ height: 10 }} />

          <div className="miniGrid">
            <Link className="miniAction" href="/admin/shipments">
              <Package2 size={16} />
              Embarques
            </Link>
            <Link className="miniAction" href={QUOTE_PATH}>
              <Calculator size={16} />
              Cotizador
            </Link>
            <Link className="miniAction" href="/admin/users">
              <Users2 size={16} />
              Clientes
            </Link>
            <Link className="miniAction" href={QUOTE_PATH}>
              <History size={16} />
              Historial
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .kpiStrip {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .kpiChip {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid var(--ff-border);
          background: var(--ff-surface);
          border-radius: 12px;
          box-shadow: var(--ff-shadow);
        }
        .kpiLbl {
          font-size: 12px;
          font-weight: 900;
          color: var(--ff-muted);
        }
        .kpiVal {
          font-size: 16px;
          font-weight: 950;
          letter-spacing: -0.2px;
        }

        .btnGhost {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
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
          transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
        }
        .btnGhost:hover {
          background: rgba(15, 23, 42, 0.03);
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
        }
        .btnGhost:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .mainGrid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1100px) {
          .mainGrid {
            grid-template-columns: 1.7fr 1fr;
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
          transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
        }
        .btnSmall:hover {
          background: rgba(15, 23, 42, 0.03);
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
        }

        .tEmpty {
          padding: 12px;
          font-size: 12px;
          color: var(--ff-muted);
        }

        /* === Dense list (NO headers) === */
        .denseList {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }

        .denseRow {
          display: grid;
          grid-template-columns: 1.15fr 1.6fr 0.6fr 0.9fr;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          text-decoration: none;
          color: var(--ff-text);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          transition: background .12s ease, box-shadow .12s ease, border-color .12s ease;
        }
        .denseRow:last-child {
          border-bottom: 0;
        }

        /* Hover verde tenue estilo shipments */
        .denseRow:hover {
          background: rgba(31, 122, 58, 0.045);
          box-shadow: inset 0 0 0 1px rgba(31, 122, 58, 0.14);
        }

        .c1, .c2, .c3 {
          min-width: 0;
        }

        .top {
          font-size: 13px;
          font-weight: 850;
          letter-spacing: -0.1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sub {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .c4 {
          display: flex;
          justify-content: flex-end;
          align-items: center; /* ✅ alinea el pill */
          min-width: 0;
        }

        .miniMilestone {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          border: 1px solid;
          padding: 6px 10px;
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }
        .miniMilestoneTxt {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* === Quick actions PRO === */
        .qaGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 980px) {
          .qaGrid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .qaTile {
          border: 1px solid rgba(15, 23, 42, 0.10);
          border-radius: 14px;
          background: #fff;
          padding: 14px 12px;
          text-decoration: none;
          color: var(--ff-text);
          display: grid;
          gap: 6px;
          transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease;
        }
        .qaTile:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.10);
          border-color: rgba(31, 122, 58, 0.18);
          background: rgba(31, 122, 58, 0.03);
        }

        .qaTile.isPrimary {
          background: rgba(31, 122, 58, 0.06);
          border-color: rgba(31, 122, 58, 0.22);
        }
        .qaTile.isPrimary:hover {
          background: rgba(31, 122, 58, 0.08);
          border-color: rgba(31, 122, 58, 0.28);
        }

        .qaIcon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: grid;
          place-items: center; /* ✅ icono centrado */
          border: 1px solid rgba(31, 122, 58, 0.18);
          background: rgba(31, 122, 58, 0.06);
          color: var(--ff-green-dark);
        }

        .qaTitle {
          font-weight: 950;
          font-size: 13px;
          letter-spacing: -0.1px;
        }
        .qaDesc {
          font-size: 12px;
          color: var(--ff-muted);
          line-height: 16px;
        }
        .qaGo {
          margin-top: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-weight: 900;
          font-size: 12px;
          color: var(--ff-green-dark);
        }

        .miniGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .miniAction {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: #fff;
          text-decoration: none;
          color: var(--ff-text);
          font-weight: 900;
          font-size: 12px;
          transition: background .12s ease, transform .12s ease;
        }
        .miniAction:hover {
          background: rgba(15, 23, 42, 0.02);
          transform: translateY(-1px);
        }

        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
        }

        @media (max-width: 720px) {
          .denseRow {
            grid-template-columns: 1.2fr 1.5fr 0.6fr 1fr;
          }
          .miniMilestoneTxt {
            max-width: 120px;
          }
        }

        @media (max-width: 520px) {
          /* En mobile: mantenemos 4 columnas pero más compactas */
          .denseRow {
            gap: 8px;
            padding: 10px 10px;
            grid-template-columns: 1.25fr 1.35fr 0.55fr 1fr;
          }
          .top {
            font-size: 12.5px;
          }
          .sub {
            font-size: 11.5px;
          }
        }
      `}</style>
    </AdminLayout>
  );
}