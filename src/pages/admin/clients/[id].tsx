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
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file || !id) return;

      setUploading(true);
      
      // Generamos un nombre único para evitar problemas de caché
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;

      // 1. Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Obtener la URL (O el nombre del archivo para construirla después)
      // Actualizamos la tabla 'clients' con el nuevo nombre de archivo
      const { error: updateError } = await supabase
        .from('clients')
        .update({ logo_url: fileName })
        .eq('id', id);

      if (updateError) throw updateError;

      // 3. Actualizamos el estado local para que el cambio sea instantáneo
      setClient({ ...client, logo_url: fileName });
      notify("Logo actualizado correctamente", "success");

    } catch (err: any) {
      console.error(err);
      notify("Error al subir el logo", "error");
    } finally {
      setUploading(false);
    }
  };
  
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({
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
             <div className={`logo-holder ${uploading ? 'is-loading' : ''}`}>
  {client.logo_url ? (
    <img 
      key={client.logo_url}
      src={`https://oqgkbduqztrpfhfclker.supabase.co/storage/v1/object/public/client-logos/${client.logo_url}`} 
      alt="Logo" 
      onError={(e: any) => {
        e.target.onerror = null;
        e.target.src = 'https://via.placeholder.com/150?text=Error+URL';
      }} 
    />
  ) : (
    <Building2 size={24} className="opacity-20" />
  )}
  <label className="upload-btn">
    {uploading ? <Loader2 className="animate-spin" size={14} /> : <FileUp size={14} />}
    <input type="file" hidden onChange={handleLogoUpload} disabled={uploading} accept="image/*" />
  </label>
</div>
              <div className="client-titles">
  <div className="name-row">
    {isEditing ? (
      <input 
        className="header-input-name" 
        value={editData.name} 
        onChange={e => setEditData({...editData, name: e.target.value})} 
      />
    ) : (
      <h1>{client.name}</h1>
    )}
    <span className="badge-active">Cuenta Activa</span>
  </div>
  <div className="meta-links">
    <span className="tax-id">
      <Hash size={12}/> 
      {isEditing ? (
        <input 
          className="header-input-meta" 
          value={editData.tax_id} 
          onChange={e => setEditData({...editData, tax_id: e.target.value})} 
        />
      ) : (
        client.tax_id || 'SIN RUC'
      )}
    </span>
    <span className="web-link">
      <Globe size={12}/> 
      {isEditing ? (
        <input 
          className="header-input-meta" 
          value={editData.website} 
          placeholder="https://..."
          onChange={e => setEditData({...editData, website: e.target.value})} 
        />
      ) : (
        <a href={client.website} target="_blank">{client.website?.replace('https://','')}</a>
      )}
    </span>
  </div>
</div>
            </div>
          </div>

          <div className="header-actions-sidebar">
  {!isEditing ? (
    <>
      <button className="btn-modern-primary pulse-green">
        <div className="btn-content">
          <Plus size={16} strokeWidth={2.5}/>
          <span>Nuevo Embarque</span>
        </div>
      </button>

      <button className="btn-modern-secondary">
        <div className="btn-content">
          <Calculator size={16} />
          <span>Nueva Cotización</span>
        </div>
      </button>

      <button className="btn-modern-ghost" onClick={() => setIsEditing(true)}>
        <div className="btn-content">
          <Pencil size={14} />
          <span>Editar Perfil</span>
        </div>
      </button>
    </>
  ) : (
    <div className="editing-stack">
      <button className="btn-modern-save" onClick={saveClientData}>
        <Save size={16} /> Guardar Cambios
      </button>
      <button className="btn-modern-cancel" onClick={() => setIsEditing(false)}>
        Descartar
      </button>
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
  <h4 className="side-label">Datos Maestros</h4>
  <div className="master-data-stack">
    <div className="master-item">
      <label>País de Origen</label>
      {isEditing ? (
        <input 
          value={editData.country} 
          onChange={e => setEditData({...editData, country: e.target.value})} 
        />
      ) : (
        <div className="val-box"><MapPin size={12}/> {client.country || 'Panamá'}</div>
      )}
    </div>
    
    <div className="master-item">
      <label>Incoterm Preferido</label>
      {isEditing ? (
        <select 
          value={editData.default_incoterm} 
          onChange={e => setEditData({...editData, default_incoterm: e.target.value})}
        >
          <option value="FOB">FOB</option>
          <option value="CIF">CIF</option>
          <option value="EXW">EXW</option>
          <option value="DDP">DDP</option>
        </select>
      ) : (
        <div className="val-box"><ShoppingBag size={12}/> {client.default_incoterm || 'FOB'}</div>
      )}
    </div>
  </div>
</div>
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
  /* 1. LAYOUT BASE */
  .view-container { 
    padding: 30px 40px; 
    max-width: 1600px; 
    margin: 0 auto; 
    background: #f8fafc; 
    min-height: 100vh; 
    font-family: 'Inter', sans-serif;
  }
  .main-grid { 
    display: grid; 
    grid-template-columns: 1fr 360px; 
    gap: 24px; 
    align-items: start;
  }
  .pro-card { 
    background: white; 
    border-radius: 20px; 
    border: 1px solid #e2e8f0; 
    margin-bottom: 24px; 
    overflow: hidden; 
  }

  /* 2. HEADER COMMAND CENTER (CORREGIDO) */
  .header-pro { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start; /* Alinea arriba para dar espacio a los botones */
    background: white; 
    padding: 28px; 
    border-radius: 24px; 
    border: 1px solid #e2e8f0; 
    margin-bottom: 24px; 
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.04); 
  }

  .header-left { 
    display: flex; 
    align-items: center; 
    gap: 24px; 
    flex: 1; /* Toma todo el espacio sobrante */
  }

  /* LOGO */
  .logo-holder { 
    width: 80px; height: 80px; 
    background: #f8fafc; 
    border-radius: 18px; 
    position: relative; 
    display: flex; align-items: center; justify-content: center; 
    overflow: hidden; border: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .logo-holder img { width: 100%; height: 100%; object-fit: contain; padding: 10px; }
  .upload-btn { 
    position: absolute; inset: 0; background: rgba(0,0,0,0.6); 
    color: white; display: flex; align-items: center; justify-content: center; 
    opacity: 0; cursor: pointer; transition: 0.2s; 
  }
  .logo-holder:hover .upload-btn { opacity: 1; }

  /* TITLES & INPUTS */
  .client-titles { display: flex; flex-direction: column; gap: 4px; }
  .name-row { display: flex; align-items: center; gap: 12px; }
  .name-row h1 { font-size: 26px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.03em; }
  
  .header-input-name { 
    font-size: 24px; font-weight: 800; border: 2px solid #16a34a; 
    border-radius: 10px; padding: 6px 14px; background: #f0fdf4; 
    color: #0f172a; width: 400px; outline: none;
  }
  
  .badge-active { 
    font-size: 10px; font-weight: 800; color: #166534; background: #dcfce7; 
    padding: 4px 10px; border-radius: 20px; text-transform: uppercase; 
  }

  .meta-links { display: flex; gap: 20px; margin-top: 8px; align-items: center; }
  .tax-id, .web-link { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; font-weight: 600; }
  .web-link a { color: #2563eb; text-decoration: none; }
  
  .header-input-meta { 
    border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 10px; 
    font-size: 12px; width: 180px; background: #f8fafc;
  }

  /* 3. BOTONES MODERNOS (ZONA DERECHA) */
  .header-actions-sidebar { 
    display: flex; 
    flex-direction: column; 
    gap: 10px; 
    min-width: 220px; 
    padding-left: 20px;
    border-left: 1px solid #f1f5f9;
  }
  
  .btn-modern-primary { 
    background: #16a34a; color: white; border: none; padding: 12px 20px; 
    border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; 
    transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
    width: 100%;
  }
  .btn-modern-primary:hover { background: #15803d; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(22, 163, 74, 0.35); }
  
  .btn-modern-secondary { 
    background: #ffffff; color: #334155; border: 1px solid #e2e8f0; padding: 12px 20px; 
    border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; transition: 0.2s;
    width: 100%;
  }
  .btn-modern-secondary:hover { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }

  .btn-modern-ghost { 
    background: transparent; color: #94a3b8; border: none; padding: 6px; 
    font-weight: 700; font-size: 12px; cursor: pointer; text-align: right; 
    transition: 0.2s;
  }
  .btn-modern-ghost:hover { color: #16a34a; background: #f0fdf4; border-radius: 6px; }

  /* MODO EDICIÓN */
  .editing-stack { display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .btn-modern-save { 
    background: #0f172a; color: white; border: none; padding: 14px; 
    border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .btn-modern-cancel { 
    background: #fff1f2; color: #e11d48; border: none; padding: 10px; 
    border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; width: 100%;
  }

  /* 4. CONTENIDO (TABLES & CARDS) */
  .card-header-v2 { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
  .card-header-v2 h3 { font-size: 15px; font-weight: 800; color: #1e293b; margin: 0; }
  
  .logistics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #e2e8f0; }
  .address-box { background: white; padding: 24px; display: flex; flex-direction: column; gap: 12px; }
  .address-header { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
  .address-text { font-size: 13px; color: #334155; line-height: 1.6; font-weight: 500; margin: 0; }
  .edit-area { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; font-size: 13px; min-height: 90px; resize: none; width: 100%; }

  /* STAKEHOLDERS & SIDEBAR */
  .side-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; display: block; }
  .master-data-stack { display: flex; flex-direction: column; gap: 16px; }
  .master-item label { display: block; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
  .master-item input, .master-item select { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; font-weight: 600; }
  
  .dept-accordion { margin-bottom: 12px; border-radius: 14px; border: 1px solid #f1f5f9; overflow: hidden; }
  .dept-accordion summary { 
    padding: 14px 18px; background: #fafafa; display: flex; justify-content: space-between; 
    align-items: center; cursor: pointer; list-style: none; font-weight: 700; font-size: 13px; border-left: 4px solid #cbd5e1; 
  }

  /* UTILS */
  .pulse-green { animation: pulse-sutil 2s infinite; }
  @keyframes pulse-sutil {
    0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(22, 163, 74, 0); }
    100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
  }
  .loader-full { display: grid; place-items: center; height: 100vh; color: #16a34a; }
`}</style>
    </AdminLayout>
  );
}