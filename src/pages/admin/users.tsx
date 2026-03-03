import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { 
  Plus, Loader2, X, Building2, Globe, Mail, Search, RefreshCcw, ExternalLink, Phone 
} from "lucide-react";

// Lista de países fuera para no recrearla en cada render
const COUNTRIES = [
  { code: 'PA', name: 'Panamá', flag: '🇵🇦' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: 'NL', name: 'Países Bajos', flag: '🇳🇱' },
  { code: 'BE', name: 'Bélgica', flag: '🇧🇪' },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
];

export default function AdminUsersPage() {
  // 1. Estados de Control de Flujo (Fundamentales para la estabilidad)
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  // 2. Estados de Datos
  const [clients, setClients] = useState<any[]>([]);
  const [clientsBusy, setClientsBusy] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // 3. Estados del Formulario Pro
  const [form, setForm] = useState({
    name: "", legal_name: "", tax_id: "", contact_email: "", 
    country: "Panamá", phone: "", invite: true
  });
  const [countrySearch, setCountrySearch] = useState("");
  const [msg, setMsg] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  // Lógica de carga ultra-segura
  const loadData = async () => {
    if (!isMounted.current) return;
    setClientsBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/.netlify/functions/listClients", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (res.ok) {
        const json = await res.json();
        if (isMounted.current) setClients(json.items || []);
      }
    } catch (e) {
      console.error("Error cargando clientes:", e);
    } finally {
      if (isMounted.current) {
        setClientsBusy(false);
        setLoading(false);
      }
    }
  };

  // Inicialización en cascada (No rompe el Layout)
  useEffect(() => {
    isMounted.current = true;
    requireAdminOrRedirect().then(r => {
      if (r.ok && isMounted.current) {
        setIsAuthorized(true);
        loadData();
      }
    });
    return () => { isMounted.current = false; };
  }, []);

  // Filtro de países memoizado
  const filteredCountries = useMemo(() => 
    COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())),
    [countrySearch]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientsBusy(true);
    setMsg(null);
    
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/.netlify/functions/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ...form, user_email: form.contact_email }),
      });

      if (!res.ok) throw new Error(await res.text());

      setMsg({ text: "✅ Registrado correctamente", type: 'success' });
      setTimeout(() => {
        setShowDrawer(false);
        loadData();
      }, 1000);
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setClientsBusy(false);
    }
  };

  if (!isAuthorized || loading) {
    return (
      <AdminLayout title="...">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '10px' }}>
          <Loader2 className="spin" /> <span>Estabilizando Directorio...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Clientes y Directorio">
      <div className="header-actions">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{clients.length} Registros activos</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={() => loadData()} disabled={clientsBusy}>
            <RefreshCcw size={16} className={clientsBusy ? 'spin' : ''} />
          </button>
          <button className="btn-primary" onClick={() => setShowDrawer(true)}>
            <Plus size={18} /> Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="pro-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Identificación</th>
              <th>País</th>
              <th>Contacto</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="client-cell">
                    <div className="avatar">{(c.name || "C")[0]}</div>
                    <div>
                      <div className="c-name">{c.name}</div>
                      <div className="c-legal">{c.legal_name || 'Particular'}</div>
                    </div>
                  </div>
                </td>
                <td><code className="tax-code">{c.tax_id || '-'}</code></td>
                <td><span className="badge-country">{c.country || 'PA'}</span></td>
                <td className="email-cell"><Mail size={12} /> {c.contact_email}</td>
                <td><button className="btn-icon"><ExternalLink size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDrawer && (
        <div className="drawer-overlay" onClick={() => setShowDrawer(false)}>
          <div className="drawer-panel" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Crear Perfil Logístico</h3>
              <X className="pointer" onClick={() => setShowDrawer(false)} />
            </div>
            <form onSubmit={handleCreate} className="drawer-body">
              <div className="input-group">
                <label><Building2 size={12}/> DATOS FISCALES</label>
                <input required placeholder="Nombre Comercial" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                <input placeholder="Razón Social" value={form.legal_name} onChange={e => setForm({...form, legal_name: e.target.value})} />
                <input placeholder="RUC / Tax ID" value={form.tax_id} onChange={e => setForm({...form, tax_id: e.target.value})} />
              </div>

              <div className="input-group">
                <label><Globe size={12}/> UBICACIÓN EUROPA / AMÉRICA</label>
                <div className="search-box">
                  <Search size={14} className="s-icon" />
                  <input placeholder="Buscar país..." value={countrySearch} onChange={e => setCountrySearch(e.target.value)} />
                </div>
                <select size={3} className="country-select" value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                  {filteredCountries.map(cn => <option key={cn.code} value={cn.name}>{cn.flag} {cn.name}</option>)}
                </select>
              </div>

              <div className="input-group">
                <label><Mail size={12}/> CONTACTO</label>
                <input required type="email" placeholder="Email de acceso" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
                <input placeholder="Teléfono internacional" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>

              <div className="drawer-footer">
                {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
                <button type="submit" className="btn-save" disabled={clientsBusy}>
                  {clientsBusy ? <Loader2 className="spin" /> : "Registrar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .btn-primary { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-secondary { background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 10px; cursor: pointer; color: #64748b; }
        
        .table-wrapper { background: white; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
        .pro-table { width: 100%; border-collapse: collapse; text-align: left; }
        .pro-table th { background: #f8fafc; padding: 15px 20px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; }
        .pro-table td { padding: 15px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        
        .client-cell { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 34px; height: 34px; background: #dcfce7; color: #166534; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; }
        .c-name { font-weight: 700; color: #1e293b; }
        .c-legal { font-size: 11px; color: #94a3b8; }
        .tax-code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #475569; }
        .badge-country { background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
        
        .drawer-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 9999; display: flex; justify-content: flex-end; backdrop-filter: blur(4px); }
        .drawer-panel { width: 420px; background: white; height: 100%; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.1); animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        
        .drawer-header { padding: 25px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .drawer-body { padding: 25px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; flex: 1; }
        .input-group { display: flex; flex-direction: column; gap: 8px; }
        .input-group label { font-size: 10px; font-weight: 800; color: #1f7a3a; letter-spacing: 0.1em; }
        .input-group input, .country-select { border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px; outline: none; transition: 0.2s; }
        .input-group input:focus { border-color: #1f7a3a; box-shadow: 0 0 0 3px rgba(31, 122, 58, 0.1); }
        
        .search-box { position: relative; }
        .s-icon { position: absolute; left: 12px; top: 13px; color: #94a3b8; }
        .search-box input { padding-left: 35px !important; width: 100%; font-size: 13px; }
        
        .btn-save { background: #1f7a3a; color: white; border: none; padding: 16px; border-radius: 12px; font-weight: bold; cursor: pointer; }
        .alert { padding: 12px; border-radius: 8px; font-size: 13px; text-align: center; }
        .alert.success { background: #dcfce7; color: #166534; }
        .alert.error { background: #fee2e2; color: #991b1b; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pointer { cursor: pointer; }
      `}</style>
    </AdminLayout>
  );
}