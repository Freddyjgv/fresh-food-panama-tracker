// src/pages/shipments/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

import { ClientLayout } from "../../components/ClientLayout";
import { ProgressStepper } from "../../components/ProgressStepper";
import { Timeline as ModernTimeline } from "../../components/Timeline";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";

import { FileText, Image as ImageIcon, Download, Info, ArrowLeft, Package, MapPin, Shield } from "lucide-react";

/* =======================
   Types
======================= */
type Milestone = { type: string; at: string; note?: string | null };

type FileItem = {
  id: string;
  filename: string;
  created_at: string;
  doc_type?: string | null;
  url?: string | null;
};

type ShipmentDetail = {
  id: string;
  code: string;
  destination: string;
  incoterm?: string | null; // ✅ Agregado: Incoterm
  status: string;
  created_at: string;

  client_name?: string | null;
  clients?: { name?: string | null } | null;
  client?: { name?: string | null } | null;

  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;

  caliber?: string | null;
  color?: string | null;

  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;
  flight_number?: string | null;
  awb?: string | null;

  milestones: Milestone[];
  documents: FileItem[];
  photos: FileItem[];
};

/* =======================
   Utils
======================= */
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PA", {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
  } catch {
    return String(iso);
  }
}

function clientNameLine(d: ShipmentDetail) {
  return String(d.client_name || d.clients?.name || d.client?.name || "").trim() || "—";
}

function productLine(d: ShipmentDetail) {
  const name = String(d.product_name || "").trim();
  const variety = String(d.product_variety || "").trim();
  const modeRaw = String(d.product_mode || "").trim();

  const mode = (() => {
    const s = modeRaw.toLowerCase();
    if (!s) return "";
    if (s.includes("aere") || s === "air") return "Aérea";
    if (s.includes("marit") || s === "sea") return "Marítima";
    return modeRaw;
  })();

  const left = [name, variety].filter(Boolean).join(" ");
  return [left, mode].filter(Boolean).join(" · ") || "—";
}

