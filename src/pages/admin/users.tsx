import { useState, useEffect } from "react";
import { 
  Plus, X, Building2, MapPin, Phone, Mail, 
  ShieldCheck, UserPlus, Trash2, Globe, Search, Loader2, CheckCircle 
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Estado inicial del formulario maestro
  const initialForm = {
    name: "", legal_name: "", tax_id: "", email_corp: "", phone_corp: "", 
    country_origin: "Panamá", payment_condition: "Prepagado", billing_address: "",
    shipping_addresses: [{ id: Date.now(), address: "" }],
    staff_name: "", staff_email: "", staff_role: "admin"
  };
  const [f, setF] = useState(initialForm);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const endpoint = activeTab === 'clients' ? '/.netlify/functions/listClientsFull' : '/.netlify/functions/listUsers';
    
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

  // FUNCIÓN PARA AUTORIZAR ACCESO (La que pediste con Warning)
  const handleAuthorizeAccess = async (client: any) => {
    const confirmed = window.confirm(
      `¿Estás seguro que deseas otorgar acceso a la plataforma de clientes a ${client.name}?\n\nSe enviará una invitación formal a: ${client.contact_email}`
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
        alert("Acceso autorizado con éxito.");
        loadData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.message}`);
      }
    } catch (e) { alert("Error de conexión al autorizar."); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    try {
      const endpoint = activeTab === 'clients' ? "/.netlify/functions/manageClient" : "/.netlify/functions/inviteUser";
      const payload = activeTab === 'clients' ? { ...f, skip_auth: true } : { email: f.staff_email, full_name: f.staff_name, role: f.staff_role };

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
    <AdminLayout title="Panel de Control" subtitle="Gestión de Directorio y Accesos">
      
      <div className="tabs">
        <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>Directorio de Clientes</button>
        <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>Usuarios Staff</button>
      </div>

      <div className="toolbar">
        <button className="btnCreate" onClick={() => setIsDrawerOpen(true)}>
          <Plus size={18} /> {activeTab === 'clients' ? 'Nuevo Prospecto/Cliente' : 'Nuevo Staff'}
        </button>
      </div>

      <div className="card">
        <table className="pro-table">
          <thead>
            {activeTab === 'clients' ? (
              <tr><th>CLIENTE</th><th>CONTACTO</th><th>ESTADO ACCESO</th><th>ACCIONES</th></tr>
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
                      <td><strong>{item.name}</strong><br/><small>{item.tax_id || 'Sin RUC'}</small></td>
                      <td>{item.contact_email}</td>
                      <td>
                        {item.has_platform_access ? 
                          <span className="badge-ok"><CheckCircle size={12}/> Activo</span> : 
                          <span className="badge-prospect">Prospecto</span>
                        }
                      </td>
                      <td>
                        {!item.has_platform_access && (
                          <button className="btnAuth" onClick={() => handleAuthorizeAccess(item)}>Autorizar Acceso</button>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{item.full_name}</td>
                      <td>{item.email}</td>
                      <td>{item.role}</td>
                      <td>{item.confirmed_at ? "✅" : "⏳"}</td>
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
              <h3>{activeTab === 'clients' ? 'Nueva Ficha de Cliente' : 'Invitar Staff'}</h3>
              <X onClick={() => setIsDrawerOpen(false)} style={{cursor:'pointer'}} />
            </div>

            <form className="d-body" onSubmit={handleSave}>
              {activeTab === 'clients' ? (
                <>
                  <div className="group">
                    <label>DATOS FISCALES</label>
                    <input required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                    <input placeholder="RUC / Tax ID" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                    <input required type="email" placeholder="Email Corporativo" value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} />
                  </div>
                  <div className="group">
                    <label>LOGÍSTICA</label>
                    <textarea placeholder="Dirección de Facturación" value={f.billing_address} onChange={e=>setF({...f, billing_address:e.target.value})} />
                    {f.shipping_addresses.map((s, i) => (
                      <input key={s.id} placeholder={`Dirección de Entrega #${i+1}`} value={s.address} onChange={e => {
                        const ns = [...f.shipping_addresses]; ns[i].address = e.target.value; setF({...f, shipping_addresses: ns});
                      }} />
                    ))}
                    <button type="button" className="btn-add" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir Punto de Entrega</button>
                  </div>
                </>
              ) : (
                <div className="group">
                  <input required placeholder="Nombre Staff" value={f.staff_name} onChange={e=>setF({...f, staff_name:e.target.value})} />
                  <input required type="email" placeholder="Email Staff" value={f.staff_email} onChange={e=>setF({...f, staff_email:e.target.value})} />
                </div>
              )}
              <button className="btnSubmit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .tabs { display: flex; gap: 20px; border-bottom: 2px solid #eee; margin-bottom: 20px; }
        .tabs button { padding: 10px; background: none; border: none; cursor: pointer; font-weight: bold; color: #666; }
        .tabs button.active { color: #1f7a3a; border-bottom: 2px solid #1f7a3a; }
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th, .pro-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
        .badge-ok { background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 20px; font-size: 11px; display: flex; align-items: center; gap: 4px; width: fit-content; }
        .badge-prospect { background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 20px; font-size: 11px; }
        .btnAuth { background: #1f7a3a; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; }
        .drawer { position: fixed; right: 0; top: 0; width: 400px; height: 100%; background: white; z-index: 1001; box-shadow: -5px 0 15px rgba(0,0,0,0.1); }
        .d-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        .group { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid #eee; border-radius: 8px; }
        .group label { font-size: 10px; font-weight: bold; color: #1f7a3a; }
        .btnSubmit { background: #1f7a3a; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 1000; }
        input, textarea { padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
      `}</style>
    </AdminLayout>
  );
}