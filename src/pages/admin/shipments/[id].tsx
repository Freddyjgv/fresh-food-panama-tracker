import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { labelStatus } from "../../../lib/shipmentFlow";
import { Timeline as ModernTimeline } from "../../../components/Timeline";

import {
  FileText, Image as ImageIcon, Download, ClipboardCheck, 
  ArrowLeft, Info, Package, PlusCircle, CheckCircle, 
  Loader2, X, Hash, Globe, Scale, AlertCircle
} from "lucide-react";

// --- TIPOS CORREGIDOS SEGÚN TU TABLA MILESTONES REAL ---
type ShipmentMilestone = { 
  id?: string;           // Añadido: para que m.id no de error
  type: string; 
  at: string;            // Tu tabla usa 'at'
  note?: string | null; 
  actor_email?: string | null; // Añadido: para que m.actor_email no de error
  author?: { name: string } | null; 
};

type ShipmentFile = { 
  id: string; 
  kind: "doc" | "photo";
  doc_type?: string | null; 
  filename: string; 
  created_at: string; 
  url?: string | null;
};

type ShipmentDetail = {
  id: string; 
  code: string; 
  destination: string; 
  status: string; 
  created_at: string;
  client_name?: string | null;
  product_name?: string | null;
  product_variety?: string | null;
  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;
  flight_number?: string | null;
  awb?: string | null;
  calibre?: string | null; // Cambiado de caliber a calibre (como tu DB)
  color?: string | null;
  milestones: ShipmentMilestone[];
  documents: ShipmentFile[];
  photos: ShipmentFile[];
};

const DOC_TYPES = [
  { v: "invoice", l: "Factura" },
  { v: "packing_list", l: "Packing list" },
  { v: "awb", l: "AWB (guía aérea)" },
  { v: "phytosanitary", l: "Certificado fitosanitario" },
  { v: "eur1", l: "EUR1" },
  { v: "export_declaration", l: "Decl. Exportación" },
  { v: "quality_report", l: "Informe de Calidad" },
] as const;

type MilestoneType = "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION";
const CHAIN: MilestoneType[] = ["PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION"];

