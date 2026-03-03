import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RefreshCcw,
  PackagePlus,
  FilePlus2,
  Package2,
  Calculator,
  Users2,
  MapPin,
  Truck,
  PackageCheck,
  FileText,
  ExternalLink,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";
import { labelStatus } from "../../lib/shipmentFlow";

// --- TIPOS ---
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

// --- HELPERS ---
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch { return iso; }
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
  const Icon = up === "AT_DESTINATION" ? MapPin : up === "IN_TRANSIT" ? Truck : up === "DOCS_READY" ? FileText : up === "PACKED" ? PackageCheck : Package2;

  const style: React.CSSProperties =
    tone === "success" ? { background: "rgba(31,122,58,.10)", borderColor: "rgba(31,122,58,.22)", color: "var(--ff-green-dark)" }
    : tone === "warn" ? { background: "rgba(209,119,17,.12)", borderColor: "rgba(209,119,17,.24)", color: "#7a3f00" }
    : tone === "info" ? { background: "rgba(59,130,246,.10)", borderColor: "rgba(59,130,246,.22)", color: "rgba(30,64,175,1)" }
    : { background: "rgba(15,23,42,.04)", borderColor: "rgba(15,23,42,.12)", color: "var(--ff-text)" };

  return (
    <span className="miniMilestone" style={style} title={label}>
      <Icon size={14} />
      <span className="miniMilestoneTxt">{label}</span>
    </span>
  );
}

// --- API FETCHERS ---
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
    const res = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally { window.clearTimeout(id); }
}

