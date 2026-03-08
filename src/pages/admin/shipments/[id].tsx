import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { labelStatus } from "../../../lib/shipmentFlow";
import { Timeline as ModernTimeline } from "../../../components/Timeline";

import {
  FileText, Image as ImageIcon, Download, PackageCheck, Plane,
  MapPin, ClipboardCheck, ArrowLeft, Info, Package, PlusCircle,
  CheckCircle, Loader2, X, Hash, Globe, Scale, Trash2, AlertCircle
} from "lucide-react";

// --- TIPOS ---
type ShipmentMilestone = { type: string; at?: string | null; note?: string | null; };
type ShipmentDocument = { id: string; filename: string; doc_type?: string | null; created_at: string; };
type ShipmentPhoto = { id: string; filename: string; created_at: string; url?: string | null; };

type ShipmentDetail = {
  id: string; code: string; destination: string; status: string; created_at: string;
  client_name?: string | null;
  client?: { name?: string | null } | null;
  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;
  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;
  flight_number?: string | null;
  awb?: string | null;
  caliber?: string | null;
  color?: string | null;
  milestones?: ShipmentMilestone[];
  // IMPORTANTE: Adaptamos a lo que viene de la base de datos
  shipment_documents?: ShipmentDocument[]; 
  shipment_photos?: ShipmentPhoto[];
};

