import { useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  FileText,
  PackageCheck,
  Warehouse,
  Truck,
  MapPin,
} from "lucide-react";

type MilestoneType =
  | "CREATED"
  | "PACKED"
  | "DOCS_READY"
  | "AT_ORIGIN"
  | "IN_TRANSIT"
  | "AT_DESTINATION"
  | string;

type Milestone = {
  id?: string;
  type: MilestoneType;
  note?: string | null;
  created_at?: string | null;
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // compacto
  return d.toLocaleString("es-PA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelFor(type: MilestoneType) {
  const t = String(type || "").toUpperCase();

  switch (t) {
    case "CREATED":
      return "Creado";
    case "PACKED":
      return "En Empaque";
    case "DOCS_READY":
      return "Documentación lista";
    case "AT_ORIGIN":
      return "En Origen";
    case "IN_TRANSIT":
      return "En tránsito a destino";
    case "AT_DESTINATION":
      return "En Destino";
    default:
      return t.replaceAll("_", " ");
  }
}

function iconFor(type: MilestoneType, done: boolean) {
  const t = String(type || "").toUpperCase();
  const color = done ? "var(--ff-green-dark)" : "rgba(0,0,0,.35)";
  const size = 18;

  if (t === "PACKED") return <PackageCheck size={size} color={color} />;
  if (t === "DOCS_READY") return <FileText size={size} color={color} />;
  if (t === "AT_ORIGIN") return <Warehouse size={size} color={color} />;
  if (t === "IN_TRANSIT") return <Truck size={size} color={color} />;
  if (t === "AT_DESTINATION") return <MapPin size={size} color={color} />;

  return done ? (
    <CheckCircle2 size={size} color={color} />
  ) : (
    <Circle size={size} color={color} />
  );
}

function statusTone(type: MilestoneType) {
  const t = String(type || "").toUpperCase();
  if (t === "AT_DESTINATION") return "green";
  if (t === "IN_TRANSIT") return "orange";
  if (t === "AT_ORIGIN") return "orange";
  if (t === "DOCS_READY") return "purple";
  if (t === "PACKED") return "blue";
  return "neutral";
}

export function Timeline({ milestones }: { milestones: Milestone[] }) {
  if (!milestones?.length) {
    return <p className="ff-sub">Aún no hay hitos registrados.</p>;
  }

  // ✅ Orden: más reciente primero
  const sorted = useMemo(() => {
    return [...milestones].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
  }, [milestones]);

  const lastKey = sorted[0]?.id ?? `${sorted[0]?.type}-0`;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sorted.map((m, idx) => {
        const done = true;
        const title = labelFor(m.type);
        const key = m.id ?? `${m.type}-${idx}`;
        const isLast = key === lastKey;

        const tone = statusTone(m.type);
        const bg =
          tone === "green"
            ? "rgba(39,118,50,.06)"
            : tone === "orange"
            ? "rgba(209,119,17,.06)"
            : tone === "purple"
            ? "rgba(126,34,206,.05)"
            : tone === "blue"
            ? "rgba(37,99,235,.05)"
            : "transparent";

        const bd =
          tone === "green"
            ? "rgba(39,118,50,.18)"
            : tone === "orange"
            ? "rgba(209,119,17,.18)"
            : tone === "purple"
            ? "rgba(126,34,206,.16)"
            : tone === "blue"
            ? "rgba(37,99,235,.16)"
            : "var(--ff-border)";

        return (
          <div
            key={key}
            className="ff-card ff-card-pad"
            style={{
              padding: 10,
              boxShadow: "none",
              borderColor: isLast ? bd : "var(--ff-border)",
              background: isLast ? bg : "var(--ff-surface)",
            }}
          >
            <div className="row">
              <div className="left">
                <div
                  className="iconBox"
                  style={{
                    background: done ? "rgba(39,118,50,.10)" : "rgba(0,0,0,.06)",
                    border: done
                      ? "1px solid rgba(39,118,50,.18)"
                      : "1px solid var(--ff-border)",
                  }}
                >
                  {iconFor(m.type, done)}
                </div>

                <div className="txt">
                  <div className="title">{title}</div>
                  <div className="meta">{fmt(m.created_at)}</div>
                </div>
              </div>

              {/* ✅ Badge SOLO para “Último evento” */}
              {isLast ? <span className="lastBadge">Último evento</span> : null}
            </div>

            {m.note ? <div className="note">{m.note}</div> : null}

            <style jsx>{`
              .row {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 10px;
              }
              .left {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                min-width: 0;
              }
              .iconBox {
                width: 34px;
                height: 34px;
                border-radius: 12px;
                display: grid;
                place-items: center;
                flex: 0 0 auto;
              }
              .txt {
                min-width: 0;
              }
              .title {
                font-weight: 900;
                font-size: 13px;
                line-height: 16px;
                letter-spacing: -0.15px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .meta {
                margin-top: 3px;
                font-size: 11px;
                font-weight: 800;
                color: var(--ff-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .lastBadge {
                font-size: 11px;
                font-weight: 900;
                border: 1px solid rgba(39, 118, 50, 0.22);
                background: rgba(39, 118, 50, 0.1);
                color: var(--ff-green-dark);
                padding: 5px 10px;
                border-radius: 999px;
                white-space: nowrap;
                flex: 0 0 auto;
              }
              .note {
                margin-top: 8px;
                font-size: 12px;
                line-height: 16px;
                color: var(--ff-black);
                opacity: 0.92;
                white-space: pre-wrap;
              }
            `}</style>
          </div>
        );
      })}
    </div>
  );
}