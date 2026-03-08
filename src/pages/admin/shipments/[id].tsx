// src/pages/admin/shipments/[id].tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { labelStatus } from "../../../lib/shipmentFlow";
import { Timeline as ModernTimeline } from "../../../components/Timeline";

import {
  FileText,
  Image as ImageIcon,
  Download,
  PackageCheck,
  Plane,
  MapPin,
  ClipboardCheck,
  ArrowLeft,
  Info,
  Package,
  PlusCircle,
  CheckCircle,
  Loader2,
  X,
  Truck,
  Hash,
  Layers
} from "lucide-react";

// ... (Tipos se mantienen idénticos)
type ShipmentMilestone = { type: string; at?: string | null; note?: string | null; };
type ShipmentDocument = { id: string; filename: string; doc_type?: string | null; created_at: string; };
type ShipmentPhoto = { id: string; filename: string; created_at: string; url?: string | null; };
type ShipmentDetail = {
  id: string; code: string; destination: string; status: string; created_at: string;
  client_name?: string | null; client?: { name?: string | null } | null;
  product_name?: string | null; product_variety?: string | null; product_mode?: string | null;
  boxes?: number | null; pallets?: number | null; weight_kg?: number | null;
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

type DocTypeValue = (typeof DOC_TYPES)[number]["v"];
type MilestoneType = "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION";

function clean(v: any) { return String(v ?? "").trim(); }

export default function AdminShipmentDetail() {
  const router = useRouter();
  const { id } = router.query;

  // Lógica funcional (INTACTA)
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [flight, setFlight] = useState("");
  const [awb, setAwb] = useState("");
  const [caliber, setCaliber] = useState("");
  const [color, setColor] = useState("");
  const [docType, setDocType] = useState<DocTypeValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ... (Funciones auxiliares load, upload, mark, deleteFile, etc. se mantienen idénticas a tu original)
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }
  async function getTokenOrRedirect() {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token || null;
  }

  useEffect(() => { (async () => { const r = await requireAdminOrRedirect(); if (r.ok) setAuthReady(true); })(); }, []);
  
  async function load(shipmentId: string) {
    setLoading(true);
    const token = await getTokenOrRedirect();
    const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}&mode=admin`, {
      headers: { Authorization: `Bearer ${token || ""}` }
    });
    if (res.ok) {
      const json = await res.json();
      setData(json); setFlight(json.flight_number ?? ""); setAwb(json.awb ?? "");
      setCaliber(json.caliber ?? ""); setColor(json.color ?? "");
    } else { setError("Error"); }
    setLoading(false);
  }

  useEffect(() => { if (authReady && typeof id === "string") load(id); }, [id, authReady]);

  async function handleMark(type: MilestoneType) {
    if (!data) return; setBusy(true);
    const token = await getTokenOrRedirect();
    await fetch("/.netlify/functions/updateMilestone", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shipmentId: data.id, type, note: note.trim(), flight_number: flight.trim(), awb: awb.trim(), caliber: caliber.trim(), color: color.trim() }),
    });
    setBusy(false); setNote(""); showToast("Actualizado ✅"); load(data.id);
  }

  async function upload(kind: "doc" | "photo", file: File, explicitType?: string) {
    if (!data) return;
    const finalDocType = kind === "doc" ? (explicitType || docType) : null;
    setBusy(true);
    try {
      const token = await getTokenOrRedirect();
      const res1 = await fetch("/.netlify/functions/getUploadUrl", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket: kind === "doc" ? "shipment-docs" : "shipment-photos", shipmentCode: data.code, filename: file.name }),
      });
      const { uploadUrl, path } = await res1.json();
      await fetch(uploadUrl, { method: "PUT", body: file });
      await fetch("/.netlify/functions/registerFile", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shipmentId: data.id, kind, doc_type: finalDocType, filename: file.name, storage_path: path, bucket: kind === "doc" ? "shipment-docs" : "shipment-photos" }),
      });
      showToast("Cargado ✅"); load(data.id);
    } catch (e) {} finally { setBusy(false); setDocType(null); }
  }

  async function download(fileId: string) {
    const token = await getTokenOrRedirect();
    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const { url } = await res.json(); window.open(url, "_blank"); }
  }

  async function deleteFile(fileId: string, kind: "doc" | "photo") {
    if (!confirm("¿Eliminar?")) return;
    setBusy(true);
    const token = await getTokenOrRedirect();
    await fetch("/.netlify/functions/deleteFile", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fileId, kind, shipmentId: data?.id }),
    });
    setBusy(false); showToast("Eliminado"); load(data!.id);
  }

  const timelineItems = useMemo(() => (data?.milestones ?? []).map((m, idx) => ({ id: `${m.type}-${idx}`, type: m.type, created_at: m.at, note: m.note })), [data?.milestones]);
  const clientName = clean(data?.client_name) || clean((data as any)?.client?.name) || "—";

  if (loading) return <AdminLayout title="Cargando..."><div className="loader-center"><Loader2 className="spin" /></div></AdminLayout>;

  return (
    <AdminLayout title="Control de Operaciones" subtitle="Fresh Food Panamá - Logística Senior">
      <div className="page">
        {/* TOP BAR: VOLVER Y TOAST */}
        <div className="modern-section-header spread">
          <Link href="/admin/shipments" className="ff-download-minimal">
            <ArrowLeft size={16} /> Volver al listado
          </Link>
          {toast && <div className="ff-id-badge">{toast}</div>}
        </div>

        {/* 1. PREMIUM HEADER */}
        <header className="ff-header-premium">
          <div className="ff-header-main-info">
            <span className="ff-id-badge"><Hash size={14}/> {data?.code}</span>
            <h1 className="ff-product-name">{data?.product_name || "Sin nombre"} <small style={{fontWeight: 400, opacity: 0.6}}>{data?.product_variety}</small></h1>
            <div className="ff-client-tag">Cliente: <strong>{clientName}</strong> • Destino: <strong>{data?.destination}</strong></div>
          </div>

          <div className="ff-header-specs-bar">
            <div className="ff-spec-item">
              <span className="ff-spec-label">Logística</span>
              <div className="ff-spec-value-group">
                <Plane size={14} className="ff-text-blue" />
                <span className="ff-spec-value">{data?.flight_number || "—"}</span>
              </div>
            </div>
            <div className="ff-spec-divider" />
            <div className="ff-spec-item">
              <span className="ff-spec-label">AWB</span>
              <span className="ff-spec-value">{data?.awb || "—"}</span>
            </div>
            <div className="ff-spec-divider-heavy" />
            <div className="ff-spec-item">
              <span className="ff-spec-label">Estado Actual</span>
              <span className={`pill-status-v2 ${data?.status.toLowerCase()}`}>{labelStatus(data?.status || "")}</span>
            </div>
          </div>
        </header>

        {/* 2. GRID BALANCEADO */}
        <div className="ff-balanced-grid">
          {/* COLUMNA IZQUIERDA: CONTROL Y TIMELINE */}
          <div className="col-stack">
            {/* CARD DE ACCIONES RÁPIDAS */}
            <section className="ff-col-docs" style={{marginBottom: 24}}>
              <div className="modern-section-header">
                <div className="header-icon orange"><ClipboardCheck size={20} /></div>
                <h3>Actualizar Estado</h3>
              </div>
              
              <div className="admin-quick-inputs">
                <div className="field">
                  <label className="ff-spec-label">Nota Interna</label>
                  <input className="ff-input-modern" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Mercancía recibida en bodega..." />
                </div>
                <div className="row-3-inputs">
                  <div className="field">
                    <label className="ff-spec-label">Vuelo</label>
                    <input className="ff-input-modern" value={flight} onChange={(e) => setFlight(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="ff-spec-label">AWB</label>
                    <input className="ff-input-modern" value={awb} onChange={(e) => setAwb(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="ff-spec-label">Calibre/Color</label>
                    <div className="ff-row-mini">
                      <input className="ff-input-modern" value={caliber} onChange={(e) => setCaliber(e.target.value)} placeholder="Cal" />
                      <input className="ff-input-modern" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Col" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="actions-strip-admin">
                <button disabled={busy} onClick={() => handleMark("PACKED")} className="btn-action-admin"><PackageCheck size={16}/> Empacado</button>
                <button disabled={busy} onClick={() => handleMark("DOCS_READY")} className="btn-action-admin"><FileText size={16}/> Docs Listos</button>
                <button disabled={busy} onClick={() => handleMark("AT_ORIGIN")} className="btn-action-admin"><MapPin size={16}/> En Origen</button>
                <button disabled={busy} onClick={() => handleMark("IN_TRANSIT")} className="btn-action-admin primary"><Plane size={16}/> En Tránsito</button>
                <button disabled={busy} onClick={() => handleMark("AT_DESTINATION")} className="btn-action-admin success"><CheckCircle size={16}/> Entregado</button>
              </div>
            </section>

            <section className="ff-col-docs">
              <div className="modern-section-header">
                <div className="header-icon dark"><Layers size={20} /></div>
                <h3>Línea de Tiempo</h3>
              </div>
              <ModernTimeline milestones={timelineItems as any} />
            </section>
          </div>

          {/* COLUMNA DERECHA: EXPEDIENTE Y FOTOS */}
          <div className="col-stack">
            {/* EXPEDIENTE DIGITAL */}
            <section className="ff-col-docs" style={{marginBottom: 24}}>
              <div className="modern-section-header spread">
                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                  <div className="header-icon dark"><FileText size={20} /></div>
                  <h3>Expediente Digital</h3>
                </div>
                <span className="doc-counter-premium">{data?.documents?.length || 0} / {DOC_TYPES.length}</span>
              </div>

              <div className="ff-docs-list-refined">
                {DOC_TYPES.map((type) => {
                  const doc = data?.documents?.find(d => d.doc_type === type.v);
                  return (
                    <div key={type.v} className={`ff-doc-flat-row ${doc ? 'is-up' : 'is-off'}`}>
                      <div className="ff-doc-left">
                        <div className="ff-status-indicator" />
                        <span className="ff-doc-label">{type.l}</span>
                      </div>
                      <div className="ff-row-mini">
                        {doc ? (
                          <>
                            <button onClick={() => download(doc.id)} className="ff-download-minimal"><Download size={14}/></button>
                            <button disabled={busy} onClick={() => deleteFile(doc.id, "doc")} className="btn-icon-del"><X size={14}/></button>
                          </>
                        ) : (
                          <label className="btn-plus-upload">
                            <PlusCircle size={16} />
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

            {/* FOTOS DE CARGA */}
            <section className="ff-col-photos">
              <div className="modern-section-header spread">
                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                  <div className="header-icon dark"><ImageIcon size={20} /></div>
                  <h3>Registro Fotográfico</h3>
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
                {data?.photos?.map((p) => (
                  <div key={p.id} className="ff-thumb-admin">
                    <img src={p.url || ""} alt="Carga" />
                    <div className="thumb-overlay">
                      <button onClick={() => download(p.id)} className="overlay-btn"><Download size={14}/></button>
                      <button onClick={() => deleteFile(p.id, "photo")} className="overlay-btn del"><X size={14}/></button>
                    </div>
                  </div>
                ))}
                {(!data?.photos || data.photos.length === 0) && <div className="muted-box">Sin fotos cargadas</div>}
              </div>
            </section>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* REUTILIZACIÓN DE TUS ESTILOS PREMIUM */
        .page { display: flex; flex-direction: column; gap: 24px; padding: 20px; }
        .modern-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .modern-section-header.spread { justify-content: space-between; }
        .modern-section-header h3 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
        
        .header-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; }
        .header-icon.dark { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
        .header-icon.orange { background: #fff7ed; color: #ea580c; }

        .ff-header-premium {
          background: #ffffff; padding: 28px 36px; border-radius: 24px; border: 1px solid #f1f5f9;
          display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }

        .ff-id-badge { 
          display: inline-flex; align-items: center; gap: 8px; background: #f0fdf4; color: #166534; 
          padding: 4px 10px; border-radius: 8px; font-family: monospace; font-weight: 700; font-size: 13px; margin-bottom: 8px;
        }
        .ff-product-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
        .ff-client-tag { font-size: 13px; color: #64748b; margin-top: 4px; }

        .ff-header-specs-bar { display: flex; align-items: center; gap: 20px; background: #f8fafc; padding: 14px 28px; border-radius: 20px; border: 1px solid #f1f5f9; }
        .ff-spec-item { display: flex; flex-direction: column; }
        .ff-spec-label { font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
        .ff-spec-value { font-size: 14px; font-weight: 700; color: #1e293b; }
        .ff-spec-divider { width: 1px; height: 20px; background: #e2e8f0; }
        .ff-spec-divider-heavy { width: 2px; height: 30px; background: #e2e8f0; margin: 0 10px; opacity: 0.6; }

        .ff-balanced-grid { display: grid; grid-template-columns: 1fr 450px; gap: 24px; }
        .ff-col-docs, .ff-col-photos { background: white; padding: 24px; border-radius: 24px; border: 1px solid #f1f5f9; }

        /* ADMIN SPECIFIC UI */
        .admin-quick-inputs { background: #f8fafc; padding: 16px; border-radius: 16px; margin-bottom: 16px; border: 1px solid #f1f5f9; }
        .row-3-inputs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
        .ff-input-modern { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 14px; outline: none; transition: 0.2s; }
        .ff-input-modern:focus { border-color: #ea580c; background: white; }
        
        .actions-strip-admin { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .btn-action-admin { 
          display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; 
          border-radius: 12px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 11px; font-weight: 700; transition: 0.2s;
        }
        .btn-action-admin:hover { border-color: #ea580c; color: #ea580c; }
        .btn-action-admin.primary { background: #1e293b; color: white; border: none; }
        .btn-action-admin.success { background: #16a34a; color: white; border: none; }

        .ff-docs-list-refined { display: flex; flex-direction: column; gap: 8px; }
        .ff-doc-flat-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; border: 1px solid #f1f5f9; }
        .ff-doc-flat-row.is-up { background: #f0fdf4; border-color: #bbf7d0; }
        .ff-doc-flat-row.is-off { opacity: 0.6; background: #fafafa; }
        .ff-status-indicator { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; margin-right: 10px; }
        .is-up .ff-status-indicator { background: #16a34a; box-shadow: 0 0 8px rgba(22,163,74,0.4); }

        .ff-thumbs-grid-admin { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; margin-top: 12px; }
        .ff-thumb-admin { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
        .ff-thumb-admin img { width: 100%; height: 100%; object-fit: cover; }
        .thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; gap: 4px; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .ff-thumb-admin:hover .thumb-overlay { opacity: 1; }
        .overlay-btn { padding: 4px; background: white; border: none; border-radius: 4px; cursor: pointer; }
        .overlay-btn.del { color: #dc2626; }
        
        .btn-add-photo-premium { display: flex; align-items: center; gap: 6px; background: #1e293b; color: white; padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .btn-icon-del { background: #fee2e2; color: #dc2626; border: none; padding: 4px; border-radius: 6px; cursor: pointer; }
        .ff-row-mini { display: flex; align-items: center; gap: 6px; }
        .loader-center { display: grid; place-items: center; height: 200px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .pill-status-v2 { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
        .created { background: #fef3c7; color: #92400e; }
        .in_transit { background: #dbeafe; color: #1e40af; }
        .delivered { background: #dcfce7; color: #166534; }

        @media (max-width: 1200px) { .ff-balanced-grid { grid-template-columns: 1fr; } .ff-header-premium { flex-direction: column; align-items: flex-start; gap: 20px; } }
      `}</style>
    </AdminLayout>
  );
}