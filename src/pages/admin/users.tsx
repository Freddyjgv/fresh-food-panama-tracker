import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { 
  Plus, X, Mail, Phone, Loader2, Send, Search, Copy, 
  Building2, Globe, ShieldCheck, Upload, MapPin, Info,
  Pencil
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout, notify } from "../../components/AdminLayout";

// --- HELPERS SENIOR ---
const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || "??";

export default function AdminUsersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const initialForm = {
    id: null, 
    name: "", 
    legal_name: "", 
    tax_id: "", 
    contact_email: "", 
    phone: "", 
    country: "Panamá",
    mode: "invite" as "invite" | "manual",
    password: "",
    // Estructuras JSON para logística TOP
    billing_info: { address: "", email: "", phone: "" },
    consignee_info: { address: "", email: "", phone: "" },
    notify_info: { address: "", email: "", phone: "" }
  };
  
  const [f, setF] = useState(initialForm);

  // --- CARGA DE DATOS ---
  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const endpoint = activeTab === 'clients' ? '/.netlify/functions/listClients' : '/.netlify/functions/listUsers';
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const data = await res.json();
      setDataList(data.items || []);
    } catch (e) { notify("Error de conexión", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      const s = searchQuery.toLowerCase();
      return (item.name || "").toLowerCase().includes(s) || (item.contact_email || "").toLowerCase().includes(s);
    });
  }, [dataList, searchQuery]);

  // --- LÓGICA DE GUARDADO (HILVANADO CON NETLIFY) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalLogoUrl = f.id ? (dataList.find(d => d.id === f.id)?.logo_url) : "";

      // 1. Subida de Logo si hay archivo nuevo
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('client-logos').upload(fileName, logoFile);
        if (uploadError) throw uploadError;
        finalLogoUrl = fileName;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      // 2. Llamada a createClient (La función de Netlify que analizamos)
      const res = await fetch('/.netlify/functions/createClient', {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ...f, logo_url: finalLogoUrl })
      });

      if (res.ok) {
        notify(f.id ? "Perfil actualizado" : "Cliente y Acceso Creados", "success");
        setIsDrawerOpen(false);
        loadData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Error en el servidor");
      }
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout title="Directorio Maestro" subtitle="Control de identidades y entidades logísticas">
      
      <div className="ff-directory-container">
        {/* HEADER TOOLS */}
        <div className="directory-header">
          <div className="tabs">
            <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>
              Clientes <span className="tab-count">{activeTab === 'clients' ? filteredData.length : '0'}</span>
            </button>
            <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>
              Staff Interno
            </button>
          </div>
          
          <div className="actions-bar">
            <div className="search-wrapper">
              <Search size={16} />
              <input placeholder="Buscar identidad..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button className="ff-btn-primary-top" onClick={() => { setF(initialForm); setPreviewUrl(null); setIsDrawerOpen(true); }}>
              <Plus size={18} /> Nuevo Cliente
            </button>
          </div>
        </div>

        {/* TABLA PREMIUM */}
        <div className="ff-table-wrapper">
          <table className="ff-table-top">
            <thead>
              <tr>
                <th>CLIENTE / TAX ID</th>
                <th>CONTACTO PRINCIPAL</th>
                <th>PAÍS</th>
                <th>PLATAFORMA</th>
                <th className="txt-right">GESTOR</th>
              </tr>
            </thead>
            <tbody>
  {loading ? (
    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin inline" /></td></tr>
  ) : filteredData.length === 0 ? (
    <tr><td colSpan={5} className="text-center py-20 text-muted">No se encontraron registros en {activeTab}</td></tr>
  ) : filteredData.map(item => (
    <tr key={item.id} className="row-hover">
      {/* IDENTIDAD: Redirección diferenciada */}
      <td 
        onClick={() => {
          // Si es cliente, va a su perfil de cliente. Si es staff, a su perfil de usuario interno.
          const route = activeTab === 'clients' 
            ? `/admin/clients/${item.id}` 
            : `/admin/users/${item.id}`; // O la ruta que tengas para staff
          router.push(route);
        }} 
        className="ptr"
      >
        <div className="client-cell">
          <div className="avatar-box">
            {item.logo_url ? (
              <img src={`https://fofvskqshlyqmsvshnps.supabase.co/storage/v1/object/public/client-logos/${item.logo_url}`} alt="L" />
            ) : (
              <div className="avatar-fallback">{getInitials(item.name || item.full_name)}</div>
            )}
          </div>
          <div className="client-meta">
            <span className="client-name">{item.name || item.full_name}</span>
            <span className="client-sub">{item.tax_id || (activeTab === 'staff' ? item.role?.toUpperCase() : 'SIN RUC')}</span>
          </div>
        </div>
      </td>

      {/* CONTACTO */}
      <td>
        <div className="contact-col">
          <span className="email"><Mail size={12}/> {item.contact_email || item.email}</span>
          <span className="phone"><Phone size={12}/> {item.phone || '—'}</span>
        </div>
      </td>

      {/* PAÍS / ROL */}
      <td>
        {activeTab === 'clients' ? (
          <span className="country-tag">{item.country || 'Panamá'}</span>
        ) : (
          <span className="role-badge-staff">{item.role || 'Staff'}</span>
        )}
      </td>

      {/* ESTADO PLATAFORMA */}
      <td>
        <span className={`status-pill ${item.has_platform_access || item.confirmed_at ? 'active' : 'pending'}`}>
          {item.has_platform_access || item.confirmed_at ? 'ACTIVO' : 'PROSPECTO'}
        </span>
      </td>

      {/* ACCIONES RÁPIDAS */}
      <td className="txt-right">
        <div className="flex justify-end gap-2">
          <button className="btn-edit-round" onClick={(e) => { 
            e.stopPropagation(); // Evita que dispare el router.push del TD
            setF({ ...initialForm, ...item }); 
            setIsDrawerOpen(true); 
          }}>
            <Pencil size={14} />
          </button>
        </div>
      </td>
    </tr>
  ))}
