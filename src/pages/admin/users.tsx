import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { useUILang } from "../../lib/uiLanguage";
import {
  RefreshCcw,
  Users as UsersIcon,
  Building2,
  KeyRound,
  Mail,
  Plus,
  Loader2,
  UserPlus,
  X
} from "lucide-react";

type Role = "client" | "admin" | "superadmin";
type Client = { id: string; name: string; contact_email: string; created_at?: string };

async function getTokenOrRedirect() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = "/login";
    return null;
  }
  return token;
}

export default function AdminUsersPage() {
  const { lang } = useUILang();
  const [meRole, setMeRole] = useState<Role>("client");
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<"clients" | "users">("clients");
  
  // Estado para mostrar/ocultar formularios
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsBusy, setClientsBusy] = useState(false);

  // Formulario Crear cliente+usuario
  const [cEmail, setCEmail] = useState("");
  const [cName, setCName] = useState("");
  const [cContactName, setCContactName] = useState("");
  const [clientInvite, setClientInvite] = useState(true);
  const [clientPassword, setClientPassword] = useState("");
  const [clientBusy, setClientBusy] = useState(false);
  const [clientMsg, setClientMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const canListUsers = meRole === "superadmin";

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      await loadMe();
      await loadClients(true);
      setClientsLoading(false);
    })();
  }, []);

  async function loadMe() {
    const token = await getTokenOrRedirect();
    if (!token) return;
    const res = await fetch("/.netlify/functions/getMyProfile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const me = await res.json();
    setMeRole(me.role as Role);
    setMeEmail(me.email);
  }

  async function loadClients(initial = false) {
    if (!initial) setClientsBusy(true);
    const token = await getTokenOrRedirect();
    const res = await fetch("/.netlify/functions/listClients", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setClients(json.items || []);
    }
    setClientsBusy(false);
  }

  async function onCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setClientBusy(true);
    setClientMsg(null);

    const token = await getTokenOrRedirect();
    const payload = {
      contact_email: cEmail.trim().toLowerCase(),
      name: cName.trim() || cEmail,
      contact_name: cContactName.trim(),
      user_email: cEmail.trim().toLowerCase(),
      invite: clientInvite,
      password: clientInvite ? undefined : clientPassword
    };

    const res = await fetch("/.netlify/functions/createUser", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    setClientBusy(false);
    if (!res.ok) {
      const err = await res.text();
      setClientMsg({ text: err, type: 'error' });
    } else {
      setClientMsg({ text: lang === 'es' ? "✅ ¡Creado con éxito!" : "✅ Created successfully!", type: 'success' });
      setCEmail(""); setCName(""); setCContactName(""); setClientPassword("");
      loadClients(false);
      setTimeout(() => setShowCreateForm(false), 2000);
    }
  }

  if (clientsLoading) return <AdminLayout title="..."><Loader2 className="spin" /></AdminLayout>;

  return (
    <AdminLayout 
      title={lang === "es" ? "Gestión de Clientes" : "Client Management"}
      subtitle={`${meEmail} (${meRole})`}
    >
      {/* Barra de Navegación Superior */}
      <div className="nav-bar">
        <div className="tabs">
          <button className={`tab-btn ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}>
            <Building2 size={18} /> {lang === 'es' ? 'Empresas' : 'Companies'}
          </button>
          <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            <UsersIcon size={18} /> {lang === 'es' ? 'Usuarios' : 'Users'}
          </button>
        </div>
        
        <button className="ff-btn-new" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? <X size={18} /> : <Plus size={18} />}
          {showCreateForm ? (lang === 'es' ? 'Cerrar' : 'Close') : (lang === 'es' ? 'Nuevo Cliente' : 'New Client')}
        </button>
      </div>

      <div className="content-area">
        {/* Formulario Lateral (Drawer-like) */}
        {showCreateForm && (
          <div className="side-form-container">
            <div className="ff-card2 shadow-lg">
              <h2 className="h2x">{lang === 'es' ? 'Registrar Nuevo Cliente' : 'Register New Client'}</h2>
              <p className="subx">{lang === 'es' ? 'Se creará la empresa y su acceso de usuario.' : 'Company and user access will be created.'}</p>
              
              <form onSubmit={onCreateClient} className="form-vertical">
                <div className="input-group">
                  <label><Mail size={14}/> Email</label>
                  <input className="in2" value={cEmail} onChange={e => setCEmail(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label><Building2 size={14}/> {lang === 'es' ? 'Nombre Empresa' : 'Company Name'}</label>
                  <input className="in2" value={cName} onChange={e => setCName(e.target.value)} required />
                </div>
                
                <div className="invite-box">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={clientInvite} onChange={e => setClientInvite(e.target.checked)} />
                    <span>{lang === 'es' ? 'Enviar invitación por email' : 'Send email invitation'}</span>
                  </label>
                  {!clientInvite && (
                    <input type="password" placeholder="Contraseña temporal" className="in2 mt-2" value={clientPassword} onChange={e => setClientPassword(e.target.value)} required />
                  )}
                </div>

                <button className="ff-primary-full" disabled={clientBusy}>
                  {clientBusy ? <Loader2 className="spin" size={18}/> : <UserPlus size={18}/>}
                  {lang === 'es' ? 'Guardar Cliente' : 'Save Client'}
                </button>

                {clientMsg && <div className={`alert ${clientMsg.type}`}>{clientMsg.text}</div>}
              </form>
            </div>
          </div>
        )}

        {/* Tabla Principal */}
        <div className="main-table-container">
          <div className="ff-card2">
            <div className="ff-spread2 mb-4">
              <h2 className="h2x">{lang === 'es' ? 'Listado de Clientes' : 'Client List'} ({clients.length})</h2>
              <button className="refresh-btn" onClick={() => loadClients()} disabled={clientsBusy}>
                <RefreshCcw size={16} className={clientsBusy ? 'spin' : ''} />
              </button>
            </div>
            
            <div className="table-wrapper">
              <table className="ff-table">
                <thead>
                  <tr>
                    <th>{lang === 'es' ? 'Empresa' : 'Company'}</th>
                    <th>Email</th>
                    <th>ID Sistema</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id}>
                      <td className="font-bold">{c.name}</td>
                      <td className="text-muted">{c.contact_email}</td>
                      <td className="text-mono">{c.id.split('-')[0]}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .nav-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #fff; padding: 10px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .tabs { display: flex; gap: 8px; }
        .tab-btn { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; border: none; background: transparent; cursor: pointer; font-weight: 600; color: #64748b; transition: all 0.2s; }
        .tab-btn.active { background: #f1f5f9; color: #1f7a3a; }
        
        .ff-btn-new { display: flex; align-items: center; gap: 8px; background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: transform 0.1s; }
        .ff-btn-new:active { transform: scale(0.95); }

        .content-area { display: flex; gap: 20px; align-items: flex-start; }
        .side-form-container { width: 350px; flex-shrink: 0; position: sticky; top: 20px; }
        .main-table-container { flex-grow: 1; }

        .form-vertical { display: flex; flex-direction: column; gap: 15px; margin-top: 20px; }
        .input-group { display: flex; flex-direction: column; gap: 5px; }
        .input-group label { font-size: 12px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 5px; }
        
        .invite-box { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px dashed #cbd5e1; }
        .checkbox-label { display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; }
        
        .ff-primary-full { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: #1f7a3a; color: white; border: none; height: 45px; border-radius: 8px; font-weight: 700; cursor: pointer; }
        
        .alert { padding: 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
        .alert.success { background: #dcfce7; color: #166534; }
        .alert.error { background: #fee2e2; color: #991b1b; }

        .ff-table { width: 100%; border-collapse: collapse; }
        .ff-table th { text-align: left; padding: 12px; border-bottom: 2px solid #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; }
        .ff-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        
        .text-mono { font-family: monospace; color: #94a3b8; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        @media (max-width: 1000px) {
          .content-area { flex-direction: column; }
          .side-form-container { width: 100%; position: static; }
        }
      `}</style>
    </AdminLayout>
  );
}