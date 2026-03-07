import { useEffect, useMemo, useState } from "react";

// 1. Tipos y Constantes con nombres actualizados según tu solicitud
type StepType = "CREATED" | "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION" | string;
type Milestone = { type: StepType; at?: string | null; created_at?: string | null; note?: string | null; };

const STEPS: { type: StepType; label: string }[] = [
  { type: "CREATED", label: "Embarque creado" }, //
  { type: "PACKED", label: "Empaque" },
  { type: "DOCS_READY", label: "Documentos" },
  { type: "AT_ORIGIN", label: "En terminal de carga" }, //
  { type: "IN_TRANSIT", label: "En vuelo" },
  { type: "AT_DESTINATION", label: "Destino" },
];

export function ProgressStepper({ 
  milestones, 
  flightNumber, 
  awb, 
  introMs = 1600 
}: { 
  milestones: Milestone[]; 
  flightNumber?: string | null; 
  awb?: string | null; 
  introMs?: number; 
}) {
  const currentIndex = useMemo(() => {
    const types = new Set((milestones ?? []).map((m) => String(m.type).toUpperCase()));
    let idx = 0;
    for (let i = 0; i < STEPS.length; i++) { if (types.has(String(STEPS[i].type).toUpperCase())) idx = i; }
    return idx;
  }, [milestones]);

  const [pct, setPct] = useState(0);
  const targetPct = useMemo(() => (currentIndex / (STEPS.length - 1)) * 100, [currentIndex]);

  useEffect(() => {
    const t = setTimeout(() => setPct(targetPct), 200);
    return () => clearTimeout(t);
  }, [targetPct]);

  const hitMap = useMemo(() => {
    const m = new Map<string, Milestone>();
    (milestones ?? []).forEach((x) => m.set(String(x.type).toUpperCase(), x));
    return m;
  }, [milestones]);

  return (
    <div className="ff-apple-container">
      {/* Header unchanged for branding consistency */}
      <div className="ff-glass-header">
        <div className="ff-brand-section">
          <div className="ff-live-indicator">
            <span className="ff-pulse-core"></span>
            <span className="ff-pulse-ring"></span>
            LIVE TRACKING
          </div>
          <h2 className="ff-main-title">Logística en Tiempo Real</h2>
          <p className="ff-subtitle">Cargamento actualmente en <span className="ff-highlight">{STEPS[currentIndex].label}</span></p>
        </div>

        <div className="ff-data-group">
          <div className="ff-data-card">
            <span className="ff-data-label">WAYBILL</span>
            <span className="ff-data-value mono">{awb || "— — —"}</span>
          </div>
          <div className="ff-data-card">
            <span className="ff-data-label">VUELO</span>
            <span className="ff-data-value">✈ {flightNumber || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* TRACK: Puntos centrados milimétricamente con el texto inferior */}
      <div className="ff-track-wrapper">
        <div className="ff-main-rail">
          <div className="ff-progress-fill" style={{ width: `${pct}%` }}>
            <div className="ff-liquid-glow"></div>
          </div>
        </div>
        
        {/* Los puntos ahora usan flex-justify: space-between para alinearse con los labels */}
        <div className="ff-dots-container">
          {STEPS.map((_, i) => (
            <div key={i} className={`ff-track-dot ${i <= currentIndex ? 'filled' : ''} ${i === currentIndex ? 'active-pulse' : ''}`} />
          ))}
        </div>

        <div className="ff-floating-asset" style={{ left: `${pct}%` }}>
          <div className="ff-box-wrapper">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#d17711" strokeWidth="1.5">
              <path d="M12 2L3 7L12 12L21 7L12 2Z" fill="rgba(209, 119, 17, 0.1)"/>
              <path d="M3 7V17L12 22V12L3 7Z" />
              <path d="M21 7V17L12 22V12L21 7Z" />
            </svg>
          </div>
        </div>
      </div>

      {/* FOOTER: Labels alineados con los puntos superiores */}
      <div className="ff-minimal-flow">
        {STEPS.map((s, i) => {
          const isDone = i <= currentIndex;
          const isActive = i === currentIndex;
          const hit = hitMap.get(String(s.type).toUpperCase());
          const time = hit ? new Date(hit.at || hit.created_at || '').toLocaleTimeString('es-PA', {hour:'2-digit', minute:'2-digit'}) : null;

          return (
            <div key={s.type} className={`ff-flow-node ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
              <span className="ff-node-label">{s.label}</span>
              <span className="ff-node-time">{time || "—:—"}</span>
              {isActive && <div className="ff-active-indicator-glow" />}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .ff-apple-container {
          background: #ffffff;
          padding: 40px;
          border-radius: 24px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 10px 40px rgba(0,0,0,0.03);
        }

        .ff-glass-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 60px; }
        .ff-live-indicator { display: inline-flex; align-items: center; gap: 8px; background: #f0fdf4; padding: 6px 12px; border-radius: 100px; color: #166534; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; }
        .ff-pulse-core { width: 6px; height: 6px; background: #166534; border-radius: 50%; }
        .ff-main-title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; }
        .ff-subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
        .ff-highlight { color: #166534; font-weight: 700; }

        .ff-data-group { display: flex; gap: 12px; }
        .ff-data-card { background: #f8fafc; padding: 12px 20px; border-radius: 14px; border: 1px solid #f1f5f9; min-width: 130px; }
        .ff-data-label { font-size: 9px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 2px; }
        .ff-data-value { font-size: 14px; font-weight: 700; color: #1e293b; }
        .ff-data-value.mono { font-family: monospace; }

        /* Track con alineación perfecta */
        .ff-track-wrapper { position: relative; margin: 40px 0 30px; height: 10px; }
        .ff-main-rail { position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: #f1f5f9; transform: translateY(-50%); border-radius: 10px; overflow: hidden; }
        .ff-progress-fill { height: 100%; background: #166534; transition: width ${introMs}ms cubic-bezier(0.16, 1, 0.3, 1); }
        
        .ff-dots-container { 
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; justify-content: space-between; align-items: center;
          padding: 0; /* Asegura que el primer y último punto toquen los extremos */
        }
        .ff-track-dot { width: 10px; height: 10px; background: #fff; border: 2px solid #e2e8f0; border-radius: 50%; z-index: 5; transition: 0.3s; }
        .ff-track-dot.filled { border-color: #166534; background: #166534; }
        
        /* Highlight del hito activo más llamativo */
        .ff-track-dot.active-pulse { 
          background: #166534; 
          border-color: #166534; 
          transform: scale(1.4);
          box-shadow: 0 0 0 4px rgba(22, 101, 52, 0.2);
        }

        .ff-floating-asset { position: absolute; top: -35px; transform: translateX(-50%); transition: left ${introMs}ms cubic-bezier(0.16, 1, 0.3, 1); z-index: 10; }
        .ff-box-wrapper { filter: drop-shadow(0 5px 10px rgba(209,119,17,0.2)); }

        /* Labels alineados por el centro */
        .ff-minimal-flow { display: flex; justify-content: space-between; margin-top: 20px; }
        .ff-flow-node { 
          display: flex; flex-direction: column; align-items: center; 
          width: 80px; /* Ancho fijo para centrado perfecto */
          text-align: center;
          opacity: 0.4;
          position: relative;
        }
        .ff-flow-node.done { opacity: 0.8; }
        .ff-flow-node.active { opacity: 1; }
        .ff-node-label { font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 2px; line-height: 1.2; }
        .ff-node-time { font-size: 10px; color: #94a3b8; font-weight: 500; }
        
        /* Highlight inferior del hito en curso */
        .ff-active-indicator-glow {
          position: absolute; bottom: -12px; width: 30px; height: 3px;
          background: #166534; border-radius: 10px;
          box-shadow: 0 2px 8px rgba(22, 101, 52, 0.4);
        }

        @keyframes apple-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(3); opacity: 0; } }
      `}</style>
    </div>
  );
}