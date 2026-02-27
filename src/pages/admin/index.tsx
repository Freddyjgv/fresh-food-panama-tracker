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

// Cache para render inmediato
const CACHE_KEY = "ff_admin_dashboard_cache_v2";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

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

  const S = String(status || "").toUpperCase();
  const Icon =
    S === "AT_DESTINATION"
      ? MapPin
      : S === "IN_TRANSIT"
      ? Truck
      : S === "DOCS_READY"
      ? FileText
      : S === "PACKED"
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

async function getAccessTokenFast(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || null;
  if (!token) {
    window.location.href = "/login";
    return null;
  }
  return token;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, cancel: () => clearTimeout(id) };
}

export default function AdminDashboard() {
  const [authReady, setAuthReady] = useState(false);

  // UI states (separados para no “bloquear todo”)
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);
  const [clientsTotal, setClientsTotal] = useState<number>(0);

  const [errShipments, setErrShipments] = useState<string | null>(null);
  const [errClients, setErrClients] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  // Gate admin (una sola vez)
  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      const token = await getAccessTokenFast();
      if (!token) return;
      tokenRef.current = token;
      setAuthReady(true);
    })();
  }, []);

  // Leer cache para pintar instantáneo
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const js = JSON.parse(raw);
      if (!js || typeof js !== "object") return;
      if (!js.ts || Date.now() - Number(js.ts) > CACHE_TTL_MS) return;

      if (Array.isArray(js.shipments)) setShipments(js.shipments);
      if (typeof js.shipmentsTotal === "number") setShipmentsTotal(js.shipmentsTotal);
      if (typeof js.clientsTotal === "number") setClientsTotal(js.clientsTotal);

      // Pintamos “como si ya estuviera”
      setShipmentsLoading(false);
      setClientsLoading(false);
    } catch {
      // ignore
    }
  }, []);

  async function load() {
    if (!tokenRef.current) return;
    if (inFlightRef.current) return; // evita dobles loads
    inFlightRef.current = true;

    setErrShipments(null);
    setErrClients(null);

    // No vuelvas a dejar la UI “en blanco”: solo activa loaders por bloque
    setShipmentsLoading(true);
    setClientsLoading(true);

    const token = tokenRef.current;

    // Timeouts (evita “minutos colgado”)
    const t1 = withTimeout(12000);
    const t2 = withTimeout(12000);

    // Shipments QS (limitamos a 10 para dashboard)
    const qs = new URLSearchParams();
    qs.set("page", "1");
    qs.set("dir", "desc");
    qs.set("mode", "admin");
    qs.set("pageSize", "10"); // si tu function lo ignora, no rompe

    const pShipments = fetch(`/.netlify/functions/listShipments?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: t1.controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
        return (await res.json()) as ShipmentsApiResponse;
      })
      .then((sJson) => {
        const list = sJson.items?.slice(0, 10) || [];
        setShipments(list);
        setShipmentsTotal(sJson.total ?? list.length);
        setShipmentsLoading(false);
        return { list, total: sJson.total ?? list.length };
      })
      .catch((e: any) => {
        const msg = e?.name === "AbortError" ? "Timeout cargando embarques" : String(e?.message || e || "Error embarques");
        setErrShipments(msg);
        setShipmentsLoading(false);
        return { list: null as any, total: null as any };
      })
      .finally(() => t1.cancel());

    const pClients = fetch(`/.netlify/functions/listClients`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: t2.controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
        return (await res.json()) as ClientsApiResponse;
      })
      .then((cJson) => {
        const inferredTotal = typeof cJson.total === "number" ? cJson.total : cJson.items?.length || 0;
        setClientsTotal(inferredTotal);
        setClientsLoading(false);
        return { total: inferredTotal };
      })
      .catch((e: any) => {
        const msg = e?.name === "AbortError" ? "Timeout cargando clientes" : String(e?.message || e || "Error clientes");
        setErrClients(msg);
        setClientsLoading(false);
        return { total: null as any };
      })
      .finally(() => t2.cancel());

    // Ejecutar en paralelo
    const [sRes, cRes] = await Promise.all([pShipments, pClients]);

    // Guardar cache SOLO si tuvimos al menos algo útil
    try {
      const cache = {
        ts: Date.now(),
        shipments: Array.isArray(shipments) && shipments.length ? shipments : (sRes as any)?.list || [],
        shipmentsTotal: typeof shipmentsTotal === "number" && shipmentsTotal ? shipmentsTotal : (sRes as any)?.total || 0,
        clientsTotal: typeof clientsTotal === "number" && clientsTotal ? clientsTotal : (cRes as any)?.total || 0,
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // ignore
    }

    inFlightRef.current = false;
  }

  // Autoload al quedar listo
  useEffect(() => {
    if (!authReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  const activeShipments = useMemo(() => shipments.filter((s) => isActiveStatus(s.status)).length, [shipments]);

  // Loader global: solo para el gate (no para data)
  if (!authReady) {
    return (
      <AdminLayout title="Dashboard" subtitle="Verificando acceso…">
        <div className="ff-card2">Cargando…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria en 1 click. Rápido, denso, estilo ERP.">
      {/* KPI strip */}
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

        <button className="btnGhost" type="button" onClick={load} disabled={shipmentsLoading || clientsLoading} title="Refrescar">
          <RefreshCcw size={16} />
          {(shipmentsLoading || clientsLoading) ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div className="mainGrid">
        {/* LEFT: Últimos embarques */}
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">Entra en 1 click. Compacto y legible.</div>
            </div>

            <Link className="btnSmall" href="/admin/shipments">
              Ver todos →
            </Link>
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          {errShipments ? (
            <div className="msgWarn">
              <b>Error embarques</b>
              <div>{errShipments}</div>
            </div>
          ) : (
            <div className="table">
              <div className="thead">
                <div>Código</div>
                <div>Cliente</div>
                <div>Destino</div>
                <div className="thRight">Hito</div>
              </div>

              {shipmentsLoading ? (
                <div className="tEmpty">Cargando embarques…</div>
              ) : shipments.length === 0 ? (
                <div className="tEmpty">Aún no hay embarques.</div>
              ) : (
                shipments.map((s) => (
                  <Link key={s.id} href={`/admin/shipments/${s.id}`} className="trow">
                    <div className="cell">
                      <div className="main">{s.code}</div>
                      <div className="sub">{fmtDate(s.created_at)}</div>
                    </div>

                    <div className="cell">
                      <div className="main">{s.client_name || "—"}</div>
                      <div className="sub">{productInline(s)}</div>
                    </div>

                    <div className="cell">
                      <div className="main">{(s.destination || "").toUpperCase()}</div>
                      <div className="sub"> </div>
                    </div>

                    <div className="cellRight">
                      <MiniMilestone status={s.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Quick actions */}
        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="cardSub">Operar sin navegar: botones grandes y claros.</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="ctaGrid">
            <Link className="actionBtn primary" href="/admin/shipments">
              <div className="actionIcon">
                <PackagePlus size={18} />
              </div>
              <div className="actionText">
                <div className="actionTitle">Crear embarque</div>
                <div className="actionDesc">Crea, asigna cliente, define destino.</div>
              </div>
              <span className="actionTag">Operación</span>
            </Link>

            <Link className="actionBtn" href="/admin/quotes/new">
              <div className="actionIcon">
                <FilePlus2 size={18} />
              </div>
              <div className="actionText">
                <div className="actionTitle">Nueva cotización</div>
                <div className="actionDesc">Genera rápida y guarda historial.</div>
              </div>
              <span className="actionTag neutral">Ventas</span>
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
            <div className="msgWarn" style={{ marginTop: 10 }}>
              <b>Error clientes</b>
              <div>{errClients}</div>
            </div>
          ) : null}
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

        /* Dense table */
        .table {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }
        .thead {
          display: grid;
          grid-template-columns: 1.1fr 1.6fr 0.7fr 1fr;
          padding: 10px 12px;
          background: rgba(15, 23, 42, 0.02);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          font-size: 12px;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.6);
        }
        .thRight {
          text-align: right;
        }

        .trow {
          display: grid;
          grid-template-columns: 1.1fr 1.6fr 0.7fr 1fr;
          align-items: center;
          padding: 10px 12px;
          text-decoration: none;
          color: var(--ff-text);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }
        .trow:last-child {
          border-bottom: 0;
        }
        .trow:hover {
          background: rgba(15, 23, 42, 0.02);
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
          max-width: 190px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tEmpty {
          padding: 12px;
          font-size: 12px;
          color: var(--ff-muted);
        }

        /* Quick actions (más “real app”) */
        .ctaGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .actionBtn {
          position: relative;
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border-radius: 14px;
          text-decoration: none;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: #fff;
          color: var(--ff-text);
          transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
        }
        .actionBtn:hover {
          background: rgba(15, 23, 42, 0.02);
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(2, 6, 23, 0.08);
        }

        .actionBtn.primary {
          border-color: rgba(31, 122, 58, 0.28);
          background: rgba(31, 122, 58, 0.06);
        }
        .actionBtn.primary:hover {
          background: rgba(31, 122, 58, 0.08);
        }

        .actionIcon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(15, 23, 42, 0.03);
          flex: 0 0 auto;
        }
        .actionBtn.primary .actionIcon {
          border-color: rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.10);
          color: var(--ff-green-dark);
        }

        .actionText {
          min-width: 0;
          flex: 1 1 auto;
        }
        .actionTitle {
          font-weight: 950;
          font-size: 13px;
          letter-spacing: -0.1px;
          line-height: 18px;
        }
        .actionDesc {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .actionTag {
          position: absolute;
          top: 10px;
          right: 10px;
          font-size: 11px;
          font-weight: 950;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.10);
          color: var(--ff-green-dark);
        }
        .actionTag.neutral {
          border-color: rgba(15, 23, 42, 0.12);
          background: rgba(15, 23, 42, 0.04);
          color: rgba(15, 23, 42, 0.7);
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
        }
        .miniAction:hover {
          background: rgba(15, 23, 42, 0.02);
        }

        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
        }

        @media (max-width: 520px) {
          .thead, .trow {
            grid-template-columns: 1fr 1.1fr 0.6fr 1fr;
          }
          .miniMilestoneTxt {
            max-width: 120px;
          }
        }
      `}</style>
    </AdminLayout>
  );
}