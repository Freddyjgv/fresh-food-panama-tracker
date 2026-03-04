import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout, notify } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Mail, Phone, Edit3, Loader2, Plus, FileText, 
  ExternalLink, Hash, User, FileUp, Save, Bell
} from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  // DICCIONARIO DE ESTADOS (Igual a /shipments/index)
  const statusConfig: any = {
    'CREATED': { label: 'Creado', class: 'st-created' },
    'PACKED': { label: 'Empacado', class: 'st-packed' },
    'IN_TRANSIT': { label: 'En Tránsito', class: 'st-transit' },
    'AT_DESTINATION': { label: 'En Destino', class: 'st-destination' },
    'DELIVERED': { label: 'Entregado', class: 'st-delivered' }
  };

  const getFlagCode = (portString: string) => {
    if (!portString) return null;
    const parts = portString.split(',');
    if (parts.length < 2) return null;
    const code = parts[parts.length - 1].trim().toLowerCase();
    return code.length === 2 ? code : null;
  };

  const fetchData = useCallback(async (clientId: string) => {
    try {
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
      const { data: shipsRes } = await supabase.from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false });

      const fullClient = { 
        ...clientData, 
        consignee_info: clientData?.consignee_info || { name: '', address: '' },
        notify_party: clientData?.notify_party || { name: '', address: '' }
      };

      setClient(fullClient);
      setEditData(fullClient);
      setShipments(shipsRes || []);
    } catch (e) {
      notify("Error de carga", "error");
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
      if (!file) return;
      const fileName = `${id}-${Date.now()}`;
      const { error: uploadError } = await supabase.storage.from('client-logos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('client-logos').getPublicUrl(fileName);
      await supabase.from('clients').update({ logo_url: publicUrl }).eq('id', id);
      setClient({ ...client, logo_url: publicUrl });
      notify("Logo actualizado", "success");
    } catch (err) { notify("Error al subir logo", "error"); } finally { setUploading(false); }
  };

  const saveClientData = async () => {
    try {
      const { error } = await supabase.from('clients').update(editData).eq('id', id);
      if (error) throw error;
      setClient({...editData});
      setIsEditing(false);
      notify("Cambios guardados", "success");
    } catch (err) { notify("Error al guardar", "error"); }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-green-600" size={40}/></div>;

  return (
    <AdminLayout title={client?.name}>
      <div className="view-container">
        
        {/* HEADER CON SEPARADORES */}
        <header className="header-pro">
          <div className="header-left">
            <div className="logo-holder">
              {client.logo_url ? <img src={client.logo_url} alt="Logo" /> : <Building2 size={24} className="opacity-20" />}
              <label className="upload-btn"><FileUp size={14} /><input type="file" hidden onChange={handleLogoUpload} /></label>
            </div>
            <div className="client-main-info">
              <div className="title-row">
                <h1>{client.name}</h1>
                <span className="status-badge">Activo</span>
              </div>
              <div className="sub-row">
                <span>Tax ID: <strong>{client.tax_id}</strong></span>
                <span className="geo-label"><MapPin size={12}/> {client.country}</span>
              </div>
            </div>
            <div className="header-stats">
              <div className="h-stat"><span>Embarques</span><strong>{shipments.length}</strong></div>
              <div className="v-divider"></div>
              <div className="h-stat"><span>Incoterm</span><strong>{client.default_incoterm}</strong></div>
              <div className="v-divider"></div>
              <div className="h-stat"><span>Último</span><strong>{shipments[0] ? new Date(shipments[0].created_at).toLocaleDateString() : '--'}</strong></div>
            </div>
          </div>
          <div className="header-actions">
            {!isEditing ? (
              <button className="btn-refine-white" onClick={() => setIsEditing(true)}><Edit3 size={14}/> Editar Perfil</button>
            ) : (
              <button className="btn-refine-green" onClick={saveClientData}><Save size={14}/> Guardar</button>
            )}
            <button className="btn-refine-green"><Plus size={14}/> Nuevo Embarque</button>
          </div>
        </header>

        <div className="main-grid">
          <main className="activity-section">
            <div className="card-pro">
              <div className="card-header"><h3>Actividad Reciente</h3></div>
              <div className="table-wrapper">
                <table className="table-refine">
                  <thead>
                    <tr>
                      <th className="txt-center">ID</th>
                      <th>Producto</th>
                      <th className="txt-center">Destino</th>
                      <th className="txt-center">Volumen</th>
                      <th className="txt-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map(s => {
                      const flag = getFlagCode(s.destination_port);
                      const status = statusConfig[s.status] || { label: s.status, class: '' };
                      return (
                        <tr key={s.id}>
                          <td className="txt-center"><span className="id-tag">{s.code}</span></td>
                          <td>
                            <div className="cell-prod">
                              <strong>{s.product_name}</strong>
                              <span>{s.product_variety}</span>
                            </div>
                          </td>
                          <td className="txt-center">
                            <div className="cell-center-col">
                               {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} className="flag-icon" />}
                               <span className="dest-text">{s.destination_port}</span>
                            </div>
                          </td>
                          <td className="txt-center">
                            <div className="cell-center-col">
                              <strong>{s.boxes || 0} CX</strong>
                              <span className="small-weight">{s.weight || 0} KG</span>
                            </div>
                          </td>
                          <td className="txt-center">
                            <span className={`pill-status-v2 ${status.class}`}>{status.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </main>

          <aside className="info-sidebar">
            <div className="card-pro mini">
              <h4 className="section-title">Contacto</h4>
              <div className="side-padding">
                <div className="contact-row">
                  <Mail size={14} className="text-green-600"/>
                  <div className="c-data">
                    <label>Email</label>
                    {isEditing ? <input value={editData.contact_email} onChange={e => setEditData({...editData, contact_email: e.target.value})} /> : <span>{client.contact_email}</span>}
                  </div>
                </div>
                <div className="contact-row mt-3">
                  <Hash size={14} className="text-green-600"/>
                  <div className="c-data">
                    <label>Tax ID (Editable)</label>
                    {isEditing ? <input value={editData.tax_id} onChange={e => setEditData({...editData, tax_id: e.target.value})} /> : <span>{client.tax_id}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-pro mini">
              <h4 className="section-title">Logística</h4>
              <div className="side-padding">
                <div className="log-item"><label>Facturación</label><p>{client.billing_address}</p></div>
                <div className="log-item mt-3"><label>Consignatario</label><p>{client.consignee_info?.name}</p></div>
                <div className="log-item mt-3"><label>Notificar a</label><p>{client.notify_party?.name}</p></div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .view-container { padding: 25px 40px; background: #fcfcfd; min-height: 100vh; font-family: 'Inter', sans-serif; }
        .header-pro { display: flex; justify-content: space-between; align-items: center; background: white; padding: 18px 24px; border-radius: 12px; border: 1px solid #eef0f2; margin-bottom: 25px; }
        .header-left { display: flex; align-items: center; gap: 20px; flex: 1; }
        .logo-holder { width: 60px; height: 60px; background: #f8fafc; border-radius: 10px; border: 1.5px dashed #e2e8f0; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; }
        .upload-btn { position: absolute; inset: 0; background: rgba(0,0,0,0.4); color: white; display: flex; align-items: center; justify-content: center; opacity: 0; cursor: pointer; transition: 0.2s; }
        .logo-holder:hover .upload-btn { opacity: 1; }
        
        .header-stats { display: flex; gap: 20px; margin-left: 30px; padding-left: 30px; border-left: 1px solid #f1f5f9; }
        .v-divider { width: 1px; height: 30px; background: #e2e8f0; }
        .h-stat { display: flex; flex-direction: column; align-items: center; }
        .h-stat span { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
        .h-stat strong { font-size: 14px; color: #1e293b; }

        .main-grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
        .card-pro { background: white; border-radius: 12px; border: 1px solid #eef0f2; }
        .card-header { padding: 15px 20px; border-bottom: 1px solid #f8fafc; }

        /* TABLA AJUSTES */
        .table-refine { width: 100%; border-collapse: collapse; }
        .table-refine th { padding: 12px; font-size: 10px; color: #94a3b8; text-transform: uppercase; background: #fafafa; }
        .table-refine td { padding: 14px 12px; border-bottom: 1px solid #f8fafc; font-size: 12px; }
        .txt-center { text-align: center; }
        .cell-center-col { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .id-tag { font-family: monospace; font-weight: 700; color: #166534; background: #f0fdf4; padding: 2px 6px; border-radius: 4px; }
        .small-weight { font-size: 10px; color: #94a3b8; }
        .flag-icon { width: 18px; border-radius: 2px; margin-bottom: 2px; }
        .dest-text { font-weight: 500; color: #475569; text-align: center; }

        /* ESTADOS TRADUCIDOS */
        .pill-status-v2 { font-size: 9px; font-weight: 800; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; }
        .st-packed { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .st-destination { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .st-created { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }

        /* SIDEBAR */
        .section-title { font-size: 10px; font-weight: 800; color: #1f7a3a; padding: 15px 20px; text-transform: uppercase; }
        .side-padding { padding: 0 20px 20px; }
        .contact-row { display: flex; gap: 10px; align-items: flex-start; }
        .c-data label { display: block; font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: 700; }
        .c-data input { border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 5px; width: 100%; font-size: 11px; }
        .log-item label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; }
        .log-item p { font-size: 11px; color: #475569; margin: 0; line-height: 1.4; }
        
        .btn-refine-white { padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; }
        .btn-refine-green { padding: 6px 12px; border-radius: 6px; border: none; background: #1f7a3a; color: white; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; }
        .mt-3 { margin-top: 12px; }
      `}</style>
    </AdminLayout>
  );
}