import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, Phone, ArrowLeft, 
  Edit3, Loader2, Plus, FileText, 
  Globe, Package, Clock, CheckCircle2, User, Info, FileUp, Save, X, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import ShipmentDrawer from '../../../components/ShipmentDrawer';

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

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
        notify_party: clientData.notify_party || { name: '', address: '' },
        default_incoterm: clientData.default_incoterm || 'FOB'
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
        .from('client-logos').upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos').getPublicUrl(filePath);

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
      // ✅ IMPORTANTE: Filtramos solo los campos necesarios para evitar el error de "stack depth"
      // Si enviamos el ID o relaciones (shipping_addresses) en el update, fallará.
      const payload = {
        contact_email: editData.contact_email,
        phone: editData.phone,
        tax_id: editData.tax_id,
        billing_address: editData.billing_address,
        consignee_info: editData.consignee_info,
        notify_party: editData.notify_party,
        default_incoterm: editData.default_incoterm
      };

      const { error } = await supabase.from('clients')
        .update(payload)
        .eq('id', id);

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

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon blue"><Package size={20}/></div>
            <div className="kpi-data"><span>Embarques</span><strong>{shipments.length} Registrados</strong></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green"><ShieldCheck size={20}/></div>
            <div className="kpi-data"><span>Incoterm Base</span><strong>{client.default_incoterm || 'FOB'}</strong></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange"><Clock size={20}/></div>
            <div className="kpi-data"><span>Último Envío</span><strong>{shipments[0] ? new Date(shipments[0].created_at).toLocaleDateString() : 'N/A'}</strong></div>
          </div>
        </div>

        <div className="main-grid">
          <aside className="info-column">
            <section className="glass-card">
              <div className="card-label">Contacto y Fiscal</div>
              <div className="form-group">
                <label>Email Contacto</label>
                <input disabled={!isEditing} value={isEditing ? editData.contact_email : client.contact_email} 
                  onChange={e => setEditData({...editData, contact_email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input disabled={!isEditing} value={isEditing ? editData.phone : client.phone} 
                  onChange={e => setEditData({...editData, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Incoterm Predeterminado</label>
                <select disabled={!isEditing} value={isEditing ? editData.default_incoterm : client.default_incoterm}
                  onChange={e => setEditData({...editData, default_incoterm: e.target.value})}
                  className="select-custom"
                >
                  {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
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
              {shipments.length === 0 && <p className="empty-state">No hay embarques registrados para este cliente.</p>}
            </div>
          </main>

          <aside className="info-column">
             <div className="glass-card">
                <div className="card-label">Directorio de Entregas</div>
                
                <div className={`accordion ${openAcc === 'fact' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc('fact')}><Building2 size={14}/> Facturación</button>
                   <div className="acc-body">
                      {isEditing ? (
                        <textarea value={editData.billing_address} onChange={e => setEditData({...editData, billing_address: e.target.value})} placeholder="Dirección de cobro..." />
                      ) : ( <p>{client.billing_address || 'No definida'}</p> )}
                   </div>
                </div>

                <div className={`accordion ${openAcc === 'cons' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc('cons')}><User size={14}/> Consignatario</button>
                   <div className="acc-body">
                      {isEditing ? (
                        <div className="edit-substack">
                          <input value={editData.consignee_info?.name || ''} onChange={e => setEditData({...editData, consignee_info: {...editData.consignee_info, name: e.target.value}})} placeholder="Nombre..." />
                          <textarea value={editData.consignee_info?.address || ''} onChange={e => setEditData({...editData, consignee_info: {...editData.consignee_info, address: e.target.value}})} placeholder="Dirección..." />
                        </div>
                      ) : (
                        <div className="view-sub">
                          <strong>{client.consignee_info?.name || 'Falta Nombre'}</strong>
                          <p>{client.consignee_info?.address || 'Falta Dirección'}</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className={`accordion ${openAcc === 'notify' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc('notify')}><Info size={14}/> Notify Party</button>
                   <div className="acc-body">
                      {isEditing ? (
                        <div className="edit-substack">
                          <input value={editData.notify_party?.name || ''} onChange={e => setEditData({...editData, notify_party: {...editData.notify_party, name: e.target.value}})} placeholder="Empresa Notify..." />
                          <textarea value={editData.notify_party?.address || ''} onChange={e => setEditData({...editData, notify_party: {...editData.notify_party, address: e.target.value}})} placeholder="Dirección..." />
                        </div>
                      ) : (
                        <div className="view-sub">
                          <strong>{client.notify_party?.name || 'Fresh Food Admin'}</strong>
                          <p>{client.notify_party?.address || 'Panamá City'}</p>
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
        defaultIncoterm={client.default_incoterm} // <-- Pasado al drawer
      />

      <style jsx>{`
        /* ... Tus estilos anteriores se mantienen ... */
        .select-custom { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; font-size: 13px; }
        .mt-20 { margin-top: 20px; }
        .empty-state { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; }
        .doc-list { display: flex; flex-direction: column; gap: 10px; }
        .doc-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; padding: 8px; background: #f8fafc; border-radius: 6px; }
        .upload-btn { border: 1px dashed #cbd5e1; background: none; color: #64748b; padding: 8px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; margin-top: 10px; }
        /* ... Mismos estilos de tabla y KPIs que enviaste ... */
      `}</style>
    </AdminLayout>
  );
}