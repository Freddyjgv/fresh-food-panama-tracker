import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { useUILang } from "../../lib/uiLanguage";
import {
  RefreshCcw, Building2, Mail, Plus, Loader2, UserPlus, X, 
  Globe, Phone, MapPin, FileText, ShieldCheck, ExternalLink, Info
} from "lucide-react";

const COUNTRIES = [
  { code: 'PA', name: 'Panamá', dial: '+507', flag: '🇵🇦' },
  { code: 'US', name: 'USA', dial: '+1', flag: '🇺🇸' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica', dial: '+506', flag: '🇨🇷' },
  { code: 'ES', name: 'España', dial: '+34', flag: '🇪🇸' },
  { code: 'MX', name: 'México', dial: '+52', flag: '🇲🇽' },
];

export default function AdminUsersPage() {
  const { lang } = useUILang();
  const [tab, setTab] = useState<"clients" | "users">("clients");
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsBusy, setClientsBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    contact_email: "",
    contact_name: "",
    tax_id: "",
    phone: "",
    website: "",
    country: "Panamá",
    city: "",
    billing_address: "",
    shipping_address: "",
    internal_notes: "",
    create_user_access: false,
    client_invite: true,
    password: ""
  });

  const [clientMsg, setClientMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) {
        await loadClients(true);
        setClientsLoading(false);
      }
    })();
  }, []);

  async function loadClients(initial = false) {
    if (!initial) setClientsBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/.netlify/functions/listClients", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setClients(json.items || []);
    }
    setClientsBusy(false);
  }

  async function onCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setClientsBusy(true);
    setClientMsg(null);

    const { data: { session } } = await supabase.auth.getSession();
    const payload = {
      ...form,
      user_email: form.contact_email,
      invite: form.client_invite,
    };

    const res = await fetch("/.netlify/functions/createUser", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(payload),
    });

    setClientsBusy(false);
    if (!res.ok) {
      const err = await res.text();
      setClientMsg({ text: err, type: 'error' });
    } else {
      setClientMsg({ text: "✅ ¡Cliente registrado!", type: 'success' });
      setTimeout(() => {
        setShowCreateForm(false);
        loadClients(false);
      }, 1500);
    }
  }

  if (clientsLoading) {
    return (
      <AdminLayout title="...">
        <div style={{ display: 'flex', gap: 10, padding: 20 }}>
          <Loader2 className="spin" /> <span>Cargando directorio...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={lang === "es" ? "Directorio de Clientes" : "Client Directory"}>
      <div className="ff-header-actions">
        <div className="ff-tabs-modern">
          <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>Clientes</button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Usuarios (Admins)</button>
        </div>
        
        <button className="btn-primary-pro" onClick={() => setShowCreateForm(true)}>
          <Plus size={18} />
          {lang === 'es' ? 'Nuevo Cliente' : 'Add Client'}
        </button>
      </div>

      <div className="ff-main-grid">
        <div className="ff-card-clean">
          <div className="table-header">
            <h3>{clients.length} Clientes registrados</h3>
            <button onClick={() => loadClients()} className="btn-icon">
              <RefreshCcw size={16} className={clientsBusy ? 'spin' : ''}/>
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="pro-table">
              <thead>
                <tr>
                  <th>Cliente / Empresa</th>
                  <th>Contacto</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="td-client">
                        <div className="avatar">{c.name ? c.name[0].toUpperCase() : '?'}</div>
                        <div>
                          <div className="name">{c.name}</div>
                          <div className="legal">{c.legal_name || 'Sin razón social'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="td-contact">
                        <span><Mail size={12}/> {c.contact_email}</span>
                        <span><Phone size={12}/> {c.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="td-muted">{c.city || 'N/A'}, {c.country}</td>
                    <td><span className="badge-active">{c.status || 'active'}</span></td>
                    <td><button className="btn-ghost"><ExternalLink size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="drawer-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>Crear Nuevo Cliente</h2>
              <button className="btn-close" onClick={() => setShowCreateForm(false)}><X/></button>
            </div>

            <form onSubmit={onCreateClient} className="drawer-form">
              <section>
                <div className="section-title"><Building2 size={16}/> Información de Empresa</div>
                <div className="input-row">
                  <div className="field">
                    <label>Nombre Comercial *</label>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ej: Fresh Food Corp" />
                  </div>
                  <div className="field">
                    <label>Razón Social (Legal)</label>
                    <input value={form.legal_name} onChange={e => setForm({...form, legal_name: e.target.value})} placeholder="Ej: Fresh Food S.A." />
                  </div>
                </div>
                <div className="input-row" style={{ marginTop: 15 }}>
                  <div className="field">
                    <label>Tax ID / RUC</label>
                    <input value={form.tax_id} onChange={e => setForm({...form, tax_id: e.target.value})} placeholder="000-000-000" />
                  </div>
                  <div className="field">
                    <label>Website</label>
                    <input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://..." />
                  </div>
                </div>
              </section>

              <section>
                <div className="section-title"><MapPin size={16}/> Contacto y Ubicación</div>
                <div className="field">
                  <label>Email de Contacto *</label>
                  <input required type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
                </div>
                <div className="input-row" style={{ marginTop: 15 }}>
                  <div className="field">
                    <label>Teléfono</label>
                    <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                  <div className="field">
                    <label>País</label>
                    <select value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field" style={{ marginTop: 15 }}>
                  <label>Dirección de Facturación</label>
                  <textarea rows={2} value={form.billing_address} onChange={e => setForm({...form, billing_address: e.target.value})} />
                </div>
              </section>

              <section className="access-section">
                <div className="ff-switch-row">
                  <div>
                    <div className="section-title" style={{margin:0}}><ShieldCheck size={16}/> Acceso al Portal</div>
                    <p className="subx">Permite al cliente ver sus cotizaciones</p>
                  </div>
                  <input type="checkbox" className="switch" checked={form.create_user_access} onChange={e => setForm({...form, create_user_access: e.target.checked})} />
                </div>

                {form.create_user_access && (
                  <div className="access-details">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={form.client_invite} onChange={e => setForm({...form, client_invite: e.target.checked})} />
                      <span>Enviar invitación por email</span>
                    </label>
                  </div>
                )}
              </section>

              <div className="drawer-footer">
                {clientMsg && <div className={`alert ${clientMsg.type}`}>{clientMsg.text}</div>}
                <button type="submit" className="btn-save-full" disabled={clientsBusy}>
                  {clientsBusy ? <Loader2 className="spin" size={20}/> : <UserPlus size={20}/>}
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .ff-header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .ff-tabs-modern { background: #e2e8f0; padding: 4px; border-radius: 10px; display: flex; gap: 4px; }
        .ff-tabs-modern button { border: none; padding: 8px 16px; border-radius: 7px; font-weight: 600; cursor: pointer; color: #64748b; background: transparent; }
        .ff-tabs-modern button.active { background: white; color: #1f7a3a; }
        .btn-primary-pro { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .ff-card-clean { background: white; border-radius: 16px; border: 1px solid #e2e8f0; }
        .table-header { padding: 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { background: #f8fafc; text-align: left; padding: 14px 20px; font-size: 11px; color: #64748b; }
        .pro-table td { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .td-client { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 36px; height: 36px; background: #dcfce7; color: #166534; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; }
        .name { font-weight: 700; color: #1e293b; }
        .legal { font-size: 12px; color: #64748b; }
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; justify-content: flex-end; }
        .drawer-content { width: 450px; background: white; height: 100%; display: flex; flex-direction: column; }
        .drawer-header { padding: 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .drawer-form { padding: 24px; overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; gap: 25px; }
        .section-title { font-size: 12px; font-weight: 800; color: #1f7a3a; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field label { font-size: 11px; font-weight: 700; color: #475569; }
        .field input, .field select, .field textarea { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; outline: none; }
        .ff-switch-row { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 12px; border-radius: 10px; }
        .switch { width: 34px; height: 18px; appearance: none; background: #cbd5e1; border-radius: 20px; position: relative; cursor: pointer; }
        .switch:checked { background: #1f7a3a; }
        .btn-save-full { width: 100%; background: #1f7a3a; color: white; border: none; padding: 14px; border-radius: 10px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .alert { padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; }
        .alert.success { background: #dcfce7; color: #166534; }
        .alert.error { background: #fee2e2; color: #991b1b; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-close, .btn-icon, .btn-ghost { background: none; border: none; cursor: pointer; color: #64748b; }
      `}</style>
    </AdminLayout>
  );
}