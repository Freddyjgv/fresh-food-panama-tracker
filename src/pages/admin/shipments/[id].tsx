import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout, notify } from "../../../components/AdminLayout";
import { Timeline as ModernTimeline } from "../../../components/Timeline";

import {
  FileText, Image as ImageIcon, Download, PackageCheck,
  Plane, MapPin, ClipboardCheck, ArrowLeft, PlusCircle,
  CheckCircle, Loader2, X, Hash, Layers, User, Globe
} from "lucide-react";

// --- TIPOS ---
type ShipmentMilestone = { 
  type: string; 
  at?: string | null; 
  note?: string | null; 
  author?: { name: string } | null;
  actor_email?: string | null;
};
type ShipmentDocument = { id: string; filename: string; doc_type?: string | null; created_at: string; };
type ShipmentPhoto = { id: string; filename: string; created_at: string; url?: string | null; };
type ShipmentDetail = {
  id: string; code: string; destination: string; status: string; created_at: string;
  client_name?: string | null; 
  product_name?: string | null;
  flight_number?: string | null; awb?: string | null;
  caliber?: string | null; color?: string | null;
  milestones?: ShipmentMilestone[]; documents?: ShipmentDocument[]; photos?: ShipmentPhoto[];
};

const DOC_TYPES = [
  { v: "invoice", l: "Factura" },
  { v: "packing_list", l: "Packing list" },
  { v: "awb", l: "AWB (guía aérea)" },
  { v: "phytosanitary", l: "Certificado fitosanitario" },
  { v: "eur1", l: "EUR1" },
  { v: "export_declaration", l: "Aduana" },
  { v: "quality_report", l: "Informe de calidad" },
] as const;

// Helper local para evitar conflictos de importación
const getStatusLabel = (s: string) => {
  const map: any = {
    'CREATED': 'Creado',
    'PACKED': 'Empacado',
    'DOCS_READY': 'Documentación',
    'IN_TRANSIT': 'En Tránsito',
    'AT_DESTINATION': 'Entregado'
  };
  return map[s] || s;
};

