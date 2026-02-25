// src/pages/shipments/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

import { ClientLayout } from "../../components/ClientLayout";
import { ProgressStepper } from "../../components/ProgressStepper";
import { Timeline as ModernTimeline } from "../../components/Timeline";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";

import { FileText, Image as ImageIcon, Download, Info, ArrowLeft, Package } from "lucide-react";

/* =======================
   Types
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
  status: string;
  created_at: string;

  // ✅ Multi-product (single product for now)
  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;

  boxes?: number | null;
  pallets?: number | null;
  weight_kg?: number | null;
  flight_number?: string | null;
  awb?: string | null;

  milestones: Milestone[];
  documents: FileItem[];
  photos: FileItem[];
};

/* =======================
   Utils
======================= */
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-PA");
  } catch {
    return String(iso);
  }
}

function productLine(d: ShipmentDetail) {
  const name = String(d.product_name || "").trim();
  const variety = String(d.product_variety || "").trim();
  const modeRaw = String(d.product_mode || "").trim();

  const mode = (() => {
    const s = modeRaw.toLowerCase();
    if (!s) return "";
    if (s === "aerea" || s === "aérea" || s === "air") return "Aérea";
    if (s === "maritima" || s === "marítima" || s === "sea") return "Marítima";
    if (s === "terrestre" || s === "land") return "Terrestre";
    return modeRaw;
  })();

  const left = [name, variety].filter(Boolean).join(" ");
  const full = [left, mode].filter(Boolean).join(" · ");

  return full || "—";
}

