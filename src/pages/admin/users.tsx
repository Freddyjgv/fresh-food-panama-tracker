import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { Loader2, Plus, X, Building2, Mail, Globe, ExternalLink } from "lucide-react";

// Lista profesional fija (Para evitar cálculos pesados)
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
  { code: 'CN', name: 'China', flag: '🇨🇳' }
];

function UsersContent() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const isMounted = useRef(true);

  const loadData = useCallback(async () => {
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
    } catch (e) {
      console.error(e);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    requireAdminOrRedirect().then(r => { if (r.ok && isMounted.current) loadData(); });
    return () => { isMounted.current = false; };
  }, [loadData]);

  if (loading) return <div style={{padding: 40}}><Loader2 className="spin" /> Estabilizando...</div>;

  return (
    <div style={{ animation: 'fadeIn 0.5s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Directorio Logístico</h2>
        <button 
          onClick={() => setShowDrawer(true)}
          style={{ background: '#1f7a3a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={18} inline-block /> Nuevo Cliente
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 15, fontSize: 12, color: '#64748b' }}>CLIENTE</th>
              <th style={{ textAlign: 'left', padding: 15, fontSize: 12, color: '#64748b' }}>PAÍS</th>
              <th style={{ textAlign: 'right', padding: 15 }}></th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: 15 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.contact_email}</div>
                </td>
                <td style={{ padding: 15 }}><span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>{c.country}</span></td>
                <td style={{ padding: 15, textAlign: 'right' }}><ExternalLink size={14} color="#94a3b8" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 400, background: 'white', height: '100%', padding: 25, boxShadow: '-5px 0 15px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
              <h3 style={{ margin: 0 }}>Registro Pro</h3>
              <X onClick={() => setShowDrawer(false)} style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <input style={inStyle} placeholder="Empresa" />
              <input style={inStyle} placeholder="Email" />
              <select style={inStyle}>
                {ALL_COUNTRIES.map(cn => <option key={cn.code} value={cn.name}>{cn.flag} {cn.name}</option>)}
              </select>
              <button style={{ background: '#1f7a3a', color: 'white', border: 'none', padding: 15, borderRadius: 10, fontWeight: 700, marginTop: 10 }}>Guardar Cliente</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const inStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' };

// LA CLAVE: Forzamos a que el componente sea solo de cliente
export default function AdminUsersPage() {
  return (
    <AdminLayout title="Clientes">
      <UsersContent />
    </AdminLayout>
  );
}