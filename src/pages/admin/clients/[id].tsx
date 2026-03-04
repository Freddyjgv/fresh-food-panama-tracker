import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout, notify } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, Phone, ArrowLeft, 
  Edit3, Loader2, Plus, FileText, 
  Globe, Package, Clock, Shield, ExternalLink, Hash, Copy, User, Info, FileUp, Save
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const fetchData = useCallback(async (clientId: string) => {
    try {
      const { data: clientData, error: cErr } = await supabase
        .from('clients').select('*').eq('id', clientId).maybeSingle();
      if (cErr) throw cErr;

      const { data: shipsRes, error: sErr } = await supabase
        .from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
      if (sErr) throw sErr;

      const fullClient = { 
        ...clientData, 
        consignee_info: clientData.consignee_info || { name: '', address: '' },
        notify_party: clientData.notify_party || { name: '', address: '' },
        default_incoterm: clientData.default_incoterm || 'FOB'
      };

      setClient(fullClient);
      setEditData(fullClient);
      setShipments(shipsRes || []);
    } catch (e: any) {
      notify("Error cargando expediente", "error");
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
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('client-logos').upload(filePath, file);
      if (uploadError) throw uploadError;

      // Solución al problema de visualización: Forzamos la URL pública
      const { data: { publicUrl } } = supabase.storage.from('client-logos').getPublicUrl(filePath);
      
      const { error: updateError } = await supabase.from('clients').update({ logo_url: publicUrl }).eq('id', id);
      if (updateError) throw updateError;
      
      setClient({ ...client, logo_url: publicUrl });
      notify("Logo actualizado", "success");
    } catch (err: any) {
      notify("Error al procesar imagen", "error");
    } finally {
      setUploading(false);
    }
  };

  const saveClientData = async () => {
    try {
      const { error } = await supabase.from('clients').update({
        contact_email: editData.contact_email,
        phone: editData.phone,
        tax_id: editData.tax_id, // Ahora editable
        billing_address: editData.billing_address,
        consignee_info: editData.consignee_info,
        notify_party: editData.notify_party,
        default_incoterm: editData.default_incoterm
      }).eq('id', id);
      
      if (error) throw error;
      setClient({...editData});
      setIsEditing(false);
      notify("Expediente actualizado", "success");
    } catch (err: any) {
      notify("Error al guardar cambios", "error");
    }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-green-600" size={40}/></div>;

  return (
    <AdminLayout title={client?.name}>
      <div className="view-container">
        
        {/* HEADER REFINADO */}
        <header className="header-pro">
          <div className="header-left">
            <div className={`logo-holder ${uploading ? 'is-loading' : ''}`}>
              {client.logo_url ? (
                <img src={client.logo_url} alt="Logo" onError={(e: any) => e.target.src = '/placeholder-logo.png'} />
              ) : (
                <Building2 size={24} className="opacity-20" />
              )}
              <label className="upload-btn">
                <FileUp size={14} />
                <input type="file" hidden onChange={handleLogoUpload} />
              </label>
            </div>
            
            <div className="client-main-info">
              <div className="title-row">
                <h1>{client.name}</h1>
                <span className={`status-badge ${shipments.length > 0 ? 'active' : 'new'}`}>
                  {shipments.length > 0 ? 'Cliente Activo' : 'Prospecto'}
                </span>
              </div>
              <div className="sub-row">
                <span className="tax-label">Tax ID: <strong>{client.tax_id || 'Pendiente'}</strong></span>
                <span className="geo-label"><MapPin size={12}/> {client.country || 'Panamá'}</span>
              </div>
            </div>

            {/* KPIs INTEGRADOS EN HEADER */}
            <div className="header-stats">
              <div className="h-stat">
                <span className="h-stat-label">Embarques</span>
                <span className="h-stat-val">{shipments.length}</span>
              </div>
              <div className="h-stat">
                <span className="h-stat-label">Incoterm</span>
                <span className="h-stat-val">{client.default_incoterm}</span>
              </div>
              <div className="h-stat">
                <span className="h-stat-label">Último Despacho</span>
                <span className="h-stat-val">{shipments[0] ? new Date(shipments[0].created_at).toLocaleDateString() : '--'}</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            {!isEditing ? (
              <>
                <button className="btn-refine-white" onClick={() => setIsEditing(true)}>
                  <Edit3 size={14}/> Editar Perfil
                </button>
                <button className="btn-refine-green" onClick={() => setIsDrawerOpen(true)}>
                  <Plus size={14}/> Nuevo Embarque
                </button>
              </>
            ) : (
              <div className="editing-actions">
                <button className="btn-cancel" onClick={() => setIsEditing(false)}>Descartar</button>
                <button className="btn-save" onClick={saveClientData}><Save size={14}/> Guardar</button>
              </div>
            )}
          </div>
        </header>

        <div className="main-grid">
          {/* COLUMNA 1 Y 2: ACTIVIDAD RECIENTE (AMPLIADA) */}
          <main className="activity-section">
            <div className="card-pro">
              <div className="card-header">
                <h3>Actividad Reciente</h3>
                <Link href={`/admin/shipments?client=${id}`} className="view-all">Ver historial <ExternalLink size={12}/></Link>
              </div>
              <div className="table-wrapper">
                <table className="table-refine">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Producto</th>
                      <th>Destino</th>
                      <th className="txt-right">Volumen</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map(s => (
                      <tr key={s.id} className="row-hover" onClick={() => router.push(`/admin/shipments/${s.id}`)}>
                        <td><span className="id-tag">{s.code}</span></td>
                        <td>
                          <div className="cell-product">
                            <strong>{s.product_name}</strong>
                            <span>{s.product_variety}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-dest">
                             <img src={`https://flagcdn.com/w20/${s.destination_country_code?.toLowerCase() || 'pa'}.png`} alt="flag" className="flag-icon" />
                             <span>{s.destination_port}</span>
                          </div>
                        </td>
                        <td className="txt-right">
                          <div className="cell-vol">
                            <strong>{s.boxes || 0} CX</strong>
                            <span className="text-muted-xs">{s.weight || 0} KG</span>
                          </div>
                        </td>
                        <td>
                          <span className={`pill-status-v2 ${s.status?.toLowerCase()}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>

          {/* COLUMNA 3: INFORMACIÓN ESTÁTICA */}
          <aside className="info-sidebar">
            {/* CONTACTO */}
            <div className="card-pro mini">
              <h4 className="section-title">Contacto</h4>
              <div className="contact-links">
                <a href={`mailto:${client.contact_email}`} className="contact-item">
                  <Mail size={14} className="text-green-600"/>
                  <div className="contact-data">
                    <label>Email</label>
                    {isEditing ? (
                      <input value={editData.contact_email} onChange={e => setEditData({...editData, contact_email: e.target.value})} />
                    ) : (
                      <span>{client.contact_email}</span>
                    )}
                  </div>
                </a>
                <div className="contact-item">
                  <Phone size={14} className="text-green-600"/>
                  <div className="contact-data">
                    <label>Teléfono</label>
                    {isEditing ? (
                      <input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                    ) : (
                      <span>{client.phone || 'N/A'}</span>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div className="contact-item">
                    <Hash size={14} className="text-green-600"/>
                    <div className="contact-data">
                      <label>Tax ID</label>
                      <input value={editData.tax_id} onChange={e => setEditData({...editData, tax_id: e.target.value})} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* LOGÍSTICA */}
            <div className="card-pro mini">
              <h4 className="section-title">Instrucciones Logísticas</h4>
              <div className="logistics-stack">
                <div className="log-block">
                  <div className="log-label"><Building2 size={12}/> Facturación</div>
                  {isEditing ? (
                    <textarea value={editData.billing_address} onChange={e => setEditData({...editData, billing_address: e.target.value})} />
                  ) : (
                    <p>{client.billing_address || 'Sin dirección'}</p>
                  )}
                </div>
                <div className="log-block">
                  <div className="log-label"><User size={12}/> Consignatario</div>
                  {isEditing ? (
                    <textarea value={editData.consignee_info?.address} onChange={e => setEditData({...editData, consignee_info: {...editData.consignee_info, address: e.target.value}})} />
                  ) : (
                    <p>{client.consignee_info?.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* DOCUMENTOS */}
            <div className="card-pro mini">
              <h4 className="section-title">Documentos KYC</h4>
              <div className="file-list-pro">
                <div className="file-item-pro"><FileText size={14}/> Registro Fiscal.pdf</div>
                <div className="file-item-pro"><FileText size={14}/> Pacto Social.pdf</div>
                <button className="btn-add-pro"><Plus size={12}/> Adjuntar</button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .view-container { padding: 25px 40px; max-width: 1550px; margin: 0 auto; background: #fcfcfd; min-height: 100vh; font-family: 'Inter', sans-serif; }
        
        /* HEADER REFINADO */
        .header-pro { display: flex; justify-content: space-between; align-items: center; background: white; padding: 18px 24px; border-radius: 12px; border: 1px solid #eef0f2; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
        .header-left { display: flex; align-items: center; gap: 24px; flex: 1; }
        
        .logo-holder { width: 60px; height: 60px; background: #f8fafc; border-radius: 10px; position: relative; border: 1.5px dashed #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; padding: 6px; }
        .upload-btn { position: absolute; inset: 0; background: rgba(0,0,0,0.4); color: white; display: flex; align-items: center; justify-content: center; opacity: 0; cursor: pointer; transition: 0.2s; }
        .logo-holder:hover .upload-btn { opacity: 1; }

        .client-main-info h1 { font-size: 20px; font-weight: 800; color: #1a202c; margin: 0; }
        .title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
        .sub-row { display: flex; gap: 15px; font-size: 12px; color: #718096; align-items: center; }
        .status-badge { font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; }
        .status-badge.active { background: #e6fffa; color: #2c7a7b; }

        .header-stats { display: flex; gap: 30px; border-left: 1px solid #edf2f7; padding-left: 30px; margin-left: 10px; }
        .h-stat { display: flex; flex-direction: column; }
        .h-stat-label { font-size: 10px; font-weight: 700; color: #a0aec0; text-transform: uppercase; }
        .h-stat-val { font-size: 14px; font-weight: 800; color: #2d3748; }

        .header-actions { display: flex; gap: 8px; }
        .btn-refine-white { padding: 6px 14px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; color: #4a5568; }
        .btn-refine-green { padding: 6px 14px; border-radius: 6px; border: none; background: #1f7a3a; color: white; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }

        /* GRID LAYOUT */
        .main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start; }
        .card-pro { background: white; border-radius: 12px; border: 1px solid #eef0f2; overflow: hidden; }
        .card-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f7fafc; }
        .card-header h3 { font-size: 14px; font-weight: 700; margin: 0; }
        .view-all { font-size: 11px; color: #1f7a3a; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px; }

        /* TABLA REFINADA */
        .table-refine { width: 100%; border-collapse: collapse; }
        .table-refine th { text-align: left; padding: 12px 20px; font-size: 10px; font-weight: 800; color: #a0aec0; text-transform: uppercase; background: #fcfcfd; }
        .table-refine td { padding: 12px 20px; border-bottom: 1px solid #f7fafc; font-size: 12px; vertical-align: middle; }
        .id-tag { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #1f7a3a; background: #f0fdf4; padding: 3px 6px; border-radius: 4px; white-space: nowrap; }
        .cell-product { display: flex; flex-direction: column; line-height: 1.2; }
        .cell-product strong { font-size: 13px; color: #2d3748; }
        .cell-product span { font-size: 11px; color: #718096; }
        .cell-dest { display: flex; align-items: center; gap: 8px; font-weight: 500; }
        .flag-icon { width: 18px; border-radius: 2px; }
        .cell-vol { display: flex; flex-direction: column; text-align: right; }
        .text-muted-xs { font-size: 10px; color: #a0aec0; }
        
        /* ESTADOS PILL (Hitos) */
        .pill-status-v2 { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; display: inline-block; }
        .pill-status-v2.packed { background: #f0fdf4; color: #166534; border: 1px solid #bcf0da; }
        .pill-status-v2.at_destination { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
        .pill-status-v2.created { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }

        /* SIDEBAR */
        .info-sidebar { display: flex; flex-direction: column; gap: 20px; }
        .section-title { font-size: 11px; font-weight: 800; color: #1f7a3a; text-transform: uppercase; letter-spacing: 0.05em; padding: 16px 20px 0; margin-bottom: 12px; }
        .contact-links { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 12px; }
        .contact-item { display: flex; align-items: flex-start; gap: 12px; text-decoration: none; color: inherit; }
        .contact-data label { display: block; font-size: 9px; font-weight: 700; color: #a0aec0; text-transform: uppercase; }
        .contact-data span, .contact-data input { font-size: 12px; font-weight: 600; color: #2d3748; }
        .contact-data input { border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 5px; width: 100%; }

        .logistics-stack { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 15px; }
        .log-label { font-size: 10px; font-weight: 800; color: #718096; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .log-block p { font-size: 12px; margin: 0; color: #4a5568; line-height: 1.4; }
        .log-block textarea { width: 100%; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; min-height: 60px; }

        .file-list-pro { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 8px; }
        .file-item-pro { font-size: 12px; color: #4a5568; display: flex; align-items: center; gap: 8px; padding: 8px; background: #f8fafc; border-radius: 6px; }
        .btn-add-pro { margin-top: 5px; background: none; border: 1.5px dashed #e2e8f0; padding: 8px; border-radius: 6px; color: #a0aec0; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; }
        
        .txt-right { text-align: right; }
        .mini { padding-bottom: 5px; }
      `}</style>
    </AdminLayout>
  );
}