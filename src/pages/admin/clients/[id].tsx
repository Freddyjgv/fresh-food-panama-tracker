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
        
        {/* --- HEADER ULTRA-MINIMAL PORTAL --- */}
<header className="ff-header-minimal">
  <div className="ff-header-top-row">
    <div className="ff-client-profile">
      <div className="ff-logo-wrapper">
        {client.logo_url ? (
          <img 
            src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}`} 
            className="ff-logo-img" 
          />
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

    {/* BOTONES MINIMALISTAS CON TRANSPARENCIAS */}
    <div className="ff-header-actions-minimal">
      <button className="ff-btn-mini ff-btn-glass-secondary" onClick={() => router.push(`/admin/quotes/new?clientId=${id}`)}>
        <Calculator size={14} />
        <span>Nueva Cotización</span>
      </button>
      <button className="ff-btn-mini ff-btn-glass-primary" onClick={() => router.push(`/admin/shipments/new?clientId=${id}`)}>
        <Plus size={14} />
        <span>Nuevo Embarque</span>
      </button>
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
  /* ELIMINACIÓN DE BORDES Y AJUSTE DE HEADER */
  .ff-header-minimal {
    background: transparent; /* Eliminamos el fondo blanco sólido si prefieres que flote */
    padding: 20px 0 32px 0; /* Espaciado sin bordes */
    margin-bottom: 20px;
  }

  .ff-header-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* LOGO Y NOMBRE */
  .ff-logo-wrapper {
    width: 64px;
    height: 64px;
    background: white;
    border-radius: 14px;
    border: 1px solid #f1f5f9;
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  }

  .ff-name-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ff-client-name-display {
    font-size: 24px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
  }

  /* BADGE AL LADO DEL NOMBRE */
  .ff-badge-status-inline {
    background: rgba(34, 197, 94, 0.1);
    color: #166534;
    padding: 2px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  /* STACK DE INFORMACIÓN DEBAJO */
  .ff-client-meta-stack {
    margin-top: 4px;
  }

  .ff-legal-name-row {
    font-size: 14px;
    font-weight: 600;
    color: #475569;
  }

  .ff-meta-sub-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
    margin-top: 2px;
  }

  .ff-meta-divider {
    color: #e2e8f0;
  }

  /* BOTONES MINIMALISTAS (GLASSMORFISM) */
  .ff-header-actions-minimal {
    display: flex;
    gap: 10px;
  }

  .ff-btn-mini {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.2s all ease;
    border: 1px solid transparent;
  }

  /* Transparencia para Cotización */
  .ff-btn-glass-secondary {
    background: rgba(241, 245, 249, 0.7);
    color: #475569;
    border-color: #e2e8f0;
  }
  .ff-btn-glass-secondary:hover {
    background: #f1f5f9;
    transform: translateY(-1px);
  }

  /* Transparencia para Embarque (Sutilmente oscuro) */
  .ff-btn-glass-primary {
    background: rgba(15, 23, 42, 0.05);
    color: #0f172a;
    border-color: rgba(15, 23, 42, 0.1);
  }
  .ff-btn-glass-primary:hover {
    background: #0f172a;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  }
`}</style>
    </AdminLayout>
  );
}