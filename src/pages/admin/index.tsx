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
  FolderOpen,
  ArrowRight,
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
    return new Date(iso).toLocaleDateString("es-PA", { month: "short", year: "numeric" });
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
  // Todo lo “En destino” o finalizado NO es activo
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
      ? { background: "rgba(31,122,58,.10)", borderColor: "rgba(31,122,58,.22)", color: "var(--ff-green-dark)" }
      : tone === "warn"
      ? { background: "rgba(209,119,17,.12)", borderColor: "rgba(209,119,17,.24)", color: "#7a3f00" }
      : tone === "info"
      ? { background: "rgba(59,130,246,.10)", borderColor: "rgba(59,130,246,.22)", color: "rgba(30,64,175,1)" }
      : { background: "rgba(15,23,42,.04)", borderColor: "rgba(15,23,42,.12)", color: "var(--ff-text)" };

  return (
    <span className="miniMilestone" style={style} title={label}>
      <Icon size={14} />
      <span className="miniMilestoneTxt">{label}</span>
    </span>
  );
}

// Fetch helper con timeout: nunca más “minutos”
async function fetchWithTimeout(input: RequestInfo, init: RequestInit & { timeoutMs?: number } = {}) {
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

  // Estados por bloque (no bloquea toda la página)
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);
  const [clientsTotal, setClientsTotal] = useState<number>(0);

  const [errShipments, setErrShipments] = useState<string | null>(null);
  const [errClients, setErrClients] = useState<string | null>(null);

  const inFlightRef = useRef(false);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      setAuthReady(true);
    })();
  }, []);

  async function load() {
    if (inFlightRef.current) return; // evita storms
    inFlightRef.current = true;

    setErrShipments(null);
    setErrClients(null);
    setShipmentsLoading(true);
    setClientsLoading(true);

    const token = await getTokenOrRedirect();
    if (!token) {
      inFlightRef.current = false;
      return;
    }

    // Pedimos menos data (si tu backend soporta pageSize)
    const qsShip = new URLSearchParams();
    qsShip.set("page", "1");
    qsShip.set("dir", "desc");
    qsShip.set("mode", "admin");
    qsShip.set("pageSize", "12");

    const shipmentsReq = fetchWithTimeout(`/.netlify/functions/listShipments?${qsShip.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 12000,
    });

    const clientsReq = fetchWithTimeout(`/.netlify/functions/listClients`, {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 12000,
    });

    const [sRes, cRes] = await Promise.allSettled([shipmentsReq, clientsReq]);

    // Shipments
    try {
      if (sRes.status === "fulfilled") {
        if (!sRes.value.ok) {
          const t = await sRes.value.text().catch(() => "");
          setErrShipments(t || "No se pudieron cargar embarques");
        } else {
          const sJson = (await sRes.value.json()) as ShipmentsApiResponse;
          setShipments(sJson.items?.slice(0, 10) || []);
          setShipmentsTotal(sJson.total ?? (sJson.items?.length || 0));
        }
      } else {
        setErrShipments(sRes.reason?.name === "AbortError" ? "Timeout cargando embarques" : "Error cargando embarques");
      }
    } finally {
      setShipmentsLoading(false);
    }

    // Clients
    try {
      if (cRes.status === "fulfilled") {
        if (!cRes.value.ok) {
          const t = await cRes.value.text().catch(() => "");
          setErrClients(t || "No se pudieron cargar clientes");
        } else {
          const cJson = (await cRes.value.json()) as ClientsApiResponse;
          const inferredTotal = typeof cJson.total === "number" ? cJson.total : (cJson.items?.length || 0);
          setClientsTotal(inferredTotal);
        }
      } else {
        setErrClients(cRes.reason?.name === "AbortError" ? "Timeout cargando clientes" : "Error cargando clientes");
      }
    } finally {
      setClientsLoading(false);
    }

    inFlightRef.current = false;
  }

  useEffect(() => {
    if (!authReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  const activeShipments = useMemo(() => shipments.filter((s) => isActiveStatus(s.status)).length, [shipments]);

  const anyLoading = shipmentsLoading || clientsLoading;

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria en 1 click. Denso, rápido, estilo ERP.">
      {/* KPI strip compacto */}
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

        <button className="btnGhost" type="button" onClick={load} disabled={anyLoading} title="Refrescar">
          <RefreshCcw size={16} />
          {anyLoading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div className="mainGrid">
        {/* LEFT: Últimos embarques (sin headers) */}
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">Código · Cliente · Destino · Hito</div>
            </div>

            <Link className="btnSmall" href="/admin/shipments">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          {errShipments ? (
            <div className="msgWarn">
              <b>Error</b>
              <div>{errShipments}</div>
            </div>
          ) : shipmentsLoading ? (
            <div className="muted">Cargando embarques…</div>
          ) : shipments.length === 0 ? (
            <div className="muted">Aún no hay embarques.</div>
          ) : (
            <div className="denseList">
              {shipments.map((s) => (
                <Link key={s.id} href={`/admin/shipments/${s.id}`} className="denseRow">
                  {/* Col 1: Código */}
                  <div className="col codeCol">
                    <div className="top">{s.code}</div>
                    <div className="bottom">{fmtDateShort(s.created_at)} · {productInline(s)}</div>
                  </div>

                  {/* Col 2: Cliente */}
                  <div className="col clientCol">
                    <div className="top">{s.client_name || "—"}</div>
                    <div className="bottom">&nbsp;</div>
                  </div>

                  {/* Col 3: Destino */}
                  <div className="col destCol">
                    <div className="top">{(s.destination || "").toUpperCase()}</div>
                    <div className="bottom">&nbsp;</div>
                  </div>

                  {/* Col 4: Hito */}
                  <div className="col hitoCol">
                    <MiniMilestone status={s.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Acciones rápidas (más “pro”) */}
        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="cardSub">Operar sin pensar (rápido y visible).</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="ctaGrid">
            <Link className="ctaPrimary" href="/admin/shipments">
              <span className="ctaIcon">
                <PackagePlus size={18} />
              </span>
              <span className="ctaText">
                <span className="ctaTitle">Crear embarque</span>
                <span className="ctaDesc">Carga docs, fotos y hitos</span>
              </span>
              <ArrowRight size={16} />
            </Link>

            <Link className="ctaSecondary" href="/admin/quotes/new">
              <span className="ctaIcon">
                <FilePlus2 size={18} />
              </span>
              <span className="ctaText">
                <span className="ctaTitle">Nueva cotización</span>
                <span className="ctaDesc">CIP/FOB/CIF + historial</span>
              </span>
              <ArrowRight size={16} />
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
            <Link className="miniAction" href="/admin/shipments">
              <FolderOpen size={16} />
              Ver tablero
            </Link>
          </div>

          {errClients ? (
            <div className="msgWarn" style={{ marginTop: 10 }}>
              <b>Clientes</b>
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

        /* Dense list (sin headers) */
        .denseList {
          display: grid;
          gap: 8px;
        }
        .denseRow {
          text-decoration: none;
          color: var(--ff-text);
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: #fff;
          border-radius: 12px;
          padding: 10px 10px;
          display: grid;
          grid-template-columns: 1.3fr 1.2fr 0.45fr 0.85fr;
          gap: 10px;
          align-items: center;
          transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
        }
        .denseRow:hover {
          background: rgba(31, 122, 58, 0.045); /* verde MUY tenue */
          border-color: rgba(31, 122, 58, 0.18);
        }

        .col {
          min-width: 0;
        }
        .top {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: -0.1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .bottom {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Ajustes por columna */
        .codeCol .top {
          font-weight: 950;
        }
        .clientCol .top {
          font-weight: 850;
        }
        .destCol .top {
          font-weight: 950;
          letter-spacing: 0.3px;
        }
        .hitoCol {
          display: flex;
          justify-content: flex-end;
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
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Quick actions */
        .ctaGrid {
          display: grid;
          gap: 10px;
        }

        .ctaPrimary,
        .ctaSecondary {
          display: grid;
          grid-template-columns: 34px 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 12px;
          border-radius: 16px;
          text-decoration: none;
          border: 1px solid rgba(15, 23, 42, 0.10);
          transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
        }
        .ctaPrimary {
          background: linear-gradient(135deg, rgba(31, 122, 58, 1), rgba(31, 122, 58, 0.88));
          border-color: rgba(31, 122, 58, 0.35);
          color: #fff;
        }
        .ctaPrimary:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
        }

        .ctaSecondary {
          background: #fff;
          color: var(--ff-text);
        }
        .ctaSecondary:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
          background: rgba(15, 23, 42, 0.015);
        }

        .ctaIcon {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.25);
        }
        .ctaSecondary .ctaIcon {
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.10);
        }

        .ctaText {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .ctaTitle {
          font-weight: 950;
          letter-spacing: -0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ctaDesc {
          font-size: 12px;
          opacity: 0.9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ctaSecondary .ctaDesc {
          color: var(--ff-muted);
          opacity: 1;
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
          background: rgba(31, 122, 58, 0.04);
          border-color: rgba(31, 122, 58, 0.18);
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

        @media (max-width: 720px) {
          .denseRow {
            grid-template-columns: 1.2fr 1fr 0.45fr 1fr;
          }
          .miniMilestoneTxt {
            max-width: 120px;
          }
        }
      `}</style>
    </AdminLayout>
  );
}