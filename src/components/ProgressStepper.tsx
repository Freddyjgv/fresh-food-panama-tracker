import { useEffect, useMemo, useState } from "react";

type StepType = | "CREATED" | "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION" | string;
type Milestone = { type: StepType; at?: string | null; created_at?: string | null; note?: string | null; };

const STEPS: { type: StepType; label: string }[] = [
  { type: "CREATED", label: "Reserva" },
  { type: "PACKED", label: "Empaque" },
  { type: "DOCS_READY", label: "Documentos" },
  { type: "AT_ORIGIN", label: "Origen" },
  { type: "IN_TRANSIT", label: "En Vuelo" },
  { type: "AT_DESTINATION", label: "Destino" },
];

const IN_TRANSIT_INDEX = STEPS.findIndex((s) => String(s.type).toUpperCase() === "IN_TRANSIT");

// Icono de Caja Isométrica Premium (Líneas finas + profundidad)
function PremiumBoxIcon({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 7L12 12L21 7L12 2Z" stroke="var(--ff-orange)" strokeWidth="1.2" fill="rgba(209, 119, 17, 0.1)"/>
      <path d="M3 7V17L12 22V12L3 7Z" stroke="var(--ff-orange)" strokeWidth="1.2" fill="rgba(209, 119, 17, 0.05)"/>
      <path d="M21 7V17L12 22V12L21 7Z" stroke="var(--ff-orange)" strokeWidth="1.2" />
      <path d="M12 12V22" stroke="var(--ff-orange)" strokeWidth="0.8" strokeDasharray="2 2"/>
    </svg>
  );
}

