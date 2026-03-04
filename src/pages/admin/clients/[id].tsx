import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { 
  Plus, X, Mail, Phone, Edit3, Loader2, Search, Building2, 
  Globe, CreditCard, MapPin, ExternalLink, Trash2
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout, notify } from "../../components/AdminLayout";

export default function AdminUsersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'clients' | 'staff'>('clients');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const initialForm = {
    id: null, name: "", legal_name: "", tax_id: "", email_corp: "", phone_corp: "", 
    country_origin: "Panamá", payment_condition: "Prepagado", billing_address: "",
    website: "", shipping_addresses: [{ id: Date.now(), address: "" }],
    staff_name: "", staff_email: "", staff_role: "admin"
  };
  
  const [f, setF] = useState(initialForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const endpoint = activeTab === 'clients' ? '/.netlify/functions/listClients' : '/.netlify/functions/listUsers';
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const data = await res.json();
      setDataList(data.items || []);
    } catch (e) { notify("Error de carga", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      const s = searchQuery.toLowerCase();
      const name = (item.name || item.full_name || "").toLowerCase();
      const email = (item.contact_email || item.email || "").toLowerCase();
      return name.includes(s) || email.includes(s);
    });
  }, [dataList, searchQuery]);

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

      if (res.ok) {
        notify("Registro actualizado", "success");
        setIsDrawerOpen(false);
        loadData();
      } else {
        const err = await res.json();
        notify(err.message, "error");
      }
    } catch (err) { notify("Error de servidor", "error"); }
    finally { setIsSaving(false); }
  };

  return (
    <AdminLayout title="Directorio" subtitle="Gestión de identidades y accesos">
      
      <div className="directory-header">
        <div className="tab-switcher">
          <button className={activeTab === 'clients' ? 'active' : ''} onClick={() => setActiveTab('clients')}>Clientes</button>
          <button className={activeTab === 'staff' ? 'active' : ''} onClick={() => setActiveTab('staff')}>Equipo</button>
        </div>
        
        <div className="top-actions">
          <div className="search-bar-slim">
            <Search size={14} />
            <input placeholder="Filtrar por nombre o email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <button className="btn-create-main" onClick={() => { setF(initialForm); setIsDrawerOpen(true); }}>
            <Plus size={16} /> Nuevo {activeTab === 'clients' ? 'Cliente' : 'Miembro'}
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="ff-table-pro">
          <thead>
            {activeTab === 'clients' ? (
              <tr><th>Cliente / RUC</th><th>Contacto</th><th>Ubicación</th><th>Estado</th><th className="txt-right">Acciones</th></tr>
            ) : (
              <tr><th>Colaborador</th><th>Email</th><th>Rol</th><th>Estatus</th></tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="td-loading"><Loader2 className="spin" /></td></tr>
            ) : filteredData.map(item => (
              <tr key={item.id} className="tr-interactive">
                {activeTab === 'clients' ? (
                  <>
                    <td onClick={() => router.push(`/admin/clients/${item.id}`)}>
                      <div className="cell-identity">
                        <strong>{item.name}</strong>
                        <code>{item.tax_id || 'SIN RUC'}</code>
                      </div>
                    </td>
                    <td>
                      <div className="cell-contact">
                        <span><Mail size={10}/> {item.contact_email}</span>
                        <span><Phone size={10}/> {item.phone || '---'}</span>
                      </div>
                    </td>
                    <td><div className="cell-geo"><Globe size={10}/> {item.country || 'Panamá'}</div></td>
                    <td>
                      <span className={item.has_platform_access ? "tag-active" : "tag-prospect"}>
                        {item.has_platform_access ? "Activo" : "Prospecto"}
                      </span>
                    </td>
                    <td className="txt-right">
                       <button className="btn-icon-edit" onClick={(e) => { e.stopPropagation(); setF({...f, ...item, email_corp: item.contact_email}); setIsDrawerOpen(true); }}>
                          <Edit3 size={14}/>
                       </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td><strong>{item.full_name}</strong></td>
                    <td className="txt-muted">{item.email}</td>
                    <td><span className="role-badge">{item.role}</span></td>
                    <td><div className={item.confirmed_at ? "dot-online" : "dot-offline"} /></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DRAWER RECONSTRUIDO CON TODOS TUS CAMPOS */}
      {isDrawerOpen && (
        <>
          <div className="ff-backdrop" onClick={() => setIsDrawerOpen(false)} />
          <div className="ff-drawer-right">
            <div className="drawer-head">
              <div className="title-area">
                <Building2 size={16} className="text-green" />
                <h3>{f.id ? 'Expediente Cliente' : 'Nuevo Cliente'}</h3>
              </div>
              <button className="btn-close" onClick={() => setIsDrawerOpen(false)}><X size={18}/></button>
            </div>

            <form className="drawer-content" onSubmit={handleSave}>
              <div className="form-group-sec">
                <label>Identificación Legal</label>
                <input required placeholder="Nombre Comercial" value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
                <input placeholder="Razón Social (Legal)" value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} />
                <div className="grid-2">
                  <div className="sub-group">
                    <label>RUC / Tax ID</label>
                    <input placeholder="8-XXX-XXXX" value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
                  </div>
                  <div className="sub-group">
                    <label>País</label>
                    <input placeholder="Panamá" value={f.country_origin} onChange={e=>setF({...f, country_origin:e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="form-group-sec">
                <label>Canales de Contacto</label>
                <div className="input-with-icon">
                  <Mail size={12} />
                  <input required type="email" placeholder="email@empresa.com" value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} />
                </div>
                <div className="input-with-icon">
                  <Phone size={12} />
                  <input placeholder="+507 0000-0000" value={f.phone_corp} onChange={e=>setF({...f, phone_corp:e.target.value})} />
                </div>
                <div className="input-with-icon">
                  <ExternalLink size={12} />
                  <input placeholder="www.website.com" value={f.website} onChange={e=>setF({...f, website:e.target.value})} />
                </div>
              </div>

              <div className="form-group-sec">
                <label>Logística y Pagos</label>
                <select value={f.payment_condition} onChange={e=>setF({...f, payment_condition:e.target.value})}>
                  <option value="Prepagado">Prepagado</option>
                  <option value="Crédito 15 días">Crédito 15 días</option>
                  <option value="Crédito 30 días">Crédito 30 días</option>
                </select>
                <textarea placeholder="Dirección de Facturación" value={f.billing_address} onChange={e=>setF({...f, billing_address:e.target.value})} />
              </div>

              <div className="form-group-sec">
                <div className="label-row">
                  <label>Puntos de Entrega</label>
                  <button type="button" className="btn-mini" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id: Date.now(), address: ""}]})}>
                    <Plus size={10}/> Añadir
                  </button>
                </div>
                {f.shipping_addresses.map((addr: any, idx: number) => (
                  <div key={addr.id} className="input-row-del">
                    <input placeholder={`Dirección ${idx + 1}`} value={addr.address} onChange={e => {
                      const newAddrs = [...f.shipping_addresses];
                      newAddrs[idx].address = e.target.value;
                      setF({...f, shipping_addresses: newAddrs});
                    }} />
                    {f.shipping_addresses.length > 1 && (
                      <button type="button" className="btn-del" onClick={() => setF({...f, shipping_addresses: f.shipping_addresses.filter((_, i) => i !== idx)})}>
                        <Trash2 size={12}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="drawer-actions-fixed">
                <button type="button" className="btn-cancel-flat" onClick={() => setIsDrawerOpen(false)}>Descartar</button>
                <button type="submit" className="btn-save-main" disabled={isSaving}>
                  {isSaving ? <Loader2 className="spin" size={14} /> : (f.id ? "Guardar Cambios" : "Crear Cliente")}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .directory-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        
        .tab-switcher { display: flex; background: #f1f5f9; padding: 3px; border-radius: 10px; }
        .tab-switcher button { border: none; background: none; padding: 6px 16px; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer; border-radius: 8px; transition: 0.2s; }
        .tab-switcher button.active { background: white; color: #1f7a3a; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

        .top-actions { display: flex; gap: 12px; }
        .search-bar-slim { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; padding: 0 12px; border-radius: 10px; width: 280px; }
        .search-bar-slim input { border: none; padding: 8px 0; font-size: 12px; outline: none; width: 100%; }
        .search-bar-slim :global(svg) { color: #94a3b8; }

        .btn-create-main { background: #1f7a3a; color: white; border: none; padding: 0 16px; height: 36px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }

        .table-wrapper { background: white; border-radius: 16px; border: 1px solid #f1f5f9; overflow: hidden; }
        .ff-table-pro { width: 100%; border-collapse: collapse; }
        .ff-table-pro th { background: #fcfcfc; text-align: left; padding: 12px 20px; font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1px solid #f1f5f9; }
        .ff-table-pro td { padding: 14px 20px; font-size: 12px; border-bottom: 1px solid #f8fafc; color: #1e293b; }
        .tr-interactive:hover { background: #fafafa; cursor: pointer; }

        .cell-identity { display: flex; flex-direction: column; gap: 2px; }
        .cell-identity strong { font-weight: 700; font-size: 13px; }
        .cell-identity code { font-size: 10px; color: #94a3b8; background: #f1f5f9; padding: 1px 4px; border-radius: 4px; width: fit-content; }

        .cell-contact { display: flex; flex-direction: column; gap: 3px; }
        .cell-contact span { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; }
        
        .tag-active { background: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; }
        .tag-prospect { background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; }

        /* DRAWER SENIOR */
        .ff-backdrop { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.4); backdrop-filter: blur(3px); z-index: 9000; }
        .ff-drawer-right { position: fixed; top: 0; right: 0; bottom: 0; width: 450px; background: white; z-index: 9001; display: flex; flex-direction: column; animation: slideRight 0.3s ease-out; }
        @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }

        .drawer-head { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .title-area { display: flex; align-items: center; gap: 12px; }
        .title-area h3 { font-size: 15px; font-weight: 800; margin: 0; }
        .btn-close { background: none; border: none; color: #94a3b8; cursor: pointer; }

        .drawer-content { padding: 24px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 28px; padding-bottom: 100px; }
        .form-group-sec { display: flex; flex-direction: column; gap: 12px; }
        .form-group-sec label { font-size: 10px; font-weight: 800; color: #1f7a3a; text-transform: uppercase; letter-spacing: 0.05em; }
        
        .label-row { display: flex; justify-content: space-between; align-items: center; }
        .btn-mini { background: #f0fdf4; border: 1px solid #dcfce7; color: #166534; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; }

        input, select, textarea { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 12px; outline: none; transition: 0.2s; }
        input:focus, select:focus, textarea:focus { border-color: #1f7a3a; box-shadow: 0 0 0 3px rgba(31,122,58,0.08); }
        
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .sub-group { display: flex; flex-direction: column; gap: 6px; }

        .input-with-icon { position: relative; }
        .input-with-icon :global(svg) { position: absolute; left: 12px; top: 11px; color: #94a3b8; }
        .input-with-icon input { padding-left: 35px; }

        .input-row-del { display: flex; gap: 8px; align-items: center; }
        .btn-del { background: #fff1f2; color: #e11d48; border: none; padding: 10px; border-radius: 8px; cursor: pointer; }

        .drawer-actions-fixed { position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 24px; background: white; border-top: 1px solid #f1f5f9; display: flex; gap: 12px; }
        .btn-cancel-flat { flex: 1; border: none; background: #f8fafc; color: #64748b; padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-save-main { flex: 2; background: #1f7a3a; color: white; border: none; padding: 12px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(31,122,58,0.2); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .txt-right { text-align: right; }
        .txt-muted { color: #94a3b8; }
        .role-badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .dot-online { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; margin: 0 auto; }
        .dot-offline { width: 8px; height: 8px; background: #cbd5e1; border-radius: 50%; margin: 0 auto; }
      `}</style>
    </AdminLayout>
  );
}