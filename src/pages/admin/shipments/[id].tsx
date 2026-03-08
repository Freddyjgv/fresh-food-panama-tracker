import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { labelStatus } from "../../../lib/shipmentFlow";
import { Timeline as ModernTimeline } from "../../../components/Timeline";

import {
  FileText, Image as ImageIcon, Download, PackageCheck, Plane,
  MapPin, ClipboardCheck, ArrowLeft, Info, Package, PlusCircle,
  CheckCircle, Loader2, X, Hash, Globe, Scale, Droplets, Trash2,
  AlertCircle
} from "lucide-react";

// --- CONFIGURACIÓN DE TIPOS Y CONSTANTES ---
const DOC_TYPES = [
  { v: "invoice", l: "Factura" },
  { v: "packing_list", l: "Packing list" },
  { v: "awb", l: "AWB (guía aérea)" },
  { v: "phytosanitary", l: "Certificado fitosanitario" },
  { v: "eur1", l: "EUR1" },
  { v: "export_declaration", l: "Declaración de aduana" },
  { v: "non_recyclable_plastics", l: "Plásticos no reciclables" },
  { v: "sanitary_general_info", l: "Info. Sanitaria" },
  { v: "additives_declaration", l: "Declaración de aditivos" },
  { v: "quality_report", l: "Informe de calidad" },
] as const;

type MilestoneType = "PACKED" | "DOCS_READY" | "AT_ORIGIN" | "IN_TRANSIT" | "AT_DESTINATION";
const CHAIN: MilestoneType[] = ["PACKED", "DOCS_READY", "AT_ORIGIN", "IN_TRANSIT", "AT_DESTINATION"];

