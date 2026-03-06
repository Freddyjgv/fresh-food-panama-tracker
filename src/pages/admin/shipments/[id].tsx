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
    <AdminLayout title="Detalle Logístico" subtitle="Gestión de hitos y expedición documental">
      
      {/* 1. TOP BAR REFINADA */}
      <div className="top-nav">
        <Link href="/admin/shipments" className="back-link">
          <ArrowLeft size={18} />
          <span>Volver al listado</span>
        </Link>
        <div className="top-badges">
          {data?.flight_number && <span className="badge-modern blue">Vuelo: {data.flight_number}</span>}
          {data?.awb && <span className="badge-modern blue">AWB: {data.awb}</span>}
          {data && <span className="badge-status-master">{labelStatus(data.status)}</span>}
        </div>
      </div>

      {toast && <div className="toast-floating">{toast}</div>}

      {!authReady ? (
        <div className="loading-state">Verificando seguridad...</div>
      ) : loading ? (
        <div className="loading-state">Sincronizando datos del embarque...</div>
      ) : data ? (
        <div className="detail-container">
          
          {/* 2. HEADER RESUMEN (HERO SECTION) */}
          <header className="hero-header">
            <div className="hero-content">
              <div className="hero-icon"><Package size={24} /></div>
              <div className="hero-text">
                <h1 className="shipment-id">{data.code}</h1>
                <p className="shipment-client">Cliente: <span>{clientName}</span> · {data.destination}</p>
              </div>
            </div>
            <div className="hero-meta">
              <div className="meta-item">
                <span className="meta-label">CREADO EL</span>
                <span className="meta-value">{fmtDT(data.created_at)}</span>
              </div>
            </div>
          </header>

          {/* 3. PANEL DE ACCIONES (CONTROL DE HITOS) */}
          <section className="action-panel">
            <div className="panel-header">
              <div className="panel-info">
                <h3>Panel de Expedición</h3>
                <p>Actualiza el progreso del flujo logístico en tiempo real.</p>
              </div>
            </div>

            <div className="action-inputs">
              <div className="input-field">
                <label>Notas del hito</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Observaciones de inspección..." />
              </div>
              <div className="input-field">
                <label>Vuelo (Requerido para Tránsito)</label>
                <input value={flight} onChange={e => setFlight(e.target.value)} placeholder="Ej: AA923" />
              </div>
              <div className="input-field">
                <label>AWB</label>
                <input value={awb} onChange={e => setAwb(e.target.value)} placeholder="000-00000000" />
              </div>
            </div>

            <div className="milestone-buttons">
              <button disabled={busy || !canMark("PACKED").ok} onClick={() => mark("PACKED")} className="btn-milestone">
                <PackageCheck size={16} /> En Empaque
              </button>
              <button disabled={busy || !canMark("DOCS_READY").ok} onClick={() => mark("DOCS_READY")} className="btn-milestone">
                <ClipboardCheck size={16} /> Docs Listos
              </button>
              <button disabled={busy || !canMark("AT_ORIGIN").ok} onClick={() => mark("AT_ORIGIN")} className="btn-milestone">
                <MapPin size={16} /> En Origen
              </button>
              <button disabled={busy || !canMark("IN_TRANSIT").ok} onClick={() => mark("IN_TRANSIT")} className="btn-milestone">
                <Plane size={16} /> En Tránsito
              </button>
              <button disabled={busy || !canMark("AT_DESTINATION").ok} onClick={() => mark("AT_DESTINATION")} className="btn-milestone primary">
                <PackageCheck size={16} /> En Destino
              </button>
            </div>
          </section>

          {/* 4. GRID DE INFORMACIÓN Y TIMELINE */}
          <div className="main-grid">
            <aside className="info-sidebar">
              <div className="glass-card">
                <h4 className="card-title"><Info size={16} /> Detalles Técnicos</h4>
                <div className="data-list">
                  <div className="data-row"><span>Producto</span> <strong>{productShort(data)}</strong></div>
                  <div className="data-row"><span>Cajas</span> <strong>{data.boxes || "-"}</strong></div>
                  <div className="data-row"><span>Pallets</span> <strong>{data.pallets || "-"}</strong></div>
                  <div className="data-row"><span>Peso</span> <strong>{data.weight_kg ? `${data.weight_kg}kg` : "-"}</strong></div>
                </div>
                
                <div className="packing-inputs">
                  <div className="field">
                    <label>Calibre *</label>
                    <input value={caliber} onChange={e => setCaliber(e.target.value)} placeholder="5-7" />
                  </div>
                  <div className="field">
                    <label>Color *</label>
                    <input value={color} onChange={e => setColor(e.target.value)} placeholder="2.5" />
                  </div>
                </div>
              </div>
            </aside>

            <main className="timeline-main">
              <div className="glass-card">
                <h4 className="card-title">Línea de Tiempo</h4>
                <ModernTimeline milestones={timelineItems as any} />
              </div>
            </main>
          </div>

          {/* 5. DOCUMENTOS Y FOTOS */}
          <section className="files-section">
            <div className="glass-card docs-card">
              <h4 className="card-title"><FileText size={16} /> Documentación Oficial</h4>
              <div className="doc-pill-grid">
                {DOC_TYPES.map((t) => (
                  <button 
                    key={t.v} 
                    className={`pill-btn ${docType === t.v ? 'active' : ''}`}
                    onClick={() => setDocType(t.v)}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
              <div className="upload-zone">
                <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("doc", f); e.currentTarget.value = ""; }} />
              </div>
              
              <div className="file-list">
                {data.documents?.map(d => (
                  <div key={d.id} className="file-item">
                    <FileText size={18} className="file-icon" />
                    <div className="file-info">
                      <span className="file-name">{d.filename}</span>
                      <span className="file-meta">{d.doc_type} · {fmtDT(d.created_at)}</span>
                    </div>
                    <button onClick={() => download(d.id)} className="download-btn"><Download size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card photos-card">
              <h4 className="card-title"><ImageIcon size={16} /> Archivo Fotográfico</h4>
              <div className="upload-zone">
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("photo", f); e.currentTarget.value = ""; }} />
              </div>
              <div className="photo-gallery">
                {data.photos?.map(p => (
                  <div key={p.id} className="photo-thumb">
                    {p.url ? <img src={p.url} alt="Inspección" /> : <div className="no-img" />}
                    <div className="photo-overlay">
                      <button onClick={() => download(p.id)}><Download size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      ) : null}

      <style jsx>{`
        /* VARIABLES DE DISEÑO PREMIUM */
        :global(:root) {
          --ff-bg: #f8fafc;
          --ff-card: #ffffff;
          --ff-accent: #16a34a;
          --ff-text-main: #0f172a;
          --ff-text-muted: #64748b;
          --ff-border-soft: #f1f5f9;
        }

        .detail-container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; padding-bottom: 60px; animation: fadeIn 0.5s ease; }

        .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .back-link { display: flex; align-items: center; gap: 8px; color: var(--ff-text-muted); text-decoration: none; font-size: 14px; font-weight: 600; transition: 0.2s; }
        .back-link:hover { color: var(--ff-accent); }

        .badge-modern { padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .badge-modern.blue { background: #eff6ff; color: #2563eb; }
        .badge-status-master { background: #f0fdf4; color: #166534; padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 800; border: 1px solid #dcfce7; }

        .hero-header { display: flex; justify-content: space-between; align-items: flex-end; padding: 20px 0; border-bottom: 1px solid var(--ff-border-soft); }
        .hero-content { display: flex; align-items: center; gap: 20px; }
        .hero-icon { width: 56px; height: 56px; background: #16a34a; color: white; border-radius: 16px; display: grid; place-items: center; box-shadow: 0 10px 15px -3px rgba(22, 163, 74, 0.2); }
        .shipment-id { font-size: 32px; font-weight: 900; letter-spacing: -0.04em; color: var(--ff-text-main); margin: 0; }
        .shipment-client { font-size: 16px; color: var(--ff-text-muted); margin: 4px 0 0; }
        .shipment-client span { color: var(--ff-text-main); font-weight: 700; }

        .hero-meta { text-align: right; }
        .meta-label { font-size: 10px; font-weight: 800; color: #94a3b8; display: block; }
        .meta-value { font-size: 14px; font-weight: 600; color: var(--ff-text-main); }

        .action-panel { background: white; border-radius: 24px; padding: 32px; border: 1px solid var(--ff-border-soft); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
        .panel-header h3 { font-size: 18px; font-weight: 800; margin: 0; }
        .panel-header p { font-size: 13px; color: var(--ff-text-muted); margin: 4px 0 20px; }

        .action-inputs { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .input-field label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 6px; }
        .input-field input { width: 100%; height: 44px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 14px; font-size: 14px; background: #f8fafc; transition: 0.2s; }
        .input-field input:focus { border-color: #16a34a; background: white; box-shadow: 0 0 0 4px rgba(22,163,74,0.1); outline: none; }

        .milestone-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn-milestone { flex: 1; min-width: 140px; height: 44px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .btn-milestone:hover:not(:disabled) { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }
        .btn-milestone:disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(1); }
        .btn-milestone.primary { background: #16a34a; color: white; border: none; }
        .btn-milestone.primary:hover:not(:disabled) { background: #15803d; }

        .main-grid { display: grid; grid-template-columns: 350px 1fr; gap: 24px; }
        .glass-card { background: white; border: 1px solid var(--ff-border-soft); border-radius: 20px; padding: 24px; }
        .card-title { font-size: 14px; font-weight: 800; color: var(--ff-text-main); display: flex; align-items: center; gap: 8px; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 0.05em; }

        .data-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .data-row { display: flex; justify-content: space-between; font-size: 14px; padding-bottom: 8px; border-bottom: 1px solid #f8fafc; }
        .data-row span { color: var(--ff-text-muted); }
        .data-row strong { color: var(--ff-text-main); }

        .packing-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-top: 16px; border-top: 1px dotted #e2e8f0; }
        .packing-inputs label { font-size: 11px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px; }
        .packing-inputs input { width: 100%; height: 38px; border-radius: 8px; border: 1px solid #e2e8f0; padding: 0 10px; font-size: 13px; font-weight: 600; }

        .files-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .doc-pill-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
        .pill-btn { padding: 6px 12px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .pill-btn.active { background: #16a34a; color: white; border-color: #16a34a; box-shadow: 0 4px 10px rgba(22,163,74,0.2); }

        .file-list { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
        .file-item { display: flex; align-items: center; gap: 14px; padding: 12px; border: 1px solid #f1f5f9; border-radius: 14px; transition: 0.2s; }
        .file-item:hover { background: #fbfcfe; border-color: #e2e8f0; }
        .file-icon { color: #94a3b8; }
        .file-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .file-name { font-size: 13px; font-weight: 700; color: var(--ff-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-meta { font-size: 11px; color: var(--ff-text-muted); }
        .download-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: #f1f5f9; color: #64748b; cursor: pointer; display: grid; place-items: center; }

        .photo-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; margin-top: 20px; }
        .photo-thumb { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #f1f5f9; border: 1px solid #e2e8f0; }
        .photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .photo-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; display: grid; place-items: center; transition: 0.2s; }
        .photo-thumb:hover .photo-overlay { opacity: 1; }
        .photo-overlay button { width: 30px; height: 30px; border-radius: 50%; border: none; background: white; cursor: pointer; }

        .upload-zone { margin-top: 10px; }
        .upload-zone input[type="file"] { font-size: 12px; color: #94a3b8; }

        .loading-state { padding: 100px; text-align: center; color: #94a3b8; font-weight: 600; }
        .toast-floating { position: fixed; bottom: 32px; right: 32px; background: #0f172a; color: white; padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); z-index: 99999; animation: slideUp 0.3s ease; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </AdminLayout>
  );
}