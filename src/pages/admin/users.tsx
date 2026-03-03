import { useState, useEffect, useRef } from "react";
import Link from "next/link"; 
import { 
  Plus, X, Building2, MapPin, Phone, Mail, 
  Trash2, Globe, Search, Loader2, CheckCircle, Edit3, ExternalLink 
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";

// --- TIPOS ---
type ClientItem = {
  id: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  contact_email: string;
  phone?: string;
  country?: string;
  has_platform_access?: boolean;
  shipping_addresses?: any[];
};

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);

  const initialForm = {
    id: null,
    name: "", 
    legal_name: "", 
    tax_id: "", 
    email_corp: "", 
    phone_corp: "", 
    country_origin: "Panamá", 
    payment_condition: "Prepagado", 
    billing_address: "",
    website: "",
    contact_name: "",
    shipping_addresses: [{ id: Date.now(), address: "" }],
    staff_name: "", 
    staff_email: "", 
    staff_role: "admin"
  };
  
  const [f, setF] = useState(initialForm);

  const getAuthToken = async () => {
    if (tokenRef.current) return tokenRef.current;
    const { data: { session } } = await supabase.auth.getSession();
    tokenRef.current = session?.access_token || null;
    return tokenRef.current;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const endpoint = activeTab === 'clients' ? '/.netlify/functions/listClients' : '/.netlify/functions/listUsers';
      
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Error al obtener datos");
      const data = await res.json();
      setDataList(data.items || []);
    } catch (e: any) { 
      setError(e.message);
      console.error(e); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const openEdit = (item: any) => {
    setF({
      ...initialForm,
      ...item,
      id: item.id,
      email_corp: item.contact_email || item.email || "",
      phone_corp: item.phone || "",
      country_origin: item.country || "Panamá",
      shipping_addresses: (item.shipping_addresses && item.shipping_addresses.length > 0) 
        ? item.shipping_addresses 
        : [{ id: Date.now(), address: "" }]
    });
    setIsDrawerOpen(true);
  };

  const handleAuthorizeAccess = async (client: ClientItem) => {
    const confirmed = window.confirm(
      `¿Otorgar acceso a la plataforma a ${client.name}?\n\nSe enviará invitación a: ${client.contact_email}`
    );
    if (!confirmed) return;

    try {
      const token = await getAuthToken();
      const res = await fetch("/.netlify/functions/inviteUser", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          email: client.contact_email, 
          full_name: client.name, 
          role: 'client',
          client_id: client.id 
        })
      });

      if (res.ok) {
        alert("Acceso autorizado correctamente.");
        loadData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.message}`);
      }
    } catch (e) { alert("Error de conexión con el servidor."); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = await getAuthToken();
      const endpoint = activeTab === 'clients' ? "/.netlify/functions/manageClient" : "/.netlify/functions/inviteUser";
      const payload = activeTab === 'clients' ? f : { email: f.staff_email, full_name: f.staff_name, role: f.staff_role };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsDrawerOpen(false);
        setF(initialForm);
        loadData();
      } else {
        const err = await res.json();
        alert(err.message);
      }
    } finally { setIsSaving(false); }
  };

  return (
    <AdminLayout title="Directorio" subtitle="Gestión de Clientes y Staff">
      
      <div className="tabs">
        <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>Clientes</button>
        <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>Equipo FF</button>
      </div>

      <div className="toolbar">
        <button className="btnCreate" onClick={() => { setF(initialForm); setIsDrawerOpen(true); }}>
          <Plus size={18} /> {activeTab === 'clients' ? 'Registrar Cliente' : 'Invitar Staff'}
        </button>
      </div>

      <div className="card">
        {error ? (
          <div className="error-msg">{error}</div>
        ) : (
          <div className="table-container">
            <table className="pro-table">
              <thead>
                {activeTab === 'clients' ? (
                  <tr><th>CLIENTE</th><th>CONTACTO</th><th>ESTADO</th><th>ACCIONES</th></tr>
                ) : (
                  <tr><th>NOMBRE</th><th>EMAIL</th><th>ROL</th><th>ESTADO</th></tr>
                )}
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="loading-cell"><Loader2 className="animate-spin" /> Cargando directorio...</td></tr>
                ) : dataList.length === 0 ? (
                  <tr><td colSpan={4} className="empty-cell">No se encontraron registros.</td></tr>
                ) : (
                  dataList.map(item => (
                    <tr key={item.id} className="row-hover">
                      {activeTab === 'clients' ? (
                        <>
                          <td>
                            <Link href={`/admin/clients/${item.id}`} className="client-link">
                              <div className="client-info">
                                <strong>{item.name}</strong> 
                                <span className="id-tag">{item.tax_id || 'PROSPECTO'}</span>
                              </div>
                            </Link>
                          </td>
                          <td>
                            <div className="contact-cell">
                              <span><Mail size={12}/> {item.contact_email}</span>
                              <span><Phone size={12}/> {item.phone || '---'}</span>
                            </div>
                          </td>
                          <td>
                            {item.has_platform_access ? 
                              <span className="badge-ok"><CheckCircle size={12}/> Activo</span> : 
                              <span className="badge-prospect">Solo Registro</span>
                            }
                          </td>
                          <td className="actions-cell">
                            <button className="btnIcon" onClick={() => openEdit(item)}><Edit3 size={16}/></button>
                            {!item.has_platform_access && (
                              <button className="btnAuth" onClick={() => handleAuthorizeAccess(item)}>Habilitar App</button>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td><strong>{item.full_name}</strong></td>
                          <td>{item.email}</td>
                          <td><span className="role-tag">{item.role}</span></td>
                          <td>{item.confirmed_at ? <span className="st-active">● Activo</span> : <span className="st-pending">● Pendiente</span>}</td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isDrawerOpen && (
        <>
          <div className="overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer">
            <div className="d-header">
              <h3>{f.id ? 'Actualizar Información' : (activeTab === 'clients' ? 'Nuevo Registro de Cliente' : 'Invitar al Equipo')}</h3>
              <button className="btn-close" onClick={() => setIsDrawerOpen(false)}><X size={20} /></button>
            </div>

            <form className="d-body" onSubmit={handleSave}>
              {activeTab === 'clients' ? (
                <>
                  <div className="group">
                    <label>IDENTIDAD COMERCIAL</label>
                    <input required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                    <input placeholder="Razón Social Legal" value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} />
                    <input placeholder="RUC / Tax ID" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                  </div>

                  <div className="group">
                    <label>LOGÍSTICA Y CONTACTO</label>
                    <input required type="email" placeholder="Email Corporativo" value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} />
                    <input placeholder="Teléfono de contacto" value={f.phone_corp} onChange={e=>setF({...f, phone_corp:e.target.value})} />
                    <select value={f.country_origin} onChange={e=>setF({...f, country_origin:e.target.value})}>
                      <option value="Panamá">Panamá</option>
                      <option value="Costa Rica">Costa Rica</option>
                      <option value="Colombia">Colombia</option>
                    </select>
                  </div>

                  <div className="group">
                    <label>SHIPPING (DIRECCIONES DE ENTREGA)</label>
                    {f.shipping_addresses.map((s, i) => (
                      <div key={s.id} className="row-input">
                        <input placeholder={`Punto de entrega #${i+1}`} value={s.address} onChange={e => {
                          const ns = [...f.shipping_addresses]; ns[i].address = e.target.value; setF({...f, shipping_addresses: ns});
                        }} />
                        {f.shipping_addresses.length > 1 && (
                          <button type="button" onClick={() => setF({...f, shipping_addresses: f.shipping_addresses.filter(x => x.id !== s.id)})} className="btnDel"><Trash2 size={14}/></button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn-add" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir dirección</button>
                  </div>
                </>
              ) : (
                <div className="group">
                  <label>DATOS DE ACCESO FF</label>
                  <input required placeholder="Nombre Completo" value={f.staff_name} onChange={e=>setF({...f, staff_name:e.target.value})} />
                  <input required type="email" placeholder="Email @freshflow.com" value={f.staff_email} onChange={e=>setF({...f, staff_email:e.target.value})} />
                  <select value={f.staff_role} onChange={e=>setF({...f, staff_role:e.target.value})}>
                    <option value="admin">Administrador</option>
                    <option value="operaciones">Operaciones</option>
                    <option value="ventas">Ventas</option>
                  </select>
                </div>
              )}
              <button className="btnSubmit" disabled={isSaving}>{isSaving ? "Procesando..." : "Guardar Información"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .tabs { display: flex; gap: 30px; border-bottom: 1px solid #e2e8f0; margin-bottom: 25px; }
        .tabs button { padding: 12px 5px; background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 700; color: #94a3b8; transition: 0.2s; position: relative; }
        .tabs button.active { color: #1f7a3a; }
        .tabs button.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: #1f7a3a; }
        
        .toolbar { margin-bottom: 20px; }
        .btnCreate { background: #1f7a3a; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; }

        .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; padding: 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .pro-table td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
        
        /* LINK AREA */
        :global(.client-link) { text-decoration: none !important; color: inherit !important; display: block; cursor: pointer !important; }
        .client-info { display: flex; flex-direction: column; gap: 2px; }
        .client-info strong { color: #1e293b; font-size: 14px; }
        .client-info:hover strong { color: #1f7a3a; text-decoration: underline; }
        .id-tag { font-size: 10px; color: #94a3b8; font-weight: 700; }

        .contact-cell { display: flex; flex-direction: column; gap: 4px; color: #64748b; font-size: 12px; }
        .contact-cell span { display: flex; align-items: center; gap: 6px; }

        .badge-ok { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 5px; width: fit-content; }
        .badge-prospect { background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }

        .actions-cell { display: flex; gap: 10px; align-items: center; }
        .btnIcon { background: #fff; border: 1px solid #e2e8f0; padding: 7px; border-radius: 6px; cursor: pointer; color: #64748b; transition: 0.2s; }
        .btnIcon:hover { border-color: #1f7a3a; color: #1f7a3a; background: #f0fdf4; }
        .btnAuth { background: #1f7a3a; color: white; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 700; }

        .drawer { position: fixed; right: 0; top: 0; width: 450px; height: 100%; background: white; z-index: 1001; box-shadow: -10px 0 30px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
        .d-header { padding: 25px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .btn-close { background: none; border: none; color: #94a3b8; cursor: pointer; }
        .d-body { padding: 25px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }

        .group { display: flex; flex-direction: column; gap: 12px; padding: 18px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
        .group label { font-size: 11px; font-weight: 800; color: #1f7a3a; letter-spacing: 0.5px; }

        .row-input { display: flex; gap: 8px; }
        .btnDel { background: #fff1f1; color: #ef4444; border: 1px solid #fee2e2; padding: 8px; border-radius: 8px; cursor: pointer; }
        .btn-add { background: white; border: 1px dashed #cbd5e1; color: #64748b; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; }
        .btn-add:hover { border-color: #1f7a3a; color: #1f7a3a; }

        .btnSubmit { background: #1f7a3a; color: white; border: none; padding: 16px; border-radius: 12px; cursor: pointer; font-weight: 800; font-size: 14px; margin-top: 10px; margin-bottom: 40px; box-shadow: 0 4px 12px rgba(31,122,58,0.2); }
        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); z-index: 1000; backdrop-filter: blur(4px); }

        input, select, textarea { padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; width: 100%; transition: 0.2s; }
        input:focus { outline: none; border-color: #1f7a3a; box-shadow: 0 0 0 3px rgba(31,122,58,0.1); }
        
        .role-tag { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .st-active { color: #166534; font-weight: 700; font-size: 12px; }
        .st-pending { color: #92400e; font-weight: 700; font-size: 12px; }
        
        .loading-cell, .empty-cell { text-align: center; padding: 60px !important; color: #94a3b8; font-style: italic; }
        .animate-spin { animation: spin 1s linear infinite; margin-bottom: 10px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}