function fmtStepTime(iso: string) {
  try { return new Date(iso).toLocaleString("es-PA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function computeCurrentIndex(milestones: Milestone[]) {
  const types = new Set((milestones ?? []).map((m) => String(m.type).toUpperCase()));
  let idx = 0;
  for (let i = 0; i < STEPS.length; i++) { if (types.has(String(STEPS[i].type).toUpperCase())) idx = i; }
  return idx;
}

export function ProgressStepper({ milestones, flightNumber, awbNumber, introMs = 1400 }: { milestones: Milestone[]; flightNumber?: string | null; awbNumber?: string | null; introMs?: number; }) {
  const currentIndex = useMemo(() => computeCurrentIndex(milestones ?? []), [milestones]);
  const targetPct = useMemo(() => (STEPS.length <= 1 ? 0 : (currentIndex / (STEPS.length - 1)) * 100), [currentIndex]);
  
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPct(targetPct), 100);
    return () => clearTimeout(t);
  }, [targetPct]);

  const hitMap = useMemo(() => {
    const m = new Map<string, Milestone>();
    (milestones ?? []).forEach((x) => m.set(String(x.type).toUpperCase(), x));
    return m;
  }, [milestones]);

  return (
    <div className="ff-stepper-premium">
      {/* Header con Data Logística Real */}
      <div className="ff-header">
        <div className="ff-header-main">
          <div className="ff-live-tag">
            <span className="ff-ping"></span>
            LIVE TRACKING
          </div>
          <h3 className="ff-title">Logística Aérea Internacional</h3>
        </div>

        <div className="ff-meta-grid">
          <div className="ff-meta-box">
            <span className="ff-meta-label">GUÍA AÉREA (AWB)</span>
            <span className="ff-meta-value mono">{awbNumber || "--- --- ---"}</span>
          </div>
          
          <div className="ff-meta-box">
            <span className="ff-meta-label">ESTADO ACTUAL</span>
            <span className="ff-meta-value active">{STEPS[currentIndex]?.label}</span>
          </div>

          <div className="ff-flight-container">
            <a 
              href={`https://www.google.com/search?q=flight+status+${flightNumber}`} 
              target="_blank" 
              className="ff-flight-action"
            >
              <span className="ff-flight-info">✈ {flightNumber || "N/A"}</span>
              <span className="ff-flight-label">RASTREAR VUELO ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Progress Track Técnico */}
      <div className="ff-track-area">
        <div className="ff-rail">
          <div className="ff-fill" style={{ width: `${pct}%`, transition: `width ${introMs}ms cubic-bezier(0.22, 1, 0.36, 1)` }}>
            <div className="ff-scan" />
          </div>
        </div>
        <div className="ff-box-position" style={{ left: `${pct}%`, transition: `left ${introMs}ms cubic-bezier(0.22, 1, 0.36, 1)` }}>
          <PremiumBoxIcon />
        </div>
      </div>

      {/* Grid de Hitos Encadenados (Chevron Flow) */}
      <div className="ff-flow-wrapper">
        {STEPS.map((s, i) => {
          const isDone = i <= currentIndex;
          const isActive = i === currentIndex;
          const hit = hitMap.get(String(s.type).toUpperCase());
          const time = hit ? (hit.at || hit.created_at) : null;

          return (
            <div key={s.type} className={`ff-flow-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
              <div className="ff-flow-inner">
                <span className="ff-flow-name">{s.label}</span>
                <span className="ff-flow-time">{time ? fmtStepTime(time) : "---"}</span>
              </div>
              {i < STEPS.length - 1 && <div className="ff-chevron-edge" />}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .ff-stepper-premium {
          background: var(--ff-surface);
          padding: 32px;
          border-radius: 20px;
          border: 1px solid var(--ff-border);
          box-shadow: var(--ff-shadow);
        }

        /* HEADER & META DATA */
        .ff-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
        .ff-live-tag { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; color: var(--ff-green); letter-spacing: 1px; margin-bottom: 6px; }
        .ff-ping { width: 8px; height: 8px; background: var(--ff-green); border-radius: 50%; animation: pro-ping 2s infinite; }
        .ff-title { margin: 0; font-size: 18px; font-weight: 500; color: var(--ff-text); }

        .ff-meta-grid { display: flex; gap: 32px; align-items: flex-end; }
        .ff-meta-box { display: flex; flex-direction: column; align-items: flex-end; }
        .ff-meta-label { font-size: 9px; font-weight: 700; color: var(--ff-muted); margin-bottom: 4px; }
        .ff-meta-value { font-size: 14px; font-weight: 500; color: var(--ff-text); }
        .ff-meta-value.mono { font-family: monospace; letter-spacing: 0.5px; }
        .ff-meta-value.active { color: var(--ff-green); font-weight: 700; }

        /* FLIGHT TRACKING BUTTON */
        .ff-flight-container { border-left: 1px solid var(--ff-border); padding-left: 32px; }
        .ff-flight-action {
          display: flex; flex-direction: column; align-items: center;
          text-decoration: none; background: var(--ff-bg); padding: 8px 16px; border-radius: 12px;
          transition: 0.2s; border: 1px solid transparent;
        }
        .ff-flight-action:hover { border-color: var(--ff-orange); background: #fff; box-shadow: 0 4px 12px rgba(209, 119, 17, 0.1); }
        .ff-flight-info { font-size: 13px; font-weight: 700; color: var(--ff-text); }
        .ff-flight-label { font-size: 9px; font-weight: 800; color: var(--ff-orange); margin-top: 2px; }

        /* TRACK AREA */
        .ff-track-area { position: relative; height: 60px; display: flex; align-items: center; margin-bottom: 12px; }
        .ff-rail { width: 100%; height: 4px; background: var(--ff-bg); border-radius: 10px; overflow: hidden; }
        .ff-fill { height: 100%; background: var(--ff-green); position: relative; box-shadow: 0 0 10px rgba(31, 122, 58, 0.2); }
        .ff-scan { position: absolute; top: 0; right: 0; bottom: 0; width: 60px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: scan 3s infinite linear; }
        .ff-box-position { position: absolute; transform: translate(-50%, -18px); z-index: 10; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.1)); }

        /* FLOW ENCADENADO (CHEVRON) */
        .ff-flow-wrapper { display: flex; gap: 4px; margin-top: 10px; }
        .ff-flow-step {
          flex: 1; position: relative; background: var(--ff-bg); padding: 16px 20px;
          border-radius: 6px; opacity: 0.4; transition: 0.3s; display: flex; align-items: center;
        }
        .ff-flow-step.done { opacity: 0.8; }
        .ff-flow-step.active {
          opacity: 1; background: rgba(31, 122, 58, 0.05);
          border: 1px solid rgba(31, 122, 58, 0.1);
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
        }
        
        .ff-flow-inner { display: flex; flex-direction: column; z-index: 2; }
        .ff-flow-name { font-size: 12px; font-weight: 600; color: var(--ff-text); margin-bottom: 2px; }
        .ff-flow-time { font-size: 10px; font-weight: 500; color: var(--ff-muted); }
        .active .ff-flow-name { color: var(--ff-green); }

        .ff-chevron-edge {
          position: absolute; right: -10px; top: 50%; transform: translateY(-50%) rotate(45deg);
          width: 20px; height: 20px; background: inherit; border-right: 3px solid var(--ff-surface);
          border-top: 3px solid var(--ff-surface); z-index: 1; border-radius: 0 4px 0 0;
        }

        @keyframes pro-ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes scan { 0% { right: 100%; } 100% { right: -20%; } }

        @media (max-width: 900px) { 
          .ff-header { flex-direction: column; align-items: flex-start; gap: 20px; }
          .ff-meta-grid { width: 100%; justify-content: space-between; gap: 10px; }
          .ff-flow-wrapper { flex-wrap: wrap; }
          .ff-chevron-edge { display: none; }
        }
      `}</style>
    </div>
  );
}