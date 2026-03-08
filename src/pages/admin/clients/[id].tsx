import { useRouter } from 'next/router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout, notify } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Mail, Phone, Pencil, Loader2, Plus, FileText, 
  ExternalLink, Hash, User, FileUp, Save, Globe, Bell, ShoppingBag, 
  CreditCard, Truck, ChevronDown, CheckCircle2, Clock, Calculator
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

  const statusConfig: any = {
    'CREATED': { label: 'Creado', class: 'created' },
    'PACKED': { label: 'Empacado', class: 'packed' },
    'IN_TRANSIT': { label: 'En Tránsito', class: 'transit' },
    'AT_DESTINATION': { label: 'En Destino', class: 'at_destination' },
    'DELIVERED': { label: 'Entregado', class: 'delivered' }
  };

  const fetchData = useCallback(async (clientId: string) => {
    try {
      const { data: clientData, error: cErr } = await supabase
        .from('clients').select('*').eq('id', clientId).maybeSingle();
      if (cErr) throw cErr;

      const { data: shipsRes, error: sErr } = await supabase
        .from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
      if (sErr) throw sErr;

      // Estructuramos datos por defecto para evitar errores de renderizado
      const fullClient = { 
        ...clientData, 
        billing_info: clientData.billing_info || { address: '', email: '', phone: '' },
        consignee_info: clientData.consignee_info || { address: '', email: '', phone: '' },
        notify_info: clientData.notify_info || { address: '', email: '', phone: '' },
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

  const saveClientData = async () => {
    try {
      const { error } = await supabase.from('clients').update(editData).eq('id', id);
      if (error) throw error;
      setClient({...editData});
      setIsEditing(false);
      notify("Expediente Actualizado", "success");
    } catch (err) { notify("Error al guardar", "error"); }
  };

  if (loading) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <AdminLayout title={`Expediente: ${client?.name}`}>
      <div className="view-container">
        
        {/* --- HEADER COMMAND CENTER --- */}
        <header className="header-pro">
          <div className="header-left">
            <div className="logo-section">
              <div className="logo-holder">
                {client.logo_url ? (
                  <img src={`https://fofvskqshlyqmsvshnps.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}`} alt="Logo" />
                ) : (
                  <Building2 size={24} className="opacity-20" />
                )}
                <label className="upload-btn"><FileUp size={14} /><input type="file" hidden /></label>
              </div>
              <div className="client-titles">
                <div className="name-row">
                  <h1>{client.name}</h1>
                  <span className="badge-active">Cuenta Activa</span>
                </div>
                <div className="meta-links">
                  <span className="tax-id"><Hash size={12}/> {client.tax_id || 'PENDIENTE'}</span>
                  <a href={client.website} target="_blank" className="web-link"><Globe size={12}/> {client.website?.replace('https://','')}</a>
                </div>
              </div>
            </div>
          </div>

          <div className="header-actions">
            {!isEditing ? (
              <>
                <button className="btn-refine-white" onClick={() => setIsEditing(true)}>
                  <Pencil size={14}/> Editar Perfil
                </button>
                <div className="action-divider"></div>
                <button className="btn-action-outline"><Calculator size={14}/> Nueva Cotización</button>
                <button className="btn-refine-green"><Plus size={14}/> Nuevo Embarque</button>
              </>
            ) : (
              <div className="editing-actions">
                <button className="btn-cancel" onClick={() => setIsEditing(false)}>Descartar</button>
                <button className="btn-refine-green" onClick={saveClientData}><Save size={14}/> Guardar Maestro</button>
              </div>
            )}
          </div>
        </header>

        <div className="main-grid">
          <div className="main-col">
            
            {/* --- HUB DE DIRECCIONES LOGÍSTICAS --- */}
            <section className="pro-card">
              <div className="card-header-v2">
                <h3>Configuración de Direcciones</h3>
                <MapPin size={16} className="text-slate-400"/>
              </div>
              <div className="logistics-grid">
                {[
                  { title: 'Billing Party', key: 'billing_info', icon: <CreditCard size={14}/> },
                  { title: 'Consignee Default', key: 'consignee_info', icon: <User size={14}/> },
                  { title: 'Notify Party', key: 'notify_info', icon: <Bell size={14}/> }
                ].map((item) => (
                  <div className="address-box" key={item.key}>
                    <div className="address-header">
                      {item.icon} <span>{item.title}</span>
                    </div>
                    {isEditing ? (
                      <textarea 
                        className="edit-area"
                        value={editData[item.key]?.address}
                        onChange={e => setEditData({...editData, [item.key]: {...editData[item.key], address: e.target.value}})}
                      />
                    ) : (
                      <p className="address-text">{client[item.key]?.address || 'No definida'}</p>
                    )}
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(client[item.key]?.address)}`} target="_blank" className="maps-link">Ver en Mapa</a>
                  </div>
                ))}
              </div>
            </section>

            {/* --- ACTIVIDAD RECIENTE --- */}
            <section className="pro-card">
              <div className="card-header-v2">
                <h3>Monitor de Embarques</h3>
                <Link href="/admin/shipments" className="link-all">Ver Histórico <ExternalLink size={12}/></Link>
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
                      <tr key={s.id} className="row-hover">
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

          {/* --- SIDEBAR: CONTACTOS Y STAKEHOLDERS --- */}
          <aside className="side-col">
            <div className="pro-card mini-padding">
              <h4 className="side-label">Directorio Interno</h4>
              <div className="stakeholders-stack">
                {[
                  { id: 'purchasing', label: 'Compras', icon: <ShoppingBag size={14}/>, color: '#3b82f6' },
                  { id: 'accounting', label: 'Pagos / Contab.', icon: <CreditCard size={14}/>, color: '#ef4444' },
                  { id: 'logistics', label: 'Logística / Tráfico', icon: <Truck size={14}/>, color: '#10b981' }
                ].map(dept => (
                  <details className="dept-accordion" key={dept.id}>
                    <summary style={{ borderLeftColor: dept.color }}>
                      <div className="sum-left">{dept.icon} <span>{dept.label}</span></div>
                      <ChevronDown size={14}/>
                    </summary>
                    <div className="dept-form">
                      {isEditing ? (
                        <>
                          <input placeholder="Nombre" value={editData.stakeholders[dept.id].name} onChange={e => setEditData({...editData, stakeholders: {...editData.stakeholders, [dept.id]: {...editData.stakeholders[dept.id], name: e.target.value}}})} />
                          <input placeholder="Email" value={editData.stakeholders[dept.id].email} onChange={e => setEditData({...editData, stakeholders: {...editData.stakeholders, [dept.id]: {...editData.stakeholders[dept.id], email: e.target.value}}})} />
                        </>
                      ) : (
                        <div className="dept-view">
                          <p><strong>{client.stakeholders[dept.id]?.name || 'No asignado'}</strong></p>
                          <a href={`mailto:${client.stakeholders[dept.id]?.email}`} className="mailto-btn">
                            <Mail size={12}/> {client.stakeholders[dept.id]?.email || 'Sin email'}
                          </a>
                          <a href={`tel:${client.stakeholders[dept.id]?.phone}`} className="tel-btn">
                            <Phone size={12}/> {client.stakeholders[dept.id]?.phone || 'Sin tel'}
                          </a>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>

            <div className="pro-card mini-padding">
              <h4 className="side-label">Salud del Expediente (KYC)</h4>
              <div className="kyc-list">
                <div className="kyc-item done"><CheckCircle2 size={14}/> Registro Fiscal (RUC)</div>
                <div className="kyc-item pending"><Clock size={14}/> Pacto Social Vigente</div>
                <button className="btn-add-doc"><Plus size={12}/> Adjuntar Documento</button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .view-container { padding: 30px 40px; max-width: 1600px; margin: 0 auto; background: #f8fafc; min-height: 100vh; }
        
        /* HEADER PRO */
        .header-pro { display: flex; justify-content: space-between; align-items: center; background: white; padding: 24px; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .logo-section { display: flex; align-items: center; gap: 20px; }
        .logo-holder { width: 64px; height: 64px; background: #f1f5f9; border-radius: 14px; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #e2e8f0; }
        .logo-holder img { width: 100%; height: 100%; object-fit: contain; padding: 6px; }
        .client-titles h1 { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
        .badge-active { font-size: 9px; font-weight: 900; color: #166534; background: #dcfce7; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; }
        .meta-links { display: flex; gap: 15px; margin-top: 5px; font-size: 12px; color: #64748b; font-weight: 600; }
        .web-link { color: #2563eb; text-decoration: none; display: flex; align-items: center; gap: 4px; }

        .header-actions { display: flex; align-items: center; gap: 12px; }
        .action-divider { width: 1px; height: 24px; background: #e2e8f0; margin: 0 8px; }
        .btn-refine-green { background: #16a34a; color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-action-outline { background: white; color: #475569; border: 1px solid #e2e8f0; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-refine-white { background: white; border: 1px solid #e2e8f0; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; }

        /* GRID */
        .main-grid { display: grid; grid-template-columns: 1fr 360px; gap: 24px; }
        .pro-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px; overflow: hidden; }
        .card-header-v2 { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .card-header-v2 h3 { font-size: 15px; font-weight: 800; color: #1e293b; margin: 0; }

        /* LOGISTICS HUB */
        .logistics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #f1f5f9; }
        .address-box { background: white; padding: 24px; display: flex; flex-direction: column; }
        .address-header { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px; }
        .address-text { font-size: 13px; color: #334155; line-height: 1.5; font-weight: 500; min-height: 60px; }
        .maps-link { font-size: 11px; font-weight: 700; color: #2563eb; text-decoration: none; margin-top: auto; }
        .edit-area { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; font-size: 13px; min-height: 80px; resize: none; }

        /* STAKEHOLDERS */
        .side-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; }
        .mini-padding { padding: 24px; }
        .dept-accordion { margin-bottom: 10px; border-radius: 12px; border: 1px solid #f1f5f9; overflow: hidden; }
        .dept-accordion summary { padding: 12px 16px; background: #fafafa; display: flex; justify-content: space-between; align-items: center; cursor: pointer; list-style: none; font-weight: 700; font-size: 13px; border-left: 4px solid #cbd5e1; }
        .sum-left { display: flex; align-items: center; gap: 10px; }
        .dept-view { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        .mailto-btn, .tel-btn { font-size: 12px; color: #475569; text-decoration: none; display: flex; align-items: center; gap: 8px; font-weight: 500; }
        .mailto-btn:hover { color: #2563eb; }

        /* TABLE */
        .table-refine { width: 100%; border-collapse: collapse; }
        .table-refine th { text-align: left; padding: 12px 24px; font-size: 11px; color: #94a3b8; font-weight: 800; background: #fafafa; }
        .table-refine td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .code-tag { font-family: monospace; font-weight: 800; color: #16a34a; background: #f0fdf4; padding: 4px 8px; border-radius: 6px; }

        .kyc-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .kyc-item.done { background: #f0fdf4; color: #166534; }
        .kyc-item.pending { background: #fffbeb; color: #92400e; }
        .btn-add-doc { width: 100%; padding: 10px; background: none; border: 1.5px dashed #e2e8f0; border-radius: 10px; color: #94a3b8; font-weight: 700; cursor: pointer; font-size: 12px; }

        .loader-full { display: grid; place-items: center; height: 100vh; color: #16a34a; }
      `}</style>
    </AdminLayout>
  );
}