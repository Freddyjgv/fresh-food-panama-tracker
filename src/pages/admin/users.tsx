import { useState, useEffect } from "react";
import Link from "next/link"; // Pieza clave añadida
import { 
  Plus, X, Building2, MapPin, Phone, Mail, 
  ShieldCheck, UserPlus, Trash2, Globe, Search, Loader2, CheckCircle, Edit3, ExternalLink 
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);

  // Estado inicial robusto con todos los campos de la DB
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

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    // Cambiado a listClientsFull si ese es el nombre de tu función actualizada
    const endpoint = activeTab === 'clients' ? '/.netlify/functions/listClients' : '/.netlify/functions/listUsers';
    
    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      setDataList(data.items || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activeTab]);

  // Abrir para editar
  const openEdit = (item: any) => {
    setF({
      ...initialForm,
      ...item,
      id: item.id,
      email_corp: item.contact_email || item.email || "",
      phone_corp: item.phone || "",
      country_origin: item.country || "Panamá",
      shipping_addresses: item.shipping_addresses?.length > 0 
        ? item.shipping_addresses 
        : [{ id: Date.now(), address: "" }]
    });
    setIsDrawerOpen(true);
  };

  const handleAuthorizeAccess = async (client: any) => {
    const confirmed = window.confirm(
      `¿Otorgar acceso a la plataforma a ${client.name}?\n\nSe enviará invitación a: ${client.contact_email}`
    );
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/inviteUser", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          email: client.contact_email, 
          full_name: client.name, 
          role: 'client',
          client_id: client.id 
        })
      });

      if (res.ok) {
        alert("Acceso autorizado.");
        loadData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.message}`);
      }
    } catch (e) { alert("Error de conexión."); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    try {
      const endpoint = activeTab === 'clients' ? "/.netlify/functions/manageClient" : "/.netlify/functions/inviteUser";
      const payload = activeTab === 'clients' ? f : { email: f.staff_email, full_name: f.staff_name, role: f.staff_role };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
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
    <AdminLayout title="Panel de Control" subtitle="Directorio de Clientes y Staff">
      
      <div className="tabs">
        <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>Clientes (Prospectos)</button>
        <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>Staff Interno</button>
      </div>

      <div className="toolbar">
        <button className="btnCreate" onClick={() => { setF(initialForm); setIsDrawerOpen(true); }}>
          <Plus size={18} /> {activeTab === 'clients' ? 'Nuevo Cliente' : 'Nuevo Staff'}
        </button>
      </div>

      <div className="card">
        <table className="pro-table">
          <thead>
            {activeTab === 'clients' ? (
              <tr><th>CLIENTE</th><th>CONTACTO</th><th>ESTADO</th><th>ACCIONES</th></tr>
            ) : (
              <tr><th>NOMBRE</th><th>EMAIL</th><th>ROL</th><th>ESTADO</th></tr>
            )}
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4}>Cargando...</td></tr> : 
              dataList.map(item => (
                <tr key={item.id}>
                  {activeTab === 'clients' ? (
                    <>
                      <td>
                        <div className="client-info">
                          {/* Enlace corregido para Next.js */}
                          <Link href={`/admin/clients/${item.id}`} passHref legacyBehavior>
                            <a className="client-link">
                              <strong>{item.name}</strong> <ExternalLink size={12} />
                            </a>
                          </Link>
                          <small>{item.tax_id || 'Sin Tax ID'}</small>
                        </div>
                      </td>
                      <td>
                        <div className="contact-cell">
                          <Mail size={12}/> {item.contact_email}<br/>
                          <Phone size={12}/> {item.phone || '---'}
                        </div>
                      </td>
                      <td>
                        {item.has_platform_access ? 
                          <span className="badge-ok"><CheckCircle size={10}/> Activo</span> : 
                          <span className="badge-prospect">Prospecto</span>
                        }
                      </td>
                      <td className="actions-cell">
                        <button className="btnIcon" onClick={() => openEdit(item)} title="Editar Ficha"><Edit3 size={16}/></button>
                        {!item.has_platform_access && (
                          <button className="btnAuth" onClick={() => handleAuthorizeAccess(item)}>Autorizar</button>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{item.full_name}</td>
                      <td>{item.email}</td>
                      <td><span className="role-tag">{item.role}</span></td>
                      <td>{item.confirmed_at ? "✅ Activo" : "⏳ Pendiente"}</td>
                    </>
                  )}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {isDrawerOpen && (
        <>
          <div className="overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer">
            <div className="d-header">
              <h3>{f.id ? 'Editar Cliente' : (activeTab === 'clients' ? 'Nuevo Cliente' : 'Nuevo Staff')}</h3>
              <X onClick={() => setIsDrawerOpen(false)} style={{cursor:'pointer'}} />
            </div>

            <form className="d-body" onSubmit={handleSave}>
              {activeTab === 'clients' ? (
                <>
                  <div className="group">
                    <label>IDENTIDAD COMERCIAL</label>
                    <input required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                    <input placeholder="Razón Social Legal" value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} />
                    <input placeholder="RUC / Tax ID" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                    <input placeholder="Website (URL)" value={f.website} onChange={e=>setF({...f, website:e.target.value})} />
                  </div>

                  <div className="group">
                    <label>CONTACTO Y PAÍS</label>
                    <input required type="email" placeholder="Email Corporativo" value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} />
                    <input placeholder="Teléfono" value={f.phone_corp} onChange={e=>setF({...f, phone_corp:e.target.value})} />
                    <select value={f.country_origin} onChange={e=>setF({...f, country_origin:e.target.value})}>
                      <option value="Panamá">Panamá</option>
                      <option value="Costa Rica">Costa Rica</option>
                      <option value="Colombia">Colombia</option>
                      <option value="Ecuador">Ecuador</option>
                    </select>
                  </div>

                  <div className="group">
                    <label>FACTURACIÓN Y PAGOS</label>
                    <select value={f.payment_condition} onChange={e=>setF({...f, payment_condition:e.target.value})}>
                      <option value="Prepagado">Prepagado</option>
                      <option value="Crédito 15 días">Crédito 15 días</option>
                      <option value="Crédito 30 días">Crédito 30 días</option>
                    </select>
                    <textarea placeholder="Dirección Fiscal de Facturación" value={f.billing_address} onChange={e=>setF({...f, billing_address:e.target.value})} />
                  </div>

                  <div className="group">
                    <label>PUNTOS DE ENTREGA (SHIPPING)</label>
                    {f.shipping_addresses.map((s, i) => (
                      <div key={s.id} className="row-input">
                        <input placeholder={`Dirección #${i+1}`} value={s.address} onChange={e => {
                          const ns = [...f.shipping_addresses]; ns[i].address = e.target.value; setF({...f, shipping_addresses: ns});
                        }} />
                        {f.shipping_addresses.length > 1 && (
                          <button type="button" onClick={() => setF({...f, shipping_addresses: f.shipping_addresses.filter(x => x.id !== s.id)})} className="btnDel"><Trash2 size={14}/></button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn-add" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir Dirección</button>
                  </div>
                </>
              ) : (
                <div className="group">
                  <label>DATOS DEL STAFF</label>
                  <input required placeholder="Nombre Completo" value={f.staff_name} onChange={e=>setF({...f, staff_name:e.target.value})} />
                  <input required type="email" placeholder="Email de Trabajo" value={f.staff_email} onChange={e=>setF({...f, staff_email:e.target.value})} />
                  <select value={f.staff_role} onChange={e=>setF({...f, staff_role:e.target.value})}>
                    <option value="admin">Administrador</option>
                    <option value="operaciones">Operaciones</option>
                    <option value="ventas">Ventas</option>
                  </select>
                </div>
              )}
              <button className="btnSubmit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar Cambios"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .tabs { display: flex; gap: 20px; border-bottom: 2px solid #eee; margin-bottom: 20px; }
        .tabs button { padding: 10px; background: none; border: none; cursor: pointer; font-weight: bold; color: #666; transition: 0.3s; }
        .tabs button.active { color: #1f7a3a; border-bottom: 2px solid #1f7a3a; }
        
        .client-link { color: #1f7a3a; text-decoration: none; display: flex; align-items: center; gap: 5px; cursor: pointer; }
        .client-link:hover { text-decoration: underline; }
        
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; padding: 12px; text-align: left; }
        .pro-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        
        .badge-ok { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 20px; font-size: 11px; display: flex; align-items: center; gap: 5px; width: fit-content; }
        .badge-prospect { background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 11px; }
        
        .actions-cell { display: flex; gap: 10px; align-items: center; }
        .btnIcon { background: none; border: 1px solid #e2e8f0; padding: 6px; border-radius: 6px; cursor: pointer; color: #64748b; }
        .btnIcon:hover { background: #f8fafc; color: #1f7a3a; }
        .btnAuth { background: #1f7a3a; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; }
        
        .drawer { position: fixed; right: 0; top: 0; width: 450px; height: 100%; background: white; z-index: 1001; box-shadow: -10px 0 30px rgba(0,0,0,0.1); overflow-y: auto; }
        .d-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .d-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        
        .group { display: flex; flex-direction: column; gap: 10px; padding: 15px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; }
        .group label { font-size: 10px; font-weight: 800; color: #1f7a3a; letter-spacing: 0.5px; }
        
        .row-input { display: flex; gap: 5px; }
        .btnDel { background: #fee2e2; color: #ef4444; border: none; padding: 5px; border-radius: 5px; cursor: pointer; }
        .btn-add { background: none; border: 1px dashed #1f7a3a; color: #1f7a3a; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px; }
        
        .btnSubmit { background: #1f7a3a; color: white; border: none; padding: 15px; border-radius: 10px; cursor: pointer; font-weight: bold; font-size: 14px; margin-bottom: 40px; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; backdrop-filter: blur(2px); }
        
        input, select, textarea { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; width: 100%; }
        input:focus { outline: none; border-color: #1f7a3a; box-shadow: 0 0 0 2px rgba(31,122,58,0.1); }
        
        .role-tag { background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
      `}</style>
    </AdminLayout>
  );
}