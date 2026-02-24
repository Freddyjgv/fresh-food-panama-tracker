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
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-PA");
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

function badgeClass(type: MilestoneType) {
  const t = String(type || "").toUpperCase();

  // Verde: completados / logrado
  if (t === "AT_DESTINATION") return "ff-badge ff-badge-green";

  // Naranja: movimiento
  if (t === "IN_TRANSIT") return "ff-badge ff-badge-orange";

  // Azul / verde suaves para etapas internas (ajusta si tus clases cambian)
  if (t === "AT_ORIGIN") return "ff-badge ff-badge-orange";
  if (t === "DOCS_READY") return "ff-badge ff-badge-purple";
  if (t === "PACKED") return "ff-badge ff-badge-blue";
  if (t === "CREATED") return "ff-badge";

  return "ff-badge";
}

export function Timeline({ milestones }: { milestones: Milestone[] }) {
  if (!milestones?.length) {
    return <p className="ff-sub">Aún no hay hitos registrados.</p>;
  }

  // Orden: más reciente primero
  const sorted = [...milestones].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {sorted.map((m, idx) => {
        const done = true;
        const title = labelFor(m.type);

        return (
          <div key={m.id ?? `${m.type}-${idx}`} className="ff-card ff-card-pad">
            <div className="ff-spread">
              <div className="ff-row" style={{ gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: done ? "rgba(39,118,50,.10)" : "rgba(0,0,0,.06)",
                    border: done
                      ? "1px solid rgba(39,118,50,.18)"
                      : "1px solid var(--ff-border)",
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {iconFor(m.type, done)}
                </div>

                <div>
                  <div style={{ fontWeight: 700 }}>{title}</div>
                  <div className="ff-sub" style={{ marginTop: 2 }}>
                    {fmt(m.created_at)}
                  </div>
                </div>
              </div>

              <span className={badgeClass(m.type)}>{title}</span>
            </div>

            {m.note ? (
              <div style={{ marginTop: 10, color: "var(--ff-black)" }}>
                {m.note}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}