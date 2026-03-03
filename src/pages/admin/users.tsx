import { useState, useEffect } from "react";
import { 
  Plus, X, Building2, MapPin, Phone, Mail, 
  ShieldCheck, User, Trash2, Globe, CreditCard, Search, Loader2 
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";

export default function AdminUsersAndStaffPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // ESTADO FORMULARIO (Se limpia según el tab)
  const [f, setF] = useState<any>({
    // Campos Cliente
    name: "", legal_name: "", tax_id: "", email_corp: "", phone_corp: "", 
    country_origin: "Panamá", payment_condition: "Prepagado", billing_address: "",
    shipping_addresses: [{ id: Date.now(), address: "" }],
    // Campos Staff
    staff_name: "", staff_email: "", staff_role: "admin"
  });

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      if (activeTab === 'clients') {
        // GUARDAR CLIENTE (SOLO DB)
        await fetch("/.netlify/functions/manageClient", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...f, skip_auth: true })
        });
      } else {
        // INVITAR STAFF (AUTH + DB)
        await fetch("/.netlify/functions/inviteUser", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: f.staff_email, full_name: f.staff_name, role: f.staff_role })
        });
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (err) { alert("Error al procesar solicitud"); }
    setIsSaving(false);
  };

  return (
    <AdminLayout title="Configuración de Sistema" subtitle="Administra el staff interno y el directorio de clientes.">
      
      {/* NAVEGACIÓN DE TABS */}
      <div className="tabs">
        <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>
          <Building2 size={16} /> Directorio de Clientes
        </button>
        <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>
          <ShieldCheck size={16} /> Gestión de Staff
        </button>
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btnCreate" onClick={() => setIsDrawerOpen(true)}>
          <Plus size={18} /> {activeTab === 'clients' ? 'Añadir Cliente' : 'Invitar Staff'}
        </button>
      </div>

      {/* LISTADO DINÁMICO */}
      <div className="card">
        <table className="pro-table">
          <thead>
            {activeTab === 'clients' ? (
              <tr><th>EMPRESA</th><th>PAÍS</th><th>CONDICIÓN</th><th>CONTACTO</th></tr>
            ) : (
              <tr><th>NOMBRE</th><th>EMAIL</th><th>ROL</th><th>ESTADO</th></tr>
            )}
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4}><Loader2 className="spin" /> Cargando...</td></tr> : 
              dataList.map(item => (
                <tr key={item.id}>
                  {activeTab === 'clients' ? (
                    <>
                      <td><strong>{item.name}</strong><br/><small>{item.tax_id}</small></td>
                      <td>{item.country_origin}</td>
                      <td><span className="badge">{item.payment_condition}</span></td>
                      <td>{item.email_corp}</td>
                    </>
                  ) : (
                    <>
                      <td><strong>{item.full_name}</strong></td>
                      <td>{item.email}</td>
                      <td><span className={`role-badge ${item.role}`}>{item.role}</span></td>
                      <td>{item.confirmed_at ? "✅ Activo" : "⏳ Pendiente"}</td>
                    </>
                  )}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* DRAWER LATERAL */}
      {isDrawerOpen && (
        <>
          <div className="overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer">
            <div className="d-header">
              <h3>{activeTab === 'clients' ? 'Ficha Maestra Cliente' : 'Invitación de Staff'}</h3>
              <X onClick={() => setIsDrawerOpen(false)} style={{cursor:'pointer'}} />
            </div>

            <form className="d-body" onSubmit={handleSave}>
              {activeTab === 'clients' ? (
                <>
                  <div className="group">
                    <label>IDENTIDAD FISCAL</label>
                    <input required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                    <input placeholder="Razón Social" value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} />
                    <div className="grid">
                      <input placeholder="RUC / NIF" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                      <select value={f.country_origin} onChange={e=>setF({...f, country_origin:e.target.value})}>
                        <option value="Panamá">🇵🇦 Panamá</option>
                        <option value="España">🇪🇸 España</option>
                        <option value="USA">🇺🇸 USA</option>
                      </select>
                    </div>
                  </div>
                  <div className="group">
                    <label>CONTACTO Y PAGOS</label>
                    <input required type="email" placeholder="Email Corp." value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} />
                    <select value={f.payment_condition} onChange={e=>setF({...f, payment_condition:e.target.value})}>
                      <option value="Prepagado">Prepagado</option>
                      <option value="Condicion Especial">Condición Especial</option>
                    </select>
                  </div>
                  <div className="group">
                    <label>DIRECCIONES (BILLING/SHIPPING)</label>
                    <textarea placeholder="Billing Address" value={f.billing_address} onChange={e=>setF({...f, billing_address:e.target.value})} />
                    {f.shipping_addresses.map((s:any, i:number) => (
                      <div key={s.id} className="row">
                        <input placeholder={`Shipping Address #${i+1}`} value={s.address} onChange={e => {
                          const ns = [...f.shipping_addresses]; ns[i].address = e.target.value; setF({...f, shipping_addresses: ns});
                        }} />
                      </div>
                    ))}
                    <button type="button" className="btn-add" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir Shipping</button>
                  </div>
                </>
              ) : (
                <div className="group">
                  <label>DATOS DE ACCESO STAFF</label>
                  <input required placeholder="Nombre Completo" value={f.staff_name} onChange={e=>setF({...f, staff_name:e.target.value})} />
                  <input required type="email" placeholder="Email de Trabajo" value={f.staff_email} onChange={e=>setF({...f, staff_email:e.target.value})} />
                  <select value={f.staff_role} onChange={e=>setF({...f, staff_role:e.target.value})}>
                    <option value="admin">Administrador (Ventas/Logística)</option>
                    <option value="superadmin">Superadmin (Jefe)</option>
                  </select>
                </div>
              )}
              <button className="btnSubmit" disabled={isSaving}>{isSaving ? "Guardando..." : "Confirmar y Guardar"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .tabs { display: flex; gap: 20px; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; }
        .tabs button { padding: 12px 20px; border: none; background: none; cursor: pointer; font-weight: 700; color: #64748b; display: flex; align-items: center; gap: 8px; }
        .tabs button.active { color: #1f7a3a; border-bottom: 2px solid #1f7a3a; }
        
        .toolbar { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .search { display: flex; align-items: center; gap: 10px; background: white; padding: 8px 15px; border-radius: 10px; border: 1px solid #e2e8f0; width: 300px; }
        .search input { border: none; outline: none; font-size: 14px; width: 100%; }
        
        .btnCreate { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { background: #f8fafc; text-align: left; padding: 15px; font-size: 11px; font-weight: 900; color: #64748b; }
        .pro-table td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }

        .role-badge { padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .role-badge.superadmin { background: #fee2e2; color: #991b1b; }
        .role-badge.admin { background: #e0f2fe; color: #075985; }

        .drawer { position: fixed; right: 0; top: 0; width: 450px; height: 100%; background: #f8fafc; z-index: 1001; display: flex; flex-direction: column; box-shadow: -5px 0 25px rgba(0,0,0,0.1); }
        .d-header { padding: 25px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
        .d-body { padding: 25px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        .group { background: white; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 10px; }
        .group label { font-size: 10px; font-weight: 900; color: #1f7a3a; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        input, select, textarea { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; background: #fcfcfc; }
        textarea { height: 80px; resize: none; font-family: inherit; }
        
        .btnSubmit { background: #1f7a3a; color: white; border: none; padding: 18px; border-radius: 12px; font-weight: 900; cursor: pointer; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; backdrop-filter: blur(2px); }
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}