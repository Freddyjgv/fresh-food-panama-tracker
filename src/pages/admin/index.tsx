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

// Fetch helper con timeout (evita “minutos” si algo se queda colgado)
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
        const inferredTotal = typeof cJson.total === "number" ? cJson.total : cJson.items?.length || 0;
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

  const activeShipments = useMemo(() => shipments.filter((s) => isActiveStatus(s.status)).length, [shipments]);

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria en 1 click. Denso, rápido, estilo ERP.">
      {/* KPIs + Refresh */}
      <div className="topBar">
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
        </div>

        <button className="btnGhost" type="button" onClick={load} disabled={loading} title="Refrescar">
          <RefreshCcw size={16} />
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div className="mainGrid">
        {/* LEFT: Últimos embarques */}
        <div className="card">
          <div className="cardHead">
            <div style={{ minWidth: 0 }}>
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
            <div className="sTable" role="list">
              {shipments.map((s) => (
                <Link key={s.id} href={`/admin/shipments/${s.id}`} className="sRow" role="listitem">
                  {/* Col 1: Código */}
                  <div className="c1">
                    <div className="cMain">{s.code}</div>
                    <div className="cSub">{fmtDate(s.created_at)}</div>
                  </div>

                  {/* Col 2: Cliente */}
                  <div className="c2">
                    <div className="cMain">{s.client_name || "—"}</div>
                  </div>

                  {/* Col 3: Destino */}
                  <div className="c3">
                    <span className="iata">{(s.destination || "").toUpperCase()}</span>
                  </div>

                  {/* Col 4: Hito */}
                  <div className="c4">
                    <MiniMilestone status={s.status} />
                  </div>

                  {/* Línea secundaria (spans col 1-2) */}
                  <div className="subline">{`${productInline(s)}`}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Acciones rápidas */}
        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="cardSub">Operación y ventas sin fricción.</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="actionGrid">
            <Link className="actionCard primary" href="/admin/shipments">
              <div className="actionIcon">
                <PackagePlus size={20} />
              </div>
              <div className="actionTitle">Crear embarque</div>
              <div className="actionMeta">Operación</div>
            </Link>

            <Link className="actionCard" href="/admin/quotes/new">
              <div className="actionIcon">
                <FilePlus2 size={20} />
              </div>
              <div className="actionTitle">Nueva cotización</div>
              <div className="actionMeta">Ventas</div>
            </Link>
          </div>

          <div style={{ height: 12 }} />

          <div className="miniLinks">
            <Link className="miniLink" href="/admin/shipments">
              <Package2 size={16} />
              <span>Embarques</span>
            </Link>
            <Link className="miniLink" href={QUOTE_PATH}>
              <Calculator size={16} />
              <span>Cotizador</span>
            </Link>
            <Link className="miniLink" href="/admin/users">
              <Users2 size={16} />
              <span>Clientes</span>
            </Link>
            <Link className="miniLink" href={QUOTE_PATH}>
              <History size={16} />
              <span>Historial</span>
            </Link>
          </div>

          <div className="tip">
            Tip: luego agregamos “Pendientes” por embarque (docs/fotos) como mini badges.
          </div>
        </div>
      </div>

      <style jsx>{`
        .topBar {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }

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
          border-radius: 999px;
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

        /* ===== Shipments: compact 4-col (no headers) ===== */
        .sTable {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 14px;
          background: #fff;
          overflow: hidden;
        }

        .sRow {
          display: grid;
          grid-template-columns: 1.15fr 1.35fr 0.55fr 0.95fr;
          grid-auto-rows: auto;
          align-items: center; /* ✅ alinea todo verticalmente */
          gap: 0;
          padding: 10px 12px;
          text-decoration: none;
          color: var(--ff-text);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          position: relative;
          transition: background 140ms ease, border-left-color 140ms ease;
          border-left: 3px solid transparent; /* para el efecto ERP */
        }
        .sRow:last-child {
          border-bottom: 0;
        }

        /* ✅ Hover tipo ERP (verde MUY tenue) */
        .sRow:hover {
          background: rgba(31, 122, 58, 0.045);
          border-left-color: rgba(31, 122, 58, 0.35);
        }

        .c1,
        .c2,
        .c3,
        .c4 {
          min-width: 0;
        }

        .cMain {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: -0.1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 18px;
        }
        .cSub {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 16px;
        }

        .c3 {
          display: flex;
          justify-content: center;
        }
        .iata {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(15, 23, 42, 0.02);
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.3px;
          color: rgba(15, 23, 42, 0.75);
          min-width: 52px;
        }

        .c4 {
          display: flex;
          justify-content: flex-end;
          align-items: center; /* ✅ */
          min-width: 0;
        }

        .subline {
          grid-column: 1 / span 2; /* ✅ Feb + producto debajo de Código+Cliente */
          margin-top: 4px;
          font-size: 12px;
          color: var(--ff-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
          line-height: 16px;
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

        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
        }

        /* ===== Quick Actions: modern tiles ===== */
        .actionGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 520px) {
          .actionGrid {
            grid-template-columns: 1fr;
          }
        }

        .actionCard {
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          border-radius: 16px;
          padding: 14px 12px;
          text-decoration: none;
          color: var(--ff-text);
          display: grid;
          justify-items: center; /* ✅ icono centrado */
          text-align: center;
          gap: 8px;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease;
          position: relative;
          overflow: hidden;
        }
        .actionCard:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, 0.10);
          border-color: rgba(31, 122, 58, 0.18);
          background: rgba(31, 122, 58, 0.03);
        }

        .actionCard.primary {
          border-color: rgba(31, 122, 58, 0.24);
          background: rgba(31, 122, 58, 0.045);
        }
        .actionCard.primary:hover {
          background: rgba(31, 122, 58, 0.06);
          border-color: rgba(31, 122, 58, 0.30);
        }

        .actionIcon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(15, 23, 42, 0.02);
          display: grid;
          place-items: center;
          color: var(--ff-green-dark);
        }
        .primary .actionIcon {
          border-color: rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.08);
        }

        .actionTitle {
          font-weight: 950;
          font-size: 13px;
          letter-spacing: -0.15px;
        }
        .actionMeta {
          font-size: 12px;
          color: var(--ff-muted);
          font-weight: 800;
        }

        .miniLinks {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .miniLink {
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
          transition: background 160ms ease, transform 160ms ease, border-color 160ms ease;
        }
        .miniLink:hover {
          background: rgba(31, 122, 58, 0.035);
          border-color: rgba(31, 122, 58, 0.18);
          transform: translateY(-1px);
        }

        .tip {
          margin-top: 12px;
          font-size: 12px;
          color: var(--ff-muted);
          border-top: 1px dashed rgba(15, 23, 42, 0.10);
          padding-top: 10px;
        }

        /* Responsive */
        @media (max-width: 720px) {
          .sRow {
            grid-template-columns: 1.2fr 1.2fr 0.55fr 1fr;
          }
          .miniMilestoneTxt {
            max-width: 130px;
          }
          .subline {
            max-width: 100%;
          }
        }
      `}</style>
    </AdminLayout>
  );
}