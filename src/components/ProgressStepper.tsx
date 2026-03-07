import { useEffect, useMemo, useState } from "react";

// Estructura de tipos (Sin cambios para estabilidad)
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

// Icono de Caja 3D Isométrica (Líneas finas, look Pro)
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

export function ProgressStepper({ 
  milestones, 
  flightNumber, 
  awb, // <-- Usamos exactamente el nombre de tu SQL
  introMs = 1400 
}: { 
  milestones: Milestone[]; 
  flightNumber?: string | null; 
  awb?: string | null; 
  introMs?: number; 
}) {
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
      <div className="ff-header">
        <div className="ff-header-info">
          <div className="ff-live-pill">
            <span className="ff-ping"></span>
            SISTEMA DE MONITOREO CIP/AIR
          </div>
          <h3 className="ff-title">Estatus de Logística Internacional</h3>
          <div className="ff-current-step-txt">
            Paso Actual: <span>{STEPS[currentIndex]?.label}</span>
          </div>
        </div>

        {/* Bloque de Badges de Acción */}
        <div className="ff-action-badges">
          {/* Badge AWB */}
          <div className="ff-badge-group">
            <span className="ff-badge-label">GUÍA AÉREA (AWB)</span>
            <div className="ff-pill-static mono">
              {awb || "PENDIENTE"}
            </div>
          </div>
          
          {/* Badge Vuelo */}
          <div className="ff-badge-group">
            <span className="ff-badge-label">RASTREO DE TRANSPORTE</span>
            <a 
              href={`https://www.google.com/search?q=flight+status+${flightNumber}`} 
              target="_blank" 
              className="ff-pill-action"
            >
              <span className="ff-flight-val">✈ {flightNumber || "N/A"}</span>
              <span className="ff-action-hint">SIGA SU VUELO ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Progress Track */}
      <div className="ff-track-area">
        <div className="ff-rail">
          <div className="ff-fill" style={{ width: `${pct}%`, transition: `width ${introMs}ms cubic-bezier(0.22, 1, 0.36, 1)` }}>
            <div className="ff-scan-light" />
          </div>
        </div>
        <div className="ff-box-position" style={{ left: `${pct}%`, transition: `left ${introMs}ms cubic-bezier(0.22, 1, 0.36, 1)` }}>
          <PremiumBoxIcon />
        </div>
      </div>

      {/* Hitos Encadenados (Chevron Flow) */}
      <div className="ff-flow-container">
        {STEPS.map((s, i) => {
          const isDone = i <= currentIndex;
          const isActive = i === currentIndex;
          const hit = hitMap.get(String(s.type).toUpperCase());
          const time = hit ? (hit.at || hit.created_at) : null;

          return (
            <div key={s.type} className={`ff-flow-box ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
              <div className="ff-flow-content">
                <span className="ff-step-label">{s.label}</span>
                <span className="ff-step-time">{time ? fmtStepTime(time) : "---"}</span>
              </div>
              {i < STEPS.length - 1 && <div className="ff-chevron-arrow" />}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .ff-stepper-premium {
          background: #fff;
          padding: 32px;
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 10px 30px rgba(0,0,0,0.02);
        }

        .ff-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 45px; }
        .ff-live-pill { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 700; color: var(--ff-green); letter-spacing: 1px; margin-bottom: 6px; }
        .ff-ping { width: 8px; height: 8px; background: var(--ff-green); border-radius: 50%; animation: ping-pro 2s infinite; }
        .ff-title { margin: 0; font-size: 18px; font-weight: 500; color: #1e293b; }
        .ff-current-step-txt { font-size: 13px; color: #64748b; margin-top: 4px; }
        .ff-current-step-txt span { color: var(--ff-green); font-weight: 600; }

        .ff-action-badges { display: flex; flex-direction: column; gap: 12px; }
        .ff-badge-group { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .ff-badge-label { font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px; }

        .ff-pill-static, .ff-pill-action {
          min-width: 170px; padding: 7px 14px; border-radius: 10px; border: 1px solid #e2e8f0;
          font-size: 12px; font-weight: 600; color: #1e293b; text-align: center; display: flex; flex-direction: column;
        }
        .ff-pill-static.mono { font-family: monospace; background: #f8fafc; color: #334155; }
        .ff-pill-action { text-decoration: none; background: #fff; transition: 0.2s; }
        .ff-pill-action:hover { border-color: var(--ff-orange); box-shadow: 0 4px 12px rgba(209, 119, 17, 0.1); }
        .ff-flight-val { font-size: 13px; }
        .ff-action-hint { font-size: 8px; color: var(--ff-orange); font-weight: 800; margin-top: 1px; }

        .ff-track-area { position: relative; height: 60px; display: flex; align-items: center; margin-bottom: 12px; }
        .ff-rail { width: 100%; height: 5px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
        .ff-fill { height: 100%; background: var(--ff-green); position: relative; }
        .ff-scan-light { position: absolute; top: 0; right: 0; bottom: 0; width: 60px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: scan-pro 3s infinite linear; }
        .ff-box-position { position: absolute; transform: translate(-50%, -18px); z-index: 10; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.08)); }

        .ff-flow-container { display: flex; gap: 6px; margin-top: 10px; }
        .ff-flow-box {
          flex: 1; position: relative; background: #f8fafc; padding: 14px 18px;
          border-radius: 8px; opacity: 0.45; transition: 0.3s; display: flex; align-items: center;
        }
        .ff-flow-box.done { opacity: 0.85; }
        .ff-flow-box.active {
          opacity: 1; background: rgba(31, 122, 58, 0.05);
          border: 1px solid rgba(31, 122, 58, 0.1); transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        
        .ff-flow-content { display: flex; flex-direction: column; z-index: 2; }
        .ff-step-label { font-size: 12px; font-weight: 600; color: #1e293b; margin-bottom: 2px; }
        .ff-step-time { font-size: 10px; color: #64748b; font-weight: 500; }
        .active .ff-step-label { color: var(--ff-green); }

        .ff-chevron-arrow {
          position: absolute; right: -11px; top: 50%; transform: translateY(-50%) rotate(45deg);
          width: 20px; height: 20px; background: inherit; border-right: 3px solid #fff;
          border-top: 3px solid #fff; z-index: 1; border-radius: 0 4px 0 0;
        }

        @keyframes ping-pro { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes scan-pro { 0% { right: 100%; } 100% { right: -20%; } }

        @media (max-width: 900px) { 
          .ff-header { flex-direction: column; align-items: flex-start; gap: 24px; }
          .ff-action-badges { width: 100%; align-items: stretch; }
          .ff-badge-group { align-items: flex-start; }
          .ff-pill-static, .ff-pill-action { min-width: 100%; text-align: left; }
          .ff-flow-container { flex-wrap: wrap; }
          .ff-chevron-arrow { display: none; }
        }
      `}</style>
    </div>
  );
}