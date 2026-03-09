import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout, notify } from '../../../components/AdminLayout';
import { 
  Building2, Mail, Phone, Pencil, Loader2, Plus, 
  ExternalLink, User, Save, Globe, Bell, ShoppingBag, 
  CreditCard, Truck, ChevronDown, Calculator
} from 'lucide-react';
import Link from 'next/link';
export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingMaster, setIsEditingMaster] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [isEditingAddresses, setIsEditingAddresses] = useState(false);
  const [isEditingStakeholders, setIsEditingStakeholders] = useState(false);

  const statusConfig: any = {
    'CREATED': { label: 'Creado', class: 'created' },
    'PACKED': { label: 'Empacado', class: 'packed' },
    'IN_TRANSIT': { label: 'En Tránsito', class: 'transit' },
    'DELIVERED': { label: 'Entregado', class: 'delivered' }
  };

  // 1. CARGA DE DATOS
  const fetchData = useCallback(async (clientId: string) => {
    try {
      const { data: clientData, error: cErr } = await supabase
        .from('clients').select('*').eq('id', clientId).maybeSingle();
      if (cErr) throw cErr;

      const { data: shipsRes, error: sErr } = await supabase
        .from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
      if (sErr) throw sErr;

      const safeClient = { 
        ...clientData, 
        billing_info: clientData.billing_info || { address: '' },
        consignee_info: clientData.consignee_info || { address: '' },
        notify_info: clientData.notify_info || { address: '' },
        stakeholders: {
          purchasing: clientData.stakeholders?.purchasing || { name: '', email: '', phone: '' },
          accounting: clientData.stakeholders?.accounting || { name: '', email: '', phone: '' },
          logistics: clientData.stakeholders?.logistics || { name: '', email: '', phone: '' }
        }
      };

      setClient(safeClient);
      setEditData(safeClient);
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

  // 2. FUNCIONES DE GUARDADO (Ahora en el lugar correcto)
  
  const saveMasterData = async () => {
    try {
      const payload = {
        name: editData.name || null,
        legal_name: editData.legal_name || null,
        tax_id: editData.tax_id || null,
        website: editData.website || null,
        country: editData.country || null,
        city: editData.city || null,
        phone: editData.phone || null,
        contact_name: editData.contact_name || null,
        contact_email: editData.contact_email || null,
        default_incoterm: editData.default_incoterm || null,
        credit_days: editData.credit_days ? parseInt(editData.credit_days) : 0,
        sales_rep: editData.sales_rep || null
      };
      const { error } = await supabase.from('clients').update(payload).eq('id', id);
      if (error) throw error;
      setClient({...editData});
      setIsEditingMaster(false);
      notify("Datos Maestros actualizados", "success");
    } catch (err: any) { notify("Error al guardar", "error"); }
  };

  const saveAddresses = async () => {
    try {
      const payload = {
        billing_info: editData.billing_info,
        consignee_info: editData.consignee_info,
        notify_info: editData.notify_info
      };
      const { error } = await supabase.from('clients').update(payload).eq('id', id);
      if (error) throw error;
      setClient({ ...client, ...payload });
      setIsEditingAddresses(false);
      notify("Direcciones actualizadas", "success");
    } catch (err) { notify("Error al guardar direcciones", "error"); }
  };

  const saveStakeholders = async () => {
    try {
      const payload = {
        stakeholders: editData.stakeholders
      };
      const { error } = await supabase.from('clients').update(payload).eq('id', id);
      if (error) throw error;
      setClient({ ...client, ...payload });
      setIsEditingStakeholders(false);
      notify("Directorio actualizado", "success");
    } catch (err) { notify("Error al guardar directorio", "error"); }
  };

  if (loading || !client) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <AdminLayout title={`Expediente: ${client.name}`}>
      <div className="view-container">
        
        {/* HEADER */}
        <header className="ff-header-minimal">
          <div className="ff-header-top-row">
            <div className="ff-client-profile">
              <div className="ff-logo-wrapper">
                {client.logo_url ? (
                  <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}`} className="ff-logo-img" alt="logo" />
                ) : (
                  <div className="ff-logo-placeholder">{client.name?.charAt(0)}</div>
                )}
              </div>
              <div className="ff-client-info">
                <div className="ff-name-row">
                  <h1 className="ff-client-name-display">{client.name}</h1>
                  <span className="ff-badge-status-inline">Cuenta Activa</span>
                </div>
                <div className="ff-client-meta-stack">
                  <div className="ff-legal-name-row">{client.legal_name || 'Razón Social no definida'}</div>
                  <div className="ff-meta-sub-row">
                    <span>{client.tax_id || 'SIN TAX ID'}</span>
                    <span className="ff-meta-divider">|</span>
                    <span>{client.country || 'Panamá'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ff-header-actions-minimal">
              <button className="ff-btn-mini ff-btn-glass-secondary" onClick={() => router.push(`/admin/quotes/new?clientId=${id}`)}>
                <Calculator size={14} /> <span>Nueva Cotización</span>
              </button>
              <button className="ff-btn-mini ff-btn-glass-primary" onClick={() => router.push(`/admin/shipments/new?clientId=${id}`)}>
                <Plus size={14} /> <span>Nuevo Embarque</span>
              </button>
            </div>
          </div>
        </header>

        <div className="main-grid">
          <div className="main-col">
            {/* DATOS MAESTROS */}
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="header-title-group">
                  <div className="ff-icon-circle"><Building2 size={18} /></div>
                  <div className="ff-header-text-group">
                    <h3>Expediente del Cliente</h3>
                    <p>Información legal y términos comerciales</p>
                  </div>
                </div>
                {!isEditingMaster ? (
                  <button className="ff-btn-edit-main" onClick={() => setIsEditingMaster(true)}>
                    <Pencil size={14} /> <span>Editar Perfil</span>
                  </button>
                ) : (
                  <div className="ff-edit-group">
                    <button className="ff-btn-save" onClick={saveMasterData}><Save size={14}/> <span>Guardar</span></button>
                    <button className="ff-btn-cancel" onClick={() => { setIsEditingMaster(false); setEditData(client); }}>Cancelar</button>
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
                    <span className="ff-item-label">{item.label}</span>
                    {isEditingMaster ? (
                      <input 
                        className="ff-master-input"
                        type={item.key === 'credit_days' ? 'number' : 'text'}
                        value={editData[item.key] || ''} 
                        onChange={e => setEditData({...editData, [item.key]: e.target.value})}
                      />
                    ) : (
                      <div className="ff-item-value">{client[item.key] || '—'}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* MONITOR DE EMBARQUES */}
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="ff-header-text-group">
                  <h3>Monitor de Embarques</h3>
                </div>
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
                        <td><strong>{s.product_name}</strong></td>
                        <td><div className="dest-cell"><Globe size={12}/> {s.destination_port}</div></td>
                        <td className="txt-center">
                          <span className={`pill-status-v2 ${statusConfig[s.status]?.class || 'created'}`}>
                            {statusConfig[s.status]?.label || 'Procesando'}
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
  {/* DIRECCIONES BL/AWB */}
  <div className="pro-card mini-padding">
    <div className="side-header-row">
      <h4 className="side-label">Direcciones BL/AWB</h4>
      {!isEditingAddresses ? (
        <button className="ff-btn-mini-edit" onClick={() => setIsEditingAddresses(true)}><Pencil size={10}/></button>
      ) : (
        <button className="ff-btn-mini-save" onClick={saveAddresses}><Save size={10}/></button>
      )}
    </div>
    <div className="stakeholders-stack">
      {[
        { id: 'billing_info', label: 'Billing Party', icon: <CreditCard size={14}/> },
        { id: 'consignee_info', label: 'Consignee Default', icon: <User size={14}/> },
        { id: 'notify_info', label: 'Notify Party', icon: <Bell size={14}/> }
      ].map(addr => (
        <details className="dept-accordion" key={addr.id} open={isEditingAddresses}>
          <summary className="ff-summary-clean">
            <div className="sum-left">{addr.icon} <span>{addr.label}</span></div>
            <ChevronDown size={14} className="chevron-icon"/>
          </summary>
          <div className="dept-view">
            {isEditingAddresses ? (
              <textarea 
                className="ff-edit-textarea"
                value={editData[addr.id]?.address || ''}
                onChange={e => setEditData({
                  ...editData, 
                  [addr.id]: { ...editData[addr.id], address: e.target.value }
                })}
              />
            ) : (
              <p className="ff-address-text">{client[addr.id]?.address || 'No definida'}</p>
            )}
          </div>
        </details>
      ))}
    </div>
  </div>

  {/* DIRECTORIO INTERNO */}
  <div className="pro-card mini-padding">
    <div className="side-header-row">
      <h4 className="side-label">Directorio Interno</h4>
      {!isEditingStakeholders ? (
        <button className="ff-btn-mini-edit" onClick={() => setIsEditingStakeholders(true)}><Pencil size={10}/></button>
      ) : (
        <button className="ff-btn-mini-save" onClick={saveStakeholders}><Save size={10}/></button>
      )}
    </div>
    <div className="stakeholders-stack">
      {[
        { id: 'purchasing', label: 'Compras', icon: <ShoppingBag size={14}/>, color: '#3b82f6' },
        { id: 'accounting', label: 'Pagos / Contab.', icon: <CreditCard size={14}/>, color: '#ef4444' },
        { id: 'logistics', label: 'Logística', icon: <Truck size={14}/>, color: '#10b981' }
      ].map(dept => (
        <details className="dept-accordion" key={dept.id} open={isEditingStakeholders}>
          <summary className="ff-summary-clean" style={{ borderLeft: `4px solid ${dept.color}` }}>
            <div className="sum-left">{dept.icon} <span>{dept.label}</span></div>
            <ChevronDown size={14} className="chevron-icon"/>
          </summary>
          <div className="dept-view">
            {isEditingStakeholders ? (
              <div className="ff-edit-stack-mini">
                <input 
                  placeholder="Nombre"
                  value={editData.stakeholders?.[dept.id]?.name || ''}
                  onChange={e => setEditData({
                    ...editData,
                    stakeholders: {
                      ...editData.stakeholders,
                      [dept.id]: { ...editData.stakeholders[dept.id], name: e.target.value }
                    }
                  })}
                />
                <input 
                  placeholder="Email"
                  value={editData.stakeholders?.[dept.id]?.email || ''}
                  onChange={e => setEditData({
                    ...editData,
                    stakeholders: {
                      ...editData.stakeholders,
                      [dept.id]: { ...editData.stakeholders[dept.id], email: e.target.value }
                    }
                  })}
                />
              </div>
            ) : (
              <>
                <p className="ff-contact-name">{client.stakeholders?.[dept.id]?.name || 'No asignado'}</p>
                <div className="ff-contact-item"><Mail size={12}/> <span>{client.stakeholders?.[dept.id]?.email || '—'}</span></div>
              </>
            )}
          </div>
        </details>
      ))}
    </div>
  </div>
</aside>
        </div>
      </div>

      <style jsx>{`
        .view-container { padding: 20px 40px; max-width: 1600px; margin: 0 auto; background: #f8fafc; min-height: 100vh; font-family: 'Inter', sans-serif; }
        .ff-header-minimal { padding: 10px 0 32px 0; background: transparent; }
        .ff-header-top-row { display: flex; justify-content: space-between; align-items: center; }
        .ff-client-profile { display: flex; align-items: center; gap: 20px; }
        .ff-logo-wrapper { width: 64px; height: 64px; background: white; border-radius: 14px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .ff-logo-img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
        .ff-logo-placeholder { font-size: 24px; font-weight: 800; color: #cbd5e1; }
        .ff-name-row { display: flex; align-items: center; gap: 12px; }
        .ff-client-name-display { font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.03em; }
        .ff-badge-status-inline { background: rgba(34, 197, 94, 0.1); color: #166534; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; border: 1px solid rgba(34, 197, 94, 0.2); }
        .ff-client-meta-stack { margin-top: 4px; }
        .ff-legal-name-row { font-size: 14px; font-weight: 600; color: #475569; }
        .ff-meta-sub-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; font-weight: 500; }
        .ff-meta-divider { color: #e2e8f0; }
        .ff-header-actions-minimal { display: flex; gap: 12px; }
        .ff-btn-mini { display: flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
        .ff-btn-glass-secondary { background: white; color: #475569; border-color: #e2e8f0; }
        .ff-btn-glass-primary { background: rgba(15, 23, 42, 0.05); color: #0f172a; border-color: rgba(15, 23, 42, 0.1); }
        .main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
        .pro-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .card-header-v2 { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .ff-icon-circle { width: 32px; height: 32px; background: #eff6ff; color: #2563eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .ff-header-text-group h3 { font-size: 15px; font-weight: 800; color: #1e293b; margin: 0; }
        .ff-header-text-group p { font-size: 11px; color: #94a3b8; margin: 0; }
        .ff-master-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px 32px; padding: 24px; }
        .ff-master-item { display: flex; flex-direction: column; gap: 4px; }
        .ff-item-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .ff-item-value { font-size: 14px; font-weight: 600; color: #1e293b; padding: 4px 0; }
        .ff-master-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-weight: 600; background: #f8fafc; outline: none; }
        .ff-btn-edit-main { display: flex; align-items: center; gap: 6px; background: #f1f5f9; border: none; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #475569; cursor: pointer; }
        .ff-btn-save { background: #16a34a; color: white; border: none; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .ff-btn-cancel { background: white; border: 1px solid #e2e8f0; color: #64748b; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }
        .ff-summary-clean { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fafafa; cursor: pointer; list-style: none; }
        .ff-summary-clean::-webkit-details-marker { display: none; }
        .sum-left { display: flex; align-items: center; gap: 10px; font-weight: 700; color: #475569; font-size: 13px; }
        .sum-right { display: flex; align-items: center; gap: 12px; }
        .chevron-icon { transition: 0.2s; color: #94a3b8; }
        .side-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.ff-btn-mini-save { width: 22px; height: 22px; border-radius: 6px; border: none; background: #16a34a; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.ff-edit-textarea { width: 100%; min-height: 80px; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px; font-family: inherit; resize: none; outline: none; }
.ff-edit-stack-mini { display: flex; flex-direction: column; gap: 6px; }
.ff-edit-stack-mini input { padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; outline: none; }
.ff-edit-stack-mini input:focus, .ff-edit-textarea:focus { border-color: #234d23; }
        .dept-accordion[open] .chevron-icon { transform: rotate(180deg); }
        .ff-btn-mini-edit { width: 22px; height: 22px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .dept-view { padding: 0 16px 16px 16px; background: #fafafa; }
        .ff-address-text { font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; padding: 10px; background: white; border-radius: 8px; border: 1px solid #edf2f7; }
        .ff-contact-name { font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
        .ff-contact-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; margin-top: 4px; }
        .table-refine { width: 100%; border-collapse: collapse; }
        .table-refine th { text-align: left; padding: 14px 24px; font-size: 11px; color: #94a3b8; font-weight: 800; background: #fafafa; border-bottom: 1px solid #f1f5f9; }
        .table-refine td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .code-tag { font-family: monospace; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 4px 8px; border-radius: 6px; }
        .pill-status-v2 { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
        .created { background: #fef3c7; color: #92400e; }
        .delivered { background: #dcfce7; color: #166534; }
        .side-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 16px; display: block; }
        .dept-accordion { margin-bottom: 8px; border-radius: 12px; border: 1px solid #f1f5f9; overflow: hidden; }
        .loader-full { height: 100vh; display: flex; align-items: center; justify-content: center; color: #2563eb; }
        .link-all { font-size: 12px; color: #2563eb; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 4px; }
        .txt-center { text-align: center; }
        .mini-padding { padding: 20px; }
      `}</style>
    </AdminLayout>
  );
}