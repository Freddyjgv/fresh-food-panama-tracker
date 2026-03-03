import { useEffect, useState, useMemo } from "react";
import { 
  Plus, Search, X, Loader2, Building2, Globe, Mail, 
  UserCheck, AlertCircle, MoreVertical, Filter 
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { AdminLayout } from "../../components/AdminLayout";

// Tipado para evitar errores de undefined
interface Client {
  id: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  country: string;
  contact_email: string;
  created_at: string;
}

export default function UsersProPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Estado del Formulario
  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    tax_id: "",
    country: "Panamá",
    contact_email: ""
  });

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/.netlify/functions/listClients", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setClients(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/createUser", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({
          ...form,
          user_email: form.contact_email, // Se usa el email de contacto para el login
          invite: true
        })
      });

      if (res.ok) {
        setIsDrawerOpen(false);
        setForm({ name: "", legal_name: "", tax_id: "", country: "Panamá", contact_email: "" });
        fetchClients();
      } else {
        alert("Error al crear el cliente. Verifica que el email no exista.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  return (
    <AdminLayout title="Directorio Logístico" subtitle="Gestión de clientes y accesos a plataforma.">
      
      {/* TOOLBAR SUPERIOR */}
      <div className="toolbar">
        <div className="searchWrapper">
          <Search size={16} className="searchIcon" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button className="btnCreate" onClick={() => setIsDrawerOpen(true)}>
          <Plus size={18} />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* TABLA DE CLIENTES */}
      <div className="tableCard">
        <table className="proTable">
          <thead>
            <tr>
              <th>CLIENTE</th>
              <th>IDENTIFICACIÓN</th>
              <th>PAÍS</th>
              <th>CONTACTO</th>
              <th style={{ textAlign: 'right' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i} className="skeletonRow">
                  <td colSpan={5}><div className="skeletonLine" /></td>
                </tr>
              ))
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={5} className="emptyState">
                  <AlertCircle size={32} />
                  <p>No se encontraron clientes en el directorio.</p>
                </td>
              </tr>
            ) : filteredClients.map(client => (
              <tr key={client.id}>
                <td>
                  <div className="clientNameCell">
                    <div className="avatar">{client.name[0]}</div>
                    <div>
                      <div className="mainName">{client.name}</div>
                      <div className="subText">{client.legal_name || 'Sin razón social'}</div>
                    </div>
                  </div>
                </td>
                <td><code className="taxId">{client.tax_id || 'N/A'}</code></td>
                <td>
                  <span className="countryBadge">
                    {client.country === 'España' ? '🇪🇸' : '🇵🇦'} {client.country}
                  </span>
                </td>
                <td>
                  <div className="emailLink">
                    <Mail size={12} /> {client.contact_email}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btnIcon"><MoreVertical size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DRAWER LATERAL (FORMULARIO PRO) */}
      {isDrawerOpen && (
        <>
          <div className="drawerOverlay" onClick={() => !isSaving && setIsDrawerOpen(false)} />
          <div className="drawer">
            <div className="drawerHeader">
              <div>
                <h2>Nuevo Cliente</h2>
                <p>Registrar empresa y acceso de usuario</p>
              </div>
              <button className="btnClose" onClick={() => setIsDrawerOpen(false)}><X /></button>
            </div>

            <form onSubmit={handleSave} className="drawerBody">
              <div className="formSection">
                <label><Building2 size={14} /> INFORMACIÓN COMERCIAL</label>
                <input 
                  required 
                  placeholder="Nombre de la empresa (Ej. FreshFruit SL)"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
                <input 
                  placeholder="Razón Social Legal"
                  value={form.legal_name}
                  onChange={e => setForm({...form, legal_name: e.target.value})}
                />
                <input 
                  placeholder="Tax ID / NIF / RUC"
                  value={form.tax_id}
                  onChange={e => setForm({...form, tax_id: e.target.value})}
                />
              </div>

              <div className="formSection">
                <label><Globe size={14} /> UBICACIÓN</label>
                <select 
                  value={form.country}
                  onChange={e => setForm({...form, country: e.target.value})}
                >
                  <option value="Panamá">🇵🇦 Panamá (Origen)</option>
                  <option value="España">🇪🇸 España (Destino)</option>
                  <option value="Alemania">🇩🇪 Alemania (Destino)</option>
                  <option value="Holanda">🇳🇱 Holanda (Destino)</option>
                </select>
              </div>

              <div className="formSection">
                <label><UserCheck size={14} /> ACCESO DE USUARIO</label>
                <p className="fieldHint">Se enviará una invitación de acceso a este correo.</p>
                <input 
                  required 
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.contact_email}
                  onChange={e => setForm({...form, contact_email: e.target.value})}
                />
              </div>

              <button type="submit" className="btnSubmit" disabled={isSaving}>
                {isSaving ? <Loader2 className="spin" /> : "Crear e Invitar Cliente"}
              </button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .toolbar { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 20px; align-items: center; }
        .searchWrapper { position: relative; flex: 1; max-width: 400px; }
        .searchIcon { position: absolute; left: 12px; top: 10px; color: #94a3b8; }
        .searchWrapper input { width: 100%; padding: 8px 12px 8px 35px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 14px; }
        
        .btnCreate { background: var(--ff-green-dark, #1f7a3a); color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; display: flex; gap: 8px; align-items: center; cursor: pointer; transition: opacity 0.2s; }
        .btnCreate:hover { opacity: 0.9; }

        .tableCard { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .proTable { width: 100%; border-collapse: collapse; }
        .proTable th { background: #f8fafc; padding: 14px 18px; text-align: left; font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
        .proTable td { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }

        .clientNameCell { display: flex; gap: 12px; align-items: center; }
        .avatar { width: 36px; height: 36px; background: #f0fdf4; color: #166534; border-radius: 10px; display: grid; place-items: center; font-weight: 900; }
        .mainName { font-weight: 700; color: #1e293b; font-size: 14px; }
        .subText { font-size: 12px; color: #64748b; }
        
        .taxId { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: monospace; }
        .countryBadge { font-size: 13px; font-weight: 500; }
        .emailLink { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; }

        /* DRAWER CSS */
        .drawerOverlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.3); backdrop-filter: blur(2px); z-index: 9998; }
        .drawer { position: fixed; top: 0; right: 0; width: 420px; height: 100%; background: white; z-index: 9999; display: flex; flex-direction: column; box-shadow: -10px 0 50px rgba(0,0,0,0.1); animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

        .drawerHeader { padding: 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .drawerHeader h2 { margin: 0; font-size: 18px; font-weight: 800; }
        .drawerHeader p { margin: 4px 0 0; font-size: 13px; color: #64748b; }
        .btnClose { background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; }

        .drawerBody { padding: 24px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; }
        .formSection { display: flex; flex-direction: column; gap: 10px; }
        .formSection label { font-size: 11px; font-weight: 800; color: var(--ff-green-dark); display: flex; gap: 6px; align-items: center; }
        .formSection input, .formSection select { padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; transition: border-color 0.2s; }
        .formSection input:focus { border-color: var(--ff-green-dark); }
        .fieldHint { font-size: 12px; color: #94a3b8; margin: -5px 0 5px; }

        .btnSubmit { background: var(--ff-green-dark); color: white; border: none; padding: 16px; border-radius: 12px; font-weight: 800; cursor: pointer; margin-top: auto; }
        .btnSubmit:disabled { opacity: 0.6; }

        .emptyState { padding: 60px; text-align: center; color: #94a3b8; }
        .emptyState p { margin-top: 10px; font-size: 14px; }

        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}