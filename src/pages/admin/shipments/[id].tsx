import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { AdminLayout } from "../../../components/AdminLayout";
import { labelStatus } from "../../../lib/shipmentFlow";
import { 
  FileText, Image as ImageIcon, Download, PackageCheck, Plane, 
  MapPin, ClipboardCheck, ArrowLeft, CheckCircle, Loader2, Building2, 
  X, ChevronDown, Package, Globe, Hash, Scale, Info
} from "lucide-react";
import Link from "next/link";

// Configuración de Hitos para el Admin
const STEPS = [
  { id: 'PACKED', label: 'Empacado', icon: <PackageCheck size={18}/> },
  { id: 'DOCS_READY', label: 'Documentos Listos', icon: <FileText size={18}/> },
  { id: 'AT_ORIGIN', label: 'Terminal de Carga', icon: <Building2 size={18}/>, isCritical: true },
  { id: 'IN_TRANSIT', label: 'En Tránsito', icon: <Plane size={18}/> },
  { id: 'AT_DESTINATION', label: 'En Destino', icon: <CheckCircle size={18}/> }
];

export default function AdminShipmentDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  // Estados locales para los inputs de los hitos
  const [localNote, setLocalNote] = useState("");
  const [localFlight, setLocalFlight] = useState("");
  const [localAWB, setLocalAWB] = useState("");
  const [localWeight, setLocalWeight] = useState("");

  const loadData = async (sid: string) => {
    setLoading(true);
    const { data: res } = await supabase.from('shipments').select('*, clients(name)').eq('id', sid).single();
    if (res) {
      setData(res);
      setLocalFlight(res.flight_number || "");
      setLocalAWB(res.awb || "");
      setLocalWeight(res.weight_kg || "");
    }
    setLoading(false);
  };

  useEffect(() => { if (id) loadData(id as string); }, [id]);

  const handleUpdateStatus = async (type: string) => {
    setBusy(true);
    // Aquí iría tu lógica de updateMilestone.js
    // Simulamos éxito:
    setActiveStepId(null);
    setLocalNote("");
    setBusy(false);
    loadData(id as string);
  };

  if (loading || !data) return <div className="loader-full"><Loader2 className="animate-spin" /></div>;

  return (
    <AdminLayout title={`Embarque ${data.code}`}>
      <div className="page-container">
        
        {/* NAV & ACTIONS */}
        <div className="top-nav-row">
          <Link href="/admin/shipments" className="ff-btn-back">
            <ArrowLeft size={14}/> Volver
          </Link>
          <div className="status-indicator">
            Estado Cliente: <span className={`pill-status ${data.status.toLowerCase()}`}>{labelStatus(data.status)}</span>
          </div>
        </div>

        {/* 1. HEADER OPTIMIZADO */}
        <header className="ff-header-premium-v2">
          <div className="header-main-stack">
            <span className="id-badge"><Hash size={12}/> {data.code}</span>
            <h1>{data.product_name} <small>{data.product_variety}</small></h1>
            <p className="client-sub">Cliente: <strong>{data.clients?.name}</strong></p>
          </div>

          <div className="header-specs-grid">
            <div className="spec-box">
              <label><Package size={12}/> Carga</label>
              <span>{data.boxes || 0} bxs / {data.weight_kg || 0}kg</span>
            </div>
            <div className="spec-divider"/>
            <div className="spec-box">
              <label><Globe size={12}/> Incoterm</label>
              <span>{data.incoterm || 'FOB'}</span>
            </div>
            <div className="spec-divider"/>
            <div className="spec-box">
              <label><MapPin size={12}/> Destino</label>
              <span>{data.destination_port || data.destination}</span>
            </div>
          </div>
        </header>

        <div className="admin-main-layout">
          {/* COLUMNA IZQUIERDA: CONTROL DE HITOS */}
          <div className="col-actions">
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="header-title-group">
                  <div className="ff-icon-circle"><ClipboardCheck size={18} /></div>
                  <h3>Control de Progreso</h3>
                </div>
              </div>

              <div className="steps-vertical-admin">
                {STEPS.map((step) => {
                  const isCompleted = data.status_history?.some((h: any) => h.type === step.id);
                  const isCurrent = activeStepId === step.id;

                  return (
                    <div key={step.id} className={`step-action-card ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}>
                      <div className="step-main-row">
                        <div className="step-icon-wrap">{step.icon}</div>
                        <div className="step-info">
                          <span className="step-label">{step.label}</span>
                          {isCompleted && <span className="done-tag">Completado</span>}
                        </div>
                        {!isCompleted && !isCurrent && (
                          <button className="btn-activate" onClick={() => setActiveStepId(step.id)}>Activar</button>
                        )}
                      </div>

                      {isCurrent && (
                        <div className="step-expansion-form">
                          <div className="field-group">
                            <label>Observaciones para el cliente (Hito: {step.label})</label>
                            <textarea 
                              placeholder="Ej: La carga ya está paletizada..."
                              value={localNote}
                              onChange={(e) => setLocalNote(e.target.value)}
                            />
                          </div>
                          
                          {step.isCritical && (
                            <div className="critical-fields-grid">
                              <div className="f-item">
                                <label>Vuelo</label>
                                <input value={localFlight} onChange={e => setLocalFlight(e.target.value)} />
                              </div>
                              <div className="f-item">
                                <label>AWB</label>
                                <input value={localAWB} onChange={e => setLocalAWB(e.target.value)} />
                              </div>
                              <div className="f-item">
                                <label>Peso Final (kg)</label>
                                <input type="number" value={localWeight} onChange={e => setLocalWeight(e.target.value)} />
                              </div>
                            </div>
                          )}

                          <div className="form-actions">
                            <button className="btn-cancel-mini" onClick={() => setActiveStepId(null)}>Cancelar</button>
                            <button className="btn-confirm-mini" onClick={() => handleUpdateStatus(step.id)}>
                              {busy ? <Loader2 className="animate-spin" size={14}/> : 'Confirmar Hito'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* COLUMNA DERECHA: EXPEDIENTE Y FOTOS (YA OPTIMIZADOS) */}
          <aside className="col-sidebar">
             {/* Aquí va tu componente de Acordeón de 10 documentos que hicimos antes */}
             <div className="pro-card mini-padding">
                <h4 className="side-label">Expediente Digital</h4>
                {/* ... (código del acordeón aquí) */}
             </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .page-container { padding: 20px 40px; background: #f8fafc; min-height: 100vh; }
        .top-nav-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        
        /* HEADER V2 */
        .ff-header-premium-v2 { 
          background: white; padding: 30px; border-radius: 24px; border: 1px solid #e2e8f0;
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
        }
        .id-badge { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 8px; font-family: monospace; font-weight: 800; font-size: 12px; }
        .header-main-stack h1 { font-size: 24px; font-weight: 900; margin: 8px 0 4px 0; color: #0f172a; }
        .client-sub { color: #64748b; font-size: 14px; margin: 0; }

        .header-specs-grid { display: flex; align-items: center; gap: 24px; background: #f8fafc; padding: 15px 25px; border-radius: 16px; border: 1px solid #f1f5f9; }
        .spec-box { display: flex; flex-direction: column; gap: 4px; }
        .spec-box label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: flex; align-items: center; gap: 5px; }
        .spec-box span { font-size: 15px; font-weight: 700; color: #1e293b; }
        .spec-divider { width: 1px; height: 30px; background: #e2e8f0; }

        /* LAYOUT */
        .admin-main-layout { display: grid; grid-template-columns: 1fr 400px; gap: 24px; }

        /* STEPS ACTIONS */
        .steps-vertical-admin { display: flex; flex-direction: column; gap: 12px; padding: 20px; }
        .step-action-card { border: 1px solid #f1f5f9; border-radius: 16px; padding: 16px; transition: 0.2s; background: #fbfcfd; }
        .step-action-card.active { border-color: #ea580c; background: white; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        .step-action-card.completed { border-color: #dcfce7; background: #f0fdf4; opacity: 0.8; }
        
        .step-main-row { display: flex; align-items: center; gap: 16px; }
        .step-icon-wrap { width: 40px; height: 40px; border-radius: 12px; background: white; border: 1px solid #e2e8f0; display: grid; place-items: center; color: #64748b; }
        .active .step-icon-wrap { background: #ea580c; color: white; border-color: #ea580c; }
        .completed .step-icon-wrap { background: #16a34a; color: white; border-color: #16a34a; }

        .step-info { flex: 1; display: flex; flex-direction: column; }
        .step-label { font-size: 14px; font-weight: 800; color: #1e293b; }
        .done-tag { font-size: 10px; color: #16a34a; font-weight: 700; text-transform: uppercase; }

        .btn-activate { background: #1e293b; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
        
        /* FORMULARIO EXPANDIBLE */
        .step-expansion-form { margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9; }
        .field-group label { font-size: 11px; font-weight: 800; color: #64748b; margin-bottom: 8px; display: block; }
        .step-expansion-form textarea { width: 100%; min-height: 80px; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; outline: none; }
        
        .critical-fields-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
        .f-item label { font-size: 10px; font-weight: 800; color: #94a3b8; margin-bottom: 4px; display: block; }
        .f-item input { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; }

        .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px; }
        .btn-confirm-mini { background: #ea580c; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .btn-cancel-mini { background: #f1f5f9; color: #475569; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
      `}</style>
    </AdminLayout>
  );
}