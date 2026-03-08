import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout, notify } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Mail, Phone, Pencil, Loader2, Plus, 
  ExternalLink, User, Save, Globe, Bell, ShoppingBag, 
  CreditCard, Truck, ChevronDown, Calculator
} from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  // --- ESTADOS INICIALIZADOS CON ESTRUCTURA SEGURA ---
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingMaster, setIsEditingMaster] = useState(false);
  
  // EditData con valores por defecto para evitar errores de "undefined"
  const [editData, setEditData] = useState<any>({
    name: '',
    stakeholders: {
      purchasing: { name: '', email: '', phone: '' },
      accounting: { name: '', email: '', phone: '' },
      logistics: { name: '', email: '', phone: '' }
    }
  });

  const statusConfig: any = {
    'CREATED': { label: 'Creado', class: 'created' },
    'PACKED': { label: 'Empacado', class: 'packed' },
    'IN_TRANSIT': { label: 'En Tránsito', class: 'transit' },
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

      // Unificación de estructura para evitar errores de lectura
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

  if (loading || !client) return <div className="loader-full"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <AdminLayout title={`Expediente: ${client.name}`}>
      <div className="view-container">
        
        {/* --- HEADER --- */}
        <header className="ff-header-minimal">
          <div className="ff-header-top-row">
            <div className="ff-client-profile">
              <div className="ff-logo-wrapper">
                {client.logo_url ? (
                  <img src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}`} className="ff-logo-img" />
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
            {/* --- DATOS MAESTROS --- */}
            <section className="pro-card">
              <div className="card-header-v2">
                <div className="header-title-group">
                  <Building2 size={18} className="ff-icon-accent" />
                  <h3>Expediente Legal y Comercial</h3>
                </div>
                {!isEditingMaster ? (
                  <button className="ff-btn-edit-inline" onClick={() => setIsEditingMaster(true)}>
                    <Pencil size={14} /> Editar Información
                  </button>
                ) : (
                  <div className="ff-edit-inline-actions">
                    <button className="ff-save-mini" onClick={saveMasterData}><Save size={14}/> Guardar</button>
                    <button className="ff-cancel-mini" onClick={() => { setIsEditingMaster(false); setEditData(client); }}>Cancelar</button>
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

            {/* --- TABLA DE EMBARQUES --- */}
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

          <aside className="side-col">
            <div className="pro-card mini-padding">
              <h4 className="side-label">Direcciones Logísticas</h4>
              <div className="stakeholders-stack">
                {[
                  { id: 'billing_info', label: 'Billing Party', icon: <CreditCard size={14}/> },
                  { id: 'consignee_info', label: 'Consignee Default', icon: <User size={14}/> },
                  { id: 'notify_info', label: 'Notify Party', icon: <Bell size={14}/> }
                ].map(addr => (
                  <details className="dept-accordion" key={addr.id}>
                    <summary><div className="sum-left">{addr.icon} <span>{addr.label}</span></div><ChevronDown size={14}/></summary>
                    <div className="dept-view">
                      <p className="ff-address-text">{client[addr.id]?.address || 'No definida'}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>

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
                      {/* ACCESO SEGURO CON OPTIONAL CHAINING */}
                      <p><strong>{client.stakeholders?.[dept.id]?.name || 'No asignado'}</strong></p>
                      <div className="mailto-btn"><Mail size={12}/> {client.stakeholders?.[dept.id]?.email || 'Sin correo'}</div>
                      <div className="tel-btn"><Phone size={12}/> {client.stakeholders?.[dept.id]?.phone || 'Sin tel.'}</div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
  /* CONTENEDOR PRINCIPAL */
  .view-container { 
    padding: 20px 40px; 
    max-width: 1600px; 
    margin: 0 auto; 
    background: #f8fafc; 
    min-height: 100vh; 
    font-family: 'Inter', sans-serif; 
  }

  /* HEADER SIN BORDES */
  .ff-header-minimal { 
    padding: 10px 0 40px 0; 
    background: transparent; 
  }
  .ff-header-top-row { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
  }

  /* CLIENT PROFILE & BADGE INLINE */
  .ff-client-profile { display: flex; align-items: center; gap: 20px; }
  .ff-name-row { display: flex; align-items: center; gap: 12px; }
  .ff-client-name-display { 
    font-size: 28px; 
    font-weight: 900; 
    color: #0f172a; 
    letter-spacing: -0.03em; 
    margin: 0;
  }
  .ff-badge-status-inline { 
    background: rgba(34, 197, 94, 0.1); 
    color: #166534; 
    padding: 4px 12px; 
    border-radius: 8px; 
    font-size: 11px; 
    font-weight: 800; 
    border: 1px solid rgba(34, 197, 94, 0.2);
    white-space: nowrap;
  }

  /* BOTONES MINIMALISTAS (TRANSACCIONALES) */
  .ff-header-actions-minimal { display: flex; gap: 12px; }
  .ff-btn-mini { 
    display: flex; 
    align-items: center; 
    gap: 8px; 
    padding: 10px 18px; 
    border-radius: 12px; 
    font-size: 13px; 
    font-weight: 700; 
    cursor: pointer; 
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
    border: 1px solid transparent; 
  }

  /* Botón Blanco / Glass */
  .ff-btn-glass-secondary { 
    background: white; 
    color: #475569; 
    border-color: #e2e8f0;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .ff-btn-glass-secondary:hover { 
    background: #f8fafc; 
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }

  /* Botón Dark Transparent */
  .ff-btn-glass-primary { 
    background: rgba(15, 23, 42, 0.06); 
    color: #0f172a; 
    border-color: rgba(15, 23, 42, 0.08); 
  }
  .ff-btn-glass-primary:hover { 
    background: #0f172a; 
    color: white; 
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  }

  /* GRID Y CARDS */
  .main-grid { display: grid; grid-template-columns: 1fr 360px; gap: 30px; }
  .pro-card { 
    background: white; 
    border-radius: 24px; 
    border: 1px solid #eef2f6; 
    margin-bottom: 24px; 
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01);
  }
  .card-header-v2 { 
    padding: 24px; 
    border-bottom: 1px solid #f8fafc; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
  }

  /* INPUTS DE EDICIÓN */
  .ff-master-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 24px; }
  .ff-master-input { 
    width: 100%; 
    padding: 10px 12px; 
    border: 1px solid #e2e8f0; 
    border-radius: 10px; 
    font-size: 14px; 
    font-weight: 600; 
    background: #fdfdfd; 
    color: #1e293b;
    transition: border 0.2s;
  }
  .ff-master-input:focus { 
    border-color: #3b82f6; 
    outline: none; 
    background: white;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* SIDEBAR REFINADO */
  .mini-padding { padding: 24px; }
  .side-label { 
    font-size: 11px; 
    font-weight: 800; 
    color: #94a3b8; 
    text-transform: uppercase; 
    letter-spacing: 0.05em;
    margin-bottom: 16px; 
  }
  .dept-accordion { margin-bottom: 12px; border-radius: 16px; border: 1px solid #f1f5f9; background: #fafafa; }
  .dept-accordion summary { padding: 14px; font-weight: 700; color: #475569; }
  .dept-view { padding: 0 14px 14px 14px; background: #fafafa; }

  /* LOADER */
  .loader-full { height: 100vh; display: flex; align-items: center; justify-content: center; color: #3b82f6; }
`}</style>
    </AdminLayout>
  );
}