import { useEffect, useMemo, useState } from "react";

type StepType = "CREATED" | "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION" | string;
type Milestone = { type: StepType; at?: string | null; created_at?: string | null; note?: string | null; };

const STEPS: { type: StepType; label: string }[] = [
  { type: "CREATED", label: "Embarque creado" },
  { type: "PACKED", label: "Empaque" },
  { type: "DOCS_READY", label: "Documentos" },
  { type: "AT_ORIGIN", label: "En terminal de carga" },
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
  
  // Cálculo matemático exacto para centrar la caja sobre los puntos
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
            <span className="ff-data-label">AWB #</span>
            <span className="ff-data-value mono">{awb || "— — —"}</span>
          </div>
          {/* Restaurada opción de tracking interactivo */}
          <a 
            href={`https://www.google.com/search?q=flight+status+${flightNumber}`} 
            target="_blank" 
            rel="noreferrer"
            className="ff-data-card ff-link-active"
          >
            <span className="ff-data-label">VUELO</span>
            <span className="ff-data-value">✈ {flightNumber || "N/A"}</span>
            <span className="ff-link-hint">RASTREAR ↗</span>
          </a>
        </div>
      </div>

      <div className="ff-stepper-track-area">
        <div className="ff-rail-base">
          <div className="ff-progress-line" style={{ width: `${pct}%` }}></div>
        </div>

        {/* Capa de puntos y etiquetas con anchos idénticos para centrado perfecto */}
        <div className="ff-steps-layer">
          {STEPS.map((s, i) => {
            const isDone = i <= currentIndex;
            const isActive = i === currentIndex;
            const hit = hitMap.get(String(s.type).toUpperCase());
            const time = hit ? new Date(hit.at || hit.created_at || '').toLocaleTimeString('es-PA', {hour:'2-digit', minute:'2-digit'}) : null;

            return (
              <div key={i} className={`ff-step-column ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}>
                <div className="ff-dot-wrapper">
                  <div className="ff-step-dot"></div>
                  {isActive && <div className="ff-active-halo"></div>}
                </div>
                <div className="ff-step-content">
                  <span className="ff-label-text">{s.label}</span>
                  <span className="ff-time-text">{time || "—:—"}</span>
                </div>
                {isActive && <div className="ff-current-indicator"></div>}
              </div>
            );
          })}
        </div>

        {/* Caja flotante vinculada al % exacto */}
        <div className="ff-box-float" style={{ left: `${pct}%` }}>
           <div className="ff-box-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d17711" strokeWidth="1.5">
                <path d="M12 2L3 7L12 12L21 7L12 2Z" fill="rgba(209, 119, 17, 0.1)"/>
                <path d="M3 7V17L12 22V12L3 7Z" />
                <path d="M21 7V17L12 22V12L21 7Z" />
              </svg>
           </div>
        </div>
      </div>

      <style jsx>{`
        .ff-apple-container {
          background: #fff;
          padding: 40px;
          border-radius: 24px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 10px 40px rgba(0,0,0,0.02);
        }

        .ff-glass-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 70px; }
        .ff-live-indicator { display: inline-flex; align-items: center; gap: 8px; background: #f0fdf4; padding: 6px 14px; border-radius: 100px; color: #166534; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; }
        .ff-pulse-core { width: 6px; height: 6px; background: #166534; border-radius: 50%; }
        
        .ff-main-title { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
        .ff-subtitle { color: #64748b; font-size: 14px; margin-top: 5px; }
        .ff-highlight { color: #166534; font-weight: 800; }

        .ff-data-group { display: flex; gap: 12px; }
        .ff-data-card { background: #f8fafc; padding: 14px 20px; border-radius: 16px; border: 1px solid #f1f5f9; min-width: 140px; text-decoration: none; display: flex; flex-direction: column; }
        .ff-link-active { transition: all 0.2s; border-color: #e2e8f0; }
        .ff-link-active:hover { border-color: #d17711; background: #fff; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(209,119,17,0.1); }
        
        .ff-data-label { font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 4px; }
        .ff-data-value { font-size: 14px; font-weight: 700; color: #1e293b; }
        .ff-link-hint { font-size: 9px; color: #d17711; font-weight: 800; margin-top: 4px; }

        /* Stepper Engine: Grid de columnas iguales */
        .ff-stepper-track-area { position: relative; margin-top: 40px; padding-bottom: 20px; }
        
        .ff-rail-base { 
          position: absolute; top: 5px; left: 0; right: 0; height: 4px; 
          background: #f1f5f9; border-radius: 10px; z-index: 1; 
        }
        .ff-progress-line { 
          height: 100%; background: #166534; border-radius: 10px;
          transition: width ${introMs}ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ff-steps-layer { display: flex; position: relative; z-index: 2; }
        
        .ff-step-column { 
          flex: 1; display: flex; flex-direction: column; align-items: center; 
          position: relative; transition: 0.3s;
        }

        .ff-dot-wrapper { height: 14px; display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: 24px; }
        .ff-step-dot { width: 10px; height: 10px; background: #fff; border: 2px solid #e2e8f0; border-radius: 50%; transition: 0.4s; }
        
        .is-done .ff-step-dot { background: #166534; border-color: #166534; }
        .is-active .ff-step-dot { transform: scale(1.3); background: #166534; border-color: #166534; }
        
        .ff-active-halo { 
          position: absolute; width: 20px; height: 20px; border-radius: 50%; 
          background: rgba(22, 101, 52, 0.15); animation: pulse-halo 2s infinite; 
        }

        .ff-step-content { text-align: center; display: flex; flex-direction: column; gap: 2px; }
        .ff-label-text { font-size: 11px; font-weight: 700; color: #1e293b; opacity: 0.4; }
        .is-done .ff-label-text { opacity: 0.8; }
        .is-active .ff-label-text { opacity: 1; color: #166534; }
        .ff-time-text { font-size: 10px; color: #94a3b8; font-weight: 600; }

        .ff-current-indicator { 
          position: absolute; bottom: -20px; width: 35px; height: 3px; 
          background: #166534; border-radius: 10px; 
          box-shadow: 0 2px 10px rgba(22, 101, 52, 0.3);
        }

        .ff-box-float { 
          position: absolute; top: -35px; transform: translateX(-50%); 
          transition: left ${introMs}ms cubic-bezier(0.16, 1, 0.3, 1); z-index: 10; 
        }
        .ff-box-icon { filter: drop-shadow(0 5px 10px rgba(209,119,17,0.15)); animation: box-bounce 3s ease-in-out infinite; }

        @keyframes pulse-halo { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes box-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

        @media (max-width: 800px) {
          .ff-glass-header { flex-direction: column; align-items: flex-start; gap: 20px; }
          .ff-data-group { width: 100%; }
          .ff-data-card { flex: 1; }
          .ff-step-column { min-width: 100px; }
          .ff-stepper-track-area { overflow-x: auto; padding-top: 40px; }
        }
      `}</style>
    </div>
  );
}