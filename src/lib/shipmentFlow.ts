// src/lib/shipmentFlow.ts

export const SHIPMENT_FLOW = [
  { type: "CREATED", label: "Creado" },
  { type: "PACKED", label: "En Empaque" },
  { type: "DOCS_READY", label: "Documentación lista" },
  { type: "AT_ORIGIN", label: "En Origen" },
  { type: "IN_TRANSIT", label: "En tránsito a destino" },
  { type: "AT_DESTINATION", label: "En Destino" },
] as const;

export type ShipmentStatus = (typeof SHIPMENT_FLOW)[number]["type"];

export const STATUS_SET = new Set<ShipmentStatus>(
  SHIPMENT_FLOW.map((s) => s.type) as ShipmentStatus[]
);

export function labelStatus(status?: string | null) {
  const s = String(status || "").toUpperCase();
  const hit = SHIPMENT_FLOW.find((x) => x.type === s);
  return hit ? hit.label : (status || "");
}

export function statusIndex(status?: string | null) {
  const s = String(status || "").toUpperCase();
  const idx = SHIPMENT_FLOW.findIndex((x) => x.type === s);
  return idx >= 0 ? idx : 0;
}

export function isAllowedStatus(status?: string | null) {
  const s = String(status || "").toUpperCase();
  return STATUS_SET.has(s as ShipmentStatus);
}
export function labelForType(type?: string | null) {
  return labelStatus(type);
}

export function statusBadgeClass(status?: string | null) {
  const s = String(status || "").toUpperCase();

  switch (s) {
    case "CREATED":
      return "ff-badge";
    case "PACKED":
      return "ff-badge ff-badge-blue";
    case "DOCS_READY":
      return "ff-badge ff-badge-purple";
    case "AT_ORIGIN":
      return "ff-badge ff-badge-orange";
    case "IN_TRANSIT":
      return "ff-badge ff-badge-orange";
    case "AT_DESTINATION":
      return "ff-badge ff-badge-green";
    default:
      return "ff-badge";
  }
}