export default function ShipmentDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(shipmentId: string) {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { window.location.href = "/login"; return; }

      const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await res.text() || "Error cargando embarque");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof id === "string") load(id);
  }, [id]);

  async function download(fileId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  const normalizedMilestonesForTimeline = useMemo(() => {
    const list = data?.milestones ?? [];
    return list.map((m, idx) => ({
      id: `${m.type}-${idx}`,
      type: m.type,
      created_at: m.at,
      note: m.note,
    })).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [data?.milestones]);

  if (loading) return <ClientLayout title="Cargando..."><div className="ff-sub">Preparando información del trayecto...</div></ClientLayout>;

  return (
    <ClientLayout title="Expediente de Embarque" subtitle="Seguimiento en tiempo real y documentación">
      <div className="ff-spread" style={{ marginBottom: 16 }}>
        <Link href="/shipments" className="ff-btn ff-btn-ghost"><ArrowLeft size={16} /> Volver al listado</Link>
      </div>

      {data && (
        <div className="page">
          {/* HERO HEADER */}
          <div className="hero">
            <div className="heroLeft">
              <div className="codeRow">
                <div className="codeIcon"><Package size={20} color="var(--ff-green-dark)" /></div>
                <div style={{minWidth: 0}}>
                  <div className="heroLabel">Identificador Único</div>
                  <div className="code">{data.code}</div>
                  <div className="productLine">{productLine(data)}</div>
                </div>
              </div>
            </div>
            <div className="heroRight">
              <span className="pill green"><MapPin size={14}/> {data.destination}</span>
              <span className="pill blue"><Shield size={14}/> {data.incoterm || 'FOB'}</span>
              <span className={statusBadgeClass(data.status)}>{labelStatus(data.status)}</span>
            </div>
          </div>

          {/* PROGRESS */}
          <div className="block">
            <ProgressStepper milestones={data.milestones ?? []} flightNumber={data.flight_number ?? null} />
          </div>

          <div className="grid2">
            {/* KPI PANEL */}
            <div className="ff-card ff-card-pad soft">
              <div className="sectionTitle"><Info size={16} /> Especificaciones de Carga</div>
              <div className="kpiRow">
                <div className="kpi"><div className="kpiLabel">Incoterm</div><div className="kpiValue text-blue">{data.incoterm || 'FOB'}</div></div>
                <div className="kpi"><div className="kpiLabel">Cajas</div><div className="kpiValue">{data.boxes || '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Pallets</div><div className="kpiValue">{data.pallets || '—'}</div></div>
              </div>
              <div className="kpiRow" style={{ marginTop: 12 }}>
                <div className="kpi"><div className="kpiLabel">Peso Neto</div><div className="kpiValue">{data.weight_kg ? `${data.weight_kg} kg` : '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Calibre</div><div className="kpiValue">{data.caliber || '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Color</div><div className="kpiValue">{data.color || '—'}</div></div>
              </div>
              <div className="meta-footer">
                Embarque creado el {fmtDate(data.created_at)} para <strong>{clientNameLine(data)}</strong>
              </div>
            </div>

            {/* TIMELINE */}
            <div className="ff-card ff-card-pad">
              <div className="sectionTitle">Historial de Eventos</div>
              <ModernTimeline milestones={normalizedMilestonesForTimeline as any} />
            </div>
          </div>

          {/* DOCUMENTACIÓN Y FOTOS */}
          <div className="grid2">
            <div className="ff-card ff-card-pad">
              <div className="sectionTitle"><FileText size={16} /> Documentos Oficiales</div>
              <div className="doc-list">
                {data.documents?.length ? data.documents.map(d => (
                  <div key={d.id} className="itemRow">
                    <div className="itemTitle">{d.filename}</div>
                    <button className="ff-btn ff-btn-ghost" onClick={() => download(d.id)}><Download size={14}/> PDF</button>
                  </div>
                )) : <p className="ff-sub">No hay documentos disponibles aún.</p>}
              </div>
            </div>

            <div className="ff-card ff-card-pad">
              <div className="sectionTitle"><ImageIcon size={16} /> Evidencia Fotográfica</div>
              <div className="photoGrid">
                {data.photos?.length ? data.photos.map(p => (
                  <div key={p.id} className="photoCard" onClick={() => download(p.id)}>
                    <img src={p.url || ''} alt="evidencia" className="photoImg" />
                    <div className="photoBody">
                       <div className="photoTitle">{p.filename}</div>
                       <div className="photoMeta">{fmtDate(p.created_at)}</div>
                    </div>
                  </div>
                )) : <p className="ff-sub">Sin fotos de inspección registradas.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page { display: grid; gap: 16px; padding-bottom: 40px; }
        .hero { display: flex; justify-content: space-between; align-items: center; padding: 24px; background: white; border: 1px solid var(--ff-border); border-radius: 16px; }
        .heroLeft { flex: 1; }
        .heroRight { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .codeIcon { background: #f0fdf4; padding: 10px; border-radius: 12px; border: 1px solid #dcfce7; }
        .codeRow { display: flex; gap: 16px; align-items: center; }
        .code { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; }
        .productLine { color: var(--ff-green-dark); font-weight: 700; font-size: 14px; }
        .pill { padding: 6px 12px; border-radius: 99px; font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 6px; }
        .pill.green { background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; }
        .pill.blue { background: #eff6ff; color: #1e40af; border: 1px solid #dbeafe; }
        .kpiRow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .kpi { background: white; padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9; }
        .kpiLabel { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
        .kpiValue { font-size: 16px; font-weight: 900; color: #1e293b; margin-top: 4px; }
        .text-blue { color: #2563eb; }
        .meta-footer { margin-top: 20px; font-size: 12px; color: #94a3b8; padding-top: 15px; border-top: 1px dashed #e2e8f0; }
        .doc-list { display: flex; flex-direction: column; gap: 8px; }
        .itemRow { display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #f1f5f9; border-radius: 10px; }
        .itemTitle { font-size: 13px; font-weight: 600; color: #334155; }
        .photoGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
        .photoCard { cursor: pointer; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; transition: 0.2s; }
        .photoCard:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .photoImg { width: 100%; height: 100px; object-fit: cover; }
        .photoBody { padding: 8px; }
        .photoTitle { font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .photoMeta { font-size: 10px; color: #94a3b8; }
      `}</style>
    </ClientLayout>
  );
}