</tbody>
          </table>
        </div>
      </div>

      {/* DRAWER MAESTRO (HILVANADO) */}
      {isDrawerOpen && (
        <>
          <div className="ff-overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="ff-drawer-pro">
            <div className="drawer-header-pro">
              <div className="title-area">
                <Building2 className="text-blue" />
                <div>
                  <h3>Perfil de Entidad</h3>
                  <p>Configuración fiscal y logística</p>
                </div>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="close-btn"><X /></button>
            </div>

            <form onSubmit={handleSave} className="drawer-content-pro">
              {/* SUBIDA DE LOGO PREMIUM */}
              <div className="logo-upload-box">
                <div className="preview-circle">
                  {previewUrl ? <img src={previewUrl} /> : <div className="placeholder">{getInitials(f.name)}</div>}
                  <label htmlFor="logo-input" className="edit-overlay"><Upload size={14}/></label>
                </div>
                <input id="logo-input" type="file" hidden onChange={e => {
                  const file = e.target.files?.[0];
                  if(file) { setLogoFile(file); setPreviewUrl(URL.createObjectURL(file)); }
                }} />
                <div className="logo-info">
                  <span className="label">Imagen de Marca</span>
                  <span className="sub">Formatos: PNG, JPG. Max 2MB.</span>
                </div>
              </div>

              <div className="sections-container">
                {/* BLOQUE 1: IDENTIDAD */}
                <div className="form-section-top">
                  <div className="section-header"><Info size={14}/> Datos Básicos</div>
                  <input className="ff-input-top" required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                  <div className="grid-2">
                    <input className="ff-input-top" placeholder="Razón Social" value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} />
                    <input className="ff-input-top" placeholder="RUC / TAX ID" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                  </div>
                </div>

                {/* BLOQUE 2: ACCESO PLATAFORMA */}
                <div className="form-section-top highlight">
                  <div className="section-header"><ShieldCheck size={14}/> Credenciales de Acceso</div>
                  <div className="grid-2">
                    <input className="ff-input-top" type="email" placeholder="Email de Login" value={f.contact_email} onChange={e=>setF({...f, contact_email:e.target.value})} />
                    <select className="ff-input-top" value={f.mode} onChange={e=>setF({...f, mode: e.target.value as any})}>
                      <option value="invite">Enviar Invitación</option>
                      <option value="manual">Contraseña Manual</option>
                    </select>
                  </div>
                  {f.mode === 'manual' && (
                    <input className="ff-input-top mt-2" type="password" placeholder="Establecer Contraseña" value={f.password} onChange={e=>setF({...f, password:e.target.value})} />
                  )}
                </div>

                {/* BLOQUE 3: LOGÍSTICA (TOP REQ) */}
                <div className="form-section-top">
                  <div className="section-header"><MapPin size={14}/> Configuración Logística (Default)</div>
                  
                  {/* BILLING */}
                  <div className="logistics-card">
                    <label>Billing Party</label>
                    <textarea placeholder="Dirección completa de facturación..." value={f.billing_info.address} onChange={e=>setF({...f, billing_info:{...f.billing_info, address:e.target.value}})} />
                  </div>

                  {/* CONSIGNEE & NOTIFY */}
                  <div className="grid-2">
                    <div className="logistics-card">
                      <label>Consignee Default</label>
                      <textarea placeholder="Nombre, Tax ID, Dirección..." value={f.consignee_info.address} onChange={e=>setF({...f, consignee_info:{...f.consignee_info, address:e.target.value}})} />
                    </div>
                    <div className="logistics-card">
                      <label>Notify Party Default</label>
                      <textarea placeholder="Igual que consignee o específico..." value={f.notify_info.address} onChange={e=>setF({...f, notify_info:{...f.notify_info, address:e.target.value}})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="drawer-footer-pro">
                <button type="submit" className="ff-btn-submit-pro" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" /> : (f.id ? "Actualizar Cliente" : "Crear Cliente Full Access")}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .ff-directory-container { padding: 40px; max-width: 1400px; margin: 0 auto; }
        
        .directory-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .tabs { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .tabs button { padding: 10px 20px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; transition: 0.2s; }
        .tabs button.active { background: white; color: #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

        .actions-bar { display: flex; gap: 16px; }
        .search-wrapper { background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 0 16px; display: flex; align-items: center; gap: 10px; width: 320px; }
        .search-wrapper input { border: none; padding: 12px 0; outline: none; font-weight: 600; width: 100%; }

        .ff-btn-primary-top { background: #0f172a; color: white; border: none; padding: 0 24px; border-radius: 12px; font-weight: 800; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s; }
        .ff-btn-primary-top:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(15,23,42,0.15); }

        /* TABLE */
        .ff-table-wrapper { background: white; border-radius: 24px; border: 1.5px solid #f1f5f9; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
        .ff-table-top { width: 100%; border-collapse: collapse; }
        .ff-table-top th { background: #fafafa; padding: 18px 24px; text-align: left; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .ff-table-top td { padding: 20px 24px; border-bottom: 1px solid #f8fafc; vertical-align: middle; }
        
        .client-cell { display: flex; align-items: center; gap: 16px; }
        .avatar-box { width: 44px; height: 44px; border-radius: 12px; border: 1.5px solid #f1f5f9; overflow: hidden; }
        .avatar-box img { width: 100%; height: 100%; object-fit: contain; }
        .avatar-fallback { width: 100%; height: 100%; background: #f8fafc; display: grid; place-items: center; font-weight: 800; color: #cbd5e1; }
        .client-name { display: block; font-weight: 800; color: #0f172a; font-size: 15px; }
        .client-sub { font-size: 11px; color: #94a3b8; font-family: monospace; }

        .country-tag { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #475569; }
        .status-pill { font-size: 10px; font-weight: 900; padding: 4px 8px; border-radius: 6px; }
        .status-pill.active { background: #dcfce7; color: #166534; }
        .status-pill.pending { background: #fef3c7; color: #92400e; }

        /* DRAWER PRO */
        .ff-drawer-pro { position: fixed; right: 0; top: 0; bottom: 0; width: 520px; background: white; z-index: 1000; box-shadow: -20px 0 50px rgba(0,0,0,0.1); display: flex; flex-direction: column; animation: slideIn 0.3s ease; }
        .drawer-header-pro { padding: 32px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .title-area { display: flex; gap: 16px; align-items: center; }
        .title-area h3 { font-size: 20px; font-weight: 900; margin: 0; letter-spacing: -0.02em; }
        .title-area p { font-size: 13px; color: #94a3b8; margin: 2px 0 0 0; }

        .drawer-content-pro { flex: 1; overflow-y: auto; padding-bottom: 40px; }
        .logo-upload-box { padding: 32px; background: #fafafa; display: flex; align-items: center; gap: 24px; }
        .preview-circle { position: relative; width: 80px; height: 80px; border-radius: 24px; background: white; border: 2px solid #e2e8f0; overflow: hidden; }
        .preview-circle img { width: 100%; height: 100%; object-fit: contain; }
        .edit-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); color: white; display: grid; place-items: center; opacity: 0; cursor: pointer; transition: 0.2s; }
        .preview-circle:hover .edit-overlay { opacity: 1; }

        .form-section-top { padding: 24px 32px; border-bottom: 1px solid #f8fafc; }
        .form-section-top.highlight { background: #eff6ff; border-bottom: 1px solid #dbeafe; }
        .section-header { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
        
        .ff-input-top { width: 100%; padding: 14px 18px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-size: 14px; font-weight: 600; margin-bottom: 12px; outline: none; transition: 0.2s; }
        .ff-input-top:focus { border-color: #0f172a; box-shadow: 0 0 0 4px rgba(15,23,42,0.05); }

        .logistics-card { background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
        .logistics-card label { display: block; font-size: 11px; font-weight: 800; color: #64748b; margin-bottom: 8px; }
        .logistics-card textarea { width: 100%; border: none; outline: none; font-size: 13px; font-weight: 600; min-height: 60px; resize: none; color: #1e293b; }

        .drawer-footer-pro { padding: 32px; background: white; border-top: 1px solid #f1f5f9; }
        .ff-btn-submit-pro { width: 100%; background: #0f172a; color: white; border: none; padding: 18px; border-radius: 16px; font-size: 15px; font-weight: 800; cursor: pointer; transition: 0.3s; }
        .ff-btn-submit-pro:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(15,23,42,0.2); }

        .role-badge-staff {
  background: #f1f5f9;
  color: #475569;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  border: 1px solid #e2e8f0;
}

.ptr { cursor: pointer; }

/* Efecto al pasar el mouse por la fila */
.row-hover:hover {
  background-color: #f8fafc !important;
}

.row-hover:hover .client-name {
  color: #2563eb; /* Un azul sutil para indicar que es clickeable */
}

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </AdminLayout>
  );
}