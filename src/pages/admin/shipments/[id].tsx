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

// --- TIPOS ---
type ShipmentMilestone = { 
  id: string; 
  type: string; 
  at: string; 
  note?: string | null; 
  author?: { name: string } | null; 
};

type ShipmentFile = { 
  id: string; 
  filename: string; 
  doc_type?: string | null; 
  created_at: string; 
  url?: string | null; 
  kind: "doc" | "photo";
};

type ShipmentDetail = {
  id: string; code: string; destination: string; status: string; created_at: string;
  client_name?: string | null;
  product_name?: string | null;
  product_variety?: string | null;
  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;
  flight_number?: string | null;
  awb?: string | null;
  caliber?: string | null;
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

  // Estados de Formulario
  const [note, setNote] = useState("");
  const [flight, setFlight] = useState("");
  const [awb, setAwb] = useState("");
  const [caliber, setCaliber] = useState("");
  const [color, setColor] = useState("");
  const [docType, setDocType] = useState<string>("packing_list");
  const [popup, setPopup] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const showPopup = (msg: string, type: 'success' | 'error' = 'success') => {
    setPopup({ msg, type });
    setTimeout(() => setPopup(null), 3500);
  };

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async function load(shipmentId: string) {
    setLoading(true);
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      
      setData(json);
      setFlight(json.flight_number || "");
      setAwb(json.awb || "");
      setCaliber(json.caliber || "");
      setColor(json.color || "");
    } catch (e) {
      showPopup("Error al conectar con el servidor", "error");
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

  const timelineItems = useMemo(() => {
    if (!data?.milestones) return [];
    return data.milestones.map(m => ({
      id: m.id,
      type: m.type,
      created_at: m.at,
      note: m.note,
      author_name: m.author?.name || "Admin"
    }));
  }, [data?.milestones]);

  const mark = async (type: MilestoneType) => {
    const has = (t: string) => (data?.milestones ?? []).some((m) => m.type.toUpperCase() === t.toUpperCase());
    if (has(type)) return showPopup("Hito ya marcado", "error");
    if (type === "PACKED" && (!caliber.trim() || !color.trim())) return showPopup("Falta Calibre/Color", "error");
    if (type === "IN_TRANSIT" && !flight.trim()) return showPopup("Falta Vuelo", "error");

    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch("/.netlify/functions/updateMilestone", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shipmentId: data?.id, type, note: note.trim(),
          flight_number: flight.trim(), awb: awb.trim(),
          caliber: caliber.trim(), color: color.trim(),
        }),
      });
      if (res.ok) {
        showPopup(`Hito registrado`);
        setNote("");
        load(data!.id);
      }
    } catch (e) {
      showPopup("Error de red", "error");
    } finally {
      setBusy(false);
    }
  };

  async function upload(kind: "doc" | "photo", file: File, specificDocType?: string) {
    if (!data) return;
    setBusy(true);
    try {
      const token = await getToken();
      const bucket = kind === "doc" ? "shipment-docs" : "shipment-photos";

      const resUrl = await fetch("/.netlify/functions/getUploadUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket, shipmentCode: data.code, filename: file.name }),
      });

      const { uploadUrl, path } = await resUrl.json();
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      
      await fetch("/.netlify/functions/registerFile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shipmentId: data.id, kind, doc_type: specificDocType || null,
          filename: file.name, storage_path: path, bucket,
        }),
      });
      showPopup("Archivo subido correctamente");
      load(data.id);
    } catch (e) {
      showPopup("Error al subir archivo", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(fileId: string) {
    if (!confirm("¿Eliminar este archivo?")) return;
    setBusy(true);
    try {
      const token = await getToken();
      await fetch("/.netlify/functions/deleteFile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileId, shipmentId: data?.id }),
      });
      showPopup("Eliminado");
      load(data!.id);
    } finally {
      setBusy(false);
    }
  }

  async function download(fileId: string) {
    const token = await getToken();
    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${fileId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  if (!authReady || loading) return <div className="loader"><Loader2 className="spin" /></div>;

  return (
    <AdminLayout title={`Embarque ${data?.code}`}>
      {popup && (
        <div className={`popup-toast ${popup.type}`}>
          {popup.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
          <span>{popup.msg}</span>
        </div>
      )}

      <div className="detail-container">
        <div className="top-nav-row">
          <Link href="/admin/shipments" className="btn-back"><ArrowLeft size={16}/> Panel</Link>
          <div className="status-badge">Estado actual: <span className="pill">{labelStatus(data!.status)}</span></div>
        </div>

        <header className="shipment-header-modern">
          <div className="h-left">
            <div className="code-tag"><Hash size={14}/> {data?.code}</div>
            <h1>{data?.product_name} <small>{data?.product_variety}</small></h1>
            <p className="client">Cliente: <strong>{data?.client_name}</strong></p>
          </div>
          <div className="h-right">
            <div className="h-stat"><label><Package size={14}/> Cajas/Pallets</label><span>{data?.boxes || 0} / {data?.pallets || 0}</span></div>
            <div className="divider-v" />
            <div className="h-stat"><label><Scale size={14}/> Peso</label><span>{data?.weight_kg || 0} kg</span></div>
            <div className="divider-v" />
            <div className="h-stat"><label><Globe size={14}/> Destino</label><span>{data?.destination}</span></div>
          </div>
        </header>

        <div className="main-grid-layout">
          <div className="left-column">
            <section className="glass-card">
              <div className="card-head"><ClipboardCheck size={18}/> <h3>Gestión de Hitos</h3></div>
              <div className="milestone-controls">
                <div className="input-group-row">
                  <div className="f-item full"><label>Nota interna/cliente</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Escribe un comentario sobre este cambio..." /></div>
                  <div className="f-item"><label>Vuelo</label><input value={flight} onChange={e => setFlight(e.target.value)} /></div>
                  <div className="f-item"><label>AWB</label><input value={awb} onChange={e => setAwb(e.target.value)} /></div>
                </div>
                <div className="actions-buttons-grid">
                  {CHAIN.map(step => (
                    <button key={step} className={`btn-step ${data?.status === step ? 'active' : ''}`} onClick={() => mark(step)} disabled={busy}>
                      {labelStatus(step)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="glass-card spacing-top">
              <div className="card-head"><Info size={18}/> <h3>Detalles Técnicos</h3></div>
              <div className="technical-grid">
                <div className="f-item"><label>Calibre</label><input value={caliber} onChange={e => setCaliber(e.target.value)} /></div>
                <div className="f-item"><label>Color</label><input value={color} onChange={e => setColor(e.target.value)} /></div>
              </div>
            </section>

            <section className="glass-card spacing-top">
              <div className="card-head-between">
                <div className="title-group"><ImageIcon size={18}/> <h3>Fotos de Evidencia</h3></div>
                <label className="btn-upload-photo">
                  <PlusCircle size={14}/> Subir Foto
                  <input type="file" accept="image/*" hidden disabled={busy} onChange={e => e.target.files?.[0] && upload("photo", e.target.files[0])} />
                </label>
              </div>
              <div className="photo-grid-modern">
                {data?.photos?.length ? data.photos.map(p => (
                  <div key={p.id} className="photo-box">
                    <img src={p.url || ""} alt="Foto" />
                    <div className="overlay">
                      <button onClick={() => download(p.id)}><Download size={16}/></button>
                      <button onClick={() => deleteFile(p.id)} className="del"><X size={16}/></button>
                    </div>
                  </div>
                )) : <p className="empty-text">No hay fotos cargadas</p>}
              </div>
            </section>
          </div>

          <aside className="right-column">
            <section className="glass-card">
              <div className="card-head"><FileText size={18}/> <h3>Documentación</h3></div>
              <div className="docs-list-modern">
                {DOC_TYPES.map(type => {
                  const doc = data?.documents?.find(d => d.doc_type === type.v);
                  return (
                    <div key={type.v} className={`doc-item ${doc ? 'is-ok' : 'is-off'}`}>
                      <div className="doc-info">
                        <span className="doc-name">{type.l}</span>
                        <span className="doc-status">{doc ? 'OK' : 'Pendiente'}</span>
                      </div>
                      <div className="doc-actions">
                        {doc ? (
                          <>
                            <button onClick={() => download(doc.id)} className="btn-dl"><Download size={14}/></button>
                            <button onClick={() => deleteFile(doc.id)} className="btn-del"><X size={14}/></button>
                          </>
                        ) : (
                          <label className="btn-up">
                            <PlusCircle size={14}/>
                            <input type="file" hidden onChange={e => e.target.files?.[0] && upload("doc", e.target.files[0], type.v)} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="glass-card spacing-top">
              <div className="card-head"><CheckCircle size={18}/> <h3>Línea de Tiempo</h3></div>
              <ModernTimeline milestones={timelineItems as any} />
            </section>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .detail-container { padding: 20px 40px; background: #f8fafc; min-height: 100vh; }
        .popup-toast { position: fixed; top: 25px; right: 25px; z-index: 9999; display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-radius: 16px; color: white; font-weight: 700; background: #16a34a; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); }
        .popup-toast.error { background: #dc2626; }
        .shipment-header-modern { background: #fff; padding: 25px 30px; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .code-tag { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 12px; display: flex; align-items: center; gap: 5px; width: fit-content; }
        .h-left h1 { font-size: 24px; font-weight: 900; margin: 8px 0 2px; }
        .h-right { display: flex; gap: 24px; background: #f8fafc; padding: 12px 20px; border-radius: 16px; }
        .h-stat label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: block; }
        .h-stat span { font-size: 15px; font-weight: 800; color: #1e293b; }
        .divider-v { width: 1px; height: 30px; background: #e2e8f0; }
        .main-grid-layout { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
        .glass-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; }
        .card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .card-head h3 { font-size: 13px; font-weight: 900; text-transform: uppercase; margin: 0; }
        .input-group-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
        .f-item.full { grid-column: span 3; }
        .f-item label { font-size: 11px; font-weight: 800; color: #64748b; margin-bottom: 4px; display: block; }
        .f-item input, .f-item textarea { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; }
        .actions-buttons-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .btn-step { padding: 10px 5px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; font-size: 9px; font-weight: 800; cursor: pointer; }
        .btn-step.active { background: #16a34a; color: #fff; border-color: #16a34a; }
        .photo-grid-modern { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
        .photo-box { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; }
        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
        .overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; gap: 8px; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .photo-box:hover .overlay { opacity: 1; }
        .doc-item { display: flex; justify-content: space-between; padding: 10px; border-radius: 10px; margin-bottom: 6px; border: 1px solid #f1f5f9; }
        .doc-item.is-ok { background: #f0fdf4; border-color: #dcfce7; }
        .doc-name { font-size: 12px; font-weight: 700; display: block; }
        .doc-status { font-size: 10px; color: #94a3b8; }
        .loader { height: 100vh; display: grid; place-items: center; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}