import { useEffect, useMemo, useState } from "react";

// Lógica de tipos y utilidades (Mantenida intacta)
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

// Nuevo Icono de Caja Isométrica Técnica (Grande y líneas finas)
function TechnicalBoxIcon({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cara Superior */}
      <path d="M12 2L3 7L12 12L21 7L12 2Z" stroke="var(--ff-orange)" strokeWidth="1" fill="rgba(209, 119, 17, 0.05)"/>
      {/* Cara Izquierda */}
      <path d="M3 7V17L12 22V12L3 7Z" stroke="var(--ff-orange)" strokeWidth="1" />
      {/* Cara Derecha */}
      <path d="M21 7V17L12 22V12L21 7Z" stroke="var(--ff-orange)" strokeWidth="1" />
      {/* Detalle interno (cinta/cierre) */}
      <path d="M12 12V22" stroke="var(--ff-orange)" strokeWidth="0.5" strokeDasharray="2 2" />
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

export function ProgressStepper({ milestones, flightNumber, introMs = 1600 }: { milestones: Milestone[]; flightNumber?: string | null; introMs?: number; }) {
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
      <div className="ff-stepper-header">
        <div className="ff-brand-group">
          <div className="ff-live-pill">
            <span className="ff-ping"></span>
            SISTEMA DE MONITOREO EN VIVO
          </div>
          <h3 className="ff-title">Logística Internacional CIP/AIR</h3>
        </div>
        <div className="ff-current-status">
          <span className="ff-label">ESTADO ACTUAL</span>
          <span className="ff-value">{STEPS[currentIndex]?.label}</span>
        </div>
      </div>

      <div className="ff-track-area">
        {/* Riel de progreso técnico */}
        <div className="ff-rail">
          <div 
            className="ff-fill" 
            style={{ width: `${pct}%`, transition: `width ${introMs}ms cubic-bezier(0.22, 1, 0.36, 1)` }} 
          >
            {/* Efecto de escaneo láser */}
            <div className="ff-scan-line" />
          </div>
        </div>

        {/* Hotspot de Vuelo */}
        {transitReached && (
          <div className="ff-vuelo-radar" style={{ left: `${transitPct}%` }}>
            <div className="radar-waves" />
            <div className="radar-point" />
            <span className="radar-tag">VUELO</span>
          </div>
        )}

        {/* Icono de Caja Flotante (Grande y Técnico) */}
        <div 
          className="ff-box-float" 
          style={{ left: `${pct}%`, transition: `left ${introMs}ms cubic-bezier(0.22, 1, 0.36, 1)` }}
        >
          <div className="ff-box-bounce">
            <TechnicalBoxIcon size={42} />
          </div>
          <div className="ff-box-shadow" />
        </div>
      </div>

      {/* Grid de Pasos con Tipografía Limpia */}
      <div className="ff-steps-grid">
        {STEPS.map((s, i) => {
          const isDone = i <= currentIndex;
          const isActive = i === currentIndex;
          const hit = hitMap.get(String(s.type).toUpperCase());
          const time = hit ? (hit.at || hit.created_at) : null;

          return (
            <div key={s.type} className={`ff-step-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
              <div className="ff-marker-wrapper">
                <div className="ff-marker-dot" />
              </div>
              <div className="ff-step-content">
                <span className="ff-step-name">{s.label}</span>
                <span className="ff-step-time">{time ? fmtStepTime(time) : "PENDIENTE"}</span>
                {i === IN_TRANSIT_INDEX && flightNumber && isDone && (
                  <div className="ff-flight-tag">✈ {flightNumber}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .ff-stepper-card {
          background: var(--ff-surface);
          padding: 32px;
          border-radius: 20px;
          border: 1px solid var(--ff-border);
          box-shadow: var(--ff-shadow);
        }

        .ff-stepper-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 40px;
        }

        .ff-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ff-green);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
        }

        .ff-ping {
          width: 8px;
          height: 8px;
          background: var(--ff-green);
          border-radius: 50%;
          position: relative;
        }
        .ff-ping::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: var(--ff-green);
          animation: pro-ping 2s infinite;
        }

        .ff-title {
          margin: 0;
          font-size: 20px;
          font-weight: 500; /* Peso medio para look Pro */
          color: var(--ff-text);
          letter-spacing: -0.5px;
        }

        .ff-current-status { text-align: right; }
        .ff-label { font-size: 10px; color: var(--ff-muted); display: block; }
        .ff-value { font-size: 16px; font-weight: 600; color: var(--ff-green); }

        .ff-track-area {
          position: relative;
          height: 70px;
          display: flex;
          align-items: center;
          margin-bottom: 24px;
        }

        .ff-rail {
          width: 100%;
          height: 6px;
          background: var(--ff-bg);
          border-radius: 10px;
          overflow: hidden;
        }

        .ff-fill {
          height: 100%;
          background: var(--ff-green);
          position: relative;
          box-shadow: 0 0 15px rgba(31, 122, 58, 0.2);
        }

        .ff-scan-line {
          position: absolute;
          top: 0; right: 0; bottom: 0;
          width: 60px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: scan 3s infinite linear;
        }

        .ff-box-float {
          position: absolute;
          transform: translate(-50%, -20px);
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .ff-box-bounce { animation: pro-float 3s ease-in-out infinite; }
        .ff-box-shadow {
          width: 20px; height: 4px;
          background: rgba(0,0,0,0.1);
          border-radius: 50%;
          filter: blur(4px);
          margin-top: 4px;
        }

        .ff-vuelo-radar {
          position: absolute;
          transform: translateX(-50%);
          top: 45px;
          text-align: center;
        }
        .radar-point { width: 6px; height: 6px; background: var(--ff-orange); border-radius: 50%; }
        .radar-waves {
          position: absolute; width: 20px; height: 20px;
          border: 1px solid var(--ff-orange); border-radius: 50%;
          animation: pro-radar 2s infinite; top: -7px; left: -7px;
        }
        .radar-tag { font-size: 9px; color: var(--ff-muted); margin-top: 4px; display: block; }

        .ff-steps-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
        }

        .ff-step-item { opacity: 0.35; transition: 0.5s; }
        .ff-step-item.done { opacity: 0.8; }
        .ff-step-item.active {
          opacity: 1;
          transform: translateY(-4px);
        }

        .ff-marker-wrapper { margin-bottom: 12px; }
        .ff-marker-dot {
          width: 10px; height: 10px;
          background: #cbd5e1;
          border-radius: 50%;
          border: 2px solid var(--ff-surface);
          box-shadow: 0 0 0 1px #cbd5e1;
        }
        .done .ff-marker-dot { background: var(--ff-green); box-shadow: 0 0 0 1px var(--ff-green); }
        .active .ff-marker-dot {
          background: var(--ff-green);
          box-shadow: 0 0 0 2px var(--ff-green), 0 0 12px var(--ff-green);
        }

        .ff-step-name { font-size: 13px; font-weight: 500; color: var(--ff-text); display: block; }
        .ff-step-time { font-size: 11px; color: var(--ff-muted); }
        .ff-flight-tag {
          margin-top: 6px;
          font-size: 10px;
          color: var(--ff-orange);
          font-weight: 600;
        }

        @keyframes pro-ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes pro-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pro-radar { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes scan { 0% { right: 100%; } 100% { right: -20%; } }

        @media (max-width: 1024px) { .ff-steps-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </div>
  );
}