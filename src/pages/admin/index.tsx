// src/pages/admin/index.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RefreshCcw,
  PackagePlus,
  FilePlus2,
  Package2,
  Users2,
  Calculator,
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

function fmtDateShort(iso: string) {
  try {
    // “feb 2026”
    return new Date(iso).toLocaleDateString("es-PA", {
      month: "short",
      year: "numeric",
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
async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit & { timeoutMs?: number } = {}
) {
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

  // Estados separados (no bloquea toda la pantalla)
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);
  const [clientsTotal, setClientsTotal] = useState<number>(0);

  const [errShipments, setErrShipments] = useState<string | null>(null);
  const [errClients, setErrClients] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;

      // Cacheamos token para no pedir sesión mil veces
      const { data: sessionData } = await supabase.auth.getSession();
      tokenRef.current = sessionData.session?.access_token || null;
      if (!tokenRef.current) {
        window.location.href = "/login";
        return;
      }

      setAuthReady(true);
    })();
  }, []);

  async function load() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setErrShipments(null);
    setErrClients(null);

    setShipmentsLoading(true);
    setClientsLoading(true);

    const token = tokenRef.current;
    if (!token) {
      // Intento rápido
      const { data: sessionData } = await supabase.auth.getSession();
      tokenRef.current = sessionData.session?.access_token || null;
      if (!tokenRef.current) {
        window.location.href = "/login";
        inFlightRef.current = false;
        return;
      }
    }

    const authHeader = { Authorization: `Bearer ${tokenRef.current}` };

    const qs = new URLSearchParams();
    qs.set("page", "1");
    qs.set("dir", "desc");
    qs.set("mode", "admin");

    const shipmentsReq = (async () => {
      try {
        const res = await fetchWithTimeout(
          `/.netlify/functions/listShipments?${qs.toString()}`,
          { headers: authHeader, timeoutMs: 12000 }
        );

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          setErrShipments(t || "No se pudieron cargar embarques");
          setShipments([]);
          setShipmentsTotal(0);
          return;
        }

        const js = (await res.json()) as ShipmentsApiResponse;
        setShipments(js.items?.slice(0, 10) || []);
        setShipmentsTotal(js.total ?? (js.items?.length || 0));
      } catch (e: any) {
        const msg =
          e?.name === "AbortError"
            ? "Timeout cargando embarques (12s). Reintenta."
            : "Error de red cargando embarques";
        setErrShipments(msg);
        setShipments([]);
        setShipmentsTotal(0);
      } finally {
        setShipmentsLoading(false);
      }
    })();

    const clientsReq = (async () => {
      try {
        const res = await fetchWithTimeout(`/.netlify/functions/listClients`, {
          headers: authHeader,
          timeoutMs: 12000,
        });

        if (!res.ok) {
          // No bloquea el dashboard: solo marcamos el error
          const t = await res.text().catch(() => "");
          setErrClients(t || "No se pudieron cargar clientes");
          setClientsTotal(0);
          return;
        }

        const js = (await res.json()) as ClientsApiResponse;
        const inferredTotal =
          typeof js.total === "number" ? js.total : js.items?.length || 0;
        setClientsTotal(inferredTotal);
      } catch (e: any) {
        const msg =
          e?.name === "AbortError"
            ? "Timeout cargando clientes (12s)."
            : "Error de red cargando clientes";
        setErrClients(msg);
        setClientsTotal(0);
      } finally {
        setClientsLoading(false);
      }
    })();

    await Promise.allSettled([shipmentsReq, clientsReq]);
    inFlightRef.current = false;
  }

  useEffect(() => {
    if (!authReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  const activeShipments = useMemo(
    () => shipments.filter((s) => isActiveStatus(s.status)).length,
    [shipments]
  );

  const loadingAny = shipmentsLoading || clientsLoading;

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria en 1 click. Denso, rápido, estilo ERP.">
      {/* KPI strip (compacto) */}
      <div className="kpiStrip">
        <div className="kpiChip">
          <span className="kpiLbl">Embarques</span>
          <span className="kpiVal">{shipmentsLoading ? "—" : shipmentsTotal}</span>
        </div>

        <div className="kpiChip">
          <span className="kpiLbl">Activos</span>
          <span className="kpiVal">{shipmentsLoading ? "—" : activeShipments}</span>
        </div>

        <div className="kpiChip">
          <span className="kpiLbl">Clientes</span>
          <span className="kpiVal">{clientsLoading ? "—" : clientsTotal}</span>
        </div>

        <button
          className="btnGhost"
          type="button"
          onClick={load}
          disabled={loadingAny}
          title="Refrescar"
        >
          <RefreshCcw size={16} />
          {loadingAny ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div className="mainGrid">
        {/* LEFT: Últimos embarques (sin headers, 4 columnas) */}
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">Código · Cliente · Destino · Hito</div>
            </div>

            <Link className="btnSmall" href="/admin/shipments">
              Ver todos →
            </Link>
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          {errShipments ? (
            <div className="msgWarn">
              <b>Error</b>
              <div>{errShipments}</div>
            </div>
          ) : (
            <div className="table">
              {shipmentsLoading ? (
                <div className="tEmpty">Cargando embarques…</div>
              ) : shipments.length === 0 ? (
                <div className="tEmpty">Aún no hay embarques.</div>
              ) : (
                shipments.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/shipments/${s.id}`}
                    className="trow"
                    title={`${s.code} · ${s.client_name || ""} · ${String(s.destination || "").toUpperCase()}`}
                  >
                    {/* Col 1: Código (top), meta (bottom) */}
                    <div className="cell">
                      <div className="main">{s.code}</div>
                      <div className="sub">
                        {fmtDateShort(s.created_at)} · {productInline(s)}
                      </div>
                    </div>

                    {/* Col 2: Cliente */}
                    <div className="cell">
                      <div className="main clientMain">{s.client_name || "—"}</div>
                    </div>

                    {/* Col 3: Destino */}
                    <div className="cellDest">
                      <span className="dest">{String(s.destination || "").toUpperCase() || "—"}</span>
                    </div>

                    {/* Col 4: Hito */}
                    <div className="cellRight">
                      <MiniMilestone status={s.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Quick Actions (pro) */}
        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="cardSub">Operación y ventas sin fricción.</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="actionGrid">
            <Link href="/admin/shipments" className="actionTile primary">
              <div className="actionIconWrap">
                <PackagePlus size={22} />
              </div>
              <div className="actionText">
                <div className="actionTitle">Crear embarque</div>
                <div className="actionSub">Operación</div>
              </div>
            </Link>

            <Link href="/admin/quotes/new" className="actionTile">
              <div className="actionIconWrap">
                <FilePlus2 size={22} />
              </div>
              <div className="actionText">
                <div className="actionTitle">Nueva cotización</div>
                <div className="actionSub">Ventas</div>
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

          {errClients ? (
            <div className="tip warn">
              <b>Clientes:</b> {errClients}
            </div>
          ) : (
            <div className="tip">
              Tip: luego agregamos “Pendientes” por embarque (docs/fotos) como mini badges.
            </div>
          )}
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
          transition: background 160ms ease, transform 160ms ease;
        }
        .btnGhost:hover {
          background: rgba(15, 23, 42, 0.03);
          transform: translateY(-1px);
        }
        .btnGhost:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
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
          transition: background 160ms ease, transform 160ms ease;
        }
        .btnSmall:hover {
          background: rgba(15, 23, 42, 0.03);
          transform: translateY(-1px);
        }

        /* TABLE (sin headers) */
        .table {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }

        .trow {
          display: grid;
          grid-template-columns: 1.55fr 1.15fr 0.35fr 0.95fr;
          align-items: center;
          padding: 9px 12px; /* compacto */
          text-decoration: none;
          color: var(--ff-text);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          transition: background 160ms ease, border-color 160ms ease;
        }
        .trow:last-child {
          border-bottom: 0;
        }

        /* Hover verde MUY tenue (marca) */
        .trow:hover {
          background: rgba(31, 122, 58, 0.06);
          border-bottom-color: rgba(31, 122, 58, 0.12);
        }

        .cell {
          min-width: 0;
        }
        .main {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: -0.1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .clientMain {
          font-weight: 850; /* menos pesado para evitar “abuso de negrillas” */
        }
        .sub {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cellDest {
          display: flex;
          justify-content: center;
          align-items: center;
          min-width: 0;
        }
        .dest {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(15, 23, 42, 0.02);
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.6px;
          white-space: nowrap;
        }

        .cellRight {
          display: flex;
          justify-content: flex-end;
          align-items: center;
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

        /* QUICK ACTIONS (tiles pro) */
        .actionGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 520px) {
          .actionGrid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .actionTile {
          text-decoration: none;
          color: var(--ff-text);
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: #fff;
          border-radius: 16px;
          padding: 14px 12px;
          display: grid;
          gap: 10px;
          justify-items: center; /* icono centrado */
          text-align: center;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
        }
        .actionTile:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 30px rgba(2, 6, 23, 0.08);
          border-color: rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.03);
        }

        .actionTile.primary {
          background: linear-gradient(180deg, rgba(31, 122, 58, 0.95), rgba(31, 122, 58, 0.86));
          border-color: rgba(31, 122, 58, 0.35);
          color: #fff;
        }
        .actionTile.primary:hover {
          background: linear-gradient(180deg, rgba(31, 122, 58, 0.98), rgba(31, 122, 58, 0.88));
          border-color: rgba(31, 122, 58, 0.45);
          box-shadow: 0 14px 34px rgba(31, 122, 58, 0.18);
        }

        .actionIconWrap {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(255, 255, 255, 0.9);
          color: var(--ff-green-dark);
        }
        .actionTile.primary .actionIconWrap {
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.25);
          color: #fff;
        }

        .actionText {
          display: grid;
          gap: 2px;
        }
        .actionTitle {
          font-weight: 950;
          letter-spacing: -0.2px;
          font-size: 13px;
        }
        .actionSub {
          font-size: 12px;
          font-weight: 900;
          opacity: 0.75;
        }

        .miniGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .miniAction {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: #fff;
          text-decoration: none;
          color: var(--ff-text);
          font-weight: 900;
          font-size: 12px;
          transition: background 160ms ease, transform 160ms ease, border-color 160ms ease;
        }
        .miniAction:hover {
          background: rgba(31, 122, 58, 0.04);
          border-color: rgba(31, 122, 58, 0.18);
          transform: translateY(-1px);
        }

        .tip {
          margin-top: 10px;
          font-size: 12px;
          color: var(--ff-muted);
          border-top: 1px dashed rgba(15, 23, 42, 0.10);
          padding-top: 10px;
        }
        .tip.warn {
          border-top-color: rgba(209, 119, 17, 0.25);
          color: rgba(15, 23, 42, 0.75);
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
            grid-template-columns: 1.45fr 1fr 0.35fr 1fr;
          }
          .miniMilestoneTxt {
            max-width: 120px;
          }
        }
      `}</style>
    </AdminLayout>
  );
}