// src/components/ProgressStepper.tsx
import { useEffect, useMemo, useState } from "react";

type StepType =
  | "CREATED"
  | "PACKED"
  | "DOCS_READY"
  | "AT_ORIGIN"
  | "IN_TRANSIT"
  | "AT_DESTINATION"
  | string;

type Milestone = {
  type: StepType;
  at?: string | null; // cliente: "at"
  created_at?: string | null; // compat
  note?: string | null;
};

const STEPS: { type: StepType; label: string }[] = [
  { type: "CREATED", label: "Creado" },
  { type: "PACKED", label: "En Empaque" },
  { type: "DOCS_READY", label: "Documentación lista" },
  { type: "AT_ORIGIN", label: "En Origen" },
  { type: "IN_TRANSIT", label: "En tránsito a destino" },
  { type: "AT_DESTINATION", label: "En Destino" },
];

const IN_TRANSIT_INDEX = STEPS.findIndex((s) => String(s.type).toUpperCase() === "IN_TRANSIT");

function ShipmentBoxIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 7.5 12 5l5 2.5v6.8c0 .6-.3 1.2-.9 1.5L12 18l-4.1-2.2c-.6-.3-.9-.9-.9-1.5V7.5Z"
        fill="rgba(39,118,50,.95)"
      />
      <path
        d="M7 7.5 12 10l5-2.5"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      />
      <path d="M10.2 12.1h3.6" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.92" />
    </svg>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getMilestoneTime(m: Milestone) {
  return m.at ?? m.created_at ?? null;
}

function fmtStepTime(iso: string) {
  try {
    // compacto
    return new Date(iso).toLocaleString("es-PA", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function computeCurrentIndex(milestones: Milestone[]) {
  // hito más avanzado registrado; si no hay, asumimos CREATED
  const types = new Set((milestones ?? []).map((m) => String(m.type).toUpperCase()));
  let idx = 0;
  for (let i = 0; i < STEPS.length; i++) {
    if (types.has(String(STEPS[i].type).toUpperCase())) idx = i;
  }
  return idx;
}

export function ProgressStepper({
  milestones,
  /** Vuelo (llenado por admin al alcanzar IN_TRANSIT) */
  flightNumber,
  /** Ajusta la velocidad de la animación inicial (ms). Ej: 1800 = más lento */
  introMs = 1200,
}: {
  milestones: Milestone[];
  flightNumber?: string | null;
  introMs?: number;
}) {
  const currentIndex = useMemo(() => computeCurrentIndex(milestones ?? []), [milestones]);

  const targetPct = useMemo(() => {
    if (STEPS.length <= 1) return 0;
    return (currentIndex / (STEPS.length - 1)) * 100;
  }, [currentIndex]);

  const [mounted, setMounted] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    setMounted(true);
    setPct(0);
    const t = setTimeout(() => setPct(targetPct), 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setPct(targetPct);
  }, [mounted, targetPct]);

  const pctClamped = clamp(pct, 0, 100);

  const hitMap = useMemo(() => {
    const m = new Map<string, Milestone>();
    (milestones ?? []).forEach((x) => m.set(String(x.type).toUpperCase(), x));
    return m;
  }, [milestones]);

  const currentLabel = STEPS[currentIndex]?.label ?? "—";

  return (
    <div className="ff-card ff-card-pad" style={{ boxShadow: "none", background: "var(--ff-surface)", padding: 12 }}>
      {/* Header compacto */}
      <div className="ff-spread" style={{ gap: 10, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: 13, letterSpacing: "-.2px", lineHeight: "16px" }}>Progreso del embarque</div>
          <div className="ff-sub" style={{ marginTop: 3, fontSize: 11, lineHeight: "14px" }}>
            Estado actual: <b>{currentLabel}</b>
          </div>
        </div>

        <span className="ff-badge ff-badge-green" style={{ whiteSpace: "nowrap", fontSize: 11, padding: "6px 10px" }}>
          {currentLabel}
        </span>
      </div>

      <div className="ff-divider" style={{ margin: "10px 0" }} />

      {/* Barra + ícono */}
      <div style={{ position: "relative", marginTop: 6 }}>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(16,24,40,.10)",
            border: "1px solid var(--ff-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pctClamped}%`,
              borderRadius: 999,
              background: "rgba(39,118,50,.35)",
              transition: `width ${mounted ? introMs : 0}ms ease`,
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `calc(${pctClamped}% - 10px)`,
            transform: "translateY(-50%)",
            transition: `left ${mounted ? introMs : 0}ms ease`,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,.18))",
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          <ShipmentBoxIcon size={20} />
        </div>
      </div>

      {/* Etapas compactas */}
      <div className="stepsGrid">
        {STEPS.map((s, i) => {
          const isCurrent = i === currentIndex;
          const done = i <= currentIndex;

          const hit = hitMap.get(String(s.type).toUpperCase());
          const time = hit ? getMilestoneTime(hit) : null;

          // Vuelo debajo de IN_TRANSIT (solo si existe o si ya se alcanzó el hito)
          const showFlightLine = i === IN_TRANSIT_INDEX && (Boolean(flightNumber?.trim()) || currentIndex >= IN_TRANSIT_INDEX);
          const flightLine = flightNumber?.trim() ? `Vuelo: ${flightNumber.trim()}` : "Vuelo: —";

          return (
            <div
              key={String(s.type)}
              className="stepCard"
              style={{
                borderColor: isCurrent ? "rgba(39,118,50,.35)" : "var(--ff-border)",
                background: isCurrent ? "rgba(39,118,50,.06)" : "white",
                opacity: done ? 1 : 0.5,
              }}
            >
              <div className="stepTop">
                <span
                  className="dot"
                  style={{
                    background: done ? "rgba(39,118,50,.95)" : "rgba(16,24,40,.25)",
                  }}
                />
                <div className="stepLabel" style={{ fontWeight: isCurrent ? 950 : 900 }}>
                  {s.label}
                </div>
              </div>

              <div className="stepMeta">{time ? fmtStepTime(time) : "Pendiente"}</div>

              {showFlightLine ? <div className="stepFlight">{flightLine}</div> : null}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .stepsGrid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
        }

        .stepCard {
          border: 1px solid var(--ff-border);
          border-radius: 12px;
          padding: 10px;
          box-shadow: none;
          min-height: 66px; /* compacto */
        }

        .stepTop {
          display: flex;
          gap: 8px;
          align-items: center;
          min-width: 0;
        }

        .dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          flex: 0 0 auto;
        }

        .stepLabel {
          font-size: 11px;
          line-height: 13px;
          letter-spacing: -0.15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stepMeta {
          margin-top: 6px;
          color: var(--ff-muted);
          font-size: 10.5px;
          line-height: 13px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stepFlight {
          margin-top: 4px;
          font-size: 10.5px;
          line-height: 13px;
          font-weight: 950;
          color: var(--ff-green-dark);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Responsive: 3 y 2 columnas, sin ocupar media pantalla */
        @media (max-width: 980px) {
          .stepsGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .stepsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}