export default function AdminDashboard() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);
  const [clientsTotal, setClientsTotal] = useState<number>(0);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [errShipments, setErrShipments] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const activeShipments = useMemo(() => shipments.filter((s) => isActiveStatus(s.status)).length, [shipments]);
  const anyLoading = shipmentsLoading || clientsLoading;

  async function load() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErrShipments(null);
    setShipmentsLoading(true);
    setClientsLoading(true);

    try {
      const token = await getAccessTokenOnce(tokenRef);
      if (!token) return;

      const shipmentsUrl = `/.netlify/functions/listShipments?page=1&dir=desc&mode=admin`;
      const clientsUrl = `/.netlify/functions/listClients`;

      const [sRes, cRes] = await Promise.allSettled([
        fetchJsonWithTimeout<ShipmentsApiResponse>(shipmentsUrl, token),
        fetchJsonWithTimeout<ClientsApiResponse>(clientsUrl, token),
      ]);

      if (sRes.status === "fulfilled") {
        setShipments(sRes.value.items?.slice(0, 10) || []);
        setShipmentsTotal(sRes.value.total ?? 0);
      } else { setErrShipments("Error cargando embarques"); }

      if (cRes.status === "fulfilled") {
        // CORRECCIÓN AQUÍ: Paréntesis para evitar error de linting
        setClientsTotal(cRes.value.total ?? (cRes.value.items?.length || 0));
      }
    } finally {
      setShipmentsLoading(false);
      setClientsLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria ERP.">
      <div className="kpiStrip">
        <div className="kpiChip"><span className="kpiLbl">Embarques</span><span className="kpiVal">{shipmentsLoading ? "—" : shipmentsTotal}</span></div>
        <div className="kpiChip"><span className="kpiLbl">Activos</span><span className="kpiVal">{shipmentsLoading ? "—" : activeShipments}</span></div>
        <div className="kpiChip"><span className="kpiLbl">Clientes</span><span className="kpiVal">{clientsLoading ? "—" : clientsTotal}</span></div>
        <button className="btnGhost" type="button" onClick={load} disabled={anyLoading}>
          <RefreshCcw size={16} className={anyLoading ? "animate-spin" : ""} /> {anyLoading ? "..." : "Refrescar"}
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
            <Link href="/admin/shipments" className="btnSmall">Ver todos →</Link>
          </div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          {errShipments ? <div className="msgWarn">{errShipments}</div> : (
            <div className="shipGrid">
              {shipmentsLoading ? <div className="p-4 text-center text-xs text-gray-400">Cargando datos...</div>
              : shipments.length === 0 ? <div className="tEmpty">No hay embarques.</div>
              : shipments.map((s) => (
                  <div key={s.id} className="shipRow">
                    {/* CELDA CÓDIGO */}
                    <Link href={`/admin/shipments/${s.id}`} className="cell pointer-area">
                        <div className="main code">{s.code}</div>
                        <div className="sub">{fmtDate(s.created_at)}</div>
                    </Link>

                    {/* CELDA CLIENTE */}
                    <div className="cell">
                      {s.client_id ? (
                        <Link href={`/admin/clients/${s.client_id}`} className="client-link-dashboard">
                            <div className="main client">
                              {s.client_name || "—"} 
                              <ExternalLink size={10} style={{ marginLeft: 6, opacity: 0.4 }} />
                            </div>
                        </Link>
                      ) : (
                        <div className="main client" style={{color: '#94a3b8'}}>{s.client_name || "—"}</div>
                      )}
                      <div className="sub">{productInline(s)}</div>
                    </div>

                    <div className="cell dest">
                      <div className="main">{(s.destination || "").toUpperCase()}</div>
                    </div>

                    <div className="cell milestone">
                      <MiniMilestone status={s.status} />
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <div className="card actions-side">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="ff-divider" style={{ margin: "12px 0" }} />
          <div className="ctaGrid">
            <Link href="/admin/shipments/new" className="ctaCard primary">
                <PackagePlus size={22} />
                <div className="ctaTitle">Crear embarque</div>
            </Link>
            <Link href="/admin/quotes/new" className="ctaCard secondary">
                <FilePlus2 size={22} />
                <div className="ctaTitle">Nueva cotización</div>
            </Link>
          </div>
          <div className="miniGrid">
             <Link href="/admin/users" className="miniCard"><Users2 size={16}/> Directorio</Link>
             <Link href="/admin/quotes" className="miniCard"><Calculator size={16}/> Cotizador</Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .kpiStrip { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
        .kpiChip { display: flex; align-items: baseline; gap: 8px; padding: 8px 12px; border: 1px solid #e2e8f0; background: #fff; border-radius: 12px; }
        .kpiLbl { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; }
        .kpiVal { font-size: 16px; font-weight: 900; }
        .btnGhost { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; font-size: 12px; cursor: pointer; font-weight: 700; }
        
        .mainGrid { display: grid; gap: 16px; grid-template-columns: 1fr; }
        @media (min-width: 1024px) { .mainGrid { grid-template-columns: 2.2fr 1fr; } }
        
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .cardHead { display: flex; justify-content: space-between; align-items: start; }
        .cardTitle { font-weight: 900; font-size: 15px; }
        .cardSub { font-size: 12px; color: #64748b; }
        
        .btnSmall { font-size: 12px; color: #1f7a3a; text-decoration: none; font-weight: 700; }
        .btnSmall:hover { text-decoration: underline; }

        .shipGrid { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .shipRow { display: grid; grid-template-columns: 100px 1.5fr 1fr 140px; border-bottom: 1px solid #e2e8f0; align-items: center; }
        .shipRow:last-child { border-bottom: 0; }
        .shipRow:hover { background: #f8fafc; }

        :global(.pointer-area), :global(.client-link-dashboard) { 
          padding: 12px;
          display: block; 
          text-decoration: none !important; 
          color: inherit !important; 
          cursor: pointer !important;
          transition: all 0.2s;
        }

        :global(.client-link-dashboard:hover) .client { color: #1f7a3a; text-decoration: underline; }
        :global(.pointer-area:hover) .code { color: #1f7a3a; }

        .cell { padding: 12px; }
        .main { font-size: 13px; font-weight: 800; }
        .code { color: #1e293b; }
        .sub { font-size: 11px; color: #64748b; }
        
        .miniMilestone { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 20px; font-size: 10px; font-weight: 800; border: 1px solid; white-space: nowrap; }
        
        .ctaGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        :global(.ctaCard) { padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 8px; cursor: pointer; }
        :global(.ctaCard.primary) { background: #1f7a3a; color: white; border: none; }
        :global(.ctaCard.secondary) { background: #fff; }
        :global(.ctaCard:hover) { transform: translateY(-2px); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }

        .miniGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        :global(.miniCard) { display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #475569; font-size: 12px; font-weight: 700; background: #fff; cursor: pointer; }
        :global(.miniCard:hover) { border-color: #1f7a3a; color: #1f7a3a; }
        
        .ff-divider { height: 1px; background: #e2e8f0; width: 100%; }
        .msgWarn { color: #7a3f00; background: #fffbeb; padding: 10px; border-radius: 8px; font-size: 12px; border: 1px solid #fde68a; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}