const DOC_TYPES = [
  { v: "invoice", l: "Factura" },
  { v: "packing_list", l: "Packing list" },
  { v: "awb", l: "AWB (guía aérea)" },
  { v: "phytosanitary", l: "Certificado fitosanitario" },
  { v: "eur1", l: "EUR1" },
  { v: "export_declaration", l: "Decl. Exportación" },
  { v: "non_recyclable_plastics", l: "Plásticos no Reciclables" },
  { v: "sanitary_general_info", l: "Info. Sanitaria" },
  { v: "additives_declaration", l: "Decl. Aditivos" },
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function getTokenOrRedirect() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { window.location.href = "/login"; return null; }
    return token;
  }

  async function load(shipmentId: string) {
    setLoading(true);
    const token = await getTokenOrRedirect();
    if (!token) return;

    try {
      const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}&mode=admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Error al cargar");

      const json = await res.json();
      setData(json);
      setFlight(json.flight_number ?? "");
      setAwb(json.awb ?? "");
      setCaliber(json.caliber ?? "");
      setColor(json.color ?? "");
    } catch (err) {
      setError("No se pudo cargar el embarque");
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
    return (data?.milestones ?? [])
      .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime())
      .map((m, idx) => ({ id: `${m.type}-${idx}`, type: m.type, created_at: m.at, note: m.note }));
  }, [data?.milestones]);

  const mark = async (type: MilestoneType) => {
    const has = (t: string) => (data?.milestones ?? []).some((m) => m.type.toUpperCase() === t.toUpperCase());
    if (has(type)) return showPopup("Hito ya marcado", "error");
    
    if (type === "PACKED" && (!caliber.trim() || !color.trim())) return showPopup("Falta Calibre/Color", "error");
    if (type === "IN_TRANSIT" && !flight.trim()) return showPopup("Falta N° de Vuelo", "error");

    setBusy(true);
    const token = await getTokenOrRedirect();
    const res = await fetch("/.netlify/functions/updateMilestone", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        shipmentId: data?.id, type, note: note.trim() || null,
        flight_number: flight.trim() || null, awb: awb.trim() || null,
        caliber: caliber.trim() || null, color: color.trim() || null,
      }),
    });

    setBusy(false);
    if (res.ok) {
      showPopup(`Hito registrado ✅`);
      setNote("");
      load(data!.id);
    } else {
      showPopup("Error al actualizar", "error");
    }
  };

  async function upload(kind: "doc" | "photo", file: File) {
    if (!data) return;
    setBusy(true);
    const token = await getTokenOrRedirect();
    const bucket = kind === "doc" ? "shipment-docs" : "shipment-photos";

    try {
      const res1 = await fetch("/.netlify/functions/getUploadUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket, shipmentCode: data.code, filename: file.name }),
      });

      if (!res1.ok) throw new Error("Upload URL Error");
      const { uploadUrl, path } = await res1.json();
      
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      
      await fetch("/.netlify/functions/registerFile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shipmentId: data.id, kind, doc_type: kind === "doc" ? docType : null,
          filename: file.name, storage_path: path, bucket,
        }),
      });
      showPopup("Archivo cargado");
      load(data.id);
    } catch (e) {
      showPopup("Error al subir archivo", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(fileId: string, kind: "doc" | "photo") {
    if (!confirm("¿Eliminar archivo?")) return;
    setBusy(true);
    const token = await getTokenOrRedirect();
    const res = await fetch("/.netlify/functions/deleteFile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileId, kind, shipmentId: data?.id }),
    });
    setBusy(false);
    if (res.ok) { showPopup("Eliminado 🗑️"); load(data!.id); }
  }

  async function download(fileId: string) {
    const token = await getTokenOrRedirect();
    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${token}` },
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
          <button onClick={() => setPopup(null)}><X size={14}/></button>
        </div>
      )}

      <div className="detail-container">
        <div className="top-nav-row">
          <Link href="/admin/shipments" className="btn-back"><ArrowLeft size={16}/> Volver</Link>
          <div className="status-badge">Estado: <span className="pill">{labelStatus(data!.status)}</span></div>
        </div>

        <header className="shipment-header-modern">
          <div className="h-left">
            <div className="code-tag"><Hash size={14}/> {data?.code}</div>
            <h1>{data?.product_name} <small>{data?.product_variety}</small></h1>
            <p className="client">Cliente: <strong>{data?.client_name || (data as any)?.client?.name}</strong></p>
          </div>
          <div className="h-right">
            <div className="h-stat"><label><Package size={14}/> Cajas / Pallets</label><span>{data?.boxes || 0} / {data?.pallets || 0}</span></div>
            <div className="divider-v" />
            <div className="h-stat"><label><Scale size={14}/> Peso Neto</label><span>{data?.weight_kg || 0} kg</span></div>
            <div className="divider-v" />
            <div className="h-stat"><label><Globe size={14}/> Destino</label><span>{data?.destination}</span></div>
          </div>
        </header>

        <div className="main-grid-layout">
          <div className="left-column">
            <section className="glass-card">
              <div className="card-head"><ClipboardCheck size={18}/> <h3>Control de Hitos</h3></div>
              <div className="milestone-controls">
                <div className="input-group-row">
                  <div className="f-item full"><label>Nota de estado</label><textarea placeholder="Detalles..." value={note} onChange={e => setNote(e.target.value)} /></div>
                  <div className="f-item"><label>Vuelo *</label><input value={flight} onChange={e => setFlight(e.target.value)} /></div>
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
              <div className="card-head"><Info size={18}/> <h3>Datos de Empaque</h3></div>
              <div className="technical-grid">
                <div className="f-item"><label>Calibre *</label><input value={caliber} onChange={e => setCaliber(e.target.value)} /></div>
                <div className="f-item"><label>Color *</label><input value={color} onChange={e => setColor(e.target.value)} /></div>
              </div>
            </section>

            {/* FOTOS - Corregido mapeo de shipment_photos */}
            <section className="glass-card spacing-top">
              <div className="card-head-between">
                <div className="title-group"><ImageIcon size={18}/> <h3>Fotos de Evidencia</h3></div>
                <label className="btn-upload-photo">
                  <PlusCircle size={14}/> Subir Foto
                  <input type="file" accept="image/*" hidden disabled={busy} onChange={e => e.target.files?.[0] && upload("photo", e.target.files[0])} />
                </label>
              </div>
              <div className="photo-grid-modern">
                {data?.shipment_photos?.length ? (
                  data.shipment_photos.map(p => (
                    <div key={p.id} className="photo-box">
                      <img src={p.url || "/placeholder-img.png"} alt="Foto" onError={(e) => (e.currentTarget.src = "/placeholder-img.png")} />
                      <div className="overlay">
                        <button onClick={() => download(p.id)} title="Descargar"><Download size={16}/></button>
                        <button onClick={() => deleteFile(p.id, "photo")} className="del" title="Eliminar"><X size={16}/></button>
                      </div>
                    </div>
                  ))
                ) : <p className="empty-text">Sin fotos cargadas</p>}
              </div>
            </section>
          </div>

          <aside className="right-column">
            {/* DOCUMENTOS - Corregido mapeo de shipment_documents */}
            <section className="glass-card">
              <div className="card-head"><FileText size={18}/> <h3>Documentación</h3></div>
              <div className="docs-list-modern">
                {DOC_TYPES.map(type => {
                  const doc = data?.shipment_documents?.find(d => d.doc_type === type.v);
                  return (
                    <div key={type.v} className={`doc-item ${doc ? 'is-ok' : 'is-off'}`}>
                      <div className="doc-info">
                        <span className="doc-name">{type.l}</span>
                        <span className="doc-status">{doc ? 'Cargado' : 'Pendiente'}</span>
                      </div>
                      <div className="doc-actions">
                        {doc ? (
                          <div className="actions-ok">
                            <button onClick={() => download(doc.id)} className="btn-dl"><Download size={14}/></button>
                            <button onClick={() => deleteFile(doc.id, "doc")} className="btn-del"><X size={14}/></button>
                          </div>
                        ) : (
                          <label className="btn-up">
                            <PlusCircle size={14}/>
                            <input type="file" hidden onChange={e => { setDocType(type.v); if(e.target.files?.[0]) upload("doc", e.target.files[0]); }} />
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
        .popup-toast { position: fixed; top: 25px; right: 25px; z-index: 9999; display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-radius: 16px; color: white; font-weight: 700; font-size: 14px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out; }
        .popup-toast.success { background: #16a34a; border-left: 5px solid #052e16; }
        .popup-toast.error { background: #dc2626; border-left: 5px solid #450a0a; }
        .popup-toast button { background: transparent; border: none; color: white; cursor: pointer; opacity: 0.7; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .shipment-header-modern { background: #fff; padding: 25px 30px; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .code-tag { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 12px; display: flex; align-items: center; gap: 5px; width: fit-content; }
        .h-left h1 { font-size: 24px; font-weight: 900; margin: 8px 0 2px; }
        .h-left h1 small { color: #64748b; font-weight: 400; font-size: 16px; margin-left: 8px; }
        .h-right { display: flex; gap: 24px; background: #f8fafc; padding: 12px 20px; border-radius: 16px; }
        .h-stat { display: flex; flex-direction: column; }
        .h-stat label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
        .h-stat span { font-size: 15px; font-weight: 800; color: #1e293b; }
        .divider-v { width: 1px; height: 30px; background: #e2e8f0; }
        .main-grid-layout { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
        .glass-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; }
        .spacing-top { margin-top: 24px; }
        .card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .card-head h3 { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #1e293b; margin: 0; }
        .card-head-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .input-group-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; background: #f8fafc; padding: 20px; border-radius: 16px; margin-bottom: 15px; }
        .f-item { display: flex; flex-direction: column; gap: 6px; }
        .f-item.full { grid-column: span 3; }
        .f-item label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .f-item input, .f-item textarea { padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; outline: none; }
        .f-item textarea { height: 60px; resize: none; }
        .actions-buttons-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .btn-step { padding: 12px 5px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; font-size: 10px; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .btn-step.active { background: #16a34a; color: #fff; border-color: #16a34a; box-shadow: 0 4px 10px rgba(22, 163, 74, 0.2); }
        .technical-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .photo-grid-modern { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
        .photo-box { position: relative; aspect-ratio: 1; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; background: #f1f5f9; }
        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
        .overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; gap: 10px; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .photo-box:hover .overlay { opacity: 1; }
        .overlay button { width: 32px; height: 32px; border-radius: 8px; border: none; cursor: pointer; display: grid; place-items: center; background: #fff; color: #1e293b; }
        .overlay button.del { background: #ef4444; color: #fff; }
        .docs-list-modern { display: flex; flex-direction: column; gap: 8px; }
        .doc-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 12px; border: 1px solid #f1f5f9; }
        .doc-item.is-ok { background: #f0fdf4; border-color: #dcfce7; }
        .doc-item.is-off { background: #f8fafc; border-style: dashed; }
        .doc-name { display: block; font-size: 12px; font-weight: 800; color: #1e293b; }
        .doc-status { font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
        .btn-up, .btn-dl, .btn-del { cursor: pointer; display: grid; place-items: center; transition: 0.2s; }
        .btn-dl { color: #16a34a; }
        .btn-del { color: #ef4444; margin-left: 8px; }
        .actions-ok { display: flex; align-items: center; }
        .loader { height: 80vh; display: grid; place-items: center; color: #16a34a; }
        .spin { animation: rotate 1s linear infinite; }
        .empty-text { font-size: 12px; color: #94a3b8; text-align: center; grid-column: 1/-1; padding: 20px; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}