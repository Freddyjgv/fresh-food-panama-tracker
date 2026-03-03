import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";

// Lista estática para evitar cálculos en el render
const COUNTRIES = ["Panamá", "USA", "China", "Colombia", "Costa Rica", "México", "España"];

export default function AdminUsersPage() {
  const [tab, setTab] = useState("clients");
  const [showDrawer, setShowDrawer] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  // Formulario simplificado para evitar errores de validación inicial
  const [form, setForm] = useState({
    name: "",
    contact_email: "",
    country: "Panamá",
    legal_name: "",
    tax_id: ""
  });

  // Función de carga con manejo de errores robusto
  const fetchClients = useCallback(async () => {
    try {
      setIsBusy(true);
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
      console.error("Fetch error:", err);
    } finally {
      setIsBusy(false);
      setLoading(false);
    }
  }, []);

  // Inicialización controlada
  useEffect(() => {
    let active = true;
    requireAdminOrRedirect().then(r => {
      if (r.ok && active) fetchClients();
    });
    return () => { active = false; };
  }, [fetchClients]);

  if (loading) {
    return (
      <AdminLayout title="Cargando...">
        <div style={{ padding: '40px', textAlign: 'center' }}>Estabilizando sistema...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Directorio de Clientes">
      <div className="admin-container">
        <div className="header-flex">
          <div className="tabs-container">
            <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>Clientes</button>
            <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Usuarios</button>
          </div>
          <button className="btn-new" onClick={() => setShowDrawer(true)}>+ Nuevo Cliente</button>
        </div>

        <div className="table-card">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Email</th>
                <th>País</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {clients.length > 0 ? clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="name-bold">{c.name || "Sin nombre"}</div>
                    <div className="sub-text">{c.legal_name}</div>
                  </td>
                  <td>{c.contact_email}</td>
                  <td>{c.country}</td>
                  <td><button className="btn-edit">✎</button></td>
                </tr>
              )) : (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No hay clientes registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer con Renderizado Condicional Limpio */}
      {showDrawer && (
        <div className="modal-overlay" onClick={() => setShowDrawer(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Crear Cliente</h2>
              <button onClick={() => setShowDrawer(false)} className="close-x">×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Nombre Comercial *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Email *</label>
                <input value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
              </div>
              <div className="input-group">
                <label>País</label>
                <select value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button className="btn-save" disabled={isBusy}>
                {isBusy ? "Guardando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-container { padding: 10px; }
        .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .tabs-container { background: #f1f5f9; padding: 4px; border-radius: 8px; display: flex; gap: 4px; }
        .tabs-container button { border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; color: #64748b; background: transparent; transition: 0.2s; font-weight: 500; }
        .tabs-container button.active { background: white; color: #1f7a3a; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .btn-new { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        
        .table-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        .simple-table { width: 100%; border-collapse: collapse; text-align: left; }
        .simple-table th { background: #f8fafc; padding: 15px; font-size: 12px; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
        .simple-table td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .name-bold { font-weight: 600; color: #1e293b; }
        .sub-text { font-size: 11px; color: #94a3b8; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: flex-end; }
        .modal-content { width: 400px; background: white; height: 100%; display: flex; flex-direction: column; animation: slideIn 0.2s ease-out; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .modal-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .input-group { display: flex; flex-direction: column; gap: 5px; }
        .input-group label { font-size: 12px; font-weight: bold; color: #475569; }
        .input-group input, .input-group select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
        .btn-save { background: #1f7a3a; color: white; border: none; padding: 15px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        .close-x { background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8; }
        .btn-edit { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 18px; }
      `}</style>
    </AdminLayout>
  );
}