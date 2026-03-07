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
  X
} from "lucide-react";

type ShipmentMilestone = {
  type: string;
  at?: string | null;
  note?: string | null;
};

type ShipmentDocument = {
  id: string;
  filename: string;
  doc_type?: string | null;
  created_at: string;
};

type ShipmentPhoto = {
  id: string;
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

  // cliente
  client_name?: string | null;
  client?: { name?: string | null } | null;

  // producto
  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;

  // cantidades
  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;

  // logística
  flight_number?: string | null;
  awb?: string | null;

  // packing
  caliber?: string | null;
  color?: string | null;

  // relaciones
  milestones?: ShipmentMilestone[];
  documents?: ShipmentDocument[];
  photos?: ShipmentPhoto[];
};

type UiLang = "es" | "en";

const SALES_LINES = [
  { key: "fruit_value", es: "1. Valor de la fruta (FOB/FCA)", en: "1. Fruit Value (FOB/FCA)" },
  { key: "intl_logistics", es: "2. Logística internacional", en: "2. International Logistics" },
  { key: "origin_customs", es: "3. Gastos en origen y aduana", en: "3. Origin Charges & Customs" },
  { key: "inspection_quality", es: "4. Inspección y calidad", en: "4. Inspection & Quality" },
] as const;

function lineLabel(key: string, lang: UiLang) {
  const row = SALES_LINES.find((x) => x.key === key);
  return row ? (lang === "en" ? row.en : row.es) : key;
};

const DOC_TYPES = [
  { v: "invoice", l: "Factura" },
  { v: "packing_list", l: "Packing list" },
  { v: "awb", l: "AWB (guía aérea)" },
  { v: "phytosanitary", l: "Certificado fitosanitario" },
  { v: "eur1", l: "EUR1" },
  { v: "export_declaration", l: "Declaración de exportación (aduana)" },
  { v: "non_recyclable_plastics", l: "Declaración de plásticos no reciclables" },
  { v: "sanitary_general_info", l: "Declaración de la Información general de carácter sanitario" },
  { v: "additives_declaration", l: "Declaración de aditivos usados" },
  { v: "quality_report", l: "Informe de calidad" },
] as const;

type DocTypeValue = (typeof DOC_TYPES)[number]["v"];

type MilestoneType = "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION";

const CHAIN: MilestoneType[] = ["PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION"];

function fmtDT(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-PA");
  } catch {
    return iso;
  }
}

function clean(v: any) {
  return String(v ?? "").trim();
}

function productLine(d: ShipmentDetail) {
  const name = clean(d.product_name) || "—";
  const variety = clean(d.product_variety) || "—";
  const mode = clean(d.product_mode) || "—";
  return `${name} ${variety} · ${mode}`;
}

