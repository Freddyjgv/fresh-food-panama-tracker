import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { Plus, Loader2, X, Building2, Globe, Mail, Search, RefreshCcw, Phone } from "lucide-react";

const COUNTRIES = [
  { code: 'PA', name: 'Panamá', flag: '🇵🇦' }, { code: 'ES', name: 'España', flag: '🇪🇸' },
  { code: 'DE', name: 'Alemania', flag: '🇩🇪' }, { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'CN', name: 'China', flag: '🇨🇳' }
];

export default function AdminUsersPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [form, setForm] = useState({ name: "", legal_name: "", tax_id: "", contact_email: "", country: "Panamá", phone: "" });

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/listClients", {
        headers: { Authorization: `Bearer ${data.session?.access_token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setClients(json.items || []);
      }
    } finally { setBusy(false); setLoading(false); }
  };

  useEffect(() => { requireAdminOrRedirect().then(r => { if (r.ok) load(); }); }, []);

  const filtered = useMemo(() => COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())), [countrySearch]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { data } = await supabase.auth.getSession();
    try {
      const res = await fetch("/.netlify/functions/createUser", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ ...form, user_email: form.contact_email, invite: true }),
      });
      if (res.ok) { setShowDrawer(false); load(); }
    } finally { setBusy(false); }
  };

  if (loading) return <AdminLayout title="..."><Loader2 className="spin" /></AdminLayout>;

  return (
    <AdminLayout title="Directorio de Clientes">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn-add" onClick={() => setShowDrawer(true)}><Plus size={18} /> Nuevo Cliente</button>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Cliente</th><th>ID Fiscal</th><th>País</th><th>Email</th></tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong><br/><small>{c.legal_name}</small></td>
                <td><code>{c.tax_id}</code></td>
                <td>{c.country}</td>
                <td>{c.contact_email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDrawer && (
        <div className="overlay" onClick={() => setShowDrawer(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-h"><h3>Nuevo Cliente</h3><X onClick={() => setShowDrawer(false)} style={{cursor:'pointer'}}/></div>
            <form onSubmit={save} className="drawer-b">
              <label>NOMBRE COMERCIAL</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <label>RAZÓN SOCIAL</label>
              <input value={form.legal_name} onChange={e => setForm({...form, legal_name: e.target.value})} />
              <label>TAX ID</label>
              <input value={form.tax_id} onChange={e => setForm({...form, tax_id: e.target.value})} />
              <label>PAÍS</label>
              <select value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
              </select>
              <label>EMAIL</label>
              <input required type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} />
              <button type="submit" className="btn-save" disabled={busy}>{busy ? "Guardando..." : "Crear Cliente"}</button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .table-container { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; padding: 12px; text-align: left; font-size: 11px; color: #64748b; }
        td { padding: 12px; border-top: 1px solid #f1f5f9; font-size: 14px; }
        .btn-add { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; gap: 8px; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 1000; display: flex; justify-content: flex-end; }
        .drawer { width: 400px; background: white; height: 100%; display: flex; flex-direction: column; box-shadow: -5px 0 15px rgba(0,0,0,0.1); }
        .drawer-h { padding: 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
        .drawer-b { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
        label { font-size: 10px; font-weight: bold; color: #1f7a3a; }
        input, select { padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .btn-save { background: #1f7a3a; color: white; border: none; padding: 15px; border-radius: 8px; font-weight: bold; margin-top: 20px; cursor: pointer; }
      `}</style>
    </AdminLayout>
  );
}