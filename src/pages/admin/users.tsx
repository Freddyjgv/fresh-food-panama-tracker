import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { 
  Plus, X, Mail, Phone, Trash2, Edit3, Loader2, Send, Search, Copy, User, Globe, Building2
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout, notify } from "../../components/AdminLayout";

// --- HELPERS SENIOR ---
const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
const generateColor = (name: string) => {
  const colors = ['#eff6ff', '#f0fdf4', '#fff7ed', '#faf5ff', '#fdf2f8'];
  const textColors = ['#1e40af', '#166534', '#9a3412', '#6b21a8', '#9d174d'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash % colors.length);
  return { bg: colors[index], text: textColors[index] };
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // Filtro real-time
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const initialForm = {
    id: null, name: "", legal_name: "", tax_id: "", email_corp: "", phone_corp: "", 
    country_origin: "Panamá", payment_condition: "Prepagado", billing_address: "",
    website: "", shipping_addresses: [{ id: Date.now(), address: "" }],
    staff_name: "", staff_email: "", staff_role: "admin"
  };
  
  const [f, setF] = useState(initialForm);

  // --- LÓGICA DE DATOS ---
  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const endpoint = activeTab === 'clients' ? '/.netlify/functions/listClients' : '/.netlify/functions/listUsers';
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDataList(data.items || []);
    } catch (e) { notify("Error al cargar datos", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  // Filtro dinámico optimizado
  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      const search = searchQuery.toLowerCase();
      const name = (item.name || item.full_name || "").toLowerCase();
      const email = (item.contact_email || item.email || "").toLowerCase();
      const ruc = (item.tax_id || "").toLowerCase();
      return name.includes(search) || email.includes(search) || ruc.includes(search);
    });
  }, [dataList, searchQuery]);

  // --- ACCIONES ---
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify("Copiado al portapapeles", "success");
  };

  const handleActivateProspect = async (item: any) => {
    const email = item.contact_email || item.email;
    if (!email) return notify("Email no encontrado", "error");
    setInvitingId(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/inviteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email, full_name: item.name, role: 'client', client_id: item.id })
      });
      if (res.ok) { notify("Acceso activado correctamente", "success"); loadData(); }
      else { notify("Error al activar", "error"); }
    } catch (e) { notify("Error de red", "error"); }
    finally { setInvitingId(null); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const endpoint = activeTab === 'clients' ? "/.netlify/functions/manageClient" : "/.netlify/functions/inviteUser";
      const payload = activeTab === 'clients' 
        ? { ...f, shipping_addresses: f.shipping_addresses.filter((a: any) => a.address.trim() !== "") }
        : { email: f.staff_email, full_name: f.staff_name, role: f.staff_role, id: f.id };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) { notify("Registro actualizado", "success"); setIsDrawerOpen(false); loadData(); }
      else { notify("Error al guardar", "error"); }
    } catch (err) { notify("Error de red", "error"); }
    finally { setIsSaving(false); }
  };

  return (
    <AdminLayout title="Directorio" subtitle="Gestión centralizada de identidades">
      
      {/* HEADER TOOLS: Estilo Stripe */}
      <div className="directory-header">
        <div className="tabs-container">
          <div className="tabs">
            <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>
              Clientes <span className="tab-count">{activeTab === 'clients' ? filteredData.length : '...'}</span>
            </button>
            <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>
              Staff Interno <span className="tab-count">{activeTab === 'staff' ? filteredData.length : '...'}</span>
            </button>
          </div>
        </div>
        
        <div className="actions-bar">
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder={`Buscar en ${activeTab}...`} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="ff-btn ff-btn-primary shadow-sm" onClick={() => { setF(initialForm); setIsDrawerOpen(true); }}>
            <Plus size={18} /> {activeTab === 'clients' ? 'Nuevo Cliente' : 'Añadir Staff'}
          </button>
        </div>
      </div>

      <div className="ff-card overflow-hidden border-none shadow-md">
        <table className="pro-table modern">
          <thead>
            {activeTab === 'clients' ? (
              <tr><th>IDENTIDAD</th><th>DETALLES DE CONTACTO</th><th>ESTADO</th><th className="txt-right">ACCIONES</th></tr>
            ) : (
              <tr><th>COLABORADOR</th><th>EMAIL INSTITUCIONAL</th><th>ROL</th><th>ACCESO</th></tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="loading-td"><Loader2 className="animate-spin" /></td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={4} className="empty-td text-center py-10">No se encontraron registros.</td></tr>
            ) : filteredData.map(item => {
              const name = item.name || item.full_name || "Sin nombre";
              const style = generateColor(name);
              return (
                <tr key={item.id} className="row-hover">
                  {activeTab === 'clients' ? (
                    <>
                      <td onClick={() => router.push(`/admin/clients/${item.id}`)} className="ptr">
                        <div className="identity-cell">
                          <div className="avatar" style={{ backgroundColor: style.bg, color: style.text }}>{getInitials(name)}</div>
                          <div className="info">
                            <span className="name-link">{name}</span>
                            <small className="tax-id">{item.tax_id || 'ID NO ASIGNADO'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="contact-details">
                          <div className="detail-item clickable" onClick={() => copyToClipboard(item.contact_email)}>
                            <Mail size={12}/> {item.contact_email}
                          </div>
                          <div className="detail-item">
                            <Phone size={12}/> {item.phone || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={item.has_platform_access ? "badge-pro active" : "badge-pro prospect"}>
                          {item.has_platform_access ? "Activo" : "Prospecto"}
                        </span>
                      </td>
                      <td className="actions txt-right">
                        <div className="flex-end gap-2">
                          {!item.has_platform_access && (
                             <button className="btn-icon-label" onClick={() => handleActivateProspect(item)} disabled={invitingId === item.id}>
                               {invitingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                               <span>Activar</span>
                             </button>
                          )}
                          <button className="btn-circle" onClick={() => { setF({...initialForm, ...item, email_corp: item.contact_email}); setIsDrawerOpen(true); }}>
                            <Edit3 size={15}/>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <div className="identity-cell">
                          <div className="avatar" style={{ backgroundColor: style.bg, color: style.text }}>{getInitials(name)}</div>
                          <strong>{name}</strong>
                        </div>
                      </td>
                      <td>{item.email}</td>
                      <td><span className="role-pill">{item.role}</span></td>
                      <td>{item.confirmed_at ? <span className="status-dot online">Activo</span> : <span className="status-dot offline">Pendiente</span>}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* DRAWER OPTIMIZADO */}
      {isDrawerOpen && (
        <>
          <div className="overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer modern-drawer">
            <div className="d-header">
              <div className="d-title">
                <Building2 size={20} className="text-muted" />
                <h3>{f.id ? 'Editar Perfil' : 'Nuevo Registro'}</h3>
              </div>
              <button className="btn-close" onClick={() => setIsDrawerOpen(false)}><X size={20}/></button>
            </div>

            <form className="d-body" onSubmit={handleSave}>
              <div className="form-grid">
                <div className="group full">
                  <label>INFORMACIÓN GENERAL</label>
                  <input required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                  <div className="input-row">
                    <input placeholder="Razón Social" value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} />
                    <input placeholder="RUC / Tax ID" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                  </div>
                </div>

                <div className="group">
                  <label>DATOS DE CONTACTO</label>
                  <div className="input-with-icon">
                    <Mail size={14} />
                    <input required type="email" placeholder="Email Corporativo" value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} />
                  </div>
                  <div className="input-with-icon">
                    <Phone size={14} />
                    <input placeholder="Teléfono" value={f.phone_corp} onChange={e=>setF({...f, phone_corp:e.target.value})} />
                  </div>
                </div>

                <div className="group">
                  <label>CONDICIONES</label>
                  <select value={f.payment_condition} onChange={e=>setF({...f, payment_condition:e.target.value})}>
                    <option value="Prepagado">Prepagado</option>
                    <option value="Crédito 15 días">Crédito 15 días</option>
                    <option value="Crédito 30 días">Crédito 30 días</option>
                  </select>
                </div>
              </div>

              <button className="ff-btn ff-btn-primary btn-submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : "Guardar Registro"}
              </button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        /* LAYOUT & TABS */
        .directory-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; gap: 20px; flex-wrap: wrap; }
        .tabs { display: flex; gap: 8px; background: #f1f5f9; padding: 4px; border-radius: 10px; }
        .tabs button { padding: 8px 16px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px; }
        .tabs button.active { background: white; color: #1e293b; shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .tab-count { font-size: 10px; background: #e2e8f0; padding: 2px 6px; border-radius: 6px; color: #475569; }

        /* SEARCH & ACTIONS */
        .actions-bar { display: flex; gap: 12px; align-items: center; }
        .search-wrapper { position: relative; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 12px; display: flex; align-items: center; width: 300px; }
        .search-icon { color: #94a3b8; }
        .search-wrapper input { border: none; padding: 10px; font-size: 13px; width: 100%; outline: none; }

        /* TABLE MODERN */
        .pro-table.modern th { text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; padding: 16px 20px; background: #fafafa; }
        .pro-table.modern td { padding: 16px 20px; vertical-align: middle; }
        .identity-cell { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; font-weight: 700; font-size: 12px; }
        .name-link { font-weight: 700; color: #1e293b; display: block; }
        .name-link:hover { color: var(--ff-green); }
        .tax-id { font-size: 11px; color: #94a3b8; font-family: monospace; }
        
        .contact-details { display: flex; flex-direction: column; gap: 4px; }
        .detail-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; }
        .detail-item.clickable:hover { color: var(--ff-green); cursor: pointer; text-decoration: underline; }

        /* BADGES PRO */
        .badge-pro { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
        .badge-pro.active { background: #dcfce7; color: #15803d; }
        .badge-pro.prospect { background: #f1f5f9; color: #475569; }
        
        .status-dot { display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .status-dot::before { content:''; width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.online::before { background: #22c55e; }
        .status-dot.offline::before { background: #cbd5e1; }

        /* DRAWER & FORMS */
        .modern-drawer { width: 500px; }
        .d-title { display: flex; align-items: center; gap: 10px; }
        .form-grid { display: flex; flex-direction: column; gap: 20px; }
        .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .input-with-icon { position: relative; display: flex; align-items: center; }
        .input-with-icon :global(svg) { position: absolute; left: 12px; color: #94a3b8; }
        .input-with-icon input { padding-left: 36px !important; width: 100%; }
        .btn-submit { margin-top: 20px; height: 48px; font-size: 14px; }

        /* UI UTILS */
        .txt-right { text-align: right; }
        .flex-end { display: flex; justify-content: flex-end; }
        .btn-circle { background: white; border: 1px solid #e2e8f0; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: #64748b; }
        .btn-circle:hover { border-color: var(--ff-green); color: var(--ff-green); background: #f0fdf4; }
        .btn-icon-label { display: flex; align-items: center; gap: 6px; background: #eff6ff; color: #2563eb; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; }
        .btn-icon-label:hover { background: #dbeafe; }
      `}</style>
    </AdminLayout>
  );
}