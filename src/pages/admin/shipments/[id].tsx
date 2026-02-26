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
            {/* Header resumen */}
            <div className="cardHead">
              <div className="ff-spread2" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="codeRow">
                    <span className="codeIcon" aria-hidden="true">
                      <Package size={16} color="var(--ff-green-dark)" />
                    </span>

                    <div style={{ minWidth: 0 }}>
                      {/* 1) Numero de embarque */}
                      <div className="code">{data.code}</div>

                      {/* 2) Cliente debajo */}
                      <div className="meta" style={{ marginTop: 2 }}>
                        Cliente: <b>{clientName}</b>
                      </div>

                      {/* 3) Producto+Variedad - Modalidad */}
                      <div className="meta" style={{ marginTop: 2 }}>
                        <b>{productLine(data)}</b>
                      </div>

                      {/* 4) fecha creado */}
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

            {/* Acciones rápidas */}
            <div className="ff-card2" style={{ padding: 12, background: "rgba(15,23,42,.02)" }}>
              <div className="sectionTitle">Acciones rápidas</div>
              <div className="muted" style={{ marginTop: 2 }}>
                Los hitos avanzan en cadena. Para <b>En tránsito</b> el <b>Vuelo</b> es obligatorio. Para <b>En empaque</b>, <b>Calibre</b> y <b>Color</b> son obligatorios.
              </div>

              <div className="ff-divider" style={{ margin: "12px 0" }} />

              <div className="row3" style={{ gridTemplateColumns: "1.2fr .9fr .9fr" }}>
                <div>
                  <label className="lbl">Nota (opcional)</label>
                  <input
                    className="in2"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ej: Inspector aprobó packing / incidencia, etc."
                  />
                </div>

                <div>
                  <label className="lbl">Vuelo *</label>
                  <input
                    className="in2"
                    value={flight}
                    onChange={(e) => setFlight(e.target.value)}
                    placeholder="Ej: IB1234"
                  />
                </div>

                <div>
                  <label className="lbl">AWB (opcional)</label>
                  <input
                    className="in2"
                    value={awb}
                    onChange={(e) => setAwb(e.target.value)}
                    placeholder="Ej: 123-45678901"
                  />
                </div>
              </div>

              <div className="ff-divider" style={{ margin: "12px 0" }} />

              <div className="actionsGrid">
                <button
                  className="ff-primary"
                  type="button"
                  disabled={busy || !canMark("PACKED").ok}
                  onClick={() => mark("PACKED")}
                  title={!canMark("PACKED").ok ? canMark("PACKED").reason : ""}
                >
                  <PackageCheck size={16} />
                  En Empaque
                </button>

                <button
                  className="ff-primary"
                  type="button"
                  disabled={busy || !canMark("DOCS_READY").ok}
                  onClick={() => mark("DOCS_READY")}
                  title={!canMark("DOCS_READY").ok ? canMark("DOCS_READY").reason : ""}
                >
                  <ClipboardCheck size={16} />
                  Documentación lista
                </button>

                <button
                  className="ff-primary"
                  type="button"
                  disabled={busy || !canMark("AT_ORIGIN").ok}
                  onClick={() => mark("AT_ORIGIN")}
                  title={!canMark("AT_ORIGIN").ok ? canMark("AT_ORIGIN").reason : ""}
                >
                  <MapPin size={16} />
                  En Origen
                </button>

                <button
                  className="ff-primary"
                  type="button"
                  disabled={busy || !canMark("IN_TRANSIT").ok}
                  onClick={() => mark("IN_TRANSIT")}
                  title={!canMark("IN_TRANSIT").ok ? canMark("IN_TRANSIT").reason : ""}
                >
                  <Plane size={16} />
                  En tránsito
                </button>

                <button
                  className="ff-primary"
                  type="button"
                  disabled={busy || !canMark("AT_DESTINATION").ok}
                  onClick={() => mark("AT_DESTINATION")}
                  title={!canMark("AT_DESTINATION").ok ? canMark("AT_DESTINATION").reason : ""}
                >
                  <PackageCheck size={16} />
                  En Destino
                </button>
              </div>

              {busy ? <div className="muted" style={{ marginTop: 10 }}>Procesando…</div> : null}
            </div>

            <div className="ff-divider" />

            {/* Datos + Timeline */}
            <div className="grid2">
              <div className="ff-card2 soft">
                <div className="sectionTitle">
                  <Info size={16} /> Datos
                </div>

                <div className="kv"><span>Producto + Variedad</span><b>{productShort(data)}</b></div>
                <div className="kv"><span>Cajas</span><b>{data.boxes ?? "-"}</b></div>
                <div className="kv"><span>Pallets</span><b>{data.pallets ?? "-"}</b></div>
                <div className="kv"><span>Peso total estimado</span><b>{data.weight_kg ? `${data.weight_kg} kg` : "-"}</b></div>

                <div className="ff-divider" style={{ margin: "10px 0" }} />

                <div className="row2">
                  <div>
                    <label className="lbl">Calibre * (obligatorio para En Empaque)</label>
                    <input
                      className="in2"
                      value={caliber}
                      onChange={(e) => setCaliber(e.target.value)}
                      placeholder="Ej: 5-7"
                    />
                  </div>
                  <div>
                    <label className="lbl">Color * (obligatorio para En Empaque)</label>
                    <input
                      className="in2"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="Ej: 2.75 - 3"
                    />
                  </div>
                </div>

                <div className="muted" style={{ marginTop: 10 }}>
                  * Se valida en UI para evitar errores operativos.
                </div>
              </div>

              <div className="ff-card2">
                <div className="sectionTitle">Hitos</div>
                <ModernTimeline milestones={timelineItems as any} />
              </div>
            </div>

            <div className="ff-divider" />

            {/* Documentos */}
            <div className="ff-card2">
              <div className="sectionTitle">
                <FileText size={16} /> Documentos
              </div>

              <div className="muted" style={{ marginTop: 6 }}>
                Selecciona el tipo correcto antes de subir. (Una opción a la vez)
              </div>

              <div className="ff-divider" style={{ margin: "10px 0" }} />

              {/* ✅ checklist tipo “casillas” */}
              <div className="docGrid">
                {DOC_TYPES.map((t) => {
                  const active = docType === t.v;
                  return (
                    <button
                      key={t.v}
                      type="button"
                      className={active ? "docPill docPillOn" : "docPill"}
                      onClick={() => setDocType(t.v)}
                      aria-pressed={active}
                      disabled={busy}
                      title={t.l}
                    >
                      {t.l}
                    </button>
                  );
                })}
              </div>

              <div className="ff-divider" style={{ margin: "12px 0" }} />

              <div className="ff-row2" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="in2"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload("doc", f);
                    e.currentTarget.value = "";
                  }}
                  style={{ maxWidth: 520 }}
                />
              </div>

              <div style={{ marginTop: 10 }}>
                {data.documents?.length ? (
                  <div className="list">
                    {data.documents.map((d) => (
                      <div key={d.id} className="itemRow">
                        <div style={{ minWidth: 0 }}>
                          <div className="itemTitle">{d.filename}</div>
                          <div className="itemMeta">
                            {(d.doc_type ?? "doc")} · {fmtDT(d.created_at)}
                          </div>
                        </div>
                        <button className="btnSmall" type="button" onClick={() => download(d.id)}>
                          <Download size={16} />
                          Descargar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted">Aún no hay documentos.</div>
                )}
              </div>
            </div>

            <div className="ff-divider" />

            {/* Fotos */}
            <div className="ff-card2">
              <div className="sectionTitle">
                <ImageIcon size={16} /> Fotos
              </div>

              <div className="ff-divider" style={{ margin: "10px 0" }} />

              <input
                className="in2"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload("photo", f);
                  e.currentTarget.value = "";
                }}
                style={{ maxWidth: 420 }}
              />

              <div style={{ marginTop: 10 }}>
                {data.photos?.length ? (
                  <div className="photoGrid">
                    {data.photos.map((p) => (
                      <div key={p.id} className="photoCard">
                        {p.url ? <img src={p.url} className="photoImg" alt={p.filename} /> : <div className="photoPlaceholder" />}
                        <div className="photoBody">
                          <div className="photoTitle" title={p.filename}>{p.filename}</div>
                          <div className="photoMeta">{fmtDT(p.created_at)}</div>
                          <button className="btnSmall full" type="button" onClick={() => download(p.id)}>
                            <Download size={16} />
                            Ver / Descargar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted">Aún no hay fotos.</div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <style jsx>{`
        .ff-card2 {
          background: var(--ff-surface);
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          box-shadow: var(--ff-shadow);
          padding: 12px;
        }
        .soft {
          background: rgba(15, 23, 42, 0.02);
        }

        .ff-row2 {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          min-width: 0;
        }
        .ff-spread2 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .cardHead {
          border: 1px solid var(--ff-border);
          background: var(--ff-surface);
          border-radius: var(--ff-radius);
          padding: 12px;
        }

        .codeRow {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }
        .codeIcon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(31, 122, 58, 0.18);
          background: rgba(31, 122, 58, 0.08);
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .code {
          font-weight: 950;
          font-size: 16px;
          letter-spacing: -0.2px;
          line-height: 20px;
        }
        .meta {
          font-size: 12px;
          color: var(--ff-muted);
          margin-top: 4px;
          line-height: 16px;
          word-break: break-word;
        }

        .sectionTitle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 900;
          font-size: 13px;
        }
        .lbl {
          display: block;
          font-size: 12px;
          font-weight: 900;
          color: var(--ff-muted);
          margin-bottom: 6px;
        }

        .row3 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 980px) {
          .row3 {
            grid-template-columns: 1.2fr 0.9fr 0.9fr;
          }
        }

        .row2 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 980px) {
          .row2 {
            grid-template-columns: 1fr 1fr;
          }
        }

        .actionsGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 980px) {
          .actionsGrid {
            grid-template-columns: repeat(5, 1fr);
          }
        }

        .in2 {
          width: 100%;
          height: 38px;
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          padding: 0 10px;
          font-size: 13px;
          outline: none;
          background: #fff;
          min-width: 0;
        }
        .in2:focus {
          border-color: rgba(31, 122, 58, 0.4);
          box-shadow: 0 0 0 4px rgba(31, 122, 58, 0.1);
        }

        .btnSmall {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 10px;
          border-radius: var(--ff-radius);
          border: 1px solid var(--ff-border);
          background: #fff;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          color: var(--ff-text);
          text-decoration: none;
          white-space: nowrap;
        }
        .btnSmall:hover {
          background: rgba(15, 23, 42, 0.03);
        }

        .ff-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(31, 122, 58, 0.35);
          background: var(--ff-green);
          color: #fff;
          border-radius: var(--ff-radius);
          height: 36px;
          padding: 0 12px;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .ff-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .chip {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.12);
          white-space: nowrap;
        }
        .chipSoft {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          background: rgba(31, 122, 58, 0.08);
          border: 1px solid rgba(31, 122, 58, 0.22);
          color: var(--ff-green-dark);
          white-space: nowrap;
        }
        .statusPill {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 950;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          white-space: nowrap;
        }

        .grid2 {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1100px) {
          .grid2 {
            grid-template-columns: 0.95fr 1.05fr;
          }
        }

        .kv {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          gap: 10px;
        }

        .docGrid {
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 980px) {
          .docGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1200px) {
          .docGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .docPill {
          height: 36px;
          border-radius: 12px;
          border: 1px solid var(--ff-border);
          background: #fff;
          font-size: 12px;
          font-weight: 900;
          padding: 0 10px;
          cursor: pointer;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .docPill:hover {
          background: rgba(15, 23, 42, 0.03);
        }
        .docPillOn {
          border-color: rgba(31, 122, 58, 0.35);
          background: rgba(31, 122, 58, 0.08);
          color: var(--ff-green-dark);
        }
        .docPill:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .list {
          display: grid;
          gap: 10px;
        }
        .itemRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          background: var(--ff-surface);
          align-items: center;
        }
        @media (max-width: 720px) {
          .itemRow {
            flex-direction: column;
            align-items: stretch;
          }
          .itemTitle {
            max-width: 100%;
          }
        }

        .itemTitle {
          font-weight: 900;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 520px;
        }
        .itemMeta {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
        }

        .photoGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
        }
        .photoCard {
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          overflow: hidden;
          background: var(--ff-surface);
        }
        .photoImg {
          width: 100%;
          height: 150px;
          object-fit: cover;
          display: block;
        }
        .photoPlaceholder {
          width: 100%;
          height: 150px;
          background: rgba(15, 23, 42, 0.04);
        }
        .photoBody {
          padding: 10px;
        }
        .photoTitle {
          font-weight: 900;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .photoMeta {
          font-size: 12px;
          color: var(--ff-muted);
          margin-top: 2px;
        }
        .full {
          width: 100%;
          justify-content: center;
          margin-top: 10px;
        }

        .muted {
          font-size: 12px;
          color: var(--ff-muted);
        }

        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
        }

        .msgOk {
          border: 1px solid rgba(31, 122, 58, 0.3);
          background: rgba(31, 122, 58, 0.08);
          border-radius: var(--ff-radius);
          padding: 10px;
          font-weight: 900;
          font-size: 12px;
        }
      `}</style>
    </AdminLayout>
  );
  
}

export default function Page() {
  return null;
}