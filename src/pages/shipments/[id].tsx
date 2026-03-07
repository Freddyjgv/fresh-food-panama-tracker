import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

import { ClientLayout } from "../../components/ClientLayout";
import { ProgressStepper } from "../../components/ProgressStepper";
import { Timeline as ModernTimeline } from "../../components/Timeline";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";

import { 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Info, 
  ArrowLeft, 
  Package, 
  MapPin, 
  Shield,
  PlusCircle,
  CheckCircle2,
  Clock
} from "lucide-react";

/* =======================
   Types & Config
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
  incoterm?: string | null;
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

const DOC_LABELS: Record<string, string> = {
  invoice: "Factura",
  packing_list: "Packing list",
  awb: "AWB (guía aérea)",
  phytosanitary: "Certificado fitosanitario",
  eur1: "EUR1",
  export_declaration: "Declaración de exportación",
  non_recyclable_plastics: "Declaración de plásticos",
  sanitary_general_info: "Info. General Sanitaria",
  additives_declaration: "Declaración de aditivos",
  quality_report: "Informe de calidad"
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

  async function load(shipmentId: string) {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { window.location.href = "/login"; return; }

      const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Error cargando embarque");
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
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

  const docCount = useMemo(() => {
  if (!data?.documents) return 0;

  // 1. Creamos un Set para guardar solo los tipos ÚNICOS que existen en la data
  const uniqueUploadedTypes = new Set(
    data.documents
      .filter(d => d.doc_type && Object.keys(DOC_LABELS).includes(d.doc_type))
      .map(d => d.doc_type)
  );

  // 2. El tamaño del Set es el número real de documentos diferentes cargados
  return uniqueUploadedTypes.size;
}, [data?.documents]);

  if (loading) return <ClientLayout title="Cargando..."><div className="ff-sub">Sincronizando datos...</div></ClientLayout>;

  return (
    <ClientLayout title="Expediente de Embarque" subtitle="Estado de tránsito y documentación legal" wide>
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
                  <div className="heroLabel">Identificador de Carga</div>
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
            <ProgressStepper 
    milestones={data.milestones ?? []} 
    flightNumber={data.flight_number ?? null} 
    awb={data.awb ?? null}  // <--- ¡AÑADE ESTA LÍNEA AQUÍ!
  />
</div>

          <div className="grid2">
            {/* KPI PANEL */}
            <div className="ff-card ff-card-pad soft">
              <div className="modern-section-header">
                <div className="header-icon blue"><Info size={18} /></div>
                <h3>Especificaciones Técnicas</h3>
              </div>
              
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
                Consignatario: <strong>{clientNameLine(data)}</strong> • Origen: {fmtDate(data.created_at)}
              </div>
            </div>

            {/* TIMELINE */}
            <div className="ff-card ff-card-pad">
              <div className="modern-section-header">
                <div className="header-icon green"><Clock size={18} /></div>
                <h3>Historial de Eventos</h3>
              </div>
              <ModernTimeline milestones={normalizedMilestonesForTimeline as any} />
            </div>
          </div>

          {/* DOCUMENTACIÓN DIGITAL */}
          <div className="ff-card ff-card-pad">
            <div className="modern-section-header spread">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="header-icon dark"><FileText size={18} /></div>
                <h3>Expediente Digital de Embarque</h3>
              </div>
              <div className="doc-counter">{docCount} / 10</div>
            </div>

            <div className="doc-grid-modern">
              {Object.entries(DOC_LABELS).map(([key, label]) => {
                const doc = data.documents
  ?.filter(d => d.doc_type === key)
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                const isUploaded = !!doc;
                return (
                  <div key={key} className={`doc-item-card ${isUploaded ? 'status-uploaded' : 'status-pending'}`}>
                    <div className="doc-item-main">
                      <div className="doc-item-status-icon">
                        {isUploaded ? <CheckCircle2 size={16} /> : <PlusCircle size={16} />}
                      </div>
                      <div className="doc-item-info">
                        <span className="doc-item-label">{label}</span>
                        <span className="doc-item-status-text">
                          {isUploaded ? 'CARGADO' : 'PENDIENTE'}
                        </span>
                      </div>
                    </div>
                    {isUploaded && (
                      <button className="doc-download-pill" onClick={() => download(doc.id)}>
                        <Download size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* REGISTRO FOTOGRÁFICO */}
          <div className="ff-card ff-card-pad">
            <div className="modern-section-header">
              <div className="header-icon orange"><ImageIcon size={18} /></div>
              <h3>Registro Fotográfico de Inspección</h3>
            </div>
            
            <div className="photoGrid">
              {data.photos?.length ? data.photos.map(p => (
                <div key={p.id} className="photoCard" onClick={() => download(p.id)}>
                  <div className="photo-container">
                    <img src={p.url || ''} alt="evidencia" className="photoImg" />
                    <div className="photo-overlay"><Download size={20} color="white" /></div>
                  </div>
                  <div className="photoBody">
                     <div className="photoTitle">{p.filename}</div>
                     <div className="photoMeta">{fmtDate(p.created_at)}</div>
                  </div>
                </div>
              )) : (
                <div className="empty-state">
                  <ImageIcon size={32} color="#cbd5e1" />
                  <p>No se han registrado fotografías de inspección para este embarque.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page { display: grid; gap: 20px; padding-bottom: 60px; }
        
        /* Estética Premium de Cabeceras */
        .modern-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .modern-section-header.spread { justify-content: space-between; }
        .modern-section-header h3 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.2px; }
        
        .header-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; }
        .header-icon.blue { background: #eff6ff; color: #2563eb; }
        .header-icon.green { background: #f0fdf4; color: #16a34a; }
        .header-icon.dark { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
        .header-icon.orange { background: #fff7ed; color: #ea580c; }
        
        .doc-counter { background: #0f172a; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; }

        /* Hero */
        .hero { display: flex; justify-content: space-between; align-items: center; padding: 30px; background: white; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
        .codeRow { display: flex; gap: 18px; align-items: center; }
        .codeIcon { background: #f0fdf4; padding: 12px; border-radius: 14px; border: 1px solid #dcfce7; }
        .code { font-size: 28px; font-weight: 900; letter-spacing: -1px; color: #0f172a; line-height: 1; }
        .heroLabel { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
        .productLine { color: var(--ff-green-dark); font-weight: 700; font-size: 14px; margin-top: 4px; }
        .pill { padding: 8px 16px; border-radius: 99px; font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
        .pill.green { background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; }
        .pill.blue { background: #eff6ff; color: #1e40af; border: 1px solid #dbeafe; }
        .heroRight { display: flex; gap: 10px; }

        /* Grid */
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .kpiRow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .kpi { background: #f8fafc; padding: 14px; border-radius: 16px; border: 1px solid #f1f5f9; }
        .kpiLabel { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .kpiValue { font-size: 17px; font-weight: 900; color: #0f172a; }
        .meta-footer { margin-top: 24px; font-size: 13px; color: #64748b; padding-top: 18px; border-top: 1px dashed #e2e8f0; }

        /* Modern Document Pills */
        .doc-grid-modern { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .doc-item-card { display: flex; align-items: center; justify-content: space-between; padding: 14px; border-radius: 16px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid #f1f5f9; }
        .status-pending { background: #f8fafc; opacity: 0.7; }
        .status-uploaded { background: white; border-color: #dcfce7; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .status-uploaded:hover { border-color: #16a34a; transform: translateY(-2px); }
        
        .doc-item-main { display: flex; align-items: center; gap: 12px; }
        .doc-item-status-icon { color: #cbd5e1; }
        .status-uploaded .doc-item-status-icon { color: #16a34a; }
        .doc-item-label { display: block; font-size: 13px; font-weight: 800; color: #1e293b; }
        .doc-item-status-text { font-size: 10px; font-weight: 800; color: #94a3b8; }
        .status-uploaded .doc-item-status-text { color: #16a34a; }
        
        .doc-download-pill { width: 32px; height: 32px; border-radius: 10px; background: #f0fdf4; border: none; color: #16a34a; display: grid; place-items: center; cursor: pointer; transition: 0.2s; }
        .doc-download-pill:hover { background: #16a34a; color: white; }

        /* Photo Grid */
        .photoGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
        .photoCard { cursor: pointer; border-radius: 18px; overflow: hidden; background: white; border: 1px solid #e2e8f0; transition: 0.3s; }
        .photoCard:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -10px rgba(0,0,0,0.1); }
        .photo-container { position: relative; height: 130px; overflow: hidden; }
        .photoImg { width: 100%; height: 100%; object-fit: cover; transition: 0.5s; }
        .photo-overlay { position: absolute; inset: 0; background: rgba(22, 163, 74, 0.6); display: grid; place-items: center; opacity: 0; transition: 0.3s; }
        .photoCard:hover .photo-overlay { opacity: 1; }
        .photoCard:hover .photoImg { transform: scale(1.1); }
        .photoBody { padding: 12px; }
        .photoTitle { font-size: 12px; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .photoMeta { font-size: 10px; color: #94a3b8; margin-top: 2px; }

        .empty-state { grid-column: 1 / -1; padding: 40px; text-align: center; background: #f8fafc; border-radius: 20px; border: 2px dashed #e2e8f0; color: #64748b; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 12px; }

        @media (max-width: 900px) {
          .hero { flex-direction: column; align-items: flex-start; gap: 20px; padding: 20px; }
          .heroRight { width: 100%; justify-content: flex-start; }
          .grid2 { grid-template-columns: 1fr; }
          .kpiRow { grid-template-columns: repeat(2, 1fr); }
        }
          .doc-item-card.status-uploaded {
  border-left: 4px solid #16a34a; /* Verde */
  background: #f0fdf4;
}

.doc-item-card.status-pending {
  border-left: 4px solid #e2e8f0; /* Gris */
  background: #f8fafc;
  opacity: 0.7;
}

.doc-download-pill {
  background: #16a34a;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 6px 12px;
  cursor: pointer;
  transition: transform 0.2s;
}

.doc-download-pill:hover {
  transform: scale(1.1);
}
      `}</style>
    </ClientLayout>
  );
}