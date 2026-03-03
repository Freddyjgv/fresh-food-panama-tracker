import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { useUILang } from "../../lib/uiLanguage";
import {
  RefreshCcw, Building2, Mail, Plus, Loader2, UserPlus, X, 
  Phone, MapPin, ShieldCheck, ExternalLink
} from "lucide-react";

const COUNTRIES = [
  { code: 'PA', name: 'Panamá', flag: 'PA' },
  { code: 'US', name: 'USA', flag: 'US' },
  { code: 'CN', name: 'China', flag: 'CN' },
  { code: 'CO', name: 'Colombia', flag: 'CO' },
  { code: 'CR', name: 'Costa Rica', flag: 'CR' }
];

export default function AdminUsersPage() {
  const { lang } = useUILang();
  const [tab, setTab] = useState<"clients" | "users">("clients");
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsBusy, setClientsBusy] = useState(false);

  const [form, setForm] = useState({
    name: "", legal_name: "", contact_email: "", contact_name: "",
    tax_id: "", phone: "", website: "", country: "Panamá",
    city: "", billing_address: "", shipping_address: "",
    internal_notes: "", create_user_access: false, client_invite: true, password: ""
  });

  const [clientMsg, setClientMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const loadClients = useCallback(async (initial = false) => {
    try {
      if (!initial) setClientsBusy(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/.netlify/functions/listClients", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (res.ok) {
        const json = await res.json();
        setClients(json.items || []);
      }
    } catch (err) {
      console.error("Error loading clients:", err);
    } finally {
      setClientsBusy(false);
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    requireAdminOrRedirect().then(r => {
      if (r.ok) loadClients(true);
    });
  }, [loadClients]);

  async function onCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setClientsBusy(true);
    setClientMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ...form, user_email: form.contact_email, invite: form.client_invite }),
      });

      if (!res.ok) throw new Error(await res.text());
      
      setClientMsg({ text: "✅ ¡Cliente registrado!", type: 'success' });
      setTimeout(() => { setShowCreateForm(false); loadClients(false); }, 1500);
    } catch (err: any) {
      setClientMsg({ text: err.message, type: 'error' });
    } finally {
      setClientsBusy(false);
    }
  }

  return (
    <AdminLayout title={lang === "es" ? "Directorio" : "Directory"}>
      <div className="ff-page-container">
        <div className="ff-header-actions">
          <div className="ff-tabs-modern">
            <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>Clientes</button>
            <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Admins</button>
          </div>
          <button className="btn-primary-pro" onClick={() => setShowCreateForm(true)}>
            <Plus size={18} /> Nuevo Cliente
          </button>
        </div>

        {clientsLoading ? (
          <div className="loading-state"><Loader2 className="spin" /> Cargando...</div>
        ) : (
          <div className="ff-main-grid">
            <div className="ff-card-clean">
              <div className="table-header">
                <h3>{clients.length} Registros</h3>
                <button onClick={() => loadClients()} className="btn-icon">
                  <RefreshCcw size={16} className={clientsBusy ? 'spin' : ''}/>
                </button>
              </div>
              <div className="table-wrapper">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Contacto</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div className="td-client">
                            <div className="avatar">{(c.name || "C")[0].toUpperCase()}</div>
                            <div>
                              <div className="name">{c.name || 'S/N'}</div>
                              <div className="legal">{c.legal_name || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="td-contact">
                            <span>{c.contact_email}</span>
                            <span className="sub">{c.phone || ''}</span>
                          </div>
                        </td>
                        <td><span className="badge-active">Activo</span></td>
                        <td><ExternalLink size={14} color="#64748b" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="drawer-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>Nuevo Cliente</h2>
              <X className="close-icon" onClick={() => setShowCreateForm(false)}/>
            </div>
            <form onSubmit={onCreateClient} className="drawer-form">
              <div className="field">
                <label>Nombre Comercial *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="field">
                <label>Email *</label>
                <input required type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
              </div>
              <div className="field">
                <label>País</label>
                <select value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="drawer-footer">
                {clientMsg && <div className={`alert ${clientMsg.type}`}>{clientMsg.text}</div>}
                <button type="submit" className="btn-save-full" disabled={clientsBusy}>
                  {clientsBusy ? <Loader2 className="spin" /> : "Guardar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .ff-page-container { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ff-header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .ff-tabs-modern { background: #e2e8f0; padding: 4px; border-radius: 10px; display: flex; }
        .ff-tabs-modern button { border: none; padding: 8px 16px; border-radius: 7px; cursor: pointer; color: #64748b; background: transparent; transition: 0.2s; }
        .ff-tabs-modern button.active { background: white; color: #1f7a3a; font-weight: 600; }
        .btn-primary-pro { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .ff-card-clean { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
        .table-header { padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
        .table-wrapper { overflow-x: auto; }
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { background: #f8fafc; text-align: left; padding: 14px 20px; font-size: 11px; color: #64748b; text-transform: uppercase; }
        .pro-table td { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; }
        .td-client { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 32px; height: 32px; background: #dcfce7; color: #166534; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; }
        .name { font-weight: 600; color: #1e293b; font-size: 14px; }
        .legal { font-size: 11px; color: #94a3b8; }
        .badge-active { background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .loading-state { padding: 40px; text-align: center; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 10000; display: flex; justify-content: flex-end; }
        .drawer-content { width: 400px; background: white; height: 100%; display: flex; flex-direction: column; box-shadow: -4px 0 15px rgba(0,0,0,0.1); }
        .drawer-header { padding: 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .drawer-form { padding: 20px; display: flex; flex-direction: column; gap: 20px; flex: 1; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 12px; font-weight: 600; color: #475569; }
        .field input, .field select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; outline: none; }
        .btn-save-full { background: #1f7a3a; color: white; border: none; padding: 14px; border-radius: 10px; font-weight: 700; cursor: pointer; width: 100%; margin-top: auto; }
        .alert { padding: 10px; border-radius: 8px; font-size: 13px; }
        .alert.success { background: #dcfce7; color: #166534; }
        .alert.error { background: #fee2e2; color: #991b1b; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .close-icon { cursor: pointer; color: #64748b; }
        .btn-icon { background: none; border: none; cursor: pointer; color: #64748b; }
      `}</style>
    </AdminLayout>
  );
}