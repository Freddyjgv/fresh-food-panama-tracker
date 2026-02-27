// src/pages/admin/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

type ClientsApiResponse = {
  items: { id: string; name: string }[];
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

/**
 * ✅ Arquitectura main@1bf36a1:
 * - Dashboard NO llama supabase.auth.getSession()
 * - Tomamos token del storage (instantáneo, sin loops)
 */
function getAccessTokenFromStorage(): string | null {
  try {
    // Busca cualquier key tipo sb-xxxx-auth-token
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (!k.endsWith("-auth-token")) continue;

      const raw = localStorage.getItem(k);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      // Supabase suele guardar { access_token, refresh_token, ... }
      if (parsed?.access_token) return String(parsed.access_token);

      // A veces viene anidado
      if (parsed?.currentSession?.access_token) return String(parsed.currentSession.access_token);
      if (parsed?.session?.access_token) return String(parsed.session.access_token);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  token: string,
  timeoutMs = 9000
): Promise<T> {
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
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Timeout (abort)");
    throw e;
  } finally {
    window.clearTimeout(id);
  }
}

export default function AdminDashboard() {
  // UI FIRST
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [shipmentsTotal, setShipmentsTotal] = useState<number>(0);
  const [clientsTotal, setClientsTotal] = useState<number>(0);

  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [errShipments, setErrShipments] = useState<string | null>(null);
  const [errClients, setErrClients] = useState<string | null>(null);

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
      const token = getAccessTokenFromStorage();
      if (!token) {
        // NO redirigimos, NO loop: solo mostramos error y dejamos UI viva
        setErrShipments("Sin token. Abre /login en otra pestaña y vuelve a cargar.");
        setErrClients("Sin token.");
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
        setErrShipments(sRes.reason?.message || "No se pudieron cargar embarques");
      }

      if (cRes.status === "fulfilled") {
        const inferredTotal =
          typeof cRes.value.total === "number" ? cRes.value.total : cRes.value.items?.length || 0;
        setClientsTotal(inferredTotal);
      } else {
        setErrClients(cRes.reason?.message || "No se pudieron cargar clientes");
      }
    } finally {
      setShipmentsLoading(false);
      setClientsLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout title="Dashboard" subtitle="Operación diaria en 1 click. Denso, rápido, estilo ERP.">
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
          {anyLoading ? "Actualizando…" : "Refrescar"}
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
            <div className="shipGrid">
              {shipmentsLoading ? (
                <>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="shipRow skeleton">
                      <div className="cell">
                        <div className="sk sk1" />
                        <div className="sk sk2" />
                      </div>
                      <div className="cell">
                        <div className="sk sk1" />
                        <div className="sk sk2" />
                      </div>
                      <div className="cell dest">
                        <div className="sk sk1" />
                        <div className="sk sk2" />
                      </div>
                      <div className="cell milestone">
                        <div className="sk skPill" />
                      </div>
                    </div>
                  ))}
                </>
              ) : shipments.length === 0 ? (
                <div className="tEmpty">Aún no hay embarques.</div>
              ) : (
                shipments.map((s) => (
                  <Link key={s.id} href={`/admin/shipments/${s.id}`} className="shipRow">
                    <div className="cell">
                      <div className="main code">{s.code}</div>
                      <div className="sub">{fmtDate(s.created_at)}</div>
                    </div>

                    <div className="cell">
                      <div className="main client">{s.client_name || "—"}</div>
                      <div className="sub">{productInline(s)}</div>
                    </div>

                    <div className="cell dest">
                      <div className="main">{(s.destination || "").toUpperCase()}</div>
                      <div className="sub">&nbsp;</div>
                    </div>

                    <div className="cell milestone">
                      <MiniMilestone status={s.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="cardTitle">Acciones rápidas</div>
          <div className="cardSub">2-up pro, hover premium, íconos centrados.</div>

          <div className="ff-divider" style={{ margin: "12px 0" }} />

          <div className="ctaGrid">
            <Link className="ctaCard primary" href="/admin/shipments">
              <div className="ctaIcon">
                <PackagePlus size={22} />
              </div>
              <div className="ctaTitle">Crear embarque</div>
              <div className="ctaDesc">Operación, hitos, docs y fotos.</div>
              <div className="ctaFoot">Operación</div>
            </Link>

            <Link className="ctaCard secondary" href="/admin/quotes/new">
              <div className="ctaIcon">
                <FilePlus2 size={22} />
              </div>
              <div className="ctaTitle">Nueva cotización</div>
              <div className="ctaDesc">Cotiza rápido (AIR/SEA) y guarda historial.</div>
              <div className="ctaFoot">Ventas</div>
            </Link>
          </div>

          <div style={{ height: 10 }} />

          <div className="miniGrid">
            <Link className="miniCard" href="/admin/shipments">
              <Package2 size={16} />
              <span>Embarques</span>
            </Link>
            <Link className="miniCard" href={QUOTE_PATH}>
              <Calculator size={16} />
              <span>Cotizador</span>
            </Link>
            <Link className="miniCard" href="/admin/users">
              <Users2 size={16} />
              <span>Clientes</span>
            </Link>
            <Link className="miniCard" href={QUOTE_PATH}>
              <History size={16} />
              <span>Historial</span>
            </Link>
          </div>

          {errClients ? (
            <div className="hintWarn">
              No se pudo cargar el total de clientes: <b>{errClients}</b>
            </div>
          ) : (
            <div className="hint">Tip: luego sumamos mini-badges de pendientes (docs/fotos).</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .kpiStrip { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .kpiChip { display:inline-flex; align-items:baseline; gap:8px; padding:8px 10px; border:1px solid var(--ff-border); background:var(--ff-surface); border-radius:12px; box-shadow:var(--ff-shadow); }
        .kpiLbl { font-size:12px; font-weight:900; color:var(--ff-muted); }
        .kpiVal { font-size:16px; font-weight:950; letter-spacing:-0.2px; }

        .btnGhost { margin-left:auto; display:inline-flex; align-items:center; gap:8px; height:36px; padding:0 12px; border-radius:var(--ff-radius); border:1px solid var(--ff-border); background:#fff; font-size:12px; font-weight:900; cursor:pointer; color:var(--ff-text); }
        .btnGhost:hover { background:rgba(31,122,58,0.05); border-color:rgba(31,122,58,0.18); }
        .btnGhost:disabled { opacity:.6; cursor:not-allowed; }

        .mainGrid { display:grid; gap:12px; grid-template-columns:1fr; }
        @media (min-width:1100px){ .mainGrid{ grid-template-columns:1.7fr 1fr; align-items:start; } }

        .card { background:var(--ff-surface); border:1px solid var(--ff-border); border-radius:var(--ff-radius); box-shadow:var(--ff-shadow); padding:12px; }
        .cardHead { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap; }
        .cardTitle { font-weight:950; font-size:14px; letter-spacing:-0.2px; }
        .cardSub { margin-top:4px; font-size:12px; color:var(--ff-muted); }

        .btnSmall { display:inline-flex; align-items:center; gap:8px; height:34px; padding:0 10px; border-radius:var(--ff-radius); border:1px solid var(--ff-border); background:#fff; font-size:12px; font-weight:900; cursor:pointer; color:var(--ff-text); text-decoration:none; white-space:nowrap; }
        .btnSmall:hover { background:rgba(31,122,58,0.05); border-color:rgba(31,122,58,0.18); }

        .shipGrid { border:1px solid rgba(15,23,42,0.08); border-radius:12px; overflow:hidden; background:#fff; }
        .shipRow { display:grid; grid-template-columns:1.2fr 1.6fr 0.55fr 0.95fr; align-items:center; padding:10px 12px; text-decoration:none; color:var(--ff-text); border-bottom:1px solid rgba(15,23,42,0.06); transition:background 160ms ease; }
        .shipRow:last-child{ border-bottom:0; }
        .shipRow:hover{ background:rgba(31,122,58,0.055); }

        .cell{ min-width:0; }
        .main{ font-size:13px; font-weight:700; letter-spacing:-0.1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .main.code{ font-weight:950; }
        .main.client{ font-weight:800; }
        .sub{ margin-top:2px; font-size:12px; color:var(--ff-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cell.milestone{ display:flex; justify-content:flex-end; align-items:center; }

        .miniMilestone{ display:inline-flex; align-items:center; gap:8px; border-radius:999px; border:1px solid; padding:6px 10px; font-weight:900; font-size:12px; line-height:16px; white-space:nowrap; }
        .miniMilestoneTxt{ max-width:170px; overflow:hidden; text-overflow:ellipsis; }

        .tEmpty{ padding:12px; font-size:12px; color:var(--ff-muted); }

        .skeleton{ pointer-events:none; }
        .sk{ border-radius:8px; background:rgba(15,23,42,0.06); overflow:hidden; position:relative; }
        .sk:after{ content:""; position:absolute; inset:0; transform:translateX(-60%); background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%); animation:shimmer 1.1s infinite; }
        @keyframes shimmer{ 0%{ transform:translateX(-60%);} 100%{ transform:translateX(60%);} }
        .sk1{ height:12px; width:68%; }
        .sk2{ height:10px; width:88%; margin-top:6px; }
        .skPill{ height:26px; width:150px; border-radius:999px; }

        .ctaGrid{ display:grid; grid-template-columns:1fr; gap:10px; }
        @media (min-width:900px){ .ctaGrid{ grid-template-columns:1fr 1fr; } }

        .ctaCard{ text-decoration:none; border-radius:16px; border:1px solid rgba(15,23,42,0.1); padding:14px; display:grid; gap:10px; transition:transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease; box-shadow:0 8px 22px rgba(2,6,23,0.05); }
        .ctaCard:hover{ transform:translateY(-1px); box-shadow:0 14px 34px rgba(2,6,23,0.10); border-color:rgba(31,122,58,0.22); background:rgba(31,122,58,0.04); }

        .ctaIcon{ width:44px; height:44px; border-radius:14px; display:grid; place-items:center; border:1px solid rgba(15,23,42,0.12); background:rgba(15,23,42,0.03); }

        .ctaTitle{ font-weight:950; letter-spacing:-0.2px; font-size:14px; line-height:18px; color:var(--ff-text); }
        .ctaDesc{ font-size:12px; color:var(--ff-muted); line-height:16px; }
        .ctaFoot{ font-size:11px; font-weight:950; letter-spacing:0.2px; text-transform:uppercase; color:rgba(15,23,42,0.55); margin-top:2px; }

        .ctaCard.primary{ background:linear-gradient(180deg, rgba(31,122,58,0.12) 0%, rgba(31,122,58,0.04) 100%); border-color:rgba(31,122,58,0.22); }
        .ctaCard.primary .ctaIcon{ border-color:rgba(31,122,58,0.22); background:rgba(31,122,58,0.10); color:var(--ff-green-dark); }
        .ctaCard.secondary{ background:#fff; }

        .miniGrid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .miniCard{ display:inline-flex; align-items:center; gap:10px; padding:10px 10px; border-radius:12px; border:1px solid rgba(15,23,42,0.10); background:#fff; text-decoration:none; color:var(--ff-text); font-weight:900; font-size:12px; transition:background 160ms ease, border-color 160ms ease; }
        .miniCard:hover{ background:rgba(31,122,58,0.05); border-color:rgba(31,122,58,0.18); }

        .hint{ margin-top:10px; font-size:12px; color:var(--ff-muted); border-top:1px dashed rgba(15,23,42,0.10); padding-top:10px; }
        .hintWarn{ margin-top:10px; font-size:12px; border-top:1px dashed rgba(209,119,17,0.28); padding-top:10px; color:rgba(122,63,0,0.95); }
        .msgWarn{ border:1px solid rgba(209,119,17,0.35); background:rgba(209,119,17,0.08); padding:10px; border-radius:var(--ff-radius); font-size:12px; }
      `}</style>
    </AdminLayout>
  );
}