export default function AdminShipmentDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form States
  const [note, setNote] = useState("");
  const [flight, setFlight] = useState("");
  const [awb, setAwb] = useState("");
  const [caliber, setCaliber] = useState("");
  const [color, setColor] = useState("");
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  async function load(shipmentId: string) {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/.netlify/functions/getShipment?id=${shipmentId}&mode=admin`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      
      setData(json);
      setFlight(json.flight_number || "");
setAwb(json.awb || "");
setCaliber(json.calibre || ""); // <--- Cambiado a 'calibre'
setColor(json.color || "");
    } catch (e) {
      showToast("Error al cargar embarque", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) {
        setAuthReady(true);
        if (typeof id === "string") load(id);
      }
    })();
  }, [id]);

  // Sincronización con Timeline.tsx
  const timelineItems = useMemo(() => {
  if (!data?.milestones) return [];
  return data.milestones.map((m) => ({
    id: m.id,
    type: m.type,
    created_at: m.at, // 'at' es la columna real de tu tabla milestones
    note: m.note,
    author_name: m.actor_email || "Admin" // Usamos actor_email que sí existe
  }));
}, [data?.milestones]);

  const handleMark = async (type: MilestoneType) => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/updateMilestone", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          shipmentId: data?.id, 
  type, 
  note: note.trim(),
  flight_number: flight.trim(), 
  awb: awb.trim(),
  calibre: caliber.trim(), // <--- Enviamos 'calibre' al hito
  color: color.trim(),
}),
      });
      if (res.ok) {
        showToast("Estado actualizado");
        setNote("");
        load(data!.id);
      }
    } catch (e) {
      showToast("Error al actualizar", "error");
    } finally {
      setBusy(false);
    }
  };

  async function upload(kind: "doc" | "photo", file: File, doc_type?: string) {
    if (!data) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const bucket = kind === "doc" ? "shipment-docs" : "shipment-photos";

      const resUrl = await fetch("/.netlify/functions/getUploadUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket, shipmentCode: data.code, filename: file.name }),
      });
      const { uploadUrl, path } = await resUrl.json();

      await fetch(uploadUrl, { method: "PUT", body: file });
      
      await fetch("/.netlify/functions/registerFile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shipmentId: data.id, kind, doc_type,
          filename: file.name, storage_path: path, bucket,
        }),
      });
      showToast("Archivo subido");
      load(data.id);
    } catch (e) {
      showToast("Error de subida", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(fileId: string) {
    if (!confirm("¿Borrar archivo?")) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/.netlify/functions/deleteFile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fileId, shipmentId: data?.id }),
      });
      showToast("Archivo eliminado");
      load(data!.id);
    } finally {
      setBusy(false);
    }
  }

  async function download(fileId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${fileId}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  if (!authReady || loading) return <div className="loader-center"><Loader2 className="spin" /></div>;

  return (
    <AdminLayout title={`Detalle ${data?.code}`}>
      {toast && <div className={`toast-alert ${toast.type}`}>{toast.msg}</div>}

      <div className="admin-page">
        <header className="header-shipment">
          <div className="h-main">
            <Link href="/admin/shipments" className="back-btn"><ArrowLeft size={16}/> Volver</Link>
            <h1>{data?.product_name} <small>{data?.product_variety}</small></h1>
            <div className="meta">
              <span className="badge-code"><Hash size={12}/> {data?.code}</span>
              <span>Cliente: <strong>{data?.client_name}</strong></span>
              <span>Destino: <strong>{data?.destination}</strong></span>
            </div>
          </div>
          <div className="h-status">
             <div className="status-pill">{labelStatus(data!.status)}</div>
          </div>
        </header>

        <div className="detail-grid">
          <div className="left-pane">
            <section className="admin-card">
              <div className="card-header"><ClipboardCheck size={18}/> <h3>Gestión de Hitos</h3></div>
              <div className="form-box">
                <textarea 
                  placeholder="Nota para el hito..." 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                />
                <div className="inputs-row">
                  <div className="field"><label>Vuelo</label><input value={flight} onChange={e => setFlight(e.target.value)} /></div>
                  <div className="field"><label>AWB</label><input value={awb} onChange={e => setAwb(e.target.value)} /></div>
                  <div className="field"><label>Cal/Col</label>
                    <div className="dual"><input placeholder="Cal" value={caliber} onChange={e => setCaliber(e.target.value)} /><input placeholder="Col" value={color} onChange={e => setColor(e.target.value)} /></div>
                  </div>
                </div>
                <div className="steps-grid">
                  {CHAIN.map(s => (
                    <button key={s} className={`step-btn ${data?.status === s ? 'active' : ''}`} onClick={() => handleMark(s)} disabled={busy}>
                      {labelStatus(s)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="admin-card spacing">
              <div className="card-header-between">
                <div className="row-gap"><ImageIcon size={18}/> <h3>Fotos de Carga</h3></div>
                <label className="upload-btn-photo">
                  <PlusCircle size={14}/> Subir Foto
                  <input type="file" hidden accept="image/*" onChange={e => e.target.files?.[0] && upload("photo", e.target.files[0])} />
                </label>
              </div>
              <div className="photos-grid">
                {data?.photos?.map(p => (
                  <div key={p.id} className="photo-item">
                    <img src={p.url || ""} alt="Evidencia" />
                    <div className="photo-overlay">
                      <button onClick={() => download(p.id)}><Download size={16}/></button>
                      <button onClick={() => deleteFile(p.id)} className="danger"><X size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="right-pane">
            <section className="admin-card">
              <div className="card-header"><FileText size={18}/> <h3>Documentos</h3></div>
              <div className="docs-stack">
                {DOC_TYPES.map(t => {
                  const doc = data?.documents?.find(d => d.doc_type === t.v);
                  return (
                    <div key={t.v} className={`doc-item ${doc ? 'exists' : ''}`}>
                      <span className="doc-label">{t.l}</span>
                      <div className="doc-btns">
                        {doc ? (
                          <>
                            <button onClick={() => download(doc.id)}><Download size={14}/></button>
                            <button onClick={() => deleteFile(doc.id)} className="text-red"><X size={14}/></button>
                          </>
                        ) : (
                          <label className="btn-up-small">
                            <PlusCircle size={14}/>
                            <input type="file" hidden onChange={e => e.target.files?.[0] && upload("doc", e.target.files[0], t.v)} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="admin-card spacing">
              <div className="card-header"><CheckCircle size={18}/> <h3>Timeline</h3></div>
              <ModernTimeline milestones={timelineItems as any} />
            </section>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .admin-page { padding: 20px; max-width: 1400px; margin: 0 auto; }
        .header-shipment { background: #fff; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
        .back-btn { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 15px; }
        .header-shipment h1 { font-size: 26px; font-weight: 900; margin: 0; color: #1e293b; }
        .header-shipment small { color: #94a3b8; font-weight: 400; }
        .meta { display: flex; gap: 20px; margin-top: 10px; font-size: 14px; color: #64748b; }
        .badge-code { background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 6px; font-weight: 800; display: flex; align-items: center; gap: 4px; }
        .status-pill { background: #1e293b; color: white; padding: 8px 16px; border-radius: 30px; font-weight: 700; font-size: 13px; }
        
        .detail-grid { display: grid; grid-template-columns: 1fr 380px; gap: 25px; }
        .admin-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; }
        .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; color: #1e293b; }
        .card-header-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .card-header h3 { font-size: 14px; font-weight: 900; text-transform: uppercase; margin: 0; }
        
        .form-box textarea { width: 100%; height: 80px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 15px; }
        .inputs-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .field label { display: block; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; }
        .field input { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .dual { display: flex; gap: 5px; }
        .steps-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .step-btn { padding: 12px 5px; font-size: 10px; font-weight: 800; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; transition: 0.2s; }
        .step-btn.active { background: #16a34a; color: #fff; border-color: #16a34a; }
        
        .photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 15px; }
        .photo-item { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; }
        .photo-item img { width: 100%; height: 100%; object-fit: cover; }
        .photo-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; gap: 8px; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .photo-item:hover .photo-overlay { opacity: 1; }
        .photo-overlay button { background: #fff; border: none; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        .docs-stack { display: flex; flex-direction: column; gap: 10px; }
        .doc-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 12px; background: #f8fafc; border: 1px solid #f1f5f9; }
        .doc-item.exists { background: #f0fdf4; border-color: #dcfce7; }
        .doc-label { font-size: 13px; font-weight: 700; color: #1e293b; }
        .doc-btns { display: flex; gap: 8px; }
        .btn-up-small { color: #2563eb; cursor: pointer; }
        
        .loader-center { height: 100vh; display: grid; place-items: center; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .toast-alert { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 12px; background: #1e293b; color: white; font-weight: 700; z-index: 1000; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
        .spacing { margin-top: 25px; }
        .row-gap { display: flex; align-items: center; gap: 10px; }
      `}</style>
    </AdminLayout>
  );
}