export default function AdminShipmentDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [flight, setFlight] = useState("");
  const [awb, setAwb] = useState("");
  const [caliber, setCaliber] = useState("");
  const [color, setColor] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (shipmentId: string) => {
    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}&mode=admin`, {
        headers: { Authorization: `Bearer ${token || ""}` }
      });
      
      if (res.ok) {
        const json = await res.json();
        setData(json); 
        setFlight(json.flight_number ?? ""); 
        setAwb(json.awb ?? "");
        setCaliber(json.caliber ?? ""); 
        setColor(json.color ?? "");
      } else {
        notify("No se encontró el embarque");
      }
    } catch (e) {
      notify("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    requireAdminOrRedirect().then(r => { if (r.ok) setAuthReady(true); });
  }, []);

  useEffect(() => { 
    if (authReady && id && typeof id === "string") load(id); 
  }, [id, authReady, load]);

  const timelineItems = useMemo(() => 
    (data?.milestones ?? []).map((m, idx) => ({ 
      id: `${m.type}-${idx}`, 
      type: m.type, 
      created_at: m.at || new Date().toISOString(), 
      note: m.note || "",
      author: m.author?.name || m.actor_email || "Sistema"
    })), [data?.milestones]
  );

  // Funciones de acción (handleMark, upload, download, deleteFile) permanecen igual...
  async function handleMark(type: string) {
    if (!data) return;
    setBusy(true);
    try {
        const { data: session } = await supabase.auth.getSession();
        const { data: { user } } = await supabase.auth.getUser();
        await fetch("/.netlify/functions/updateMilestone", {
          method: "POST", 
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({ 
            shipmentId: data.id, type, note: note.trim(), 
            flight_number: flight.trim(), awb: awb.trim(), 
            caliber: caliber.trim(), color: color.trim(), createdBy: user?.id 
          }),
        });
        setNote(""); notify("Estado actualizado ✅"); load(data.id);
    } finally { setBusy(false); }
  }

  async function upload(kind: "doc" | "photo", file: File, explicitType?: string) {
    if (!data) return;
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res1 = await fetch("/.netlify/functions/getUploadUrl", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket: kind === "doc" ? "shipment-docs" : "shipment-photos", shipmentCode: data.code, filename: file.name }),
      });
      const { uploadUrl, path } = await res1.json();
      await fetch(uploadUrl, { method: "PUT", body: file });
      
      const { data: { user } } = await supabase.auth.getUser();
      await fetch("/.netlify/functions/registerFile", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          shipmentId: data.id, kind, doc_type: explicitType || null, 
          filename: file.name, storage_path: path, 
          bucket: kind === "doc" ? "shipment-docs" : "shipment-photos",
          createdBy: user?.id
        }),
      });
      notify("Archivo cargado ✅"); load(data.id);
    } catch (e) { notify("Error al subir"); } finally { setBusy(false); }
  }

  async function download(fileId: string) {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, { 
        headers: { Authorization: `Bearer ${session?.session?.access_token}` } 
    });
    if (res.ok) { const { url } = await res.json(); window.open(url, "_blank"); }
  }

  async function deleteFile(fileId: string, kind: "doc" | "photo") {
    if (!confirm("¿Eliminar?")) return;
    setBusy(true);
    try {
        const { data: session } = await supabase.auth.getSession();
        await fetch("/.netlify/functions/deleteFile", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({ fileId, kind, shipmentId: data?.id }),
        });
        notify("Eliminado"); load(data!.id);
    } finally { setBusy(false); }
  }

  if (loading) return <AdminLayout title="Cargando..."><div className="loader-center"><Loader2 className="spin" /></div></AdminLayout>;
  if (!data) return <AdminLayout title="Error"><div>No se pudo cargar el embarque.</div></AdminLayout>;

  return (
    <AdminLayout title="Control de Operaciones" subtitle="Gestión Logística Fresh Food">
      <div className="page">
        <div className="modern-section-header spread">
          <Link href="/admin/shipments" className="ff-back-btn">
            <ArrowLeft size={16} /> Volver al listado
          </Link>
        </div>

        {/* HEADER PREMIUM */}
        <header className="ff-header-premium">
          <div className="ff-header-main-info">
            <span className="code-tag"><Hash size={14}/> {data.code}</span>
            <h1 className="ff-product-name">{data.product_name || "Producto sin nombre"}</h1>
            <div className="ff-client-tag">
              <User size={14} /> <span>{data.client_name || "Cliente no asignado"}</span>
              <span className="divider">|</span>
              <Globe size={14} /> <span>{data.destination}</span>
            </div>
          </div>

          <div className="ff-header-specs-bar">
            <div className="ff-spec-item">
              <span className="ff-spec-label">Logística</span>
              <div className="ff-spec-value-group">
                <Plane size={14} style={{color: '#2563eb'}} />
                <span className="ff-spec-value">{data.flight_number || "—"}</span>
              </div>
            </div>
            <div className="ff-spec-divider" />
            <div className="ff-spec-item">
              <span className="ff-spec-label">Estado Actual</span>
              <span className={`pill-status-v2 ${data.status.toLowerCase()}`}>{getStatusLabel(data.status)}</span>
            </div>
          </div>
        </header>

        <div className="ff-balanced-grid">
          <div className="col-stack">
            {/* PANEL DE CONTROL */}
            <section className="ff-col-docs" style={{marginBottom: 24}}>
              <div className="modern-section-header">
                <div className="header-icon orange"><ClipboardCheck size={20} /></div>
                <h3>Actualizar Estado</h3>
              </div>
              
              <div className="admin-quick-inputs">
                <div className="field">
                  <label className="ff-spec-label">Nota de Auditoría</label>
                  <input className="ff-input-modern" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Mercancía lista en pallets..." />
                </div>
                <div className="row-3-inputs">
                  <div className="field">
                    <label className="ff-spec-label">Vuelo/Nave</label>
                    <input className="ff-input-modern" value={flight} onChange={(e) => setFlight(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="ff-spec-label">AWB / BL</label>
                    <input className="ff-input-modern" value={awb} onChange={(e) => setAwb(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="ff-spec-label">Calibre / Color</label>
                    <div style={{display:'flex', gap:4}}>
                      <input className="ff-input-modern" value={caliber} onChange={(e) => setCaliber(e.target.value)} placeholder="Cal" />
                      <input className="ff-input-modern" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Col" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="actions-strip-admin">
                <button disabled={busy} onClick={() => handleMark("PACKED")} className="btn-action-admin">Empacado</button>
                <button disabled={busy} onClick={() => handleMark("DOCS_READY")} className="btn-action-admin">Docs Listos</button>
                <button disabled={busy} onClick={() => handleMark("IN_TRANSIT")} className="btn-action-admin primary">En Tránsito</button>
                <button disabled={busy} onClick={() => handleMark("AT_DESTINATION")} className="btn-action-admin success">Entregado</button>
              </div>
            </section>

            <section className="ff-col-docs">
              <div className="modern-section-header">
                <div className="header-icon dark"><Layers size={20} /></div>
                <h3>Línea de Tiempo Operativa</h3>
              </div>
              <ModernTimeline milestones={timelineItems as any} />
            </section>
          </div>

          <div className="col-stack">
            {/* EXPEDIENTE DIGITAL */}
            <section className="ff-col-docs" style={{marginBottom: 24}}>
              <div className="modern-section-header">
                  <div className="header-icon dark"><FileText size={20} /></div>
                  <h3>Expediente Digital</h3>
              </div>

              <div className="ff-docs-list-refined">
                {DOC_TYPES.map((type) => {
                  const doc = data.documents?.find(d => d.doc_type === type.v);
                  return (
                    <div key={type.v} className={`ff-doc-flat-row ${doc ? 'is-up' : 'is-off'}`}>
                      <span className="ff-doc-label">{type.l}</span>
                      <div style={{display:'flex', gap:8}}>
                        {doc ? (
                          <>
                            <button onClick={() => download(doc.id)} className="btn-circle"><Download size={14}/></button>
                            <button disabled={busy} onClick={() => deleteFile(doc.id, "doc")} className="btn-circle del"><X size={14}/></button>
                          </>
                        ) : (
                          <label className="btn-plus-upload">
                            <PlusCircle size={18} />
                            <input type="file" hidden disabled={busy} onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) upload("doc", f, type.v);
                            }} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* FOTOS */}
            <section className="ff-col-photos">
              <div className="modern-section-header spread">
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div className="header-icon dark"><ImageIcon size={20} /></div>
                  <h3>Fotos de Carga</h3>
                </div>
                <label className="btn-add-photo-premium">
                  <PlusCircle size={16} /> Agregar
                  <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload("photo", f);
                  }} />
                </label>
              </div>
              
              <div className="ff-thumbs-grid-admin">
                {data.photos?.map((p) => (
                  <div key={p.id} className="ff-thumb-admin">
                    <img src={p.url || ""} alt="Carga" />
                    <div className="thumb-overlay">
                      <button onClick={() => download(p.id)} className="overlay-btn"><Download size={14}/></button>
                      <button onClick={() => deleteFile(p.id, "photo")} className="overlay-btn del"><X size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 24px; padding: 20px; max-width: 1400px; margin: 0 auto; }
        .ff-header-premium { 
          background: white; padding: 32px; border-radius: 24px; border: 1px solid #f1f5f9;
          display: flex; justify-content: space-between; align-items: center;
        }
        .ff-product-name { font-size: 26px; font-weight: 800; color: #16a34a; margin: 10px 0; }
        .code-tag { font-family: monospace; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 4px 12px; border-radius: 8px; font-size: 14px; }
        .ff-client-tag { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 14px; }
        .divider { color: #e2e8f0; margin: 0 4px; }
        
        .ff-header-specs-bar { display: flex; gap: 24px; background: #f8fafc; padding: 16px 24px; border-radius: 16px; border: 1px solid #f1f5f9; }
        .ff-spec-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; display: block; }
        .ff-spec-value { font-size: 15px; font-weight: 700; color: #1e293b; }
        .ff-spec-divider { width: 1px; background: #e2e8f0; }

        .ff-balanced-grid { display: grid; grid-template-columns: 1fr 420px; gap: 24px; }
        .ff-col-docs, .ff-col-photos { background: white; padding: 24px; border-radius: 24px; border: 1px solid #f1f5f9; }

        .admin-quick-inputs { background: #f8fafc; padding: 16px; border-radius: 16px; margin-bottom: 20px; }
        .row-3-inputs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
        .ff-input-modern { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 14px; }
        
        .actions-strip-admin { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .btn-action-admin { padding: 12px 8px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; font-size: 11px; font-weight: 700; cursor: pointer; }
        .btn-action-admin.primary { background: #1e293b; color: white; border: none; }
        .btn-action-admin.success { background: #16a34a; color: white; border: none; }

        .ff-doc-flat-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; border: 1px solid #f1f5f9; margin-bottom: 8px;}
        .ff-doc-flat-row.is-up { background: #f0fdf4; border-color: #bbf7d0; }
        .ff-doc-label { font-size: 13px; font-weight: 600; color: #334155; }
        
        .ff-thumbs-grid-admin { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
        .ff-thumb-admin { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
        .ff-thumb-admin img { width: 100%; height: 100%; object-fit: cover; }
        .thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; gap: 8px; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .ff-thumb-admin:hover .thumb-overlay { opacity: 1; }
        
        .btn-circle { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #e2e8f0; background: white; display: grid; place-items: center; cursor: pointer; }
        .btn-circle.del { color: #ef4444; }
        .overlay-btn { width: 32px; height: 32px; border-radius: 50%; background: white; border: none; cursor: pointer; display: grid; place-items: center; }

        .btn-add-photo-premium { background: #1e293b; color: white; padding: 8px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-plus-upload { color: #2563eb; cursor: pointer; }
        
        .pill-status-v2 { font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 8px; text-transform: uppercase; }
        .created { background: #fef3c7; color: #92400e; }
        .packed { background: #e0f2fe; color: #0369a1; }
        .in_transit { background: #fef3c7; color: #92400e; }
        .at_destination { background: #dcfce7; color: #166534; }

        .loader-center { display: grid; place-items: center; height: 300px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .header-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; }
        .header-icon.orange { background: #fff7ed; color: #f97316; }
        .header-icon.dark { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
        .spread { display: flex; justify-content: space-between; align-items: center; }
      `}</style>
    </AdminLayout>
  );
}