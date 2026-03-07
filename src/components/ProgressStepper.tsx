import { useEffect, useMemo, useState } from "react";

// Estructura de tipos (Sin cambios)
type StepType = "CREATED" | "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION" | string;
type Milestone = { type: StepType; at?: string | null; created_at?: string | null; note?: string | null; };

const STEPS: { type: StepType; label: string }[] = [
  { type: "CREATED", label: "Reserva" },
  { type: "PACKED", label: "Empaque" },
  { type: "DOCS_READY", label: "Documentos" },
  { type: "AT_ORIGIN", label: "Origen" },
  { type: "IN_TRANSIT", label: "En Vuelo" },
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
      {/* HEADER: Limpio y Jerarquizado */}
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
          <a href={`https://www.google.com/search?q=flight+status+${flightNumber}`} target="_blank" className="ff-data-card ff-link">
            <span className="ff-data-label">VUELO</span>
            <span className="ff-data-value">✈ {flightNumber || "N/A"}</span>
            <div className="ff-hover-arrow">→</div>
          </a>
        </div>
      </div>

      {/* TRACK: El "Liquid Rail" */}
      <div className="ff-track-wrapper">
        <div className="ff-main-rail">
          <div className="ff-progress-fill" style={{ width: `${pct}%` }}>
            <div className="ff-liquid-glow"></div>
          </div>
        </div>
        
        {/* Marcadores de Hitos en la vía */}
        <div className="ff-dots-overlay">
          {STEPS.map((_, i) => (
            <div key={i} className={`ff-track-dot ${i <= currentIndex ? 'filled' : ''}`} style={{ left: `${(i / (STEPS.length - 1)) * 100}%` }} />
          ))}
        </div>

        {/* El Icono Flotante */}
        <div className="ff-floating-asset" style={{ left: `${pct}%` }}>
          <div className="ff-box-wrapper">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M12 2L3 7L12 12L21 7L12 2Z" fill="rgba(209, 119, 17, 0.1)"/>
              <path d="M3 7V17L12 22V12L3 7Z" />
              <path d="M21 7V17L12 22V12L21 7Z" />
            </svg>
          </div>
        </div>
      </div>

      {/* FOOTER: Flujo sin bordes (Minimalismo puro) */}
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
              {isActive && <div className="ff-active-bar" />}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .ff-apple-container {
          background: #ffffff;
          padding: 40px;
          border-radius: 32px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 20px 50px rgba(0,0,0,0.04);
          font-family: 'Inter', -apple-system, sans-serif;
        }

        /* Header & Labels */
        .ff-glass-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 60px; }
        .ff-live-indicator { 
          display: inline-flex; align-items: center; gap: 8px; 
          background: rgba(31, 122, 58, 0.08); padding: 6px 12px; 
          border-radius: 100px; color: #1f7a3a; font-size: 10px; font-weight: 700; letter-spacing: 1px;
          margin-bottom: 12px; position: relative;
        }
        .ff-pulse-core { width: 6px; height: 6px; background: #1f7a3a; border-radius: 50%; }
        .ff-pulse-ring { 
          position: absolute; left: 12px; width: 6px; height: 6px; 
          border: 2px solid #1f7a3a; border-radius: 50%; 
          animation: apple-pulse 2s infinite; 
        }

        .ff-main-title { font-size: 28px; font-weight: 600; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
        .ff-subtitle { color: #64748b; font-size: 15px; margin-top: 6px; }
        .ff-highlight { color: #1f7a3a; font-weight: 600; }

        /* Data Cards */
        .ff-data-group { display: flex; gap: 16px; }
        .ff-data-card { 
          background: #f8fafc; padding: 16px 24px; border-radius: 20px; 
          display: flex; flex-direction: column; min-width: 150px;
          border: 1px solid transparent; transition: all 0.3s ease;
        }
        .ff-data-card.ff-link { text-decoration: none; cursor: pointer; position: relative; overflow: hidden; }
        .ff-data-card.ff-link:hover { background: #fff; border-color: #d17711; transform: translateY(-4px); box-shadow: 0 10px 20px rgba(209,119,17,0.08); }
        .ff-data-label { font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 0.1em; margin-bottom: 4px; }
        .ff-data-value { font-size: 15px; font-weight: 600; color: #1e293b; }
        .ff-data-value.mono { font-family: 'SF Mono', monospace; }
        .ff-hover-arrow { position: absolute; right: 12px; bottom: 12px; color: #d17711; opacity: 0; transform: translateX(-10px); transition: 0.3s; }
        .ff-data-card:hover .ff-hover-arrow { opacity: 1; transform: translateX(0); }

        /* Track Section */
        .ff-track-wrapper { position: relative; margin: 40px 0 60px; height: 12px; display: flex; align-items: center; }
        .ff-main-rail { width: 100%; height: 6px; background: #f1f5f9; border-radius: 100px; overflow: hidden; }
        .ff-progress-fill { 
          height: 100%; background: #1f7a3a; border-radius: 100px; 
          transition: width ${introMs}ms cubic-bezier(0.16, 1, 0.3, 1); 
          position: relative;
        }
        .ff-liquid-glow {
          position: absolute; top: 0; right: 0; height: 100%; width: 50px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3));
        }

        .ff-track-dot { 
          position: absolute; width: 10px; height: 10px; background: #fff; 
          border: 2px solid #e2e8f0; border-radius: 50%; transform: translateX(-50%);
          z-index: 2; transition: 0.3s;
        }
        .ff-track-dot.filled { border-color: #1f7a3a; background: #1f7a3a; }

        .ff-floating-asset { 
          position: absolute; transform: translate(-50%, -32px); 
          transition: left ${introMs}ms cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 10;
        }
        .ff-box-wrapper { 
          color: #d17711; filter: drop-shadow(0 10px 15px rgba(209,119,17,0.2)); 
          animation: float-box 3s ease-in-out infinite;
        }

        /* Minimal Flow Footer */
        .ff-minimal-flow { display: flex; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 30px; }
        .ff-flow-node { display: flex; flex-direction: column; align-items: center; flex: 1; position: relative; opacity: 0.3; transition: 0.4s; }
        .ff-flow-node.done { opacity: 0.7; }
        .ff-flow-node.active { opacity: 1; transform: translateY(-2px); }
        .ff-node-label { font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
        .ff-node-time { font-size: 11px; color: #94a3b8; font-weight: 500; }
        .ff-active-bar { 
          position: absolute; bottom: -31px; width: 40px; height: 3px; 
          background: #1f7a3a; border-radius: 10px 10px 0 0; 
        }

        @keyframes apple-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(3); opacity: 0; } }
        @keyframes float-box { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

        @media (max-width: 800px) {
          .ff-glass-header { flex-direction: column; align-items: flex-start; gap: 30px; }
          .ff-data-group { width: 100%; }
          .ff-data-card { flex: 1; }
          .ff-minimal-flow { flex-wrap: wrap; gap: 20px; }
          .ff-flow-node { flex: 1 1 30%; }
        }
      `}</style>
    </div>
  );
}