export default function AdminShipmentDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  
  // Popups/Toasts de estado
  const [popup, setPopup] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Formulario de configuración técnica
  const [editForm, setEditForm] = useState({
    product_name: "",
    product_variety: "",
    caliber: "",
    color: "",
    brix_grade: "",
    boxes: 0,
    pallets: 0,
    weight_kg: 0,
    destination: "",
    destination_port: "",
    incoterm: ""
  });

  const [note, setNote] = useState("");
  const [flight, setFlight] = useState("");
  const [awb, setAwb] = useState("");

  const showPopup = (msg: string, type: 'success' | 'error' = 'success') => {
    setPopup({ msg, type });
    setTimeout(() => setPopup(null), 4000);
  };

  const load = useCallback(async (sid: string) => {
    setLoading(true);
    const { data: res } = await supabase
      .from('shipments')
      .select('*, clients(name), shipment_documents(*), shipment_photos(*), status_history(*)')
      .eq('id', sid)
      .single();

    if (res) {
      setData(res);
      setEditForm({
        product_name: res.product_name || "",
        product_variety: res.product_variety || "",
        caliber: res.caliber || "",
        color: res.color || "",
        brix_grade: res.brix_grade || "",
        boxes: res.boxes || 0,
        pallets: res.pallets || 0,
        weight_kg: res.weight_kg || 0,
        destination: res.destination || "",
        destination_port: res.destination_port || "",
        incoterm: res.incoterm || ""
      });
      setFlight(res.flight_number || "");
      setAwb(res.awb || "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) {
        setAuthReady(true);
        if (id) load(id as string);
      }
    })();
  }, [id, load]);

  const saveConfig = async () => {
    setBusy(true);
    const { error } = await supabase.from('shipments').update(editForm).eq('id', id);
    setBusy(false);
    if (error) showPopup("Error al guardar configuración", "error");
    else showPopup("Datos del embarque actualizados ✅");
  };

  const handleUpdateStatus = async (type: MilestoneType) => {
    setBusy(true);
    // Llamada a RPC o API para actualizar hito
    const { error } = await supabase.rpc('update_shipment_status_v2', {
      p_shipment_id: id,
      p_new_status: type,
      p_note: note,
      p_flight: flight,
      p_awb: awb
    });
    
    setBusy(false);
    if (!error) {
      showPopup(`Hito ${labelStatus(type)} registrado correctamente`);
      setNote("");
      load(id as string);
    } else {
      showPopup("No se pudo actualizar el hito", "error");
    }
  };

  const uploadFile = async (kind: 'doc' | 'photo', file: File, docType?: string) => {
    setBusy(true);
    try {
      const path = `${id}/${Date.now()}_${file.name}`;
      const bucket = kind === 'doc' ? 'shipment-documents' : 'shipment-photos';
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file);
      if (upErr) throw upErr;

      const table = kind === 'doc' ? 'shipment_documents' : 'shipment_photos';
      const payload: any = { shipment_id: id, file_url: path, file_name: file.name };
      if (docType) payload.doc_type = docType;

      await supabase.from(table).insert(payload);
      showPopup(`${kind === 'doc' ? 'Documento' : 'Foto'} cargada con éxito`);
      load(id as string);
    } catch (e) { showPopup("Error en la subida", "error"); }
    finally { setBusy(false); }
  };

  const deleteFile = async (fileId: string, kind: 'doc' | 'photo') => {
    if (!confirm("¿Estás seguro de eliminar este archivo permanentemente?")) return;
    const table = kind === 'doc' ? 'shipment_documents' : 'shipment_photos';
    const { error } = await supabase.from(table).delete().eq('id', fileId);
    if (!error) {
      showPopup("Archivo eliminado 🗑️");
      load(id as string);
    }
  };

  if (!authReady || loading || !data) return (
    <div className="loader-screen">
      <Loader2 className="animate-spin" size={40} color="#16a34a" />
      <p>Cargando detalles del embarque...</p>
    </div>
  );

  return (
    <AdminLayout title={`Embarque ${data.code}`}>
      <div className="admin-container">
        
        {/* POPUP NOTIFICATION SYSTEM */}
        {popup && (
          <div className={`popup-msg ${popup.type}`}>
            {popup.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
            <span>{popup.msg}</span>
            <button onClick={() => setPopup(null)}><X size={14}/></button>
          </div>
        )}

        <div className="top-nav-actions">
          <Link href="/admin/shipments" className="btn-back">
            <ArrowLeft size={16}/> Volver al listado
          </Link>
          <div className="status-badge-wrapper">
             Estado Actual: <span className={`pill ${data.status.toLowerCase()}`}>{labelStatus(data.status)}</span>
          </div>
        </div>

        {/* 1. HEADER RESUMEN */}
        <header className="shipment-header-v3">
          <div className="header-info">
            <div className="id-tag"><Hash size={14}/> {data.code}</div>
            <h1>{data.product_name} <small>{data.product_variety}</small></h1>
            <p className="client-name">Cliente: <strong>{data.clients?.name}</strong></p>
          </div>
          <div className="header-stats">
            <div className="stat-card">
              <label><Package size={14}/> Cajas / Pallets</label>
              <span>{data.boxes || 0} / {data.pallets || 0}</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-card">
              <label><Scale size={14}/> Peso Neto</label>
              <span>{data.weight_kg || 0} kg</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-card">
              <label><Globe size={14}/> Destino</label>
              <span>{data.destination_port || data.destination}</span>
            </div>
          </div>
        </header>

        <div className="main-grid-layout">
          
          <div className="left-column">
            {/* BLOQUE DE CONFIGURACIÓN TÉCNICA */}
            <section className="glass-card">
              <div className="card-header">
                <div className="title-group"><Info size={18} /> <h3>Configuración técnica</h3></div>
                <button className="btn-save-config" onClick={saveConfig} disabled={busy}>
                  {busy ? <Loader2 size={14} className="spin"/> : 'Actualizar Datos'}
                </button>
              </div>
              <div className="config-form-grid">
                <div className="f-group"><label>Producto</label><input value={editForm.product_name} onChange={e => setEditForm({...editForm, product_name: e.target.value})} /></div>
                <div className="f-group"><label>Variedad</label><input value={editForm.product_variety} onChange={e => setEditForm({...editForm, product_variety: e.target.value})} /></div>
                <div className="f-group"><label>Calibre</label><input value={editForm.caliber} onChange={e => setEditForm({...editForm, caliber: e.target.value})} /></div>
                <div className="f-group"><label>Color</label><input value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} /></div>
                <div className="f-group"><label><Droplets size={12}/> Brix</label><input value={editForm.brix_grade} onChange={e => setEditForm({...editForm, brix_grade: e.target.value})} /></div>
                <div className="f-group"><label>Incoterm</label><input value={editForm.incoterm} onChange={e => setEditForm({...editForm, incoterm: e.target.value})} /></div>
                <div className="f-group"><label>Cajas</label><input type="number" value={editForm.boxes} onChange={e => setEditForm({...editForm, boxes: parseInt(e.target.value)})} /></div>
                <div className="f-group"><label>Pallets</label><input type="number" value={editForm.pallets} onChange={e => setEditForm({...editForm, pallets: parseInt(e.target.value)})} /></div>
                <div className="f-group"><label>Peso (kg)</label><input type="number" value={editForm.weight_kg} onChange={e => setEditForm({...editForm, weight_kg: parseFloat(e.target.value)})} /></div>
              </div>
            </section>

            {/* CONTROL DE HITOS */}
            <section className="glass-card spacing-top">
              <div className="card-header"><ClipboardCheck size={18} /> <h3>Control de Hitos de Progreso</h3></div>
              <div className="milestone-controls">
                <div className="inputs-row">
                  <div className="f-group full"><label>Observaciones/Nota para el Cliente</label><textarea placeholder="Detalla novedades para el cliente..." value={note} onChange={e => setNote(e.target.value)} /></div>
                  <div className="f-group"><label>N° de Vuelo</label><input value={flight} onChange={e => setFlight(e.target.value)} /></div>
                  <div className="f-group"><label>N° Guía AWB</label><input value={awb} onChange={e => setAwb(e.target.value)} /></div>
                </div>
                <div className="buttons-grid">
                  {CHAIN.map(step => (
                    <button key={step} className={`btn-step ${data.status === step ? 'active' : ''}`} onClick={() => handleUpdateStatus(step)} disabled={busy}>
                      {labelStatus(step)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* FOTOS */}
            <section className="glass-card spacing-top">
              <div className="card-header-between">
                <div className="title-group"><ImageIcon size={18}/> <h3>Evidencia Fotográfica</h3></div>
                <label className="btn-add-mini">
                  <PlusCircle size={14}/> Subir Foto
                  <input type="file" hidden accept="image/*" onChange={e => e.target.files?.[0] && uploadFile('photo', e.target.files[0])} />
                </label>
              </div>
              <div className="photo-grid">
                {data.shipment_photos?.map((p: any) => (
                  <div key={p.id} className="photo-card">
                    <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/shipment-photos/${p.file_url}`} alt="evidencia" />
                    <div className="photo-overlay">
                        <button className="del-btn" onClick={() => deleteFile(p.id, 'photo')}><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="right-column">
            {/* DOCUMENTACIÓN */}
            <section className="glass-card">
              <div className="card-header"><FileText size={18} /> <h3>Expediente Digital</h3></div>
              <div className="docs-list">
                {DOC_TYPES.map(type => {
                  const doc = data.shipment_documents?.find((d: any) => d.doc_type === type.v);
                  return (
                    <div key={type.v} className={`doc-row ${doc ? 'active' : 'empty'}`}>
                      <div className="doc-indicator" />
                      <div className="doc-info">
                        <span className="doc-name">{type.l}</span>
                        <span className="doc-status">{doc ? 'Completado' : 'Pendiente'}</span>
                      </div>
                      <div className="doc-actions">
                        {doc ? (
                          <div className="doc-actions-done">
                            <button onClick={() => deleteFile(doc.id, 'doc')} className="btn-icon-del"><X size={14}/></button>
                          </div>
                        ) : (
                          <label className="btn-icon-up">
                            <PlusCircle size={14}/>
                            <input type="file" hidden onChange={e => e.target.files?.[0] && uploadFile('doc', e.target.files[0], type.v)} />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* HISTORIAL / TIMELINE */}
            <section className="glass-card spacing-top">
              <div className="card-header"><CheckCircle size={18}/> <h3>Historial Cliente</h3></div>
              <div className="timeline-wrapper">
                <ModernTimeline milestones={data.status_history?.map((h: any) => ({
                  id: h.id, type: h.type, created_at: h.at || h.created_at, note: h.note
                }))} />
              </div>
            </section>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .admin-container { padding: 20px 40px; background: #f8fafc; min-height: 100vh; position: relative; font-family: 'Inter', sans-serif; }
        
        /* POPUP SYSTEM */
        .popup-msg {
          position: fixed; top: 20px; right: 20px; z-index: 9999;
          display: flex; align-items: center; gap: 12px;
          padding: 16px 20px; border-radius: 16px;
          color: white; font-weight: 700; font-size: 14px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
          animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .popup-msg.success { background: #16a34a; border-left: 5px solid #052e16; }
        .popup-msg.error { background: #dc2626; border-left: 5px solid #450a0a; }
        .popup-msg button { background: transparent; border: none; color: white; cursor: pointer; opacity: 0.7; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        /* LOADER */
        .loader-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; gap: 15px; color: #64748b; font-weight: 600; }

        /* HEADER */
        .shipment-header-v3 { background: #fff; padding: 25px 30px; border-radius: 24px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .id-tag { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 8px; font-family: monospace; font-weight: 800; font-size: 11px; display: flex; align-items: center; gap: 5px; }
        .header-info h1 { font-size: 24px; font-weight: 900; margin: 8px 0 2px; color: #0f172a; }
        .header-info h1 small { color: #64748b; font-weight: 400; font-size: 16px; margin-left: 8px; }
        .client-name { color: #64748b; font-size: 14px; margin: 0; }

        .header-stats { display: flex; gap: 24px; background: #f8fafc; padding: 12px 20px; border-radius: 16px; border: 1px solid #f1f5f9; }
        .stat-card { display: flex; flex-direction: column; }
        .stat-card label { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
        .stat-card span { font-size: 15px; font-weight: 800; color: #1e293b; }
        .stat-divider { width: 1px; height: 30px; background: #e2e8f0; }

        /* NAVIGATION */
        .top-nav-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .btn-back { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #64748b; text-decoration: none; transition: 0.2s; }
        .btn-back:hover { color: #0f172a; }

        /* LAYOUT & CARDS */
        .main-grid-layout { display: grid; grid-template-columns: 1fr 360px; gap: 24px; }
        .glass-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 22px; transition: box-shadow 0.3s; }
        .glass-card:hover { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.02); }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .card-header-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .title-group { display: flex; align-items: center; gap: 10px; }
        .card-header h3 { font-size: 13px; font-weight: 900; margin: 0; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px; }
        .spacing-top { margin-top: 24px; }

        /* CONFIG FORM */
        .config-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .f-group { display: flex; flex-direction: column; gap: 4px; }
        .f-group label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
        .f-group input, .f-group textarea { padding: 11px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; outline: none; transition: 0.2s; background: #fcfcfc; }
        .f-group input:focus { border-color: #16a34a; background: #fff; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.05); }
        .full { grid-column: span 3; }
        .btn-save-config { background: #0f172a; color: #fff; border: none; padding: 10px 18px; border-radius: 12px; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-save-config:hover { background: #1e293b; transform: translateY(-1px); }

        /* MILESTONE PROGRESS */
        .inputs-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; background: #f8fafc; padding: 18px; border-radius: 14px; margin-bottom: 15px; border: 1px solid #f1f5f9; }
        .buttons-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .btn-step { padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; font-size: 10px; font-weight: 800; cursor: pointer; transition: all 0.2s; color: #64748b; }
        .btn-step:hover { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }
        .btn-step.active { background: #16a34a; color: #fff; border-color: #16a34a; box-shadow: 0 8px 15px rgba(22, 163, 74, 0.25); }

        /* DOCS LIST */
        .docs-list { display: flex; flex-direction: column; gap: 8px; }
        .doc-row { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 14px; border: 1px solid transparent; transition: 0.2s; }
        .doc-row.active { background: #f0fdf4; border-color: #dcfce7; }
        .doc-row.empty { background: #f8fafc; border-color: #f1f5f9; }
        .doc-indicator { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0; }
        .active .doc-indicator { background: #16a34a; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1); }
        .doc-info { flex: 1; display: flex; flex-direction: column; }
        .doc-name { font-size: 12px; font-weight: 700; color: #1e293b; }
        .doc-status { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }

        /* DOC ACTIONS */
        .btn-icon-up { width: 32px; height: 32px; border-radius: 8px; background: #fff; border: 1px solid #e2e8f0; display: grid; place-items: center; cursor: pointer; color: #64748b; transition: 0.2s; }
        .btn-icon-up:hover { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
        .btn-icon-del { width: 32px; height: 32px; border-radius: 8px; background: #fff; border: 1px solid #fee2e2; display: grid; place-items: center; cursor: pointer; color: #ef4444; transition: 0.2s; }
        .btn-icon-del:hover { background: #fef2f2; transform: scale(1.1); }

        /* PHOTOS */
        .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
        .photo-card { position: relative; aspect-ratio: 1; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; background: #f8fafc; }
        .photo-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .photo-card:hover img { transform: scale(1.05); }
        .photo-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .photo-card:hover .photo-overlay { opacity: 1; }
        .btn-add-mini { font-size: 11px; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 6px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; border: 1px solid #dbeafe; transition: 0.2s; }
        .btn-add-mini:hover { background: #dbeafe; }

        /* STATUS PILLS */
        .pill { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
        .pill.packed { background: #fef3c7; color: #d97706; }
        .pill.docs_ready { background: #dcfce7; color: #16a34a; }
        .pill.in_transit { background: #dbeafe; color: #2563eb; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}