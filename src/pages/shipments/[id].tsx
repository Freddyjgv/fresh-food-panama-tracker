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

  // Normaliza modo
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
     Consistente con DB / admin / stepper
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

  const milestonesForTimeline = useMemo(() => {
    const hitMap = new Map((data?.milestones ?? []).map((m) => [String(m.type).toUpperCase(), m]));
    return steps.map((s, idx) => {
      const hit = hitMap.get(String(s.type).toUpperCase());
      return {
        id: `${s.type}-${idx}`,
        type: s.type,
        created_at: hit ? hit.at : null,
        note: hit?.note ?? null,
        label: s.label,
      };
    });
  }, [data?.milestones, steps]);

  return (
    <ClientLayout title="Detalle del embarque" subtitle="Estado, documentos y fotos del proceso de exportación">
      {/* Toolbar */}
      <div className="ff-spread" style={{ marginBottom: 12 }}>
        <Link href="/shipments" className="ff-btn ff-btn-ghost" style={{ height: 34 }}>
          <ArrowLeft size={16} />
          Volver
        </Link>

        {data ? (
          <span
            className={statusBadgeClass(data.status)}
            style={{ height: 30, display: "inline-flex", alignItems: "center" }}
          >
            {labelStatus(data.status)}
          </span>
        ) : null}
      </div>

      <div className="ff-card ff-card-pad" style={{ padding: 12 }}>
        {loading ? (
          <div className="ff-sub">Cargando…</div>
        ) : error ? (
          <div
            className="ff-card ff-card-pad"
            style={{
              borderColor: "rgba(209,119,17,.35)",
              background: "rgba(209,119,17,.08)",
              boxShadow: "none",
            }}
          >
            <b style={{ display: "block", marginBottom: 4 }}>Error</b>
            <div className="ff-sub">{error}</div>
          </div>
        ) : data ? (
          <>
            {/* Resumen */}
            <div className="ff-card ff-card-pad summary" style={{ boxShadow: "none" }}>
              <div className="ff-spread" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="codeRow">
                    <span className="codeIcon" aria-hidden="true">
                      <Package size={16} color="var(--ff-green-dark)" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="code">{data.code}</div>
                      <div className="meta">
                        {/* ✅ Producto / variedad / aérea — SIN peso por caja */}
                        <b>{productLine(data)}</b>
                      </div>
                      <div className="meta" style={{ marginTop: 2 }}>
                        Destino: <b>{data.destination}</b> · Creado: {fmtDate(data.created_at)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ff-row" style={{ gap: 8, justifyContent: "flex-end" }}>
                  {data.flight_number ? <span className="pill">Vuelo: {data.flight_number}</span> : null}
                  {data.awb ? <span className="pill">AWB: {data.awb}</span> : null}
                </div>
              </div>
            </div>

            <div className="ff-divider" />

            {/* Progreso */}
            <ProgressStepper milestones={data.milestones ?? []} flightNumber={data.flight_number ?? null} />

            <div className="ff-divider" />

            {/* Datos + Hitos */}
            <div className="grid2">
              <div className="ff-card ff-card-pad soft" style={{ boxShadow: "none" }}>
                <div className="sectionTitle">
                  <Info size={16} /> Datos
                </div>

                <div className="kv">
                  <span className="k">Cajas</span>
                  <b className="v">{data.boxes ?? "-"}</b>
                </div>
                <div className="kv">
                  <span className="k">Pallets</span>
                  <b className="v">{data.pallets ?? "-"}</b>
                </div>
                <div className="kv" style={{ borderBottom: 0 }}>
                  <span className="k">Peso</span>
                  <b className="v">{data.weight_kg ? `${data.weight_kg} kg` : "-"}</b>
                </div>
              </div>

              <div className="ff-card ff-card-pad" style={{ boxShadow: "none" }}>
                <div className="sectionTitle">Hitos</div>
                <ModernTimeline milestones={milestonesForTimeline as any} />
              </div>
            </div>

            <div className="ff-divider" />

            {/* Documentos */}
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

            <div className="ff-divider" />

            {/* Fotos */}
            <div className="ff-card ff-card-pad" style={{ boxShadow: "none" }}>
              <div className="sectionTitle">
                <ImageIcon size={16} /> Fotos
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
          </>
        ) : null}
      </div>

      <style jsx>{`
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

        .summary {
          background: var(--ff-surface);
          border: 1px solid var(--ff-border);
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
          line-height: 20px;
          letter-spacing: -0.2px;
        }
        .meta {
          font-size: 12px;
          color: var(--ff-muted);
          line-height: 16px;
          word-break: break-word;
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

        .kv {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }
        .k {
          color: var(--ff-muted);
          font-weight: 800;
          font-size: 12px;
        }
        .v {
          font-weight: 900;
          font-size: 12px;
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