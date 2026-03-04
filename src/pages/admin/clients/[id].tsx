import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
// CORRECCIÓN DE RUTAS: Al estar en admin/clients/[id], necesitamos ../../../
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout, notify } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, Phone, ArrowLeft, 
  Edit3, Loader2, Plus, FileText, 
  Globe, Package, Clock, Shield, ExternalLink, Hash, Copy, User, Info, FileUp, Save
} from 'lucide-react';
import Link from 'next/link';
import ShipmentDrawer from '../../../components/ShipmentDrawer';

const INCOTERMS = ['FOB', 'CIF', 'CIP', 'FCA', 'CFR', 'EXW', 'DDP', 'DAP'];

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [openAcc, setOpenAcc] = useState<string | null>('fact');
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

  const handleShipmentSuccess = () => {
    notify("Nuevo embarque creado", "success");
    if (id) fetchData(id as string);
  };

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

      const { data: { publicUrl } } = supabase.storage.from('client-logos').getPublicUrl(filePath);
      await supabase.from('clients').update({ logo_url: publicUrl }).eq('id', id);
      
      setClient({ ...client, logo_url: publicUrl });
      notify("Logo actualizado", "success");
    } catch (err: any) {
      notify("Error subiendo imagen", "error");
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

  const copyId = () => {
    if (id) {
      navigator.clipboard.writeText(id as string);
      notify("ID de cliente copiado", "success");
    }
  };

  if (loading) return (
    <AdminLayout title="Cargando...">
      <div className="loader-container">
        <Loader2 className="spin-pro" size={48} />
        <p>Sincronizando expediente...</p>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title={client?.name || "Detalle de Cliente"}>
      <div className="view-container">
        
        <div className="breadcrumb-nav">
          <Link href="/admin/users" className="btn-back">
            <ArrowLeft size={14} /> Volver al directorio
          </Link>
          <div className="quick-actions">
            <button className="btn-ghost" onClick={copyId}><Copy size={12}/> ID: {String(id).slice(0,8)}</button>
          </div>
        </div>

        <header className="profile-header">
          <div className="profile-main">
            <div className="profile-logo-area">
              <div className={`logo-box ${uploading ? 'is-uploading' : ''}`}>
                {client.logo_url ? <img src={client.logo_url} alt="Logo" /> : <Building2 size={28} className="text-muted" />}
                <label className="logo-overlay">
                  {uploading ? <Loader2 className="spin-pro" /> : <FileUp size={18} />}
                  <input type="file" hidden onChange={handleLogoUpload} accept="image/*" />
                </label>
              </div>
            </div>
            <div className="profile-info">
              <div className="name-row">
                <h1>{client.name}</h1>
                <span className={`status-pill-lg ${shipments.length > 0 ? 'active' : 'new'}`}>
                  {shipments.length > 0 ? 'Cliente Activo' : 'Nuevo Prospecto'}
                </span>
              </div>
              <div className="meta-row">
                <div className="meta-item"><Hash size={12}/> <span>RUC: {client.tax_id || 'Pendiente'}</span></div>
                <div className="meta-item"><Globe size={12}/> <span>{client.country || 'Panamá'}</span></div>
              </div>
            </div>
          </div>
          
          <div className="header-actions">
            {!isEditing ? (
              <>
                <button className="ff-btn-white" onClick={() => setIsEditing(true)}><Edit3 size={14}/> Editar Perfil</button>
                <button className="ff-btn ff-btn-primary" onClick={() => setIsDrawerOpen(true)}><Plus size={14}/> Nuevo Embarque</button>
              </>
            ) : (
              <div className="editing-actions">
                <button className="btn-text-danger" onClick={() => setIsEditing(false)}>Descartar</button>
                <button className="ff-btn ff-btn-primary" onClick={saveClientData}><Save size={14}/> Guardar Expediente</button>
              </div>
            )}
          </div>
        </header>

        <div className="stats-strip">
          <div className="stat-card">
            <div className="stat-icon purple"><Package size={18}/></div>
            <div className="stat-label">Total Embarques</div>
            <div className="stat-value">{shipments.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Shield size={18}/></div>
            <div className="stat-label">Incoterm Base</div>
            <div className="stat-value">{client.default_incoterm}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><Clock size={18}/></div>
            <div className="stat-label">Último Despacho</div>
            <div className="stat-value">{shipments[0] ? new Date(shipments[0].created_at).toLocaleDateString() : '--/--/--'}</div>
          </div>
        </div>

        <div className="content-layout">
          <section className="side-column">
            <div className="glass-panel">
              <h3 className="panel-title">Contacto</h3>
              <div className="field-group">
                <label>Correo Electrónico</label>
                <div className="input-box">
                  <Mail size={12}/>
                  <input disabled={!isEditing} value={isEditing ? editData.contact_email : client.contact_email} 
                    onChange={e => setEditData({...editData, contact_email: e.target.value})} />
                </div>
              </div>
              <div className="field-group">
                <label>Teléfono</label>
                <div className="input-box">
                  <Phone size={12}/>
                  <input disabled={!isEditing} value={isEditing ? editData.phone : client.phone} 
                    onChange={e => setEditData({...editData, phone: e.target.value})} />
                </div>
              </div>
              <div className="field-group">
                <label>Incoterm</label>
                <select disabled={!isEditing} value={isEditing ? editData.default_incoterm : client.default_incoterm}
                  onChange={e => setEditData({...editData, default_incoterm: e.target.value})}>
                  {INCOTERMS.map(inc => <option key={inc} value={inc}>{inc}</option>)}
                </select>
              </div>
            </div>

            <div className="glass-panel mt-4">
              <h3 className="panel-title">Documentación KYC</h3>
              <div className="file-stack">
                <div className="file-row"><FileText size={14} className="text-blue"/> <span>Registro Fiscal.pdf</span></div>
                <div className="file-row"><FileText size={14} className="text-blue"/> <span>Pacto Social.pdf</span></div>
                <button className="btn-add-file"><Plus size={12}/> Adjuntar</button>
              </div>
            </div>
          </section>

          <main className="center-column">
            <div className="data-panel">
              <div className="panel-header">
                <h3>Actividad Reciente</h3>
                <Link href={`/admin/shipments?client=${id}`} className="link-pro">Ver todo <ExternalLink size={12}/></Link>
              </div>
              
              <div className="table-responsive">
                <table className="pro-table-v2">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Producto</th>
                      <th>Destino</th>
                      <th className="txt-right">Cajas / Peso</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.slice(0, 5).map(s => (
                      <tr key={s.id} onClick={() => router.push(`/admin/shipments/${s.id}`)} className="row-link">
                        <td><span className="code-tag">{s.code}</span></td>
                        <td>
                          <div className="prod-info">
                            <strong>{s.product_name}</strong>
                            <small>{s.product_variety}</small>
                          </div>
                        </td>
                        <td><div className="dest-info"><MapPin size={12}/> {s.destination_port}</div></td>
                        <td className="txt-right">
                          <div className="vol-info">
                            <strong>{s.boxes || 0} CX</strong>
                            <small>{s.weight || 0} KG</small>
                          </div>
                        </td>
                        <td><span className={`status-pill-sm ${s.status?.toLowerCase()}`}>{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {shipments.length === 0 && (
                  <div className="empty-state-v2">
                    <Ship size={32} />
                    <p>Sin actividad registrada</p>
                    <button className="ff-btn ff-btn-primary btn-sm" onClick={() => setIsDrawerOpen(true)}>Crear Embarque</button>
                  </div>
                )}
              </div>
            </div>
          </main>

          <section className="side-column">
            <div className="glass-panel logistics-panel">
              <h3 className="panel-title">Logística</h3>
              
              <div className={`acc-item ${openAcc === 'fact' ? 'is-open' : ''}`}>
                <button className="acc-trigger" onClick={() => setOpenAcc(openAcc === 'fact' ? null : 'fact')}>
                  <Building2 size={14}/> Facturación
                </button>
                <div className="acc-content">
                  {isEditing ? (
                    <textarea value={editData.billing_address} onChange={e => setEditData({...editData, billing_address: e.target.value})} />
                  ) : ( <p>{client.billing_address || 'Sin dirección'}</p> )}
                </div>
              </div>

              <div className={`acc-item ${openAcc === 'cons' ? 'is-open' : ''}`}>
                <button className="acc-trigger" onClick={() => setOpenAcc(openAcc === 'cons' ? null : 'cons')}>
                  <User size={14}/> Consignatario
                </button>
                <div className="acc-content">
                  {isEditing ? (
                    <div className="edit-box-sm">
                      <input placeholder="Nombre" value={editData.consignee_info?.name} onChange={e => setEditData({...editData, consignee_info: {...editData.consignee_info, name: e.target.value}})} />
                      <textarea placeholder="Dirección" value={editData.consignee_info?.address} onChange={e => setEditData({...editData, consignee_info: {...editData.consignee_info, address: e.target.value}})} />
                    </div>
                  ) : (
                    <div className="view-box-sm">
                      <strong>{client.consignee_info?.name || 'Pendiente'}</strong>
                      <p>{client.consignee_info?.address || 'Pendiente'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={`acc-item ${openAcc === 'notify' ? 'is-open' : ''}`}>
                <button className="acc-trigger" onClick={() => setOpenAcc(openAcc === 'notify' ? null : 'notify')}>
                  <Info size={14}/> Notify Party
                </button>
                <div className="acc-content">
                  {isEditing ? (
                    <div className="edit-box-sm">
                      <input placeholder="Nombre" value={editData.notify_party?.name} onChange={e => setEditData({...editData, notify_party: {...editData.notify_party, name: e.target.value}})} />
                      <textarea placeholder="Dirección" value={editData.notify_party?.address} onChange={e => setEditData({...editData, notify_party: {...editData.notify_party, address: e.target.value}})} />
                    </div>
                  ) : (
                    <div className="view-box-sm">
                      <strong>{client.notify_party?.name || 'Mismo que consignatario'}</strong>
                      <p>{client.notify_party?.address || '---'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ShipmentDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)}
        clientId={id as string} 
        clientName={client.name}
        onSuccess={handleShipmentSuccess}
        defaultIncoterm={client.default_incoterm}
      />

      <style jsx>{`
        .view-container { padding: 20px 30px; max-width: 1440px; margin: 0 auto; color: #1e293b; font-family: 'Inter', sans-serif; }
        
        /* NAVEGACIÓN */
        .breadcrumb-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .btn-back { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #64748b; text-decoration: none; }
        .btn-ghost { background: #f1f5f9; border: none; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; color: #64748b; cursor: pointer; }

        /* HEADER */
        .profile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; background: white; padding: 20px; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .profile-main { display: flex; align-items: center; gap: 20px; }
        .logo-box { width: 70px; height: 70px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
        .logo-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); color: white; display: flex; align-items: center; justify-content: center; opacity: 0; cursor: pointer; }
        .logo-box:hover .logo-overlay { opacity: 1; }

        .name-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
        .name-row h1 { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
        .status-pill-lg { font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 12px; text-transform: uppercase; }
        .status-pill-lg.active { background: #dcfce7; color: #15803d; }
        .status-pill-lg.new { background: #eff6ff; color: #1d4ed8; }
        .meta-row { display: flex; gap: 15px; }
        .meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #94a3b8; font-weight: 500; }

        /* KPI */
        .stats-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
        .stat-card { background: white; padding: 15px; border-radius: 16px; border: 1px solid #f1f5f9; position: relative; }
        .stat-icon { position: absolute; right: 15px; top: 15px; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .stat-icon.purple { background: #faf5ff; color: #7e22ce; }
        .stat-icon.green { background: #f0fdf4; color: #15803d; }
        .stat-icon.orange { background: #fff7ed; color: #c2410c; }
        .stat-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .stat-value { font-size: 20px; font-weight: 800; color: #1e293b; }

        /* GRID */
        .content-layout { display: grid; grid-template-columns: 280px 1fr 280px; gap: 20px; align-items: start; }
        .glass-panel { background: white; border: 1px solid #f1f5f9; border-radius: 16px; padding: 18px; }
        .panel-title { font-size: 11px; font-weight: 800; color: #1f7a3a; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 0.05em; }
        
        .field-group { margin-bottom: 14px; }
        .field-group label { display: block; font-size: 10px; font-weight: 700; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; }
        .input-box { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0 10px; border-radius: 8px; }
        .input-box input { border: none; background: transparent; padding: 8px 0; font-size: 12px; font-weight: 600; width: 100%; outline: none; }
        select { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; font-weight: 600; }

        /* TABLA */
        .data-panel { background: white; border-radius: 16px; border: 1px solid #f1f5f9; overflow: hidden; }
        .panel-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
        .panel-header h3 { font-size: 14px; font-weight: 800; margin: 0; }
        .link-pro { font-size: 11px; font-weight: 700; color: #1f7a3a; text-decoration: none; }
        .pro-table-v2 { width: 100%; border-collapse: collapse; }
        .pro-table-v2 th { text-align: left; padding: 12px 20px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; background: #fafafa; }
        .pro-table-v2 td { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .row-link { cursor: pointer; }
        .row-link:hover { background: #f8fafc; }
        .code-tag { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: 700; color: #1f7a3a; }
        .status-pill-sm { padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; }

        /* ACCORDION */
        .acc-item { border-bottom: 1px solid #f1f5f9; }
        .acc-trigger { width: 100%; padding: 12px 0; border: none; background: none; display: flex; align-items: center; gap: 10px; font-weight: 700; color: #475569; cursor: pointer; font-size: 12px; }
        .acc-content { max-height: 0; overflow: hidden; transition: 0.3s; color: #64748b; font-size: 12px; }
        .is-open .acc-content { max-height: 200px; padding-bottom: 15px; }
        textarea { width: 100%; min-height: 60px; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; resize: none; }

        .loader-container { height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; font-size: 14px; color: #64748b; }
        .spin-pro { animation: spin 1s linear infinite; color: #1f7a3a; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        /* BOTONES */
        .ff-btn { padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; display: flex; align-items: center; gap: 8px; }
        .ff-btn-primary { background: #1f7a3a; color: white; }
        .ff-btn-white { background: white; border: 1px solid #e2e8f0; color: #475569; padding: 7px 15px; font-size: 12px; font-weight: 700; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-text-danger { background: none; border: none; color: #e11d48; font-weight: 700; font-size: 12px; cursor: pointer; padding: 0 15px; }
      `}</style>
    </AdminLayout>
  );
}