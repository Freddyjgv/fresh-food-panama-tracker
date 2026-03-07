import { useEffect, useMemo, useState } from "react";

// ... (Tipos y funciones de ayuda se mantienen igual para no romper lógica)
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

function ShipmentBoxIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 7.5 12 5l5 2.5v6.8c0 .6-.3 1.2-.9 1.5L12 18l-4.1-2.2c-.6-.3-.9-.9-.9-1.5V7.5Z" fill="#16a34a" />
      <path d="M7 7.5 12 10l5-2.5M10.2 12.1h3.6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ... (Funciones auxiliares fmtStepTime, computeCurrentIndex, parseFlight se mantienen igual)
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

function parseFlight(raw?: string | null) {
  const s = String(raw || "").trim().toUpperCase();
  const m = s.match(/^([A-Z]{2,3})\s*(\d{2,4})(?:\/\d{1,2})?$/);
  if (!m) return null;
  return { airline: m[1], number: m[2], raw: `${m[1]} ${m[2]}` };
}

export function ProgressStepper({ milestones, flightNumber, introMs = 1200 }: { milestones: Milestone[]; flightNumber?: string | null; introMs?: number; }) {
  const currentIndex = useMemo(() => computeCurrentIndex(milestones ?? []), [milestones]);
  const targetPct = useMemo(() => (STEPS.length <= 1 ? 0 : (currentIndex / (STEPS.length - 1)) * 100), [currentIndex]);
  
  const [mounted, setMounted] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setPct(targetPct), 50);
    return () => clearTimeout(t);
  }, [targetPct]);

  const hitMap = useMemo(() => {
    const m = new Map<string, Milestone>();
    (milestones ?? []).forEach((x) => m.set(String(x.type).toUpperCase(), x));
    return m;
  }, [milestones]);

  const transitReached = currentIndex >= IN_TRANSIT_INDEX;
  const transitPct = (IN_TRANSIT_INDEX / (STEPS.length - 1)) * 100;
  const flightLabel = parseFlight(flightNumber)?.raw || flightNumber;

  return (
    <div className="stepper-container">
      {/* Header Estilizado */}
      <div className="stepper-header">
        <div className="status-info">
          <h3>Progreso del Envío CIP/AIR</h3>
          <p>Estado: <strong>{STEPS[currentIndex]?.label}</strong></p>
        </div>
        <div className="current-badge">
          <div className="pulse-dot" />
          {STEPS[currentIndex]?.label}
        </div>
      </div>

      {/* Track de Progreso */}
      <div className="progress-track-wrapper">
        <div className="track-bg">
          <div 
            className="track-fill" 
            style={{ 
              width: `${pct}%`, 
              transition: `width ${introMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)` 
            }} 
          />
        </div>

        {/* Hotspot de Vuelo */}
        {transitReached && (
          <div className="flight-hotspot" style={{ left: `${transitPct}%` }}>
            <div className="radar-ring" />
            <div className="flight-dot" title={`Vuelo: ${flightLabel}`} />
          </div>
        )}

        {/* Ícono Flotante de Caja */}
        <div 
          className="floating-box" 
          style={{ 
            left: `${pct}%`, 
            transition: `left ${introMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)` 
          }}
        >
          <ShipmentBoxIcon size={24} />
        </div>
      </div>

      {/* Grid de Pasos */}
      <div className="steps-grid">
        {STEPS.map((s, i) => {
          const isDone = i <= currentIndex;
          const isCurrent = i === currentIndex;
          const hit = hitMap.get(String(s.type).toUpperCase());
          const time = hit ? (hit.at || hit.created_at) : null;

          return (
            <div key={s.type} className={`step-card ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
              <div className="step-indicator">
                <div className="step-dot" />
                <span className="step-label">{s.label}</span>
              </div>
              <div className="step-time">{time ? fmtStepTime(time) : "---"}</div>
              {i === IN_TRANSIT_INDEX && flightNumber && isDone && (
                <div className="step-flight-tag">✈ {flightNumber}</div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .stepper-container {
          background: #ffffff;
          padding: 20px;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
        }

        .stepper-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .status-info h3 { margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; }
        .status-info p { margin: 4px 0 0; font-size: 12px; color: #64748b; }

        .current-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f0fdf4;
          color: #16a34a;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid #dcfce7;
        }

        .pulse-dot {
          width: 6px; height: 6px; background: #16a34a; border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .progress-track-wrapper {
          position: relative;
          height: 40px;
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }

        .track-bg {
          width: 100%; height: 8px; background: #f1f5f9; border-radius: 10px;
          overflow: hidden; border: 1px solid #e2e8f0;
        }

        .track-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #16a34a);
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.4);
        }

        .floating-box {
          position: absolute;
          transform: translate(-50%, -2px);
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
          z-index: 10;
        }

        .flight-hotspot {
          position: absolute;
          transform: translate(-50%, 0);
          z-index: 5;
        }

        .flight-dot {
          width: 12px; height: 12px; background: #0f172a; border-radius: 50%;
          border: 2px solid white;
        }

        .radar-ring {
          position: absolute; width: 24px; height: 24px; border: 1px solid #0f172a;
          border-radius: 50%; top: -6px; left: -6px; opacity: 0;
          animation: radar 2s infinite;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
        }

        .step-card {
          padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9;
          background: #f8fafc; transition: 0.3s; opacity: 0.6;
        }

        .step-card.is-done { opacity: 1; background: white; border-color: #e2e8f0; }
        .step-card.is-current { border-color: #16a34a; background: #f0fdf4; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

        .step-indicator { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
        .step-dot { width: 8px; height: 8px; background: #cbd5e1; border-radius: 50%; }
        .is-done .step-dot { background: #16a34a; }

        .step-label { font-size: 11px; font-weight: 800; color: #1e293b; white-space: nowrap; }
        .step-time { font-size: 10px; color: #94a3b8; font-weight: 600; }
        .step-flight-tag { margin-top: 6px; font-size: 10px; color: #16a34a; font-weight: 900; }

        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes radar { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }

        @media (max-width: 768px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
}