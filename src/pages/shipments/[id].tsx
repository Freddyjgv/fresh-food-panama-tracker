// src/pages/shipments/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

import { ClientLayout } from "../../components/ClientLayout";
import { ProgressStepper } from "../../components/ProgressStepper";
import { Timeline as ModernTimeline } from "../../components/Timeline";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";

import { FileText, Image as ImageIcon, Download, Info, ArrowLeft, Package, MapPin, Shield, ThermometerSun } from "lucide-react";



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
  destination_port?: string | null; // Soporte para ambos nombres de columna
  incoterm?: string | null;
  status: string;
  created_at: string;

  client_name?: string | null;
  clients?: { name?: string | null } | null;
  client?: { name?: string | null } | null;

  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;

  calibre?: string | null; // ✅ Unificado con el Drawer
  color?: string | null;
  brix_grade?: string | null; // ✅ Nuevo campo añadido

  boxes?: number | null;
  pallets?: number | null;
  weight?: number | null; // ✅ Unificado (antes weight_kg)
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
  return [name, variety].filter(Boolean).join(" · ") || "—";
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

      // Nota: Asegúrate que tu función Netlify 'getShipment' devuelva brix_grade, calibre y weight
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
          {/* HERO HEADER - Mantiene tu estilo original */}
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
              <span className="pill green"><MapPin size={14}/> {data.destination_port || data.destination}</span>
              <span className="pill blue"><Shield size={14}/> {data.incoterm || 'FOB'}</span>
              <span className={statusBadgeClass(data.status)}>{labelStatus(data.status)}</span>
            </div>
          </div>

          {/* PROGRESS - Tu componente linkado a los hitos */}
          <div className="block" style={{ marginBottom: 24 }}>
            <ProgressStepper milestones={data.milestones ?? []} flightNumber={data.flight_number ?? null} />
          </div>

          <div className="grid2">
            {/* KPI PANEL */}
            <div className="ff-card ff-card-pad soft">
              <div className="sectionTitle"><Info size={16} /> Especificaciones de Carga</div>
              <div className="kpiRow">
                <div className="kpi"><div className="kpiLabel">Incoterm</div><div className="kpiValue text-blue">{data.incoterm || '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Cajas</div><div className="kpiValue">{data.boxes || '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Pallets</div><div className="kpiValue">{data.pallets || '—'}</div></div>
              </div>
              <div className="kpiRow" style={{ marginTop: 12 }}>
                <div className="kpi"><div className="kpiLabel">Peso Neto</div><div className="kpiValue">{data.weight ? `${data.weight} kg` : '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Calibre</div><div className="kpiValue">{data.calibre || '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Brix</div><div className="kpiValue text-green">{data.brix_grade || '—'}</div></div>
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

          {/* NUEVA SECCIÓN: DOCUMENTOS Y FOTOS */}
          <div className="grid2" style={{ marginTop: 24 }}>
            
            {/* COLUMNA: FOTOS DE CARGA */}
            <div className="ff-card ff-card-pad">
              <div className="sectionTitle"><ImageIcon size={16} /> Evidencia de Carga</div>
              {data.photos && data.photos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginTop: '16px' }}>
                  {data.photos.map((img) => (
                    <div key={img.id} className="photo-thumb" onClick={() => download(img.id)}>
                      <img 
                        src={img.url || ""} 
                        alt={img.filename} 
                        style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #eee' }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No se han cargado fotos aún.</div>
              )}
            </div>

            {/* COLUMNA: DOCUMENTACIÓN */}
            <div className="ff-card ff-card-pad">
              <div className="sectionTitle"><FileText size={16} /> Documentación Digital</div>
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.documents && data.documents.length > 0 ? (
                  data.documents.map((doc) => (
                    <div key={doc.id} className="doc-row ff-spread" style={{ padding: '10px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <FileText size={18} color="#666" />
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: 500 }}>
                          {doc.filename}
                        </div>
                      </div>
                      <button 
                        onClick={() => download(doc.id)}
                        className="ff-btn ff-btn-ghost" 
                        style={{ padding: '4px 8px', height: 'auto' }}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No hay documentos disponibles.</div>
                )}
              </div>
            </div>
          </div> 
        </div> // <-- Cierre de "page"
      )} 

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 16px; }
        .hero { display: flex; justify-content: space-between; align-items: center; background: white; padding: 20px; border-radius: 12px; border: 1px solid #eaeaea; }
        .codeIcon { background: #e8f5e9; padding: 10px; border-radius: 10px; margin-right: 12px; }
        .codeRow { display: flex; align-items: center; }
        .code { font-size: 20px; font-weight: 800; color: #1a1a1a; }
        .heroLabel { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
        .productLine { font-size: 14px; color: #666; }
        .heroRight { display: flex; gap: 8px; }
        .pill { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .pill.green { background: #e8f5e9; color: #2e7d32; }
        .pill.blue { background: #e3f2fd; color: #1565c0; }
        .sectionTitle { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #333; margin-bottom: 12px; font-size: 15px; }
        .kpiRow { display: flex; gap: 16px; }
        .kpi { flex: 1; }
        .kpiLabel { font-size: 11px; color: #888; text-transform: uppercase; }
        .kpiValue { font-size: 16px; font-weight: 700; color: #333; }
        .text-blue { color: #0070f3; }
        .text-green { color: #22c55e; }
        .meta-footer { margin-top: 16px; padding-top: 12px; border-top: 1px dashed #eee; font-size: 12px; color: #999; }
        .empty-state { padding: 20px; text-align: center; color: #aaa; font-size: 13px; border: 1px dashed #ddd; border-radius: 8px; margin-top: 10px; }
        .photo-thumb:hover { transform: scale(1.02); transition: 0.2s; }
        .doc-row:hover { border-color: #2e7d32 !important; }
        @media (max-width: 768px) { .hero { flex-direction: column; gap: 16px; align-items: flex-start; } .grid2 { grid-template-columns: 1fr; } }
      `}</style>
    </ClientLayout>
  );
}