export default function ShipmentDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(shipmentId: string) {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setError(text || "Error cargando embarque");
      setLoading(false);
      return;
    }

    const json = (await res.json()) as ShipmentDetail;
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    if (typeof id === "string") load(id);
  }, [id]);

  async function download(fileId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      alert("No se pudo generar el link de descarga");
      return;
    }

    const { url } = await res.json();
    window.open(url, "_blank");
  }

  /* =======================
     Hitos (ÚNICA FUENTE)
     ✅ Timeline: solo hitos existentes (con fecha)
  ======================= */
  const steps = useMemo(
    () => [
      { type: "CREATED", label: "Creado" },
      { type: "PACKED", label: "En Empaque" },
      { type: "DOCS_READY", label: "Documentación lista" },
      { type: "AT_ORIGIN", label: "En Origen" },
      { type: "IN_TRANSIT", label: "En tránsito a destino" },
      { type: "AT_DESTINATION", label: "En Destino" },
    ],
    []
  );

  // ✅ Adaptamos tu estructura (at) a la que usa Timeline (created_at)
  const normalizedMilestonesForTimeline = useMemo(() => {
    const list = data?.milestones ?? [];

    // Mapa de hitos reales (registrados en DB)
    const hitMap = new Map<string, Milestone>();
    list.forEach((m) => hitMap.set(String(m.type).toUpperCase(), m));

    // SOLO devolvemos los hitos que existen (tienen "at")
    const present = steps
      .map((s, idx) => {
        const hit = hitMap.get(String(s.type).toUpperCase());
        const at = hit?.at ?? null;
        if (!at) return null;

        return {
          id: `${s.type}-${idx}`,
          type: s.type,
          created_at: at, // 👈 clave para Timeline
          note: hit?.note ?? null,
        };
      })
      .filter(Boolean) as Array<{ id: string; type: string; created_at: string; note?: string | null }>;

    return present;
  }, [data?.milestones, steps]);

  const product = data ? productLine(data) : "—";

  return (
    <ClientLayout title="Detalle del embarque" subtitle="Estado, documentos y fotos del proceso de exportación">
      {/* Toolbar */}
      <div className="ff-spread" style={{ marginBottom: 12 }}>
        <Link href="/shipments" className="ff-btn ff-btn-ghost" style={{ height: 34 }}>
          <ArrowLeft size={16} />
          Volver
        </Link>

        {data ? (
          <span className={statusBadgeClass(data.status)} style={{ height: 30, display: "inline-flex", alignItems: "center" }}>
            {labelStatus(data.status)}
          </span>
        ) : null}
      </div>

      <div className="page">
        {loading ? (
          <div className="ff-sub">Cargando…</div>
        ) : error ? (
          <div className="ff-card ff-card-pad warn" style={{ boxShadow: "none" }}>
            <b style={{ display: "block", marginBottom: 4 }}>Error</b>
            <div className="ff-sub">{error}</div>
          </div>
        ) : data ? (
          <>
            {/* HERO / HEADER ejecutivo */}
            <div className="hero">
              <div className="heroLeft">
                <div className="codeRow">
                  <span className="codeIcon" aria-hidden="true">
                    <Package size={16} color="var(--ff-green-dark)" />
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div className="heroTop">
                      <div className="code">{data.code}</div>
                      <span className={statusBadgeClass(data.status)} style={{ height: 28, display: "inline-flex", alignItems: "center" }}>
                        {labelStatus(data.status)}
                      </span>
                    </div>

                    {/* ✅ Producto protagonista */}
                    <div className="productLine" title={product}>
                      {product}
                    </div>

                    <div className="meta">
                      Destino: <b>{data.destination}</b> · Creado: {fmtDate(data.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="heroRight">
                {data.flight_number ? <span className="pill">Vuelo: {data.flight_number}</span> : null}
                {data.awb ? <span className="pill">AWB: {data.awb}</span> : null}
              </div>
            </div>

            {/* Progreso (ancho completo) */}
            <div className="block">
              <ProgressStepper milestones={data.milestones ?? []} flightNumber={data.flight_number ?? null} />
            </div>

            {/* Datos (KPI) + Hitos */}
            <div className="grid2">
              <div className="ff-card ff-card-pad soft" style={{ boxShadow: "none" }}>
                <div className="sectionTitle">
                  <Info size={16} /> Datos
                </div>

                <div className="kpiRow">
                  <div className="kpi">
                    <div className="kpiLabel">Cajas</div>
                    <div className="kpiValue">{data.boxes ?? "—"}</div>
                  </div>
                  <div className="kpi">
                    <div className="kpiLabel">Pallets</div>
                    <div className="kpiValue">{data.pallets ?? "—"}</div>
                  </div>
                  <div className="kpi">
                    <div className="kpiLabel">Peso</div>
                    <div className="kpiValue">{data.weight_kg ? `${data.weight_kg} kg` : "—"}</div>
                  </div>
                </div>

                <div className="miniNote">
                  <span className="mono">Producto:</span> <b>{product}</b>
                </div>
              </div>

              <div className="ff-card ff-card-pad" style={{ boxShadow: "none" }}>
                <div className="sectionTitle">Timeline logístico</div>
                <ModernTimeline milestones={normalizedMilestonesForTimeline as any} />
              </div>
            </div>

            {/* Documentos vs Evidencia (Balance B) */}
            <div className="grid2">
              <div className="ff-card ff-card-pad" style={{ boxShadow: "none" }}>
                <div className="sectionTitle">
                  <FileText size={16} /> Documentos
                </div>

                {data.documents?.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {data.documents.map((d) => (
                      <div key={d.id} className="itemRow">
                        <div style={{ minWidth: 0 }}>
                          <div className="itemTitle">{d.filename}</div>
                          <div className="itemMeta">
                            {d.doc_type ?? "Documento"} · {fmtDate(d.created_at)}
                          </div>
                        </div>

                        <button
                          className="ff-btn ff-btn-ghost"
                          style={{ height: 34, flex: "0 0 auto" }}
                          onClick={() => download(d.id)}
                          type="button"
                        >
                          <Download size={16} />
                          Descargar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ff-sub">No hay documentos cargados.</div>
                )}
              </div>

              <div className="ff-card ff-card-pad" style={{ boxShadow: "none" }}>
                <div className="sectionTitle">
                  <ImageIcon size={16} /> Evidencia (Fotos)
                </div>

                {data.photos?.length ? (
                  <div className="photoGrid">
                    {data.photos.map((p) => (
                      <div key={p.id} className="photoCard">
                        {p.url ? <img src={p.url} alt={p.filename} className="photoImg" /> : <div className="photoPlaceholder" />}

                        <div className="photoBody">
                          <div className="photoTitle" title={p.filename}>
                            {p.filename}
                          </div>
                          <div className="photoMeta">{fmtDate(p.created_at)}</div>

                          <button
                            className="ff-btn ff-btn-ghost"
                            style={{ height: 34, width: "100%", justifyContent: "center", marginTop: 10 }}
                            onClick={() => download(p.id)}
                            type="button"
                          >
                            <Download size={16} />
                            Ver / Descargar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ff-sub">No hay fotos cargadas.</div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <style jsx>{`
        .page {
          display: grid;
          gap: 12px;
        }

        .warn {
          borderColor: rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--ff-border);
          background: var(--ff-surface);
          border-radius: var(--ff-radius);
          box-shadow: none;
        }
        .heroLeft {
          min-width: 0;
          flex: 1 1 auto;
        }
        .heroRight {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          justify-content: flex-end;
          flex: 0 0 auto;
          flex-wrap: wrap;
        }

        .heroTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .block {
          display: grid;
          gap: 12px;
        }

        .grid2 {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1100px) {
          .grid2 {
            grid-template-columns: 1fr 1fr;
          }
        }

        .codeRow {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }
        .codeIcon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid rgba(31, 122, 58, 0.18);
          background: rgba(31, 122, 58, 0.08);
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }
        .code {
          font-weight: 950;
          font-size: 16px;
          line-height: 20px;
          letter-spacing: -0.2px;
        }

        .productLine {
          margin-top: 2px;
          font-weight: 950;
          font-size: 13px;
          line-height: 18px;
          letter-spacing: -0.15px;
          color: var(--ff-green-dark);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meta {
          font-size: 12px;
          color: var(--ff-muted);
          line-height: 16px;
          word-break: break-word;
          margin-top: 2px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 900;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(15, 23, 42, 0.03);
          border-radius: 999px;
          padding: 6px 10px;
          white-space: nowrap;
        }

        .soft {
          background: rgba(15, 23, 42, 0.02);
          border: 1px solid rgba(15, 23, 42, 0.08);
        }

        .sectionTitle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 900;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .kpiRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .kpi {
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.7);
          border-radius: 12px;
          padding: 10px;
        }
        .kpiLabel {
          font-size: 11px;
          font-weight: 900;
          color: var(--ff-muted);
        }
        .kpiValue {
          margin-top: 4px;
          font-size: 15px;
          font-weight: 950;
          letter-spacing: -0.25px;
        }
        .miniNote {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(15, 23, 42, 0.06);
          font-size: 12px;
          color: var(--ff-muted);
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-weight: 800;
        }

        .itemRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          background: var(--ff-surface);
        }
        @media (max-width: 720px) {
          .itemRow {
            flex-direction: column;
            align-items: stretch;
          }
        }

        .itemTitle {
          font-weight: 900;
          font-size: 13px;
          line-height: 18px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .itemMeta {
          margin-top: 2px;
          color: var(--ff-muted);
          font-size: 12px;
        }

        .photoGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 10px;
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
          height: 150px;
          background: rgba(15, 23, 42, 0.03);
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
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
        }
      `}</style>
    </ClientLayout>
  );
}