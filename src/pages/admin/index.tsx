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

// Fetch helper with timeout (evita “minutos” si algo se queda colgado)
async function fetchWithTimeout(input: RequestInfo, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 12000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export default function AdminDashboard() {
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);
  const [clientsTotal, setClientsTotal] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  const inFlightRef = useRef(false);

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
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setLoading(true);
    setErr(null);

    const token = await getTokenOrRedirect();
    if (!token) {
      inFlightRef.current = false;
      return;
    }

    // Últimos embarques (rápido)
    const qs = new URLSearchParams();
    qs.set("page", "1");
    qs.set("dir", "desc");
    qs.set("mode", "admin");

    try {
      const [sRes, cRes] = await Promise.all([
        fetchWithTimeout(`/.netlify/functions/listShipments?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeoutMs: 12000,
        }),
        fetchWithTimeout(`/.netlify/functions/listClients`, {
          headers: { Authorization: `Bearer ${token}` },
          timeoutMs: 12000,
        }),
      ]);

      if (!sRes.ok) {
        const t = await sRes.text().catch(() => "");
        setErr(t || "No se pudieron cargar embarques");
        setLoading(false);
        inFlightRef.current = false;
        return;
      }

      const sJson = (await sRes.json()) as ShipmentsApiResponse;
      setShipments(sJson.items?.slice(0, 10) || []);
      setShipmentsTotal(sJson.total ?? (sJson.items?.length || 0));

      if (cRes.ok) {
        const cJson = (await cRes.json()) as ClientsApiResponse;
        const inferredTotal = typeof cJson.total === "number" ? cJson.total : cJson.items?.length || 0;
        setClientsTotal(inferredTotal);
      }

      setLoading(false);
      inFlightRef.current = false;
    } catch (e: any) {
      setErr(e?.name === "AbortError" ? "Timeout cargando dashboard (12s). Reintenta." : "Error de red cargando dashboard");
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (!authReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  const activeShipments = useMemo(() => shipments.filter((s) => isActiveStatus(s.status)).length, [shipments]);

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria en 1 click. Denso, rápido, estilo ERP.">
      {/* KPI strip */}
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
        {/* LEFT: Shipments list (4 cols, SIN headers) */}
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">4 columnas: Código / Cliente / Destino / Hito. Sin headers.</div>
            </div>

            <Link className="btnSmall" href="/admin/shipments">
              Ver todos →
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
            <div className="tableNoHead" role="list">
              {shipments.map((s) => (
                <Link key={s.id} href={`/admin/shipments/${s.id}`} className="trow" role="listitem">
                  {/* Col 1: Código (importante) */}
                  <div className="cell">
                    <div className="main">{s.code}</div>
                    <div className="sub">{fmtDate(s.created_at)}</div>
                  </div>

                  {/* Col 2: Cliente */}
                  <div className="cell">
                    <div className="main">{s.client_name || "—"}</div>
                    <div className="sub">{productInline(s)}</div>
                  </div>

                  {/* Col 3: Destino */}
                  <div className="cell">
                    <div className="main">{(s.destination || "—").toUpperCase()}</div>
                    <div className="sub">&nbsp;</div>
                  </div>

                  {/* Col 4: Hito */}
                  <div className="cellRight">
                    <MiniMilestone status={s.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Quick Actions */}
        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="cardSub">Botones visibles para operar sin pensar.</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="ctaGrid">
            <Link className="btnPrimary" href="/admin/shipments">
              <PackagePlus size={18} />
              Crear embarque
              <span className="btnHint">Operación</span>
            </Link>

            <Link className="btnSecondary" href="/admin/quotes/new">
              <FilePlus2 size={18} />
              Nueva cotización
              <span className="btnHint">Ventas</span>
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

          <div className="tip">Tip: aquí podemos sumar “Pendientes” (docs/fotos) por embarque como mini badges.</div>
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
          letter-spacing: -0.1px;
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
        }
        .btnGhost:hover {
          background: rgba(15, 23, 42, 0.03);
        }
        .btnGhost:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
        }
        .btnSmall:hover {
          background: rgba(15, 23, 42, 0.03);
        }

        /* LIST (no headers) */
        .tableNoHead {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }

        .trow {
          display: grid;
          grid-template-columns: 1.1fr 1.6fr 0.6fr 1fr;
          align-items: center;
          padding: 10px 12px;
          text-decoration: none;
          color: var(--ff-text);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);

          /* ✅ hover “marcado” verde muy tenue */
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .trow:last-child {
          border-bottom: 0;
        }
        .trow:hover {
          background: rgba(31, 122, 58, 0.04);
          border-bottom-color: rgba(31, 122, 58, 0.18);
        }

        .cell {
          min-width: 0;
        }
        .main {
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

        .cellRight {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .miniMilestone {
          display: inline-flex;
          align-items: center;
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

        .tEmpty {
          padding: 12px;
          font-size: 12px;
          color: var(--ff-muted);
        }

        /* Quick actions */
        .ctaGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .btnPrimary,
        .btnSecondary {
          position: relative;
          display: grid;
          grid-template-columns: 22px 1fr;
          align-items: center;
          gap: 10px;
          padding: 12px 12px;
          border-radius: 14px;
          text-decoration: none;
          font-weight: 950;
          letter-spacing: -0.2px;
          border: 1px solid rgba(15, 23, 42, 0.1);
        }
        .btnPrimary {
          background: var(--ff-green);
          color: #fff;
          border-color: rgba(31, 122, 58, 0.35);
        }
        .btnPrimary:hover {
          filter: brightness(0.98);
        }

        .btnSecondary {
          background: #fff;
          color: var(--ff-text);
        }
        .btnSecondary:hover {
          background: rgba(15, 23, 42, 0.02);
        }

        .btnHint {
          position: absolute;
          right: 10px;
          top: 10px;
          font-size: 11px;
          font-weight: 900;
          opacity: 0.85;
        }
        .btnPrimary .btnHint {
          color: rgba(255, 255, 255, 0.9);
        }
        .btnSecondary .btnHint {
          color: rgba(15, 23, 42, 0.6);
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
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: #fff;
          text-decoration: none;
          color: var(--ff-text);
          font-weight: 900;
          font-size: 12px;
        }
        .miniAction:hover {
          background: rgba(15, 23, 42, 0.02);
        }

        .tip {
          margin-top: 10px;
          font-size: 12px;
          color: var(--ff-muted);
          border-top: 1px dashed rgba(15, 23, 42, 0.1);
          padding-top: 10px;
        }

        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
        }

        @media (max-width: 520px) {
          .trow {
            grid-template-columns: 1.1fr 1.2fr 0.55fr 1fr;
          }
          .miniMilestoneTxt {
            max-width: 120px;
          }
        }
      `}</style>
    </AdminLayout>
  );
}