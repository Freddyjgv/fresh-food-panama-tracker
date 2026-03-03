import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RefreshCcw, PackagePlus, FilePlus2, Package2, Calculator, Users2,
  History, MapPin, PlaneIcon, PackageCheck, FileText,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";
import { labelStatus } from "../../lib/shipmentFlow";

type ShipmentListItem = {
  id: string; code: string; destination: string; status: string;
  created_at: string; client_name?: string | null;
  product_name?: string | null; product_variety?: string | null;
  product_mode?: string | null;
};

type ShipmentsApiResponse = {
  items: ShipmentListItem[]; total: number;
};

type ClientsApiResponse = {
  items: any[]; total?: number;
};

const QUOTE_PATH = "/admin/quotes";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA", {
      year: "numeric", month: "short", day: "2-digit",
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
  return !["AT_DESTINATION", "DELIVERED", "CLOSED"].includes(s);
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
  const Icon = up === "AT_DESTINATION" ? MapPin : up === "IN_TRANSIT" ? PlaneIcon : up === "DOCS_READY" ? FileText : up === "PACKED" ? PackageCheck : Package2;

  const style: React.CSSProperties = tone === "success" ? { background: "rgba(31,122,58,.10)", borderColor: "rgba(31,122,58,.22)", color: "var(--ff-green-dark)" } : tone === "warn" ? { background: "rgba(209,119,17,.12)", borderColor: "rgba(209,119,17,.24)", color: "#7a3f00" } : tone === "info" ? { background: "rgba(59,130,246,.10)", borderColor: "rgba(59,130,246,.22)", color: "rgba(30,64,175,1)" } : { background: "rgba(15,23,42,.04)", borderColor: "rgba(15,23,42,.12)", color: "var(--ff-text)" };

  return (
    <span className="miniMilestone" style={style} title={label}>
      <Icon size={14} />
      <span className="miniMilestoneTxt">{label}</span>
    </span>
  );
}

async function fetchJsonWithTimeout<T>(url: string, token: string, timeoutMs = 9000): Promise<T> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { window.clearTimeout(id); }
}

export default function AdminDashboard() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState(0);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [errShipments, setErrShipments] = useState<string | null>(null);
  const [errClients, setErrClients] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const activeShipments = useMemo(() => shipments.filter((s) => isActiveStatus(s.status)).length, [shipments]);

  async function load() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setErrShipments(null); setErrClients(null);
    setShipmentsLoading(true); setClientsLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("No session");

      // Carga Independiente de Embarques
      fetchJsonWithTimeout<ShipmentsApiResponse>(`/.netlify/functions/listShipments?page=1&dir=desc&mode=admin`, token)
        .then(res => {
          setShipments(res.items?.slice(0, 10) || []);
          setShipmentsTotal(res.total || 0);
        })
        .catch(e => setErrShipments(e.message))
        .finally(() => setShipmentsLoading(false));

      // Carga Independiente de Clientes (Blindada)
      fetchJsonWithTimeout<ClientsApiResponse>(`/.netlify/functions/listClients`, token)
        .then(res => {
          setClientsTotal(res.total ?? (res.items?.length || 0));
        })
        .catch(e => setErrClients("Error en contador"))
        .finally(() => setClientsLoading(false));

    } catch (e: any) {
      setErrShipments(e.message);
      setShipmentsLoading(false); setClientsLoading(false);
    } finally { inFlightRef.current = false; }
  }

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria en 1 click.">
      <div className="kpiStrip">
        <div className="kpiChip"><span className="kpiLbl">Embarques</span><span className="kpiVal">{shipmentsLoading ? "—" : shipmentsTotal}</span></div>
        <div className="kpiChip"><span className="kpiLbl">Activos</span><span className="kpiVal">{shipmentsLoading ? "—" : activeShipments}</span></div>
        <div className="kpiChip"><span className="kpiLbl">Clientes</span><span className="kpiVal">{clientsLoading ? "—" : clientsTotal}</span></div>
        <button className="btnGhost" onClick={load} disabled={shipmentsLoading || clientsLoading}><RefreshCcw size={16} className={shipmentsLoading ? 'spin' : ''} /> Refrescar</button>
      </div>

      <div className="mainGrid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="cardHead">
            <div className="cardTitle">Últimos embarques</div>
            <Link href="/admin/shipments" className="btnSmall">Ver todos →</Link>
          </div>
          <div className="ff-divider" style={{ margin: "12px 0" }} />
          {errShipments ? <div className="msgWarn">{errShipments}</div> : (
            <div className="shipGrid">
              {shipmentsLoading ? <div className="tEmpty">Cargando...</div> : shipments.map((s) => (
                <Link key={s.id} href={`/admin/shipments/${s.id}`} className="shipRow">
                  <div className="cell"><div className="main code">{s.code}</div><div className="sub">{fmtDate(s.created_at)}</div></div>
                  <div className="cell"><div className="main client">{s.client_name || "—"}</div><div className="sub">{productInline(s)}</div></div>
                  <div className="cell dest"><div className="main">{(s.destination || "").toUpperCase()}</div></div>
                  <div className="cell milestone"><MiniMilestone status={s.status} /></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="ctaGrid" style={{ marginTop: 15 }}>
            <Link href="/admin/shipments" className="ctaCard primary">
              <div className="ctaIcon"><PackagePlus size={22} /></div>
              <div className="ctaTitle">Crear embarque</div>
            </Link>
            <Link href="/admin/users" className="ctaCard">
              <div className="ctaIcon"><Users2 size={22} /></div>
              <div className="ctaTitle">Gestionar Clientes</div>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .kpiStrip { display: flex; gap: 10px; align-items: center; }
        .kpiChip { padding: 10px 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; display: flex; gap: 8px; align-items: baseline; }
        .kpiLbl { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .kpiVal { font-size: 18px; font-weight: 900; }
        .btnGhost { margin-left: auto; border: 1px solid #e2e8f0; background: white; padding: 8px 12px; border-radius: 8px; cursor: pointer; display: flex; gap: 6px; font-size: 12px; font-weight: bold; }
        .mainGrid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 20px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
        .cardHead { display: flex; justify-content: space-between; align-items: center; }
        .cardTitle { font-weight: 900; font-size: 15px; }
        .shipGrid { border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden; }
        .shipRow { display: grid; grid-template-columns: 1fr 1.5fr 0.8fr 1fr; padding: 12px; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit; }
        .shipRow:hover { background: #f8fafc; }
        .code { color: #1f7a3a; }
        .ctaGrid { display: grid; gap: 10px; }
        .ctaCard { padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; text-decoration: none; color: inherit; display: flex; align-items: center; gap: 12px; }
        .ctaCard.primary { background: #f0fdf4; border-color: #bcf0da; }
        .miniMilestone { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: bold; }
        @media (max-width: 1000px) { .mainGrid { grid-template-columns: 1fr; } }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}