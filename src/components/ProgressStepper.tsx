import { useEffect, useMemo, useState } from "react";

// Lógica de tipos y utilidades (Sin cambios para no romper nada)
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

// Icono de Piña con colores del Brandbook
function BrandPineappleIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L10 7L12 6L14 7L12 2Z" fill="var(--ff-green)" />
      <path d="M12 21C15.3137 21 18 18.3137 18 15C18 11.6863 15.3137 9 12 9C8.68629 9 6 11.6863 6 15C6 18.3137 8.68629 21 12 21Z" fill="var(--ff-orange)" />
      <path d="M9 13L15 17M9 17L15 13" stroke="white" strokeWidth="0.5" strokeOpacity="0.4" />
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

export function ProgressStepper({ milestones, flightNumber, introMs = 1400 }: { milestones: Milestone[]; flightNumber?: string | null; introMs?: number; }) {
  const currentIndex = useMemo(() => computeCurrentIndex(milestones ?? []), [milestones]);
  const targetPct = useMemo(() => (STEPS.length <= 1 ? 0 : (currentIndex / (STEPS.length - 1)) * 100), [currentIndex]);
  
  const [mounted, setMounted] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setPct(targetPct), 100);
    return () => clearTimeout(t);
  }, [targetPct]);

  const hitMap = useMemo(() => {
    const m = new Map<string, Milestone>();
    (milestones ?? []).forEach((x) => m.set(String(x.type).toUpperCase(), x));
    return m;
  }, [milestones]);

  const transitReached = currentIndex >= IN_TRANSIT_INDEX;
  const transitPct = (IN_TRANSIT_INDEX / (STEPS.length - 1)) * 100;

  return (
    <div className="ff-stepper-card">
      {/* Header Alineado a Brandbook */}
      <div className="ff-stepper-header">
        <div>
          <span className="ff-live-tag">TRACKING EN VIVO</span>
          <h3 className="ff-title">Estatus del Embarque CIP/AIR</h3>
        </div>
        <div className="ff-status-pill">
          {STEPS[currentIndex]?.label}
        </div>
      </div>

      {/* Track de Progreso con variables Brand */}
      <div className="ff-track-container">
        <div className="ff-rail">
          <div 
            className="ff-fill" 
            style={{ 
                width: `${pct}%`, 
                transition: `width ${introMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)` 
            }} 
          >
            <div className="ff-glow" />
          </div>
        </div>

        {/* Radar de Vuelo */}
        {transitReached && (
          <div className="ff-vuelo-radar" style={{ left: `${transitPct}%` }}>
            <div className="radar-pulse" />
            <div className="radar-dot" />
            <span className="radar-txt">Vuelo</span>
          </div>
        )}

        {/* Piña Flotante */}
        <div 
          className="ff-pineapple-float" 
          style={{ 
            left: `${pct}%`, 
            transition: `left ${introMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)` 
          }}
        >
          <BrandPineappleIcon size={46} />
        </div>
      </div>

      {/* Grid de Pasos */}
      <div className="ff-steps-grid">
        {STEPS.map((s, i) => {
          const isDone = i <= currentIndex;
          const isCurrent = i === currentIndex;
          const hit = hitMap.get(String(s.type).toUpperCase());
          const time = hit ? (hit.at || hit.created_at) : null;

          return (
            <div key={s.type} className={`ff-step-box ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}>
              <div className="ff-step-head">
                <div className="ff-step-dot" />
                <span className="ff-step-label">{s.label}</span>
              </div>
              <div className="ff-step-time">{time ? fmtStepTime(time) : "---"}</div>
              {i === IN_TRANSIT_INDEX && flightNumber && isDone && (
                <div className="ff-step-flight">✈ {flightNumber}</div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .ff-stepper-card {
          background: var(--ff-surface);
          padding: 24px;
          border-radius: 16px;
          border: 1px solid var(--ff-border);
          box-shadow: var(--ff-shadow);
          margin-bottom: 20px;
        }

        .ff-stepper-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .ff-live-tag {
          font-size: 9px;
          font-weight: 950;
          color: var(--ff-green);
          letter-spacing: 1px;
          display: block;
          margin-bottom: 4px;
        }

        .ff-title {
          margin: 0;
          font-size: 16px;
          font-weight: 950;
          color: var(--ff-text);
          letter-spacing: -0.5px;
        }

        .ff-status-pill {
          background: var(--ff-green);
          color: white;
          padding: 6px 14px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 4px 10px rgba(31, 122, 58, 0.2);
        }

        .ff-track-container {
          position: relative;
          height: 60px;
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }

        .ff-rail {
          width: 100%;
          height: 8px;
          background: var(--ff-bg);
          border-radius: 10px;
          border: 1px solid var(--ff-border);
          overflow: hidden;
        }

        .ff-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--ff-green-dark), var(--ff-green));
          position: relative;
        }

        .ff-glow {
          position: absolute;
          right: 0;
          height: 100%;
          width: 20px;
          background: white;
          filter: blur(8px);
          opacity: 0.4;
        }

        .ff-pineapple-float {
          position: absolute;
          transform: translate(-50%, -18px);
          z-index: 10;
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.1));
          animation: floaty 3s ease-in-out infinite;
        }

        .ff-vuelo-radar {
          position: absolute;
          transform: translateX(-50%);
          top: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .radar-dot { width: 6px; height: 6px; background: var(--ff-orange); border-radius: 50%; }
        .radar-pulse {
          position: absolute; width: 16px; height: 16px; border: 1px solid var(--ff-orange);
          border-radius: 50%; animation: pulse 2s infinite; top: -5px;
        }
        .radar-txt { font-size: 9px; font-weight: 900; color: var(--ff-muted); margin-top: 4px; }

        .ff-steps-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
        }

        .ff-step-box {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: var(--ff-bg);
          opacity: 0.6;
          transition: 0.3s;
        }

        .ff-step-box.done { opacity: 1; background: var(--ff-surface); border-color: var(--ff-border); }
        .ff-step-box.active {
          opacity: 1;
          background: var(--ff-surface);
          border-color: var(--ff-green);
          box-shadow: 0 4px 12px rgba(31, 122, 58, 0.08);
          transform: translateY(-2px);
        }

        .ff-step-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .ff-step-dot { width: 7px; height: 7px; background: #cbd5e1; border-radius: 50%; }
        .done .ff-step-dot { background: var(--ff-green); }
        .active .ff-step-dot { background: var(--ff-green); box-shadow: 0 0 6px var(--ff-green); }

        .ff-step-label { font-size: 11px; font-weight: 900; color: var(--ff-text); }
        .ff-step-time { font-size: 10px; font-weight: 700; color: var(--ff-muted); }
        .ff-step-flight { margin-top: 6px; font-size: 10px; font-weight: 950; color: var(--ff-orange); }

        @keyframes floaty { 0%, 100% { transform: translate(-50%, -18px); } 50% { transform: translate(-50%, -24px); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }

        @media (max-width: 900px) { .ff-steps-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </div>
  );
}