import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { useUILang } from "../../lib/uiLanguage";
import {
  RefreshCcw, Building2, Mail, Plus, Loader2, UserPlus, X, 
  Phone, MapPin, ShieldCheck, ExternalLink, Search
} from "lucide-react";

// LISTADO MAESTRO DE LOGÍSTICA
const ALL_COUNTRIES = [
  { code: 'PA', name: 'Panamá', flag: '🇵🇦' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: 'NL', name: 'Países Bajos', flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica', flag: '🇧🇪' },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá', flag: '🇨🇦' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
];

export default function AdminUsersPage() {
  const { lang } = useUILang();
  const isMounted = useRef(true);
  
  const [tab, setTab] = useState<"clients" | "users">("clients");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  
  // Estado para el buscador de países
  const [countrySearch, setCountrySearch] = useState("");
  const filteredCountries = useMemo(() => 
    ALL_COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())),
    [countrySearch]
  );

  const [form, setForm] = useState({
    name: "", legal_name: "", contact_email: "", tax_id: "", 
    phone: "", country: "Panamá", create_user_access: false, client_invite: true
  });
  const [msg, setMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const loadClients = useCallback(async (isInitial = false) => {
    if (!isInitial) setIsBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/.netlify/functions/listClients", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (res.ok && isMounted.current) {
        const json = await res.json();
        setClients(json.items || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      if (isMounted.current) {
        setIsBusy(false);
        setLoadingPage(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    requireAdminOrRedirect().then(r => {
      if (r.ok && isMounted.current) loadClients(true);
    });
    return () => { isMounted.current = false; };
  }, [loadClients]);

  if (loadingPage) return (
    <AdminLayout title="..."><div className="loader-box"><Loader2 className="spin" /></div></AdminLayout>
  );

  return (
    <AdminLayout title={lang === "es" ? "Directorio de Clientes" : "Client Directory"}>
      <div className="top-bar">
        <div className="tabs-pro">
          <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>Clientes</button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Usuarios</button>
        </div>
        <button className="btn-main" onClick={() => setShowCreateForm(true)}>
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      <div className="content-card">
        <table className="ff-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>País</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="c-info">
                    <div className="avatar">{(c.name || "C")[0]}</div>
                    <div>
                      <div className="c-name">{c.name}</div>
                      <div className="c-sub">{c.legal_name || 'Particular'}</div>
                    </div>
                  </div>
                </td>
                <td><Mail size={12}/> {c.contact_email}</td>
                <td><span className="country-badge">{c.country}</span></td>
                <td><button className="btn-ghost"><ExternalLink size={14}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateForm && (
        <div className="overlay" onClick={() => setShowCreateForm(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>Alta de Cliente Pro</h2>
              <X className="pointer" onClick={() => setShowCreateForm(false)}/>
            </div>
            
            <div className="drawer-body">
              <section className="form-sec">
                <label><Building2 size={14}/> Identificación Fiscal</label>
                <input placeholder="Nombre Comercial" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                <input placeholder="Razón Social" value={form.legal_name} onChange={e => setForm({...form, legal_name: e.target.value})} />
                <input placeholder="Tax ID / RUC / NIF" value={form.tax_id} onChange={e => setForm({...form, tax_id: e.target.value})} />
              </section>

              <section className="form-sec">
                <label><MapPin size={14}/> Destino y Origen</label>
                <div className="search-box">
                  <Search size={14} className="search-icon"/>
                  <input 
                    placeholder="Buscar país (España, Alemania...)" 
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                  />
                </div>
                <select 
                  size={4} 
                  className="country-select"
                  value={form.country}
                  onChange={e => setForm({...form, country: e.target.value})}
                >
                  {filteredCountries.map(cn => (
                    <option key={cn.code} value={cn.name}>{cn.flag} {cn.name}</option>
                  ))}
                </select>
              </section>

              <div className="drawer-foot">
                <button className="btn-save" disabled={isBusy}>
                  {isBusy ? <Loader2 className="spin" /> : "Registrar en Directorio"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .top-bar { display: flex; justify-content: space-between; margin-bottom: 24px; }
        .tabs-pro { background: #f1f5f9; padding: 4px; border-radius: 10px; display: flex; }
        .tabs-pro button { border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer; color: #64748b; background: transparent; font-weight: 500; }
        .tabs-pro button.active { background: white; color: #1f7a3a; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .btn-main { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        
        .content-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
        .ff-table { width: 100%; border-collapse: collapse; }
        .ff-table th { background: #f8fafc; text-align: left; padding: 14px 20px; font-size: 11px; color: #64748b; text-transform: uppercase; }
        .ff-table td { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        
        .c-info { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 32px; height: 32px; background: #dcfce7; color: #166534; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .c-name { font-weight: 600; color: #1e293b; }
        .c-sub { font-size: 11px; color: #94a3b8; }
        .country-badge { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }

        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 9999; display: flex; justify-content: flex-end; backdrop-filter: blur(2px); }
        .drawer { width: 400px; background: white; height: 100%; display: flex; flex-direction: column; box-shadow: -10px 0 20px rgba(0,0,0,0.1); }
        .drawer-head { padding: 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .drawer-body { padding: 24px; display: flex; flex-direction: column; gap: 24px; flex: 1; overflow-y: auto; }
        
        .form-sec { display: flex; flex-direction: column; gap: 12px; }
        .form-sec label { font-size: 12px; font-weight: bold; color: #1f7a3a; display: flex; align-items: center; gap: 6px; }
        .form-sec input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; outline: none; transition: 0.2s; }
        .form-sec input:focus { border-color: #1f7a3a; }

        .search-box { position: relative; display: flex; align-items: center; }
        .search-icon { position: absolute; left: 12px; color: #94a3b8; }
        .search-box input { padding-left: 35px !important; width: 100%; font-size: 13px; }
        .country-select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 5px; outline: none; cursor: pointer; }
        
        .btn-save { background: #1f7a3a; color: white; border: none; padding: 16px; border-radius: 12px; font-weight: bold; cursor: pointer; width: 100%; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pointer { cursor: pointer; }
      `}</style>
    </AdminLayout>
  );
}