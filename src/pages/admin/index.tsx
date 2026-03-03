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
  ExternalLink,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";
import { labelStatus } from "../../lib/shipmentFlow";

type ShipmentListItem = {
  id: string;
  code: string;
  destination: string;
  status: string;
  created_at: string;
  client_id?: string | null;
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

type ClientsApiResponse = {
  items: any[];
  total?: number;
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

async function getAccessTokenOnce(tokenRef: React.MutableRefObject<string | null>) {
  if (tokenRef.current) return tokenRef.current;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || null;
  tokenRef.current = token;
  return token;
}

async function fetchJsonWithTimeout<T>(url: string, token: string, timeoutMs = 9000): Promise<T> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(id);
  }
}

export default function AdminDashboard() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);
  const [clientsTotal, setClientsTotal] = useState<number>(0);

  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [errShipments, setErrShipments] = useState<string | null>(null);
  const [errClients, setErrClients] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const activeShipments = useMemo(
    () => shipments.filter((s) => isActiveStatus(s.status)).length,
    [shipments]
  );
  const anyLoading = shipmentsLoading || clientsLoading;

  async function load() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErrShipments(null);
    setErrClients(null);
    setShipmentsLoading(true);
    setClientsLoading(true);

    try {
      const token = await getAccessTokenOnce(tokenRef);
      if (!token) {
        setErrShipments("Sesión no disponible.");
        setErrClients("Sesión no disponible.");
        return;
      }
      const qs = new URLSearchParams();
      qs.set("page", "1");
      qs.set("dir", "desc");
      qs.set("mode", "admin");

      const shipmentsUrl = `/.netlify/functions/listShipments?${qs.toString()}`;
      const clientsUrl = `/.netlify/functions/listClients`;

      const [sRes, cRes] = await Promise.allSettled([
        fetchJsonWithTimeout<ShipmentsApiResponse>(shipmentsUrl, token, 9000),
        fetchJsonWithTimeout<ClientsApiResponse>(clientsUrl, token, 9000),
      ]);

      if (sRes.status === "fulfilled") {
        setShipments(sRes.value.items?.slice(0, 10) || []);
        setShipmentsTotal(sRes.value.total ?? (sRes.value.items?.length || 0));
      } else {
        setErrShipments(sRes.reason?.message || "Error cargando embarques");
      }

      if (cRes.status === "fulfilled") {
        setClientsTotal(typeof cRes.value.total === "number" ? cRes.value.total : cRes.value.items?.length || 0);
      } else {
        setErrClients(cRes.reason?.message || "Error cargando clientes");
      }
    } finally {
      setShipmentsLoading(false);
      setClientsLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria ERP.">
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
        <button className="btnGhost" type="button" onClick={load} disabled={anyLoading}>
          <RefreshCcw size={16} className={anyLoading ? "animate-spin" : ""} />
          {anyLoading ? "..." : "Refrescar"}
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div className="mainGrid">
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Últimos embarques</div>
              <div className="cardSub">Código · Cliente · Destino · Hito</div>
            </div>
            <Link href="/admin/shipments" legacyBehavior>
              <a className="btnSmall">Ver todos →</a>
            </Link>
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          {errShipments ? (
            <div className="msgWarn">{errShipments}</div>
          ) : (
            <div className="shipGrid">
              {shipmentsLoading ? (
                 <div className="p-4 text-center text-xs text-gray-400">Cargando datos...</div>
              ) : shipments.length === 0 ? (
                <div className="tEmpty">No hay embarques.</div>
              ) : (
                shipments.map((s) => (
                  <div key={s.id} className="shipRow">
                    {/* ENLACE AL EMBARQUE */}
                    <Link href={`/admin/shipments/${s.id}`} legacyBehavior>
                      <a className="cell pointer-area">
                        <div className="main code">{s.code}</div>
                        <div className="sub">{fmtDate(s.created_at)}</div>
                      </a>
                    </Link>

                    {/* ENLACE AL CLIENTE */}
                    <div className="cell">
                      <Link href={s.client_id ? `/admin/clients/${s.client_id}` : `/admin/users?q=${encodeURIComponent(s.client_name || '')}`} legacyBehavior>
                        <a className="client-link-dashboard">
                          <div className="main client">
                            {s.client_name || "—"} 
                            <ExternalLink size={10} style={{ marginLeft: 6, opacity: 0.4, display: 'inline' }} />
                          </div>
                        </a>
                      </Link>
                      <div className="sub">{productInline(s)}</div>
                    </div>

                    <div className="cell dest">
                      <div className="main">{(s.destination || "").toUpperCase()}</div>
                      <div className="sub">&nbsp;</div>
                    </div>

                    <div className="cell milestone">
                      <MiniMilestone status={s.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="ff-divider" style={{ margin: "12px 0" }} />
          <div className="ctaGrid">
            <Link href="/admin/shipments" legacyBehavior>
              <a className="ctaCard primary">
                <PackagePlus size={22} />
                <div className="ctaTitle">Crear embarque</div>
              </a>
            </Link>
            <Link href="/admin/quotes/new" legacyBehavior>
              <a className="ctaCard secondary">
                <FilePlus2 size={22} />
                <div className="ctaTitle">Nueva cotización</div>
              </a>
            </Link>
          </div>
          <div className="miniGrid">
             <Link href="/admin/users" legacyBehavior><a className="miniCard"><Users2 size={16}/> Clientes</a></Link>
             <Link href="/admin/quotes" legacyBehavior><a className="miniCard"><Calculator size={16}/> Cotizador</a></Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .kpiStrip { display: flex; gap: 10px; align-items: center; }
        .kpiChip { display: flex; align-items: baseline; gap: 8px; padding: 8px 12px; border: 1px solid var(--ff-border); background: #fff; border-radius: 12px; }
        .kpiLbl { font-size: 11px; font-weight: 900; color: var(--ff-muted); text-transform: uppercase; }
        .kpiVal { font-size: 16px; font-weight: 900; }
        .btnGhost { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--ff-border); background: #fff; font-size: 12px; cursor: pointer; font-weight: 700; }
        .mainGrid { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media (min-width: 1024px) { .mainGrid { grid-template-columns: 2fr 1fr; } }
        .card { background: #fff; border: 1px solid var(--ff-border); border-radius: 12px; padding: 16px; box-shadow: var(--ff-shadow); }
        .cardTitle { font-weight: 900; font-size: 15px; }
        .cardSub { font-size: 12px; color: var(--ff-muted); }
        .shipGrid { border: 1px solid var(--ff-border); border-radius: 8px; }
        .shipRow { display: grid; grid-template-columns: 1fr 1.5fr 0.8fr 1fr; padding: 12px; border-bottom: 1px solid var(--ff-border); }
        .shipRow:last-child { border-bottom: 0; }
        .pointer-area { cursor: pointer; text-decoration: none; color: inherit; }
        .client-link-dashboard { text-decoration: none; color: inherit; cursor: pointer; }
        .client-link-dashboard:hover .client { color: var(--ff-green-dark); text-decoration: underline; }
        .main { font-size: 13px; font-weight: 800; }
        .sub { font-size: 11px; color: var(--ff-muted); }
        .miniMilestone { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid; }
        .ctaGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ctaCard { padding: 16px; border-radius: 12px; border: 1px solid var(--ff-border); text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s; }
        .ctaCard:hover { border-color: var(--ff-green-dark); background: rgba(31,122,58,0.05); }
        .ctaTitle { font-weight: 800; font-size: 13px; }
        .miniGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        .miniCard { display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--ff-border); border-radius: 8px; text-decoration: none; color: inherit; font-size: 12px; font-weight: 700; }
        .ff-divider { height: 1px; background: var(--ff-border); width: 100%; }
        .msgWarn { color: #7a3f00; background: #fffbeb; padding: 10px; border-radius: 8px; font-size: 12px; }
      `}</style>
    </AdminLayout>
  );
}