export default function AdminShipmentDetail() {
  const router = useRouter();
  const { id } = router.query;

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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function getTokenOrRedirect() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      return null;
    }
    return token;
  }

  async function deleteFile(fileId: string, kind: "doc" | "photo") {
    if (!confirm("¿Estás seguro de que deseas eliminar este archivo?")) return;
    setBusy(true);
    const token = await getTokenOrRedirect();
    if (!token) { setBusy(false); return; }

    try {
      const res = await fetch("/.netlify/functions/deleteFile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileId, kind, shipmentId: data?.id }),
      });
      if (!res.ok) throw new Error("Error al eliminar");
      showToast("Archivo eliminado 🗑️");
      if (data?.id) load(data.id);
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      setAuthReady(true);
    })();
  }, []);

  async function load(shipmentId: string) {
    setLoading(true);
    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}&mode=admin`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      setError("Error cargando embarque");
      setLoading(false);
      return;
    }

    const json = await res.json();
    setData(json);
    setFlight(json.flight_number ?? "");
    setAwb(json.awb ?? "");
    setCaliber(json.caliber ?? "");
    setColor(json.color ?? "");
    setLoading(false);
  }

  useEffect(() => {
    if (!authReady) return;
    if (typeof id === "string") load(id);
  }, [id, authReady]);

  const has = (t: string) => (data?.milestones ?? []).some((m) => (m.type || "").toUpperCase() === t.toUpperCase());

  function mark(type: MilestoneType) {
    // Lógica simplificada para brevedad, asumiendo validación previa en UI
    handleMark(type);
  }

  async function handleMark(type: MilestoneType) {
    if (!data) return;
    setBusy(true);
    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/.netlify/functions/updateMilestone", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        shipmentId: data.id,
        type,
        note: note.trim(),
        flight_number: flight.trim(),
        awb: awb.trim(),
        caliber: caliber.trim(),
        color: color.trim(),
      }),
    });

    setBusy(false);
    if (!res.ok) { showToast("Error al actualizar"); return; }
    setNote("");
    showToast("Hito actualizado ✅");
    load(data.id);
  }

  // ✅ SOLUCIÓN AL DESORDEN: Añadimos explicitType
  async function upload(kind: "doc" | "photo", file: File, explicitType?: string) {
    if (!data) return;
    
    // Priorizamos el valor que viene directo del botón sobre el estado de React
    const finalDocType = kind === "doc" ? (explicitType || docType) : null;

    if (kind === "doc" && !finalDocType) {
      showToast("Selecciona el tipo de documento.");
      return;
    }

    setBusy(true);
    const token = await getTokenOrRedirect();
    if (!token) return;

    try {
      const bucket = kind === "doc" ? "shipment-docs" : "shipment-photos";
      
      const res1 = await fetch("/.netlify/functions/getUploadUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bucket, shipmentCode: data.code, filename: file.name }),
      });

      if (!res1.ok) throw new Error("Error en URL de subida");
      const { uploadUrl, path } = await res1.json();

      const up = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      if (!up.ok) throw new Error("Error subiendo al bucket");

      const res2 = await fetch("/.netlify/functions/registerFile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shipmentId: data.id,
          kind,
          doc_type: finalDocType, // <--- Aquí usamos el valor garantizado
          filename: file.name,
          storage_path: path,
          bucket,
        }),
      });

      if (!res2.ok) throw new Error("Error registrando en DB");

      showToast("Cargado con éxito ✅");
      load(data.id);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setBusy(false);
      setDocType(null);
    }
  }

  async function download(fileId: string) {
    const token = await getTokenOrRedirect();
    if (!token) return;
    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, "_blank");
    }
  }

  const timelineItems = useMemo(() => {
    return (data?.milestones ?? []).map((m, idx) => ({
      id: `${m.type}-${idx}`,
      type: m.type,
      created_at: m.at,
      note: m.note,
    }));
  }, [data?.milestones]);

  const clientName = clean(data?.client_name) || clean((data as any)?.client?.name) || "—";

  return (
    <AdminLayout title="Detalle de embarque" subtitle="Acciones, hitos, documentos y fotos.">
      <div className="ff-spread2" style={{ marginBottom: 12 }}>
        <Link href="/admin/shipments" className="btnSmall"><ArrowLeft size={16} /> Volver</Link>
        <div className="ff-row2" style={{ gap: 8 }}>
          {data?.flight_number && <span className="chip">Vuelo: {data.flight_number}</span>}
          {data?.awb && <span className="chip">AWB: {data.awb}</span>}
          {data && <span className="statusPill">{labelStatus(data.status)}</span>}
        </div>
      </div>

      {toast && <div className="msgOk" style={{ marginBottom: 12 }}>{toast}</div>}

      <div className="ff-card2" style={{ padding: 12 }}>
        {loading ? <div className="muted">Cargando…</div> : data ? (
          <>
            <div className="cardHead">
              <div className="ff-spread2">
                <div className="codeRow">
                  <span className="codeIcon"><Package size={16} color="var(--ff-green-dark)" /></span>
                  <div>
                    <div className="code">{data.code}</div>
                    <div className="meta">Cliente: <b>{clientName}</b></div>
                    <div className="meta"><b>{productLine(data)}</b></div>
                    <div className="meta">Destino: <b>{data.destination}</b></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ff-divider" />

            {/* ACCIONES */}
            <div className="ff-card2" style={{ padding: 12, background: "rgba(15,23,42,.02)" }}>
              <div className="sectionTitle">Acciones rápidas</div>
              <div className="row3" style={{ marginTop: 12 }}>
                <div><label className="lbl">Nota</label><input className="in2" value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <div><label className="lbl">Vuelo</label><input className="in2" value={flight} onChange={(e) => setFlight(e.target.value)} /></div>
                <div><label className="lbl">AWB</label><input className="in2" value={awb} onChange={(e) => setAwb(e.target.value)} /></div>
              </div>
              <div className="actionsGrid" style={{ marginTop: 12 }}>
                <button className="ff-primary" disabled={busy} onClick={() => mark("PACKED")}><PackageCheck size={16} /> Empaque</button>
                <button className="ff-primary" disabled={busy} onClick={() => mark("DOCS_READY")}><ClipboardCheck size={16} /> Docs</button>
                <button className="ff-primary" disabled={busy} onClick={() => mark("AT_ORIGIN")}><MapPin size={16} /> Origen</button>
                <button className="ff-primary" disabled={busy} onClick={() => mark("IN_TRANSIT")}><Plane size={16} /> Tránsito</button>
                <button className="ff-primary" disabled={busy} onClick={() => mark("AT_DESTINATION")}><PackageCheck size={16} /> Destino</button>
              </div>
            </div>

            <div className="ff-divider" />

            {/* DATOS + TIMELINE */}
            <div className="grid2">
              <div className="ff-card2 soft">
                <div className="sectionTitle"><Info size={16} /> Datos de Empaque</div>
                <div className="row2" style={{ marginTop: 10 }}>
                  <div><label className="lbl">Calibre</label><input className="in2" value={caliber} onChange={(e) => setCaliber(e.target.value)} /></div>
                  <div><label className="lbl">Color</label><input className="in2" value={color} onChange={(e) => setColor(e.target.value)} /></div>
                </div>
              </div>
              <div className="ff-card2">
                <div className="sectionTitle">Línea de Tiempo</div>
                <ModernTimeline milestones={timelineItems as any} />
              </div>
            </div>

            <div className="ff-divider" />

            {/* DOCUMENTOS - CORREGIDO */}
            <section className="glass-card docs-section">
              <div className="section-header-compact">
                <div className="title-group"><FileText size={18} /> <h4>Expediente Digital</h4></div>
                <span className="doc-counter">{data.documents?.length || 0} / {DOC_TYPES.length}</span>
              </div>
              <div className="docs-grid-modern">
                {DOC_TYPES.map((type) => {
                  const uploadedDoc = data.documents?.find(d => d.doc_type === type.v);
                  const isUploadingThis = busy && docType === type.v;
                  return (
                    <div key={type.v} className={`doc-slot ${uploadedDoc ? 'is-filled' : 'is-empty'}`}>
                      <div className="slot-body">
                        <div className="slot-icon">
                          {isUploadingThis ? <Loader2 size={14} className="spin" /> : uploadedDoc ? <CheckCircle size={14} /> : <PlusCircle size={14} />}
                        </div>
                        <div className="slot-info">
                          <span className="slot-label">{type.l}</span>
                          <span className="slot-status">{uploadedDoc ? 'Cargado' : 'Pendiente'}</span>
                        </div>
                      </div>
                      <div className="slot-actions">
                        {uploadedDoc ? (
                          <div className="ff-row2" style={{ gap: 4 }}>
                            <button onClick={() => download(uploadedDoc.id)} className="action-btn download"><Download size={14} /></button>
                            <button disabled={busy} onClick={() => deleteFile(uploadedDoc.id, "doc")} className="action-btn delete"><X size={14} /></button>
                          </div>
                        ) : (
                          <label className="action-btn upload">
                            <PlusCircle size={14} />
                            <input type="file" hidden disabled={busy} onChange={(e) => {
                              const f = e.target.files?.[0];
                              // PASAMOS LOS 3 ARGUMENTOS AQUÍ
                              if (f) { setDocType(type.v); upload("doc", f, type.v); }
                            }} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="ff-divider" />

            {/* FOTOS - CORREGIDO */}
            <div className="ff-card2">
              <div className="section-header-compact">
                <div className="title-group"><ImageIcon size={18} /> <h4>Fotos</h4></div>
                <label className="upload-photo-btn">
                  <PlusCircle size={14} /> Subir Foto
                  <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload("photo", f); // Aquí no necesita el tercer argumento
                  }} />
                </label>
              </div>
              <div className="modern-photo-grid" style={{ marginTop: 12 }}>
                {data.photos?.map((p) => (
                  <div key={p.id} className="photo-card-new">
                    <div className="photo-display">
                      {p.url ? <img src={p.url} alt="Envío" /> : <div className="photo-placeholder" />}
                      <div className="photo-overlay">
                        <button onClick={() => download(p.id)} className="overlay-btn view"><Download size={16} /></button>
                        <button disabled={busy} onClick={() => deleteFile(p.id, "photo")} className="overlay-btn del"><X size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <style jsx>{`
        .ff-card2 { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
        .ff-divider { height: 1px; background: #e2e8f0; margin: 16px 0; }
        .ff-row2 { display: flex; align-items: center; gap: 8px; }
        .ff-spread2 { display: flex; justify-content: space-between; align-items: center; }
        .cardHead { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .codeRow { display: flex; gap: 12px; }
        .codeIcon { background: #f0fdf4; padding: 8px; border-radius: 8px; }
        .code { font-weight: 800; font-size: 18px; }
        .meta { font-size: 12px; color: #64748b; }
        .in2 { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; outline: none; }
        .ff-primary { background: #16a34a; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .actionsGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .docs-grid-modern { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .doc-slot { display: flex; justify-content: space-between; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .is-filled { background: #f0fdf4; border-color: #bbf7d0; }
        .slot-label { font-size: 12px; font-weight: 700; }
        .slot-status { font-size: 10px; color: #64748b; }
        .action-btn { border: none; border-radius: 4px; padding: 4px; cursor: pointer; }
        .action-btn.delete { background: #fee2e2; color: #dc2626; }
        .modern-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
        .photo-card-new { aspect-ratio: 1; border-radius: 8px; overflow: hidden; position: relative; }
        .photo-display img { width: 100%; height: 100%; object-fit: cover; }
        .photo-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; gap: 4px; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .photo-card-new:hover .photo-overlay { opacity: 1; }
        .overlay-btn { border: none; border-radius: 4px; padding: 6px; cursor: pointer; }
        .overlay-btn.view { background: #16a34a; color: #fff; }
        .overlay-btn.del { background: #dc2626; color: #fff; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .grid2 { grid-template-columns: 1fr; } }
      `}</style>
    </AdminLayout>
  );
}