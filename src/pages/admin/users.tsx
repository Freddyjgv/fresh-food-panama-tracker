import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { 
  Plus, X, Mail, Phone, Trash2, CheckCircle, Edit3, Loader2, Send
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout, notify } from "../../components/AdminLayout"; // ✅ Importamos notify

export default function AdminUsersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
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
    try {
      const token = await getAuthToken();
      const endpoint = activeTab === 'clients' ? '/.netlify/functions/listClients' : '/.netlify/functions/listUsers';
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDataList(data.items || []);
    } catch (e) { console.error("Error:", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const handleActivateProspect = async (item: any) => {
    const email = item.contact_email || item.email;
    if (!email) return notify("El cliente no tiene un email asignado", "error");

    if (!confirm(`¿Activar acceso para ${item.name}?`)) return;

    setInvitingId(item.id);
    try {
      const token = await getAuthToken();
      const res = await fetch('/.netlify/functions/inviteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, full_name: item.name, role: 'client', client_id: item.id })
      });

      if (res.ok) {
        notify(`Invitación enviada a ${email}`, "success");
        loadData();
      } else {
        const err = await res.json();
        notify(err.message, "error");
      }
    } catch (e) { notify("Error de conexión", "error"); }
    finally { setInvitingId(null); }
  };

  const openEdit = (item: any) => {
    setF({
      ...initialForm,
      id: item.id,
      name: item.name || "",
      legal_name: item.legal_name || "",
      tax_id: item.tax_id || "",
      email_corp: item.contact_email || item.email || "",
      phone_corp: item.phone || "",
      country_origin: item.country || "Panamá",
      payment_condition: item.payment_condition || "Prepagado",
      billing_address: item.billing_address || "",
      website: item.website || "",
      shipping_addresses: (item.shipping_addresses?.length > 0)
        ? item.shipping_addresses.map((sa: any) => ({ id: sa.id, address: sa.address }))
        : [{ id: Date.now(), address: "" }],
      staff_name: item.full_name || "",
      staff_email: item.email || "",
      staff_role: item.role || "admin"
    });
    setIsDrawerOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = await getAuthToken();
      const endpoint = activeTab === 'clients' ? "/.netlify/functions/manageClient" : "/.netlify/functions/inviteUser";
      
      const payload = activeTab === 'clients' 
        ? { ...f, shipping_addresses: f.shipping_addresses.filter((a: any) => a.address.trim() !== "") }
        : { email: f.staff_email, full_name: f.staff_name, role: f.staff_role, id: f.id };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        notify(f.id ? "Cambios guardados" : "Registro creado con éxito", "success");
        setIsDrawerOpen(false);
        loadData();
      } else {
        const err = await res.json();
        notify(err.message, "error");
      }
    } catch (err) { notify("Error al guardar", "error"); }
    finally { setIsSaving(false); }
  };

  return (
    <AdminLayout title="Directorio" subtitle="Administración de Clientes y Equipo">
      
      <div className="tabs">
        <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>Clientes</button>
        <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>Staff Interno</button>
      </div>

      <div className="toolbar">
        <button className="ff-btn ff-btn-primary" onClick={() => { setF(initialForm); setIsDrawerOpen(true); }}>
          <Plus size={18} /> {activeTab === 'clients' ? 'Nuevo Cliente' : 'Invitar Staff'}
        </button>
      </div>

      <div className="ff-card">
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
              <tr><td colSpan={4} className="loading-td"><Loader2 className="animate-spin" /> Cargando...</td></tr>
            ) : dataList.map(item => (
              <tr key={item.id} className="row-hover">
                {activeTab === 'clients' ? (
                  <>
                    <td onClick={() => router.push(`/admin/clients/${item.id}`)} className="ptr">
                      <div className="client-cell">
                        <strong>{item.name}</strong>
                        <small>{item.tax_id || 'PROSPECTO'}</small>
                      </div>
                    </td>
                    <td>
                      <div className="contact-info">
                        <span><Mail size={12}/> {item.contact_email}</span>
                        <span><Phone size={12}/> {item.phone || '---'}</span>
                      </div>
                    </td>
                    <td>
                      {item.has_platform_access ? 
                        <span className="badge-ok">Activo</span> : 
                        <span className="badge-wait">Prospecto</span>
                      }
                    </td>
                    <td className="actions">
                      <div className="action-row">
                        {!item.has_platform_access && (
                           <button 
                             className="btn-activate" 
                             onClick={(e) => { e.stopPropagation(); handleActivateProspect(item); }}
                             disabled={invitingId === item.id}
                           >
                             {invitingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                             <span>{invitingId === item.id ? "" : "Activar"}</span>
                           </button>
                        )}
                        <button className="btnEdit" onClick={(e) => { e.stopPropagation(); openEdit(item); }}>
                          <Edit3 size={16}/>
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td><strong>{item.full_name}</strong></td>
                    <td>{item.email}</td>
                    <td><span className="role-tag">{item.role}</span></td>
                    <td>{item.confirmed_at ? <span className="badge-ok">Activo</span> : <span className="badge-wait">Pendiente</span>}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isDrawerOpen && (
        <>
          <div className="overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer">
            <div className="d-header">
              <h3>{f.id ? 'Editar Registro' : 'Nuevo Registro'}</h3>
              <X className="ptr" onClick={() => setIsDrawerOpen(false)} />
            </div>

            <form className="d-body" onSubmit={handleSave}>
              {activeTab === 'clients' ? (
                <>
                  <div className="group">
                    <label>DATOS FISCALES</label>
                    <input required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                    <input placeholder="Razón Social" value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} />
                    <input placeholder="RUC / Tax ID" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                  </div>
                  <div className="group">
                    <label>CONTACTO CORPORATIVO</label>
                    <input required type="email" placeholder="Email" value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} />
                    <input placeholder="Teléfono" value={f.phone_corp} onChange={e=>setF({...f, phone_corp:e.target.value})} />
                  </div>
                  <div className="group">
                    <label>SHIPPING (DIRECCIONES)</label>
                    {f.shipping_addresses.map((s: any, i: number) => (
                      <div key={s.id} className="row-input">
                        <input placeholder={`Dirección #${i+1}`} value={s.address} onChange={e => {
                          const ns = [...f.shipping_addresses]; ns[i].address = e.target.value; setF({...f, shipping_addresses: ns});
                        }} />
                        <button type="button" onClick={() => setF({...f, shipping_addresses: f.shipping_addresses.filter((x:any)=>x.id!==s.id)})} className="btnDel"><Trash2 size={14}/></button>
                      </div>
                    ))}
                    <button type="button" className="btn-add" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir</button>
                  </div>
                </>
              ) : (
                <div className="group">
                  <label>DATOS STAFF</label>
                  <input required placeholder="Nombre" value={f.staff_name} onChange={e=>setF({...f, staff_name:e.target.value})} />
                  <input required placeholder="Email" value={f.staff_email} onChange={e=>setF({...f, staff_email:e.target.value})} />
                  <select value={f.staff_role} onChange={e=>setF({...f, staff_role:e.target.value})}>
                    <option value="admin">Admin</option>
                    <option value="operaciones">Operaciones</option>
                  </select>
                </div>
              )}
              <button className="ff-btn ff-btn-primary" style={{height:'45px', justifyContent:'center'}} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : (f.id ? "Guardar Cambios" : "Crear Registro")}
              </button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .tabs { display: flex; gap: 20px; border-bottom: 1px solid var(--ff-border); margin-bottom: 20px; }
        .tabs button { padding: 10px; background: none; border: none; cursor: pointer; font-weight: 700; color: var(--ff-muted); }
        .tabs button.active { color: var(--ff-green); border-bottom: 2px solid var(--ff-green); }
        .toolbar { margin-bottom: 15px; }
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { background: #f8fafc; text-align: left; padding: 12px; font-size: 11px; color: var(--ff-muted); border-bottom: 1px solid var(--ff-border); }
        .pro-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .row-hover:hover { background: #f8fafc; }
        .client-cell strong { color: var(--ff-green); text-decoration: underline; }
        .contact-info { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--ff-muted); }
        .badge-ok { background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; }
        .badge-wait { background: #f1f5f9; color: var(--ff-muted); padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; }
        .action-row { display: flex; gap: 8px; align-items: center; }
        .btn-activate { 
          display: flex; align-items: center; gap: 6px; 
          background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; 
          padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer;
        }
        .btn-activate:hover { background: #2563eb; color: #fff; }
        .btnEdit { background: white; border: 1px solid var(--ff-border); padding: 6px; border-radius: 6px; cursor: pointer; color: var(--ff-muted); }
        .btnEdit:hover { border-color: var(--ff-green); color: var(--ff-green); }
        .drawer { position: fixed; right: 0; top: 0; width: 420px; height: 100%; background: white; z-index: 1001; box-shadow: -5px 0 15px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
        .d-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .d-body { padding: 20px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; backdrop-filter: blur(2px); }
        .group { background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid var(--ff-border); display: flex; flex-direction: column; gap: 10px; }
        .group label { font-size: 10px; font-weight: 800; color: var(--ff-green); }
        input, select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
        .row-input { display: flex; gap: 5px; }
        .btnDel { background: #fee2e2; color: #ef4444; border: none; padding: 8px; border-radius: 8px; cursor: pointer; }
        .btn-add { background: none; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 12px; color: var(--ff-muted); }
        .ptr { cursor: pointer; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}