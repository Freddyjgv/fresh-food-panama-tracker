// src/pages/shipments/[id].tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

import { ClientLayout } from "../../components/ClientLayout";
import { ProgressStepper } from "../../components/ProgressStepper";
import { Timeline as ModernTimeline } from "../../components/Timeline";
import { labelStatus, statusBadgeClass } from "../../lib/shipmentFlow";

import { FileText, Image as ImageIcon, Download, Info, ArrowLeft, Package, MapPin, Shield, ThermometerSun } from "lucide-react";

/* =======================
   Types
======================= */
type Milestone = { type: string; at: string; note?: string | null };

type FileItem = {
  id: string;
  filename: string;
  created_at: string;
  doc_type?: string | null;
  url?: string | null;
};

type ShipmentDetail = {
  id: string;
  code: string;
  destination: string;
  destination_port?: string | null; // Soporte para ambos nombres de columna
  incoterm?: string | null;
  status: string;
  created_at: string;

  client_name?: string | null;
  clients?: { name?: string | null } | null;
  client?: { name?: string | null } | null;

  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;

  calibre?: string | null; // ✅ Unificado con el Drawer
  color?: string | null;
  brix_grade?: string | null; // ✅ Nuevo campo añadido

  boxes?: number | null;
  pallets?: number | null;
  weight?: number | null; // ✅ Unificado (antes weight_kg)
  flight_number?: string | null;
  awb?: string | null;

  milestones: Milestone[];
  documents: FileItem[];
  photos: FileItem[];
};

/* =======================
   Utils
======================= */
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PA", {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
  } catch {
    return String(iso);
  }
}

function clientNameLine(d: ShipmentDetail) {
  return String(d.client_name || d.clients?.name || d.client?.name || "").trim() || "—";
}

function productLine(d: ShipmentDetail) {
  const name = String(d.product_name || "").trim();
  const variety = String(d.product_variety || "").trim();
  return [name, variety].filter(Boolean).join(" · ") || "—";
}

export default function ShipmentDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(shipmentId: string) {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { window.location.href = "/login"; return; }

      // Nota: Asegúrate que tu función Netlify 'getShipment' devuelva brix_grade, calibre y weight
      const res = await fetch(`/.netlify/functions/getShipment?id=${encodeURIComponent(shipmentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await res.text() || "Error cargando embarque");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof id === "string") load(id);
  }, [id]);

  async function download(fileId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`/.netlify/functions/getDownloadUrl?fileId=${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  const normalizedMilestonesForTimeline = useMemo(() => {
    const list = data?.milestones ?? [];
    return list.map((m, idx) => ({
      id: `${m.type}-${idx}`,
      type: m.type,
      created_at: m.at,
      note: m.note,
    })).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [data?.milestones]);

  if (loading) return <ClientLayout title="Cargando..."><div className="ff-sub">Preparando información del trayecto...</div></ClientLayout>;

  return (
    <ClientLayout title="Expediente de Embarque" subtitle="Seguimiento en tiempo real y documentación">
      <div className="ff-spread" style={{ marginBottom: 16 }}>
        <Link href="/shipments" className="ff-btn ff-btn-ghost"><ArrowLeft size={16} /> Volver al listado</Link>
      </div>

      {data && (
        <div className="page">
          {/* HERO HEADER */}
          <div className="hero">
            <div className="heroLeft">
              <div className="codeRow">
                <div className="codeIcon"><Package size={20} color="var(--ff-green-dark)" /></div>
                <div style={{minWidth: 0}}>
                  <div className="heroLabel">Identificador Único</div>
                  <div className="code">{data.code}</div>
                  <div className="productLine">{productLine(data)}</div>
                </div>
              </div>
            </div>
            <div className="heroRight">
              <span className="pill green"><MapPin size={14}/> {data.destination_port || data.destination}</span>
              <span className="pill blue"><Shield size={14}/> {data.incoterm || 'FOB'}</span>
              <span className={statusBadgeClass(data.status)}>{labelStatus(data.status)}</span>
            </div>
          </div>

          {/* PROGRESS */}
          <div className="block">
            <ProgressStepper milestones={data.milestones ?? []} flightNumber={data.flight_number ?? null} />
          </div>

          <div className="grid2">
            {/* KPI PANEL - ACTUALIZADO CON BRIX Y CALIBRE CORRECTO */}
            <div className="ff-card ff-card-pad soft">
              <div className="sectionTitle"><Info size={16} /> Especificaciones de Carga</div>
              <div className="kpiRow">
                <div className="kpi"><div className="kpiLabel">Incoterm</div><div className="kpiValue text-blue">{data.incoterm || '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Cajas</div><div className="kpiValue">{data.boxes || '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Pallets</div><div className="kpiValue">{data.pallets || '—'}</div></div>
              </div>
              <div className="kpiRow" style={{ marginTop: 12 }}>
                <div className="kpi"><div className="kpiLabel">Peso Neto</div><div className="kpiValue">{data.weight ? `${data.weight} kg` : '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Calibre</div><div className="kpiValue">{data.calibre || '—'}</div></div>
                <div className="kpi"><div className="kpiLabel">Brix</div><div className="kpiValue text-green">{data.brix_grade || '—'}</div></div>
              </div>
              <div className="meta-footer">
                Embarque creado el {fmtDate(data.created_at)} para <strong>{clientNameLine(data)}</strong>
              </div>
            </div>

            {/* TIMELINE */}
            <div className="ff-card ff-card-pad">
              <div className="sectionTitle">Historial de Eventos</div>
              <ModernTimeline milestones={normalizedMilestonesForTimeline as any} />
            </div>
          </div>
          
          {/* ... resto del componente (Documentos y Fotos) se mantiene igual ... */}
        </div>
      )}
      
      {/* ... estilos permanecen igual ... */}
    </ClientLayout>
  );
}