import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { AdminLayout, notify } from "../../../components/AdminLayout";
import { labelStatus } from "../../../lib/shipmentFlow";
import { 
  FileText, Image as ImageIcon, Download, PackageCheck, Plane, 
  MapPin, ClipboardCheck, ArrowLeft, CheckCircle, Loader2, 
  X, ChevronDown, Package, Globe, Hash, PlusCircle, Building2, Trash2
} from "lucide-react";
import Link from "next/link";

// 1. Tipos de Documentos (Los 10 obligatorios)
const DOC_TYPES = [
  { v: "invoice", l: "Factura Comercial", cat: "Comercial" },
  { v: "packing_list", l: "Packing List", cat: "Comercial" },
  { v: "awb", l: "AWB (Guía Aérea)", cat: "Transporte" },
  { v: "phytosanitary", l: "Certificado Fitosanitario", cat: "Sanitario" },
  { v: "eur1", l: "Certificado EUR1", cat: "Aduana" },
  { v: "export_declaration", l: "Declaración de Exportación", cat: "Aduana" },
  { v: "non_recyclable_plastics", l: "Plásticos no Reciclables", cat: "Sanitario" },
  { v: "sanitary_general_info", l: "Info. General Sanitaria", cat: "Sanitario" },
  { v: "additives_declaration", l: "Declaración de Aditivos", cat: "Sanitario" },
  { v: "quality_report", l: "Informe de Calidad", cat: "Calidad" },
] as const;

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
  
  // UI States
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<string | null>("Comercial");

  // Form States
  const [localNote, setLocalNote] = useState("");
  const [localFlight, setLocalFlight] = useState("");
  const [localAWB, setLocalAWB] = useState("");
  const [localWeight, setLocalWeight] = useState("");

  const loadData = useCallback(async (sid: string) => {
    setLoading(true);
    const { data: res } = await supabase.from('shipments').select('*, clients(name)').eq('id', sid).single();
    if (res) {
      setData(res);
      setLocalFlight(res.flight_number || "");
      setLocalAWB(res.awb || "");
      setLocalWeight(res.weight_kg || "");
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (id) loadData(id as string); }, [id, loadData]);

  // --- Lógica de Archivos (Docs y Fotos) ---
  const uploadFile = async (bucket: "doc" | "photo", file: File, docType?: string) => {
    setBusy(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${id}/${Math.random()}.${ext}`;
      const bucketName = bucket === "doc" ? "shipment-documents" : "shipment-photos";
      
      const { error: upErr } = await supabase.storage.from(bucketName).upload(path, file);
      if (upErr) throw upErr;

      const payload: any = { shipment_id: id, file_url: path, file_name: file.name };
      if (docType) payload.doc_type = docType;

      const { error: dbErr } = await supabase.from(bucket === "doc" ? 'shipment_documents' : 'shipment_photos').insert(payload);
      if (dbErr) throw dbErr;

      notify("Archivo cargado", "success");
      loadData(id as string);
    } catch (e: any) { notify(e.message, "error"); }
    finally { setBusy(false); }
  };

  const deleteFile = async (fileId: string, bucket: "doc" | "photo") => {
    if (!confirm("¿Eliminar archivo?")) return;
    const table = bucket === "doc" ? 'shipment_documents' : 'shipment_photos';
    await supabase.from(table).delete().eq('id', fileId);
    loadData(id as string);
  };

  const handleUpdateStatus = async (type: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('update_shipment_status', {
        p_shipment_id: id,
        p_new_status: type,
        p_note: localNote,
        p_flight: type === 'AT_ORIGIN' ? localFlight : data.flight_number,
        p_awb: type === 'AT_ORIGIN' ? localAWB : data.awb,
        p_weight: type === 'AT_ORIGIN' ? parseFloat(localWeight) : data.weight_kg
      });
      if (error) throw error;
      notify(`Hito ${type} actualizado`, "success");
      setActiveStepId(null);
      setLocalNote("");
      loadData(id as string);
    } catch (e: any) { notify(e.message, "error"); }
    finally { setBusy(false); }
  };

  if (loading || !data) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <AdminLayout title={`Embarque ${data.code}`}>
      <div className="page-container">
        
        {/* HEADER ESPECIFICACIONES (Punto 1 de tu solicitud) */}
        <header className="ff-header-premium-v2">
          <div className="header-main-stack">
            <span className="id-badge"><Hash size={12}/> {data.code}</span>
            <h1>{data.product_name} <small style={{opacity:0.6, fontSize:'0.7em'}}>{data.product_variety}</small></h1>
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
              <span>{data.incoterm || 'N/A'}</span>
            </div>
            <div className="spec-divider"/>
            <div className="spec-box">
              <label><MapPin size={12}/> Destino</label>
              <span>{data.destination_port || 'No def.'}</span>
            </div>
          </div>
        </header>

        <div className="admin-main-layout">
          {/* COLUMNA IZQUIERDA: HITOS (Punto 2 de tu solicitud) */}
          <div className="col-actions">
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="header-title-group">
                  <div className="ff-icon-circle"><ClipboardCheck size={18} /></div>
                  <h3>Control de Progreso y Notas</h3>
                </div>
              </div>

              <div className="steps-vertical-admin">
                {STEPS.map((step) => {
                  const historyItem = data.status_history?.find((h: any) => h.type === step.id);
                  const isCompleted = !!historyItem;
                  const isCurrent = activeStepId === step.id;

                  return (
                    <div key={step.id} className={`step-action-card ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}>
                      <div className="step-main-row">
                        <div className="step-icon-wrap">{step.icon}</div>
                        <div className="step-info">
                          <span className="step-label">{step.label}</span>
                          {isCompleted && <p className="step-note-preview">"{historyItem.note || 'Sin nota'}"</p>}
                        </div>
                        {!isCompleted && !isCurrent && (
                          <button className="btn-activate" onClick={() => setActiveStepId(step.id)}>Actualizar</button>
                        )}
                        {isCompleted && <CheckCircle size={18} className="txt-success" />}
                      </div>

                      {isCurrent && (
                        <div className="step-expansion-form">
                          <div className="field-group">
                            <label>Observación para el Cliente</label>
                            <textarea 
                              placeholder={`Escribe una actualización para el hito: ${step.label}...`}
                              value={localNote}
                              onChange={(e) => setLocalNote(e.target.value)}
                            />
                          </div>
                          
                          {step.isCritical && (
                            <div className="critical-fields-grid">
                              <div className="f-item">
                                <label>Vuelo / Barco</label>
                                <input value={localFlight} onChange={e => setLocalFlight(e.target.value)} placeholder="Ej: CM456" />
                              </div>
                              <div className="f-item">
                                <label>AWB / BL</label>
                                <input value={localAWB} onChange={e => setLocalAWB(e.target.value)} placeholder="000-0000" />
                              </div>
                              <div className="f-item">
                                <label>Peso Final (kg)</label>
                                <input type="number" value={localWeight} onChange={e => setLocalWeight(e.target.value)} />
                              </div>
                            </div>
                          )}

                          <div className="form-actions">
                            <button className="btn-cancel-mini" onClick={() => setActiveStepId(null)}>Cancelar</button>
                            <button className="btn-confirm-mini" onClick={() => handleUpdateStatus(step.id)} disabled={busy}>
                              {busy ? <Loader2 className="animate-spin" size={14}/> : 'Guardar y Notificar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* REGISTRO FOTOGRÁFICO (REINTEGRADO) */}
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="header-title-group">
                  <div className="ff-icon-circle"><ImageIcon size={18} /></div>
                  <h3>Registro Fotográfico</h3>
                </div>
                <label className="btn-add-photo">
                  <PlusCircle size={14} /> Subir Foto
                  <input type="file" hidden accept="image/*" onChange={e => e.target.files?.[0] && uploadFile("photo", e.target.files[0])} />
                </label>
              </div>
              <div className="photo-grid-admin">
                {data.shipment_photos?.map((p: any) => (
                  <div key={p.id} className="photo-item">
                    <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/shipment-photos/${p.file_url}`} alt="shipment" />
                    <button className="btn-del-photo" onClick={() => deleteFile(p.id, "photo")}><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* COLUMNA DERECHA: EXPEDIENTE DIGITAL (REINTEGRADO CON ACORDEÓN) */}
          <aside className="col-sidebar">
            <section className="pro-card mini-padding">
              <div className="side-header-compact">
                <FileText size={16} />
                <h4>Expediente Digital</h4>
              </div>
              
              <div className="ff-accordion-container">
                {["Comercial", "Transporte", "Sanitario", "Aduana", "Calidad"].map((cat) => {
                  const docsInCat = DOC_TYPES.filter(t => t.cat === cat);
                  const uploadedCount = docsInCat.filter(t => data.shipment_documents?.some((d: any) => d.doc_type === t.v)).length;
                  const isOpen = openCat === cat;

                  return (
                    <div key={cat} className={`ff-accordion-group ${isOpen ? 'is-open' : ''}`}>
                      <button className="ff-accordion-trigger" onClick={() => setOpenCat(isOpen ? null : cat)}>
                        <div className="trigger-left">
                          <ChevronDown size={14} className="acc-arrow" />
                          <span className="cat-name">{cat}</span>
                        </div>
                        <span className="cat-badge">{uploadedCount}/{docsInCat.length}</span>
                      </button>

                      {isOpen && (
                        <div className="ff-accordion-content">
                          {docsInCat.map((type) => {
                            const doc = data.shipment_documents?.find((d: any) => d.doc_type === type.v);
                            return (
                              <div key={type.v} className={`ff-doc-row-mini ${doc ? 'is-up' : ''}`}>
                                <div className="doc-info-left">
                                  <div className={`status-dot ${doc ? 'active' : ''}`} />
                                  <span className="doc-name-label">{type.l}</span>
                                </div>
                                <div className="doc-actions-right">
                                  {doc ? (
                                    <>
                                      <button className="btn-icon-s" onClick={() => window.open(`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/shipment-documents/${doc.file_url}`)}><Download size={12}/></button>
                                      <button className="btn-icon-s del" onClick={() => deleteFile(doc.id, "doc")}><X size={12}/></button>
                                    </>
                                  ) : (
                                    <label className="btn-icon-plus">
                                      <PlusCircle size={14} />
                                      <input type="file" hidden onChange={e => e.target.files?.[0] && uploadFile("doc", e.target.files[0], type.v)} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .page-container { padding: 20px 40px; background: #f8fafc; min-height: 100vh; font-family: 'Inter', sans-serif; }
        
        /* Header */
        .ff-header-premium-v2 { background: white; padding: 24px 30px; border-radius: 20px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .header-specs-grid { display: flex; gap: 24px; background: #f8fafc; padding: 12px 20px; border-radius: 12px; border: 1px solid #f1f5f9; }
        .spec-box label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: flex; align-items: center; gap: 4px; }
        .spec-box span { font-size: 14px; font-weight: 700; color: #1e293b; }
        .spec-divider { width: 1px; height: 25px; background: #e2e8f0; }

        /* Hitos */
        .steps-vertical-admin { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .step-action-card { border: 1px solid #f1f5f9; border-radius: 12px; padding: 14px; background: #fff; transition: 0.2s; }
        .step-action-card.active { border-color: #ea580c; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.1); }
        .step-action-card.completed { background: #f0fdf4; border-color: #dcfce7; }
        .step-main-row { display: flex; align-items: center; gap: 12px; }
        .step-icon-wrap { width: 36px; height: 36px; border-radius: 10px; background: #f8fafc; display: grid; place-items: center; color: #64748b; }
        .completed .step-icon-wrap { background: #16a34a; color: white; }
        .step-label { font-size: 13px; font-weight: 700; color: #1e293b; }
        .step-note-preview { font-size: 11px; color: #64748b; margin: 2px 0 0 0; font-style: italic; }

        /* Form Hitos */
        .step-expansion-form { margin-top: 15px; padding-top: 15px; border-top: 1px solid #f1f5f9; }
        .field-group textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; font-size: 12px; min-height: 60px; outline: none; }
        .critical-fields-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
        .f-item input { width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600; }
        .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
        .btn-confirm-mini { background: #ea580c; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; }

        /* Fotos */
        .photo-grid-admin { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; padding: 15px; }
        .photo-item { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
        .photo-item img { width: 100%; height: 100%; object-fit: cover; }
        .btn-del-photo { position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; padding: 4px; border-radius: 4px; cursor: pointer; }

        /* Acordeón Docs */
        .ff-accordion-container { display: flex; flex-direction: column; gap: 4px; }
        .ff-accordion-group { border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden; }
        .ff-accordion-trigger { width: 100%; display: flex; justify-content: space-between; padding: 10px 12px; background: white; border: none; cursor: pointer; }
        .cat-name { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; }
        .ff-doc-row-mini { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 2px; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #cbd5e1; margin-right: 8px; }
        .status-dot.active { background: #16a34a; }
        .doc-name-label { font-size: 11px; font-weight: 600; color: #475569; }

        .loader-full { height: 80vh; display: flex; align-items: center; justify-content: center; }
      `}</style>
    </AdminLayout>
  );
}