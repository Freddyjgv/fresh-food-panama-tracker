import { useEffect, useState } from "react";
import { 
  Plus, X, Building2, MapPin, Phone, Mail, UserPlus, 
  ShieldCheck, User, Globe, CreditCard, Trash2, CheckCircle, AlertTriangle 
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";

export default function AdminDirectoryPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Formulario Maestro
  const [f, setF] = useState({
    name: "", legal_name: "", tax_id: "", country_origin: "Panamá",
    payment_condition: "Prepagado", billing_address: "",
    shipping_addresses: [{ id: Date.now(), address: "" }],
    contacts: [{ id: Date.now(), name: "", email: "", phone: "", has_access: false, already_invited: false }]
  });

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { Authorization: `Bearer ${session?.access_token}` };
    
    const [resClients, resStaff] = await Promise.all([
      fetch("/.netlify/functions/listClientsFull", { headers }),
      fetch("/.netlify/functions/listUsers", { headers })
    ]);

    if (resClients.ok) setClients((await resClients.json()).items || []);
    if (resStaff.ok) setStaff((await resStaff.json()).items || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar Emails de contactos
    const invalidEmails = f.contacts.filter(c => c.email && !validateEmail(c.email));
    if (invalidEmails.length > 0) return alert("Uno o más correos electrónicos no tienen un formato válido.");

    const contactsToInvite = f.contacts.filter(c => c.has_access && !c.already_invited);
    if (contactsToInvite.length > 0) {
      const confirmed = window.confirm(`¿Estás seguro que deseas otorgar acceso a la plataforma a los contactos seleccionados?`);
      if (!confirmed) return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/manageClient", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(f)
      });

      if (res.ok) {
        alert("Ficha de cliente guardada y accesos procesados.");
        setIsDrawerOpen(false);
        loadData();
      }
    } finally { setIsSaving(false); }
  };

  return (
    <AdminLayout title="Gestión de Directorio" subtitle="Control de Clientes, Proveedores y Staff">
      
      {/* Selector de Pestañas */}
      <div className="tabSelector">
        <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>Directorio de Clientes</button>
        <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>Usuarios Staff (Internos)</button>
      </div>

      <div className="toolbar">
        <button className="btnMain" onClick={() => setIsDrawerOpen(true)}>
          <Plus size={18} /> {activeTab === 'clients' ? 'Nuevo Cliente' : 'Nuevo Usuario Staff'}
        </button>
      </div>

      <div className="tableCard">
        <table className="ff-table">
          <thead>
            {activeTab === 'clients' ? (
              <tr><th>EMPRESA</th><th>PAÍS</th><th>CONDICIÓN</th><th>CONTACTOS</th><th>ACCIONES</th></tr>
            ) : (
              <tr><th>NOMBRE</th><th>EMAIL</th><th>ROL</th><th>ESTADO</th></tr>
            )}
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5}>Cargando...</td></tr> : 
              activeTab === 'clients' ? clients.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><br/><small>{c.tax_id}</small></td>
                  <td>{c.country_origin}</td>
                  <td><span className="badge">{c.payment_condition}</span></td>
                  <td>{c.contacts_count || 0}</td>
                  <td><button className="btnEdit">Editar Ficha</button></td>
                </tr>
              )) : staff.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td><span className={`role ${u.role}`}>{u.role}</span></td>
                  <td>{u.confirmed_at ? "✅ Activo" : "⏳ Pendiente"}</td>
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
            <div className="dHead">
              <h3>{activeTab === 'clients' ? 'Ficha de Cliente' : 'Invitar Staff'}</h3>
              <X onClick={() => setIsDrawerOpen(false)} style={{cursor:'pointer'}} />
            </div>
            
            <form onSubmit={handleSaveClient} className="dBody">
              {activeTab === 'clients' && (
                <>
                  <section className="formGroup">
                    <label><Building2 size={14}/> IDENTIDAD COMERCIAL</label>
                    <input required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                    <input placeholder="RUC / Tax ID" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                    <select value={f.payment_condition} onChange={e=>setF({...f, payment_condition:e.target.value})}>
                      <option value="Prepagado">Prepagado</option>
                      <option value="Condicion Especial">Condición Especial</option>
                    </select>
                  </section>

                  <section className="formGroup">
                    <label><MapPin size={14}/> LOGÍSTICA (Shipping/Billing)</label>
                    <textarea placeholder="Dirección de Facturación" value={f.billing_address} onChange={e=>setF({...f, billing_address:e.target.value})} />
                    {f.shipping_addresses.map((s, i) => (
                      <div key={s.id} className="row">
                        <input placeholder={`Dirección de Entrega #${i+1}`} value={s.address} onChange={e => {
                          const news = [...f.shipping_addresses]; news[i].address = e.target.value; setF({...f, shipping_addresses: news});
                        }} />
                        <Trash2 size={14} onClick={() => setF({...f, shipping_addresses: f.shipping_addresses.filter(x => x.id !== s.id)})} />
                      </div>
                    ))}
                    <button type="button" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir Dirección</button>
                  </section>

                  <section className="formGroup">
                    <label><UserPlus size={14}/> CONTACTOS Y ACCESO PLATAFORMA (1:N)</label>
                    {f.contacts.map((c, i) => (
                      <div key={c.id} className="contactCard">
                        <input required placeholder="Nombre del contacto" value={c.name} onChange={e => {
                          const nc = [...f.contacts]; nc[i].name = e.target.value; setF({...f, contacts: nc});
                        }} />
                        <input required type="email" placeholder="Email (Validado)" value={c.email} onChange={e => {
                          const nc = [...f.contacts]; nc[i].email = e.target.value; setF({...f, contacts: nc});
                        }} />
                        <div className="accessOption">
                          <span>Habilitar Login de Cliente</span>
                          <input type="checkbox" checked={c.has_access} onChange={e => {
                            const nc = [...f.contacts]; nc[i].has_access = e.target.checked; setF({...f, contacts: nc});
                          }} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setF({...f, contacts: [...f.contacts, {id:Date.now(), name:"", email:"", phone:"", has_access:false, already_invited:false}]})}>+ Añadir Contacto</button>
                  </section>
                </>
              )}
              <button className="btnSave">{isSaving ? "Procesando..." : "Guardar Todo"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .tabSelector { display: flex; gap: 10px; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; }
        .tabSelector button { padding: 10px 20px; border: none; background: none; cursor: pointer; font-weight: 700; color: #64748b; }
        .tabSelector button.active { color: var(--ff-green-dark); border-bottom: 2px solid var(--ff-green-dark); }
        .ff-table { width: 100%; border-collapse: collapse; background: white; }
        .ff-table th { text-align: left; padding: 12px; background: #f8fafc; font-size: 11px; color: #64748b; }
        .ff-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .drawer { position: fixed; right: 0; top: 0; height: 100%; width: 480px; background: #f8fafc; z-index: 1001; box-shadow: -10px 0 30px rgba(0,0,0,0.1); overflow-y: auto; }
        .formGroup { background: white; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; }
        .contactCard { padding: 10px; background: #f1f5f9; border-radius: 8px; margin-bottom: 10px; }
        .accessOption { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; font-weight: 800; }
        .btnSave { background: var(--ff-green-dark); color: white; border: none; padding: 15px; border-radius: 10px; font-weight: 800; width: 100%; cursor: pointer; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; }
      `}</style>
    </AdminLayout>
  );
}