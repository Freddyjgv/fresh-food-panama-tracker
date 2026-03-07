import { useMemo } from "react";
import {
  CheckCircle2,
  FileText,
  PackageCheck,
  Warehouse,
  PlaneTakeoff,
  MapPin,
  Check,
  Info
} from "lucide-react";

type MilestoneType =
  | "CREATED"
  | "PACKED"
  | "DOCS_READY"
  | "AT_ORIGIN"
  | "IN_TRANSIT"
  | "AT_DESTINATION"
  | string;

type Milestone = {
  id?: string;
  type: MilestoneType;
  note?: string | null;
  created_at?: string | null;
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PA", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelFor(type: MilestoneType) {
  const t = String(type || "").toUpperCase();
  switch (t) {
    case "CREATED": return "Reserva de Carga";
    case "PACKED": return "Packing & Calidad OK";
    case "DOCS_READY": return "AWB e Invoices Listos";
    case "AT_ORIGIN": return "Ingreso a Terminal de Carga";
    case "IN_TRANSIT": return "Vuelo en Tránsito";
    case "AT_DESTINATION": return "Arribo a Destino";
    default: return t.replaceAll("_", " ");
  }
}

function iconFor(type: MilestoneType) {
  const t = String(type || "").toUpperCase();
  const size = 16;
  if (t === "PACKED") return <PackageCheck size={size} />;
  if (t === "DOCS_READY") return <FileText size={size} />;
  if (t === "AT_ORIGIN") return <Warehouse size={size} />;
  if (t === "IN_TRANSIT") return <PlaneTakeoff size={size} />; // Cambio a Avión para AIR/CIP
  if (t === "AT_DESTINATION") return <MapPin size={size} />;
  return <CheckCircle2 size={size} />;
}

export function Timeline({ milestones }: { milestones: Milestone[] }) {
  if (!milestones?.length) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
        <Info size={24} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Sincronizando flujo logístico...</p>
      </div>
    );
  }

  const sorted = useMemo(() => {
    return [...milestones].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da; 
    });
  }, [milestones]);

  return (
    <div className="air-timeline">
      {sorted.map((m, idx) => {
        const title = labelFor(m.type);
        const isLatest = idx === 0;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={m.id || `${m.type}-${idx}`} className={`timeline-step ${isLatest ? 'is-active' : ''}`}>
            
            <div className="indicator-col">
              <div className="node">
                {isLatest ? <Check size={14} strokeWidth={4} /> : iconFor(m.type)}
              </div>
              {!isLast && <div className="track-line" />}
            </div>

            <div className="body-col">
              <div className="status-box">
                <div className="status-header">
                  <div className="text-stack">
                    <span className="label">{title}</span>
                    <span className="timestamp">{fmt(m.created_at)}</span>
                  </div>
                  {isLatest && <span className="live-pill">Live Update</span>}
                </div>
                
                {m.note && (
                  <div className="note-area">
                    <p>{m.note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .air-timeline {
          padding: 5px;
          display: flex;
          flex-direction: column;
        }

        .timeline-step {
          display: flex;
          gap: 12px;
        }

        /* --- INDICADORES --- */
        .indicator-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 32px;
          flex-shrink: 0;
        }

        .node {
          width: 28px;
          height: 28px;
          border-radius: 8px; /* Square rounded para look más "tech" */
          background: white;
          border: 2px solid #e2e8f0;
          display: grid;
          place-items: center;
          color: #94a3b8;
          z-index: 2;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .is-active .node {
          background: #0f172a; /* Azul muy oscuro para contraste premium */
          border-color: #0f172a;
          color: #22c55e; /* Verde brillante para el check */
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
        }

        .track-line {
          width: 2px;
          flex-grow: 1;
          background: #f1f5f9;
          margin: 4px 0;
        }

        /* --- TARJETAS --- */
        .body-col {
          flex-grow: 1;
          padding-bottom: 20px;
        }

        .status-box {
          background: white;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 12px;
          transition: 0.2s;
        }

        .is-active .status-box {
          border-color: #e2e8f0;
          background: linear-gradient(to right, #ffffff, #f8fafc);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .text-stack {
          display: flex;
          flex-direction: column;
        }

        .label {
          font-weight: 800;
          font-size: 13px;
          color: #0f172a;
          letter-spacing: -0.3px;
        }

        .timestamp {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .live-pill {
          font-size: 9px;
          font-weight: 900;
          background: #dcfce7;
          color: #16a34a;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          animation: pulse 2s infinite;
        }

        .note-area {
          margin-top: 8px;
          padding: 8px;
          background: #f8fafc;
          border-radius: 6px;
          font-size: 12px;
          color: #475569;
          line-height: 1.4;
          border-left: 3px solid #e2e8f0;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}