import { useEffect, useMemo, useState } from "react";

// Mantenemos tipos y lógica intacta
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
      <defs>
        <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <path d="M7 7.5 12 5l5 2.5v6.8c0 .6-.3 1.2-.9 1.5L12 18l-4.1-2.2c-.6-.3-.9-.9-.9-1.5V7.5Z" fill="url(#boxGrad)" />
      <path d="M7 7.5 12 10l5-2.5M10.2 12.1h3.6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
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

  return (
    <div className="stepper-main-container">
      {/* Header con más fuerza visual */}
      <div className="stepper-visual-header">
        <div className="status-brand">
          <div className="live-indicator">
            <span className="ping"></span>
            <span className="dot"></span>
            LIVE TRACKING
          </div>
          <h3>Logística Aérea Internacional</h3>
        </div>
        <div className="current-status-display">
          <span className="status-label">ESTADO ACTUAL</span>
          <span className="status-value">{STEPS[currentIndex]?.label}</span>
        </div>
      </div>

      {/* Track de Progreso de Alto Impacto */}
      <div className="interactive-track-area">
        <div className="track-rail">
          <div 
            className="track-progress-fill" 
            style={{ 
              width: `${pct}%`, 
              transition: `width ${introMs}ms cubic-bezier(0.22, 1, 0.36, 1)` 
            }} 
          >
            <div className="progress-glow" />
            <div className="scan-line" />
          </div>
        </div>

        {/* Hotspot de Vuelo Estilo Radar */}
        {transitReached && (
          <div className="vuelo-radar-hotspot" style={{ left: `${transitPct}%` }}>
            <div className="radar-waves" />
            <div className="radar-point" />
            <span className="radar-label">CIP/AIR</span>
          </div>
        )}

        {/* Ícono de Caja con sombra proyectada */}
        <div 
          className="shipment-box-float" 
          style={{ 
            left: `${pct}%`, 
            transition: `left ${introMs}ms cubic-bezier(0.22, 1, 0.36, 1)` 
          }}
        >
          <div className="box-shadow-fx" />
          <ShipmentBoxIcon size={28} />
        </div>
      </div>

      {/* Grid de Tarjetas con Elevación Dinámica */}
      <div className="milestones-grid">
        {STEPS.map((s, i) => {
          const isDone = i <= currentIndex;
          const isCurrent = i === currentIndex;
          const hit = hitMap.get(String(s.type).toUpperCase());
          const time = hit ? (hit.at || hit.created_at) : null;

          return (
            <div key={s.type} className={`milestone-card ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}>
              <div className="card-inner">
                <div className="card-top">
                  <div className="status-circle">
                    {isDone && <div className="inner-check" />}
                  </div>
                  <span className="milestone-name">{s.label}</span>
                </div>
                
                <div className="card-bottom">
                  <span className="time-stamp">{time ? fmtStepTime(time) : "PROXIMAMENTE"}</span>
                  {i === IN_TRANSIT_INDEX && flightNumber && isDone && (
                    <div className="flight-tag">
                      <span className="plane-icon">✈</span>
                      {flightNumber}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .stepper-main-container {
          background: #ffffff;
          padding: 24px;
          border-radius: 20px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
          border: 1px solid #f1f5f9;
        }

        /* HEADER IMPACTO */
        .stepper-visual-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 32px;
        }
        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 900;
          color: #16a34a;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }
        .live-indicator .dot { width: 6px; height: 6px; background: #16a34a; border-radius: 50%; }
        .live-indicator .ping {
          position: absolute; width: 6px; height: 6px; background: #16a34a; border-radius: 50%;
          animation: ping 1.5s infinite;
        }
        .status-brand h3 { margin: 0; font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
        .current-status-display { text-align: right; }
        .status-label { display: block; font-size: 10px; font-weight: 800; color: #94a3b8; }
        .status-value { font-size: 16px; font-weight: 900; color: #16a34a; }

        /* TRACKER ANIMADO */
        .interactive-track-area {
          position: relative;
          height: 60px;
          display: flex;
          align-items: center;
          margin-bottom: 24px;
        }
        .track-rail {
          width: 100%; height: 12px; background: #f1f5f9; border-radius: 20px;
          border: 1px solid #e2e8f0; overflow: hidden; position: relative;
        }
        .track-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #16a34a, #22c55e);
          border-radius: 20px;
          position: relative;
        }
        .progress-glow {
          position: absolute; top: 0; right: 0; bottom: 0; width: 20px;
          background: white; filter: blur(10px); opacity: 0.6;
        }
        .scan-line {
          position: absolute; top: 0; left: 0; bottom: 0; width: 40px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: scan 3s infinite linear;
        }

        .shipment-box-float {
          position: absolute; transform: translate(-50%, -15px);
          z-index: 20; filter: drop-shadow(0 10px 10px rgba(22, 163, 74, 0.2));
        }

        /* RADAR CIP/AIR */
        .vuelo-radar-hotspot { position: absolute; transform: translateX(-50%); top: 45px; display: flex; flex-direction: column; align-items: center; }
        .radar-point { width: 8px; height: 8px; background: #0f172a; border-radius: 50%; border: 2px solid white; }
        .radar-waves {
          position: absolute; width: 20px; height: 20px; border: 1px solid #0f172a; border-radius: 50%;
          animation: radar 2s infinite; top: -6px;
        }
        .radar-label { font-size: 9px; font-weight: 900; color: #0f172a; margin-top: 4px; }

        /* GRID Y TARJETAS */
        .milestones-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
        .milestone-card {
          background: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9;
          padding: 14px; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          opacity: 0.5;
        }
        .milestone-card.done { opacity: 1; border-color: #e2e8f0; background: white; }
        .milestone-card.active {
          opacity: 1; border-color: #16a34a; background: #f0fdf4;
          transform: translateY(-8px) scale(1.05);
          box-shadow: 0 20px 25px -5px rgba(22, 163, 74, 0.1);
        }

        .status-circle {
          width: 14px; height: 14px; border: 2px solid #cbd5e1; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .done .status-circle { border-color: #16a34a; background: #16a34a; }
        .inner-check { width: 6px; height: 6px; background: white; border-radius: 50%; }

        .card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .milestone-name { font-size: 12px; font-weight: 900; color: #1e293b; }
        .time-stamp { font-size: 10px; font-weight: 700; color: #94a3b8; }
        .flight-tag {
          margin-top: 8px; background: #0f172a; color: white;
          font-size: 10px; font-weight: 900; padding: 4px 8px; border-radius: 6px;
          display: flex; gap: 4px; align-items: center;
        }

        @keyframes ping { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes scan { 0% { left: -100%; } 100% { left: 100%; } }
        @keyframes radar { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }

        @media (max-width: 1024px) { .milestones-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px) { .milestones-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}