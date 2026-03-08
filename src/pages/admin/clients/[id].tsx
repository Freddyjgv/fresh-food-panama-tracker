import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout, notify } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Mail, Phone, Pencil, Loader2, Plus, FileText, 
  ExternalLink, User, FileUp, Save, Globe, Bell, ShoppingBag, 
  CreditCard, Truck, ChevronDown, CheckCircle2, Clock, Calculator
} from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  // --- ESTADOS ---
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditingMaster, setIsEditingMaster] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const statusConfig: any = {
    'CREATED': { label: 'Creado', class: 'created' },
    'PACKED': { label: 'Empacado', class: 'packed' },
    'IN_TRANSIT': { label: 'En Tránsito', class: 'transit' },
    'DELIVERED': { label: 'Entregado', class: 'delivered' }
  };

  // --- LOGICA DE DATOS ---
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
        billing_info: clientData.billing_info || { address: '' },
        consignee_info: clientData.consignee_info || { address: '' },
        notify_info: clientData.notify_info || { address: '' },
        stakeholders: clientData.stakeholders || {
          purchasing: { name: '', email: '', phone: '' },
          accounting: { name: '', email: '', phone: '' },
          logistics: { name: '', email: '', phone: '' }
        }
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

  // --- ACCIONES ---
  const saveMasterData = async () => {
    try {
      const { error } = await supabase.from('clients').update({
        name: editData.name,
        legal_name: editData.legal_name,
        tax_id: editData.tax_id,
        website: editData.website,
        country: editData.country,
        city: editData.city,
        phone: editData.phone,
        contact_name: editData.contact_name,
        contact_email: editData.contact_email,
        default_incoterm: editData.default_incoterm,
        credit_days: editData.credit_days,
        sales_rep: editData.sales_rep
      }).eq('id', id);

      if (error) throw error;
      setClient({...editData});
      setIsEditingMaster(false);
      notify("Datos Maestros actualizados", "success");
    } catch (err) { notify("Error al guardar", "error"); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file || !id) return;
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('client-logos').upload(fileName, file);
      if (uploadError) throw uploadError;

      await supabase.from('clients').update({ logo_url: fileName }).eq('id', id);
      setClient({ ...client, logo_url: fileName });
      notify("Logo actualizado", "success");
    } catch (err) { notify("Error al subir logo", "error"); } finally { setUploading(false); }
  };

  if (loading) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <AdminLayout title={`Expediente: ${client?.name}`}>
      <div className="view-container">
        
        {/* --- HEADER PREMIUM --- */}
        <header className="ff-header-premium">
          <div className="ff-header-top-row">
            <div className="ff-client-profile">
              <div className="ff-logo-wrapper">
                {client.logo_url ? (
                  <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}`} className="ff-logo-img" />
                ) : (
                  <div className="ff-logo-placeholder">{client.name?.charAt(0)}</div>
                )}
                <label className="ff-upload-btn">
                  <FileUp size={16} />
                  <input type="file" hidden onChange={handleLogoUpload} accept="image/*" />
                </label>
              </div>
              <div className="ff-client-info">
                <h1 className="ff-client-name-display">{client.name}</h1>
                <div className="ff-client-meta-row">
                  <span className="ff-meta-value-main">{client.legal_name || 'Razón Social no definida'}</span>
                  <span className="ff-meta-divider">|</span>
                  <span className="ff-meta-value">{client.tax_id || 'SIN RUC'}</span>
                  <span className="ff-meta-divider">|</span>
                  <span className="ff-meta-value">{client.country || 'Panamá'}</span>
                  <span className="ff-badge-status">Cuenta Activa</span>
                </div>
              </div>
            </div>
            <div className="ff-header-actions-column">
              <button className="ff-btn-action ff-btn-primary"><Plus size={16}/><span>Nuevo Embarque</span></button>
              <button className="ff-btn-action ff-btn-secondary"><Calculator size={16}/><span>Nueva Cotización</span></button>
            </div>
          </div>
        </header>

        <div className="main-grid">
          {/* COLUMNA PRINCIPAL */}
          <div className="main-col">
            
            {/* --- DATOS MAESTROS (CENTRO) --- */}
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="header-title-group">
                  <Building2 size={18} className="ff-icon-accent" />
                  <h3>Expediente Legal y Comercial</h3>
                </div>
                {!isEditingMaster ? (
                  <button className="ff-btn-edit-inline" onClick={() => { setEditData({...client}); setIsEditingMaster(true); }}>
                    <Pencil size={14} /> Editar Información
                  </button>
                ) : (
                  <div className="ff-edit-inline-actions">
                    <button className="ff-save-mini" onClick={saveMasterData}><Save size={14}/> Guardar</button>
                    <button className="ff-cancel-mini" onClick={() => setIsEditingMaster(false)}>Cancelar</button>
                  </div>
                )}
              </div>
              <div className="ff-master-grid">
                {[
                  { label: 'Nombre Comercial', key: 'name' },
                  { label: 'Razón Social', key: 'legal_name' },
                  { label: 'Tax ID (RUC)', key: 'tax_id' },
                  { label: 'Sitio Web', key: 'website' },
                  { label: 'País', key: 'country' },
                  { label: 'Ciudad', key: 'city' },
                  { label: 'Teléfono', key: 'phone' },
                  { label: 'Contacto Principal', key: 'contact_name' },
                  { label: 'Email Notificaciones', key: 'contact_email' },
                  { label: 'Incoterm Default', key: 'default_incoterm' },
                  { label: 'Días de Crédito', key: 'credit_days' },
                  { label: 'Vendedor', key: 'sales_rep' }
                ].map((item) => (
                  <div className="ff-master-item" key={item.key}>
                    <label>{item.label}</label>
                    {isEditingMaster ? (
                      <input 
                        className="ff-master-input"
                        value={editData[item.key] || ''} 
                        onChange={e => setEditData({...editData, [item.key]: e.target.value})}
                      />
                    ) : (
                      <div className="ff-master-value">{client[item.key] || '—'}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* --- MONITOR DE EMBARQUES --- */}
            <section className="pro-card">
              <div className="card-header-v2">
                <h3>Monitor de Embarques Recientes</h3>
                <Link href="/admin/shipments" className="link-all">Ver todos <ExternalLink size={12}/></Link>
              </div>
              <div className="table-wrapper">
                <table className="table-refine">
                  <thead>
                    <tr>
                      <th>REFERENCIA</th>
                      <th>PRODUCTO</th>
                      <th>DESTINO</th>
                      <th className="txt-center">ESTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map(s => (
                      <tr key={s.id}>
                        <td><span className="code-tag">{s.code}</span></td>
                        <td>
                          <div className="prod-cell">
                            <strong>{s.product_name}</strong>
                            <span>{s.product_variety}</span>
                          </div>
                        </td>
                        <td><div className="dest-cell"><Globe size={12}/> {s.destination_port}</div></td>
                        <td className="txt-center">
                          <span className={`pill-status-v2 ${statusConfig[s.status]?.class}`}>
                            {statusConfig[s.status]?.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="side-col">
            {/* DIRECCIONES EN ACORDEÓN */}
            <div className="pro-card mini-padding">
              <h4 className="side-label">Configuración Logística</h4>
              <div className="stakeholders-stack">
                {[
                  { id: 'billing_info', label: 'Billing Party', icon: <CreditCard size={14}/> },
                  { id: 'consignee_info', label: 'Consignee Default', icon: <User size={14}/> },
                  { id: 'notify_info', label: 'Notify Party', icon: <Bell size={14}/> }
                ].map(addr => (
                  <details className="dept-accordion" key={addr.id}>
                    <summary>
                      <div className="sum-left">{addr.icon} <span>{addr.label}</span></div>
                      <ChevronDown size={14}/>
                    </summary>
                    <div className="dept-form">
                      <p className="ff-address-text">{client[addr.id]?.address || 'No definida'}</p>
                      <button className="ff-btn-maps-mini">Google Maps</button>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            {/* DIRECTORIO INTERNO */}
            <div className="pro-card mini-padding">
              <h4 className="side-label">Directorio Interno</h4>
              <div className="stakeholders-stack">
                {[
                  { id: 'purchasing', label: 'Compras', icon: <ShoppingBag size={14}/>, color: '#3b82f6' },
                  { id: 'accounting', label: 'Pagos / Contab.', icon: <CreditCard size={14}/>, color: '#ef4444' },
                  { id: 'logistics', label: 'Logística', icon: <Truck size={14}/>, color: '#10b981' }
                ].map(dept => (
                  <details className="dept-accordion" key={dept.id}>
                    <summary style={{ borderLeft: `4px solid ${dept.color}` }}>
                      <div className="sum-left">{dept.icon} <span>{dept.label}</span></div>
                      <ChevronDown size={14}/>
                    </summary>
                    <div className="dept-view">
                      <p><strong>{client.stakeholders[dept.id]?.name || 'No asignado'}</strong></p>
                      <a href={`mailto:${client.stakeholders[dept.id]?.email}`} className="mailto-btn"><Mail size={12}/> Email</a>
                      <a href={`tel:${client.stakeholders[dept.id]?.phone}`} className="tel-btn"><Phone size={12}/> Llamar</a>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .view-container { padding: 30px 40px; max-width: 1600px; margin: 0 auto; background: #f8fafc; min-height: 100vh; font-family: 'Inter', sans-serif; }
        .main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
        .pro-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px; overflow: hidden; }
        
        /* HEADER */
        .ff-header-premium { background: white; padding: 32px; border-radius: 24px; border: 1px solid #e2e8f0; margin-bottom: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .ff-header-top-row { display: flex; justify-content: space-between; align-items: center; }
        .ff-client-profile { display: flex; align-items: center; gap: 24px; }
        .ff-logo-wrapper { width: 80px; height: 80px; background: #f8fafc; border-radius: 18px; border: 1px solid #e2e8f0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .ff-logo-img { width: 100%; height: 100%; object-fit: contain; padding: 10px; }
        .ff-upload-btn { position: absolute; inset: 0; background: rgba(0,0,0,0.5); color: white; display: flex; align-items: center; justify-content: center; opacity: 0; cursor: pointer; transition: 0.2s; }
        .ff-logo-wrapper:hover .ff-upload-btn { opacity: 1; }
        .ff-client-name-display { font-size: 30px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.03em; }
        .ff-client-meta-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; color: #64748b; font-size: 14px; font-weight: 600; }
        .ff-meta-value-main { color: #1e293b; font-weight: 700; }
        .ff-meta-divider { color: #e2e8f0; }
        .ff-badge-status { background: #f0fdf4; color: #166534; padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 800; border: 1px solid #dcfce7; }

        /* DATOS MAESTROS GRID */
        .ff-master-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 24px; }
        .ff-master-item { display: flex; flex-direction: column; gap: 6px; }
        .ff-master-item label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .ff-master-value { font-size: 14px; font-weight: 600; color: #1e293b; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; }
        .ff-master-input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-weight: 600; background: #f0f7ff; outline: none; border-color: #2563eb; }
        .ff-icon-accent { color: #2563eb; }

        /* TABLA */
        .table-refine { width: 100%; border-collapse: collapse; }
        .table-refine th { text-align: left; padding: 16px 24px; font-size: 11px; color: #94a3b8; font-weight: 800; background: #fafafa; border-bottom: 1px solid #f1f5f9; }
        .table-refine td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .code-tag { font-family: monospace; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 4px 8px; border-radius: 6px; }
        .pill-status-v2 { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
        .created { background: #fef3c7; color: #92400e; }
        .delivered { background: #dcfce7; color: #166534; }

        /* ACORDEONES */
        .dept-accordion { margin-bottom: 8px; border-radius: 12px; border: 1px solid #f1f5f9; overflow: hidden; }
        .dept-accordion summary { padding: 12px 16px; background: #fafafa; display: flex; justify-content: space-between; align-items: center; cursor: pointer; list-style: none; font-weight: 700; font-size: 13px; }
        .dept-view, .dept-form { padding: 16px; background: white; display: flex; flex-direction: column; gap: 8px; }
        .ff-address-text { font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; }
        .mailto-btn, .tel-btn { font-size: 12px; color: #2563eb; text-decoration: none; display: flex; align-items: center; gap: 6px; font-weight: 600; }

        /* BOTONES */
        .ff-btn-action { display: flex; align-items: center; gap: 10px; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; border: none; cursor: pointer; }
        .ff-btn-primary { background: #0f172a; color: white; }
        .ff-btn-secondary { background: white; color: #334155; border: 1px solid #e2e8f0; }
        .ff-btn-edit-inline { background: #f1f5f9; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #475569; cursor: pointer; }
        .ff-save-mini { background: #16a34a; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; }
        .ff-cancel-mini { background: #fff1f2; color: #e11d48; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; }
        .side-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 16px; display: block; }
        .loader-full { height: 100vh; display: flex; align-items: center; justify-content: center; color: #16a34a; }
      `}</style>
    </AdminLayout>
  );
}