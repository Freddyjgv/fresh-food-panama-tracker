import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, Phone, ArrowLeft, 
  Edit3, Loader2, Plus, FileText, 
  Globe, Package, Clock, CheckCircle2, User, Info, FileUp, Save, X
} from 'lucide-react';
import Link from 'next/link';
import ShipmentDrawer from '../../../components/ShipmentDrawer';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Estados de Interfaz
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [openAcc, setOpenAcc] = useState<string | null>('entrega');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const fetchData = useCallback(async (clientId: string) => {
    setLoading(true);
    try {
      const { data: clientData, error: cErr } = await supabase
        .from('clients').select('*').eq('id', clientId).maybeSingle();

      if (cErr) throw cErr;

      const [addrsRes, shipsRes] = await Promise.all([
        supabase.from('shipping_addresses').select('*').eq('client_id', clientId),
        supabase.from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      ]);

      const fullClient = { 
        ...clientData, 
        shipping_addresses: addrsRes.data || [],
        consignee_info: clientData.consignee_info || { name: '', address: '' },
        notify_party: clientData.notify_party || { name: '', address: '' }
      };

      setClient(fullClient);
      setEditData(fullClient);
      setShipments(shipsRes.data || []);
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (router.isReady && id) fetchData(id as string);
  }, [id, router.isReady, fetchData]);

  const handleLogoUpload = async (e: any) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}-${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(filePath);

      await supabase.from('clients').update({ logo_url: publicUrl }).eq('id', id);
      setClient({ ...client, logo_url: publicUrl });
    } catch (err: any) {
      alert("Error subiendo logo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveClientData = async () => {
    try {
      const { error } = await supabase.from('clients').update({
        contact_email: editData.contact_email,
        phone: editData.phone,
        tax_id: editData.tax_id,
        billing_address: editData.billing_address,
        consignee_info: editData.consignee_info,
        notify_party: editData.notify_party
      }).eq('id', id);

      if (error) throw error;
      setClient(editData);
      setIsEditing(false);
    } catch (err: any) {
      alert("Error actualizando: " + err.message);
    }
  };

  if (loading) return (
    <AdminLayout title="Cargando...">
      <div className="loader-full"><Loader2 className="spin" size={40} /><p>Cargando expediente...</p></div>
    </AdminLayout>
  );

  return (
    <AdminLayout title={client?.name || "Detalle de Cliente"}>
      <div className="page-wrapper">
        
        {/* HEADER CON LOGO EDITABLE */}
        <header className="ops-header">
          <div className="header-left">
            <div className="avatar-wrapper">
              {client.logo_url ? (
                <img src={client.logo_url} alt="Logo" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder"><Building2 size={32}/></div>
              )}
              <label className="avatar-edit-overlay">
                <FileUp size={16}/>
                <input type="file" hidden onChange={handleLogoUpload} accept="image/*" />
              </label>
            </div>
            <div className="client-titles">
              <Link href="/admin/users" className="back-btn"><ArrowLeft size={16} /> Volver</Link>
              <h1>{client.name} <span className="id-pill">RUC: {client.tax_id || '---'}</span></h1>
            </div>
          </div>
          <div className="header-actions">
            {!isEditing ? (
              <>
                <button className="btn-secondary" onClick={() => setIsEditing(true)}><Edit3 size={16}/> Editar Perfil</button>
                <button className="btn-primary" onClick={() => setIsDrawerOpen(true)}><Plus size={16}/> Nuevo Embarque</button>
              </>
            ) : (
              <>
                <button className="btn-cancel" onClick={() => setIsEditing(false)}><X size={16}/> Cancelar</button>
                <button className="btn-save" onClick={saveClientData}><Save size={16}/> Guardar Cambios</button>
              </>
            )}
          </div>
        </header>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon blue"><Package size={20}/></div>
            <div className="kpi-data"><span>Embarques</span><strong>{shipments.length} Registrados</strong></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green"><CheckCircle2 size={20}/></div>
            <div className="kpi-data"><span>Crédito</span><strong>Aprobado</strong></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange"><Clock size={20}/></div>
            <div className="kpi-data"><span>Último Envío</span><strong>{shipments[0] ? new Date(shipments[0].created_at).toLocaleDateString() : 'N/A'}</strong></div>
          </div>
        </div>

        <div className="main-grid">
          {/* COLUMNA IZQUIERDA: INFO GENERAL */}
          <aside className="info-column">
            <section className="glass-card">
              <div className="card-label">Contacto y Fiscal</div>
              <div className="form-group">
                <label>Email</label>
                <input disabled={!isEditing} value={isEditing ? editData.contact_email : client.contact_email} 
                  onChange={e => setEditData({...editData, contact_email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input disabled={!isEditing} value={isEditing ? editData.phone : client.phone} 
                  onChange={e => setEditData({...editData, phone: e.target.value})} />
              </div>
            </section>

            <section className="glass-card mt-20">
              <div className="card-label">Documentos Legales</div>
              <div className="doc-list">
                <div className="doc-item"><FileText size={14}/> <span>Aviso de Operación</span></div>
                <div className="doc-item"><FileText size={14}/> <span>Pacto Social</span></div>
                <button className="upload-btn"><FileUp size={12}/> Subir Archivo</button>
              </div>
            </section>
          </aside>

          {/* COLUMNA CENTRAL: EMBARQUES */}
          <main className="table-column">
            <div className="table-container">
              <div className="table-header"><h3>Historial Logístico</h3></div>
              <table className="pro-table">
                <thead>
                  <tr><th>Código</th><th>Producto</th><th>Estado</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {shipments.map(s => (
                    <tr key={s.id}>
                      <td className="bold text-green">{s.code}</td>
                      <td>{s.product_name} <small className="text-muted">{s.product_variety}</small></td>
                      <td><span className="status-pill">{s.status}</span></td>
                      <td className="text-muted">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>

          {/* COLUMNA DERECHA: ACORDEONES LOGÍSTICOS */}
          <aside className="info-column">
             <div className="glass-card">
                <div className="card-label">Directorio de Entregas</div>
                
                {/* FACTURACIÓN */}
                <div className={`accordion ${openAcc === 'fact' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc('fact')}><Building2 size={14}/> Facturación</button>
                   <div className="acc-body">
                      {isEditing ? (
                        <textarea value={editData.billing_address} onChange={e => setEditData({...editData, billing_address: e.target.value})} placeholder="Dirección de cobro..." />
                      ) : ( <p>{client.billing_address || 'No definida'}</p> )}
                   </div>
                </div>

                {/* CONSIGNATARIO */}
                <div className={`accordion ${openAcc === 'cons' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc('cons')}><User size={14}/> Consignatario</button>
                   <div className="acc-body">
                      {isEditing ? (
                        <div className="edit-substack">
                          <input value={editData.consignee_info.name} onChange={e => setEditData({...editData, consignee_info: {...editData.consignee_info, name: e.target.value}})} placeholder="Nombre..." />
                          <textarea value={editData.consignee_info.address} onChange={e => setEditData({...editData, consignee_info: {...editData.consignee_info, address: e.target.value}})} placeholder="Dirección..." />
                        </div>
                      ) : (
                        <div className="view-sub">
                          <strong>{client.consignee_info.name || 'Falta Nombre'}</strong>
                          <p>{client.consignee_info.address || 'Falta Dirección'}</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* NOTIFY PARTY */}
                <div className={`accordion ${openAcc === 'notify' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc('notify')}><Info size={14}/> Notify Party</button>
                   <div className="acc-body">
                      {isEditing ? (
                        <div className="edit-substack">
                          <input value={editData.notify_party.name} onChange={e => setEditData({...editData, notify_party: {...editData.notify_party, name: e.target.value}})} placeholder="Empresa Notify..." />
                          <textarea value={editData.notify_party.address} onChange={e => setEditData({...editData, notify_party: {...editData.notify_party, address: e.target.value}})} placeholder="Dirección..." />
                        </div>
                      ) : (
                        <div className="view-sub">
                          <strong>{client.notify_party.name || 'Fresh Food Admin'}</strong>
                          <p>{client.notify_party.address || 'Panamá City'}</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </aside>
        </div>
      </div>

      <ShipmentDrawer 
        isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}
        clientId={id as string} clientName={client.name}
        onSuccess={() => fetchData(id as string)}
        shippingAddresses={client.shipping_addresses}
      />

      <style jsx>{`
        .page-wrapper { padding: 25px; max-width: 1440px; margin: 0 auto; background: #f8fafc; min-height: 100vh; }
        
        /* Avatar & Header */
        .ops-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .avatar-wrapper { position: relative; width: 85px; height: 85px; border-radius: 22px; background: white; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; }
        .avatar-img { width: 100%; height: 100%; object-fit: contain; padding: 10px; }
        .avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #cbd5e1; }
        .avatar-edit-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); color: white; display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; cursor: pointer; }
        .avatar-wrapper:hover .avatar-edit-overlay { opacity: 1; }
        
        .client-titles h1 { font-size: 26px; font-weight: 800; margin: 0; color: #0f172a; }
        .id-pill { font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 3px 10px; border-radius: 6px; margin-left: 10px; }
        .back-btn { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #94a3b8; text-decoration: none; margin-bottom: 5px; }

        .header-actions { display: flex; gap: 10px; }
        .btn-primary { background: #1f7a3a; color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-secondary { background: white; border: 1px solid #e2e8f0; padding: 12px 20px; border-radius: 12px; font-weight: 600; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-save { background: #1f7a3a; color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-cancel { background: #fff1f2; color: #e11d48; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }

        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 25px; }
        .kpi-card { background: white; padding: 18px; border-radius: 18px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; }
        .kpi-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .kpi-icon.blue { background: #eff6ff; color: #2563eb; }
        .kpi-icon.green { background: #f0fdf4; color: #16a34a; }
        .kpi-icon.orange { background: #fff7ed; color: #ea580c; }
        .kpi-data span { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; }
        .kpi-data strong { display: block; font-size: 15px; color: #0f172a; }

        .main-grid { display: grid; grid-template-columns: 300px 1fr 300px; gap: 20px; }
        .glass-card { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 22px; }
        .card-label { font-size: 11px; font-weight: 800; color: #1f7a3a; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 0.05em; }

        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 5px; }
        input, textarea { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: ${isEditing ? '#fff' : '#f8fafc'}; }
        textarea { min-height: 80px; resize: none; }

        .accordion { border-bottom: 1px solid #f1f5f9; }
        .accordion button { width: 100%; padding: 14px 0; border: none; background: none; display: flex; align-items: center; gap: 10px; font-weight: 700; color: #334155; cursor: pointer; text-align: left; font-size: 13px; }
        .acc-body { max-height: 0; overflow: hidden; transition: 0.3s; color: #64748b; font-size: 12px; }
        .accordion.active .acc-body { max-height: 250px; padding-bottom: 15px; }
        .edit-substack { display: flex; flex-direction: column; gap: 8px; }
        .view-sub strong { color: #0f172a; display: block; margin-bottom: 4px; }

        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { text-align: left; padding: 12px 15px; font-size: 11px; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
        .pro-table td { padding: 15px; border-bottom: 1px solid #f8fafc; font-size: 13px; }
        .status-pill { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 11px; }
        .bold { font-weight: 700; }
        .text-green { color: #1f7a3a; }
        .text-muted { color: #94a3b8; }
        
        .loader-full { height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; }
        .spin { animation: spin 1s linear infinite; color: #1f7a3a; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}