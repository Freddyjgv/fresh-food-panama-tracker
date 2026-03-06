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

function productShort(d: ShipmentDetail) {
  const name = clean(d.product_name);
  const variety = clean(d.product_variety);
  return [name, variety].filter(Boolean).join(" ") || "—";
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

  // ✅ nuevos campos de Datos
  const [caliber, setCaliber] = useState("");
  const [color, setColor] = useState("");

  // ✅ doc type por “casillas”
  const [docType, setDocType] = useState<DocTypeValue | null>("packing_list");

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
  // 1. Confirmación de seguridad
  if (!confirm("¿Estás seguro de que deseas eliminar este archivo? Esta acción no se puede deshacer.")) return;

  setBusy(true);
  const token = await getTokenOrRedirect();
  if (!token) {
    setBusy(false);
    return;
  }

  try {
    // 2. Llamada a tu API (Netlify Function)
    const res = await fetch("/.netlify/functions/deleteFile", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        fileId, 
        kind, 
        shipmentId: data?.id 
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Error al eliminar el archivo");
    }

    // 3. Feedback y recarga de datos
    showToast("Archivo eliminado correctamente 🗑️");
    if (data?.id) load(data.id); 

  } catch (err: any) {
    console.error("Error deleting file:", err);
    showToast(err.message || "No se pudo eliminar");
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
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch(
      `/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}&mode=admin`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      setError(t || "Error");
      setLoading(false);
      return;
    }

    const json = (await res.json()) as ShipmentDetail;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authReady]);

  const has = (t: string) =>
    (data?.milestones ?? []).some((m) => (m.type || "").toUpperCase() === t.toUpperCase());

  function prevOf(type: MilestoneType): MilestoneType | null {
    const idx = CHAIN.indexOf(type);
    if (idx <= 0) return null;
    return CHAIN[idx - 1];
  }

  function canMark(type: MilestoneType) {
    if (!data) return { ok: false, reason: "No hay embarque cargado." };
    if (has(type)) return { ok: false, reason: "Ese hito ya está marcado." };

    const prev = prevOf(type);
    if (prev && !has(prev)) {
      return { ok: false, reason: `Debes completar primero: ${labelStatus(prev)}.` };
    }

    // ✅ PACKED requiere Calibre y Color
    if (type === "PACKED") {
      if (!caliber.trim() || !color.trim()) {
        return { ok: false, reason: "Para marcar 'En Empaque' debes completar Calibre y Color." };
      }
    }

    // ✅ IN_TRANSIT requiere vuelo (y ya queda en cadena por AT_ORIGIN)
    if (type === "IN_TRANSIT" && !flight.trim()) {
      return { ok: false, reason: "Para marcar 'En tránsito' debes colocar el número de vuelo." };
    }

    return { ok: true, reason: "" };
  }

  async function mark(type: MilestoneType) {
    const chk = canMark(type);
    if (!chk.ok) {
      showToast(chk.reason || "No se puede marcar ese hito todavía.");
      return;
    }
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
        note: note.trim() || null,
        flight_number: flight.trim() || null,
        awb: awb.trim() || null,

        // ✅ nuevos (si tu backend los persiste)
        caliber: caliber.trim() || null,
        color: color.trim() || null,
      }),
    });

    const t = await res.text().catch(() => "");
    setBusy(false);

    if (!res.ok) {
      showToast(t || "No se pudo actualizar");
      return;
    }

    setNote("");
    showToast("Hito actualizado ✅");
    load(data.id);
  }

  async function upload(kind: "doc" | "photo", file: File) {
    if (!data) return;

    if (kind === "doc" && !docType) {
      showToast("Selecciona el tipo de documento antes de subir.");
      return;
    }

    setBusy(true);
    const token = await getTokenOrRedirect();
    if (!token) return;

    const bucket = kind === "doc" ? "shipment-docs" : "shipment-photos";

    // 1) signed upload url
    const res1 = await fetch("/.netlify/functions/getUploadUrl", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bucket, shipmentCode: data.code, filename: file.name }),
    });

    if (!res1.ok) {
      const t = await res1.text().catch(() => "");
      setBusy(false);
      showToast(t || "No se pudo preparar la subida");
      return;
    }

    const { uploadUrl, path } = await res1.json();

    // 2) upload file
    const up = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });

    if (!up.ok) {
      setBusy(false);
      showToast("Falló la subida del archivo");
      return;
    }

    // 3) register file in DB
    const res2 = await fetch("/.netlify/functions/registerFile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        shipmentId: data.id,
        kind,
        doc_type: kind === "doc" ? docType : null,
        filename: file.name,
        storage_path: path,
        bucket,
      }),
    });

    const t2 = await res2.text().catch(() => "");
    setBusy(false);

    if (!res2.ok) {
      showToast(t2 || "No se pudo registrar el archivo");
      return;
    }

    showToast(kind === "doc" ? "Documento cargado ✅" : "Foto cargada ✅");
    load(data.id);
  }

  async function download(fileId: string) {
    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      showToast("No se pudo generar el link de descarga");
      return;
    }

    const { url } = await res.json();
    window.open(url, "_blank");
  }

  const timelineItems = useMemo(() => {
    const ms = [...(data?.milestones ?? [])].sort((a, b) => {
      const ta = new Date(a.at).getTime();
      const tb = new Date(b.at).getTime();
      return ta - tb;
    });

    return ms.map((m, idx) => ({
      id: `${m.type}-${idx}`,
      type: m.type,
      created_at: m.at,
      note: m.note,
    }));
  }, [data?.milestones]);

  const clientName =
    clean(data?.client_name) ||
    clean((data as any)?.client?.name) ||
    "—";

  return (
    <AdminLayout title="Detalle de embarque" subtitle="Acciones, hitos, documentos y fotos.">
      {/* Top bar */}
      <div className="ff-spread2" style={{ marginBottom: 12 }}>
        <Link href="/admin/shipments" className="btnSmall">
          <ArrowLeft size={16} />
          Volver
        </Link>

        <div className="ff-row2" style={{ gap: 8 }}>
          {data?.flight_number ? <span className="chip">Vuelo: {data.flight_number}</span> : null}
          {data?.awb ? <span className="chip">AWB: {data.awb}</span> : null}
          {data ? <span className="statusPill">{labelStatus(data.status)}</span> : null}
        </div>
      </div>

      {toast ? (
        <div className="msgOk" style={{ marginBottom: 12 }}>
          {toast}
        </div>
      ) : null}

<div className="ff-card2" style={{ padding: 12 }}>
        {!authReady ? (
          <div className="muted">Verificando permisos…</div>
        ) : loading ? (
          <div className="muted">Cargando…</div>
        ) : error ? (
          <div className="msgWarn">
            <b>Error</b>
            <div>{error}</div>
          </div>
        ) : data ? (
          <>
            {/* 1. HEADER RESUMEN */}
            <div className="cardHead">
              <div className="ff-spread2" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="codeRow">
                    <span className="codeIcon" aria-hidden="true">
                      <Package size={16} color="var(--ff-green-dark)" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="code">{data.code}</div>
                      <div className="meta" style={{ marginTop: 2 }}>
                        Cliente: <b>{clientName}</b>
                      </div>
                      <div className="meta" style={{ marginTop: 2 }}>
                        <b>{productLine(data)}</b>
                      </div>
                      <div className="meta" style={{ marginTop: 2 }}>
                        Destino: <b>{data.destination}</b> · Creado: {fmtDT(data.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ff-row2" style={{ gap: 8, justifyContent: "flex-end" }}>
                  <span className="chipSoft">Estado: {labelStatus(data.status)}</span>
                </div>
              </div>
            </div>

            <div className="ff-divider" />

            {/* 2. ACCIONES RÁPIDAS */}
            <div className="ff-card2" style={{ padding: 12, background: "rgba(15,23,42,.02)" }}>
              <div className="sectionTitle">Acciones rápidas</div>
              <div className="muted" style={{ marginTop: 2 }}>
                Los hitos avanzan en cadena. Para <b>En tránsito</b> el <b>Vuelo</b> es obligatorio.
              </div>
              <div className="ff-divider" style={{ margin: "12px 0" }} />
              <div className="row3" style={{ gridTemplateColumns: "1.2fr .9fr .9fr" }}>
                <div>
                  <label className="lbl">Nota</label>
                  <input className="in2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="..." />
                </div>
                <div>
                  <label className="lbl">Vuelo *</label>
                  <input className="in2" value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="Ej: IB1234" />
                </div>
                <div>
                  <label className="lbl">AWB</label>
                  <input className="in2" value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="Ej: 123-..." />
                </div>
              </div>
              <div className="ff-divider" style={{ margin: "12px 0" }} />
              <div className="actionsGrid">
                <button className="ff-primary" type="button" disabled={busy} onClick={() => mark("PACKED")}><PackageCheck size={16} /> En Empaque</button>
                <button className="ff-primary" type="button" disabled={busy} onClick={() => mark("DOCS_READY")}><ClipboardCheck size={16} /> Documentación lista</button>
                <button className="ff-primary" type="button" disabled={busy} onClick={() => mark("AT_ORIGIN")}><MapPin size={16} /> En Origen</button>
                <button className="ff-primary" type="button" disabled={busy} onClick={() => mark("IN_TRANSIT")}><Plane size={16} /> En tránsito</button>
                <button className="ff-primary" type="button" disabled={busy} onClick={() => mark("AT_DESTINATION")}><PackageCheck size={16} /> En Destino</button>
              </div>
              {busy && <div className="muted" style={{ marginTop: 10 }}>Procesando…</div>}
            </div>

            <div className="ff-divider" />

            {/* 3. DATOS + TIMELINE */}
            <div className="grid2">
              <div className="ff-card2 soft">
                <div className="sectionTitle"><Info size={16} /> Datos</div>
                <div className="kv"><span>Cajas</span><b>{data.boxes ?? "-"}</b></div>
                <div className="kv"><span>Pallets</span><b>{data.pallets ?? "-"}</b></div>
                <div className="ff-divider" style={{ margin: "10px 0" }} />
                <div className="row2">
                  <div><label className="lbl">Calibre *</label><input className="in2" value={caliber} onChange={(e) => setCaliber(e.target.value)} /></div>
                  <div><label className="lbl">Color *</label><input className="in2" value={color} onChange={(e) => setColor(e.target.value)} /></div>
                </div>
              </div>
              <div className="ff-card2">
                <div className="sectionTitle">Hitos</div>
                <ModernTimeline milestones={timelineItems as any} />
              </div>
            </div>

            <div className="ff-divider" />

            {/* 4. EXPEDIENTE DIGITAL (DOCUMENTOS) */}
            <section className="glass-card docs-section">
              <div className="section-header-compact">
                <div className="title-group">
                  <FileText size={18} className="text-green-600" />
                  <h4>Expediente Digital</h4>
                </div>
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
    <button type="button" onClick={() => download(uploadedDoc.id)} className="action-btn download">
      <Download size={14} />
    </button>
    
    {/* AGREGA ESTE BOTÓN AQUÍ */}
    <button type="button" disabled={busy} onClick={() => deleteFile(uploadedDoc.id, "doc")} className="action-btn delete">
      <X size={14} />
    </button>
  </div>
                        ) : (
                          <label className="action-btn upload">
                            <PlusCircle size={14} />
                            <input type="file" hidden disabled={busy} onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) { setDocType(type.v); upload("doc", f); }
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

            {/* 5. FOTOS */}
            <div className="ff-card2">
              <div className="section-header-compact">
                <div className="title-group">
                  <ImageIcon size={18} className="text-blue-600" />
                  <h4 style={{ margin: 0 }}>Registro Fotográfico</h4>
                </div>
                <label className="upload-photo-btn">
                  <PlusCircle size={14} /> Subir Foto
                  <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload("photo", f);
                  }} />
                </label>
              </div>
              <div style={{ marginTop: 10 }}>
                {data.photos?.length ? (
                  <div className="modern-photo-grid">
                    {data.photos.map((p) => (
                      <div key={p.id} className="photo-card-new">
                        <div className="photo-display">
                          {p.url ? <img src={p.url} alt="Envío" /> : <div className="photo-placeholder" />}
                          <div className="photo-overlay">
  <button type="button" onClick={() => download(p.id)} className="overlay-btn view">
    <Download size={16} />
  </button>
  
  {/* AGREGA ESTE BOTÓN AQUÍ */}
  <button type="button" disabled={busy} onClick={() => deleteFile(p.id, "photo")} className="overlay-btn del">
    <X size={16} />
  </button>
</div>
                        </div>
                        <div className="photo-info-mini"><span className="photo-date">{fmtDT(p.created_at)}</span></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted">No hay fotos registradas.</div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

     <style jsx>{`
  /* --- CONTENEDORES BASE --- */
  .ff-card2 {
    background: var(--ff-surface);
    border: 1px solid var(--ff-border);
    border-radius: var(--ff-radius);
    box-shadow: var(--ff-shadow);
    padding: 12px;
  }
  .soft { background: rgba(15, 23, 42, 0.02); }
  .ff-divider { height: 1px; background: var(--ff-border); margin: 20px 0; }
  .ff-row2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .ff-spread2 { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

  /* --- HEADER Y TEXTOS --- */
  .cardHead { border: 1px solid var(--ff-border); background: var(--ff-surface); border-radius: var(--ff-radius); padding: 12px; }
  .codeRow { display: flex; align-items: flex-start; gap: 10px; }
  .codeIcon { 
    width: 32px; height: 32px; border-radius: 8px; 
    border: 1px solid rgba(31, 122, 58, 0.18); 
    background: rgba(31, 122, 58, 0.08); 
    display: grid; place-items: center; 
  }
  .code { font-weight: 950; font-size: 16px; letter-spacing: -0.2px; }
  .meta { font-size: 12px; color: var(--ff-muted); margin-top: 4px; }
  .sectionTitle { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; }
  .lbl { display: block; font-size: 11px; font-weight: 900; color: var(--ff-muted); margin-bottom: 6px; text-transform: uppercase; }


  /* --- FORMULARIO E INPUTS --- */
  .in2 {
    width: 100%; height: 38px; border: 1px solid var(--ff-border);
    border-radius: var(--ff-radius); padding: 0 10px; font-size: 13px;
    outline: none; background: #fff;
  }
  .in2:focus { border-color: var(--ff-green); box-shadow: 0 0 0 3px rgba(31, 122, 58, 0.1); }
  
  .ff-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: var(--ff-green); color: #fff; border: none;
    border-radius: var(--ff-radius); height: 36px; padding: 0 12px;
    font-weight: 900; font-size: 12px; cursor: pointer;
  }
  .ff-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* --- GRIDS RESPONSIVOS --- */
  .row3, .actionsGrid { display: grid; gap: 10px; grid-template-columns: 1fr; }
  .grid2 { display: grid; gap: 12px; grid-template-columns: 1fr; }
  
  @media (min-width: 980px) {
    .row3 { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
    .actionsGrid { grid-template-columns: repeat(5, 1fr); }
    .grid2 { grid-template-columns: 0.95fr 1.05fr; }
  }

  /* --- EXPEDIENTE DIGITAL (SLOTS) --- */
  .docs-section { padding: 20px; border-radius: 16px; background: #fff; border: 1px solid #f1f5f9; }
  .section-header-compact { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .docs-grid-modern { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
  
  .doc-slot {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; border-radius: 12px; border: 1px solid #f1f5f9;
    background: #fff; transition: 0.2s;
  }
  .doc-slot.is-filled { background: #f0fdf480; border-color: #dcfce7; }
  .doc-slot.is-empty { border-style: dashed; background: #f8fafc; }

  .slot-body { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .slot-info { display: flex; flex-direction: column; min-width: 0; }
  .slot-label { font-size: 12px; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .slot-status { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }

  /* --- FOTOS --- */
  .modern-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .photo-card-new { border-radius: 12px; overflow: hidden; border: 1px solid #f1f5f9; background: #fff; position: relative; }
  .photo-display { aspect-ratio: 1/1; background: #f8fafc; position: relative; }
  .photo-display img { width: 100%; height: 100%; object-fit: cover; }
  
  .photo-overlay {
    position: absolute; inset: 0; background: rgba(15, 23, 42, 0.7);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    opacity: 0; transition: 0.2s;
  }
  .photo-card-new:hover .photo-overlay { opacity: 1; }
  .overlay-btn { 
    width: 32px; height: 32px; border-radius: 8px; border: none; 
    display: grid; place-items: center; cursor: pointer; color: #fff;
  }
  .overlay-btn.view { background: #16a34a; }
  .overlay-btn.del { background: #e11d48; }

  /* --- BOTONES DE ACCIÓN SLOTS --- */
  .action-btn { 
    width: 28px; height: 28px; border-radius: 8px; border: none; 
    display: grid; place-items: center; cursor: pointer; transition: 0.2s;
  }
  .action-btn.download { background: #fff; color: #16a34a; border: 1px solid #dcfce7; }
  .action-btn.delete { background: #fff1f2; color: #e11d48; }
  .action-btn.upload { background: #f1f5f9; color: #64748b; }
  .action-btn:hover { transform: scale(1.05); }

  .upload-photo-btn {
    font-size: 11px; font-weight: 800; color: #2563eb; background: #eff6ff;
    padding: 6px 12px; border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; gap: 6px; border: 1px solid #dbeafe;
  }

  /* --- ESTADOS --- */
  .muted { font-size: 12px; color: var(--ff-muted); }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`}</style>
    </AdminLayout>
  );
  
}

