import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, 
  Phone, ArrowLeft, Edit3, Loader2, AlertCircle, X, Trash2,
  Calendar, Hash, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [f, setF] = useState<any>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!router.isReady || !id) return;
    fetchFullClientData();
  }, [id, router.isReady]);

  const getAuthToken = async () => {
    if (tokenRef.current) return tokenRef.current;
    const { data: { session } } = await supabase.auth.getSession();
    tokenRef.current = session?.access_token || null;
    return tokenRef.current;
  };

  const fetchFullClientData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Obtener datos del cliente
      const { data: clientData, error: cErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (cErr) throw new Error(`Error Supabase: ${cErr.message}`);
      if (!clientData) throw new Error("El expediente no existe.");

      // 2. Obtener Direcciones
      const { data: addrData } = await supabase
        .from('shipping_addresses')
        .select('*')
        .eq('client_id', id);

      // 3. Obtener Embarques (Aseguramos la query limpia)
      const { data: shipData, error: sErr } = await supabase
        .from('shipments')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      if (sErr) console.error("Error cargando embarques:", sErr);

      setClient({ ...clientData, shipping_addresses: addrData || [] });
      setShipments(shipData || []);
      
      setF({
        ...clientData,
        email_corp: clientData.contact_email || "",
        phone_corp: clientData.phone || "",
        shipping_addresses: addrData && addrData.length > 0 ? addrData : [{ id: Date.now(), address: "" }]
      });

    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = await getAuthToken();
      const payload = {
        ...f,
        shipping_addresses: f.shipping_addresses.filter((a: any) => a.address.trim() !== "")
      };

      const res = await fetch("/.netlify/functions/manageClient", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsDrawerOpen(false);
        await fetchFullClientData();
      } else {
        const err = await res.json();
        alert(err.message);
      }
    } catch (err) {
      alert("Error de conexión");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return (
    <AdminLayout title="Cargando...">
      <div className="state-container"><Loader2 className="spinner" size={40} /><p>Sincronizando expediente...</p></div>
    </AdminLayout>
  );

  if (errorMsg || !client) return (
    <AdminLayout title="Error">
      <div className="state-container"><AlertCircle size={48} color="#ef4444" /><h2>No se pudo cargar el cliente</h2><p>{errorMsg}</p><Link href="/admin/users" className="btn-back-error">Volver al listado</Link></div>
    </AdminLayout>
  );

  return (
    <AdminLayout title={client.name}>
      <div className="view-container">
        {/* BARRA SUPERIOR */}
        <div className="top-nav">
          <Link href="/admin/users" className="back-link"><ArrowLeft size={18} /> Volver a Clientes</Link>
          <button className="edit-trigger" onClick={() => setIsDrawerOpen(true)}><Edit3 size={16}/> Editar Expediente</button>
        </div>

        <div className="dashboard-layout">
          {/* LADO IZQUIERDO: PERFIL */}
          <aside className="sidebar-profile">
            <div className="avatar-box">{client.name.charAt(0)}</div>
            <h2 className="client-title">{client.name}</h2>
            <div className="badge">Cliente Activo</div>

            <div className="info-groups">
              <div className="info-group">
                <label><Building2 size={14}/> Identificación</label>
                <p><strong>RUC:</strong> {client.tax_id || 'No definido'}</p>
                <p><strong>Razón:</strong> {client.legal_name || 'N/A'}</p>
              </div>
              <div className="info-group">
                <label><Mail size={14}/> Contacto</label>
                <p>{client.contact_email}</p>
                <p>{client.phone || 'Sin teléfono'}</p>
              </div>
            </div>
          </aside>

          {/* LADO DERECHO: OPERACIONES */}
          <main className="main-content">
            <section className="card">
              <header className="card-header"><MapPin size={18} color="#1f7a3a" /> <h3>Puntos de Entrega</h3></header>
              <div className="address-grid">
                {client.shipping_addresses?.length > 0 ? client.shipping_addresses.map((a: any) => (
                  <div key={a.id} className="address-card">{a.address}</div>
                )) : <p className="empty">Sin direcciones registradas.</p>}
              </div>
            </section>

            <section className="card">
              <header className="card-header"><Ship size={18} color="#1f7a3a" /> <h3>Historial de Embarques</h3></header>
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th><Hash size={14}/> Código</th>
                      <th>Estado</th>
                      <th><Calendar size={14}/> Fecha</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.length > 0 ? shipments.map(s => (
                      <tr key={s.id}>
                        <td><span className="code-tag">{s.code}</span></td>
                        <td><span className={`status-pill ${s.status?.toLowerCase()}`}>{s.status}</span></td>
                        <td>{new Date(s.created_at).toLocaleDateString()}</td>
                        <td><ChevronRight size={16} color="#cbd5e1"/></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="empty-row">No se encontraron embarques registrados para este ID.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* DRAWER EDICIÓN */}
      {isDrawerOpen && (
        <>
          <div className="modal-overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="side-drawer">
            <div className="drawer-header">
              <h3>Actualizar Expediente</h3>
              <button onClick={() => setIsDrawerOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="drawer-form">
              <div className="form-section">
                <label>Información Comercial</label>
                <input required value={f.name} onChange={e=>setF({...f, name:e.target.value})} placeholder="Nombre" />
                <input value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} placeholder="Razón Social" />
                <input value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} placeholder="RUC" />
              </div>
              <div className="form-section">
                <label>Direcciones</label>
                {f.shipping_addresses.map((s: any, i: number) => (
                  <div key={s.id} className="input-row">
                    <input value={s.address} onChange={e => {
                      const ns = [...f.shipping_addresses]; ns[i].address = e.target.value; setF({...f, shipping_addresses: ns});
                    }} />
                    <button type="button" onClick={() => setF({...f, shipping_addresses: f.shipping_addresses.filter((x:any) => x.id !== s.id)})}><Trash2 size={14}/></button>
                  </div>
                ))}
                <button type="button" className="btn-add-line" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir</button>
              </div>
              <button className="btn-save" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar Cambios"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .view-container { max-width: 1200px; margin: 0 auto; padding: 10px; }
        .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .back-link { display: flex; align-items: center; gap: 8px; color: #64748b; text-decoration: none; font-weight: 500; font-size: 14px; }
        .edit-trigger { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        
        .dashboard-layout { display: grid; grid-template-columns: 300px 1fr; gap: 30px; }
        
        .sidebar-profile { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 30px; text-align: center; height: fit-content; position: sticky; top: 20px; }
        .avatar-box { width: 70px; height: 70px; background: #f0fdf4; color: #1f7a3a; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 28px; font-weight: 800; border: 2px solid #dcfce7; }
        .client-title { font-size: 18px; color: #1e293b; margin-bottom: 8px; }
        .badge { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; display: inline-block; margin-bottom: 25px; }
        
        .info-group { text-align: left; margin-bottom: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9; }
        .info-group label { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; margin-bottom: 8px; }
        .info-group p { font-size: 13px; color: #475569; margin: 3px 0; }

        .main-content { display: flex; flex-direction: column; gap: 25px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px; }
        .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .card-header h3 { font-size: 15px; color: #1e293b; font-weight: 700; }
        
        .address-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .address-card { background: #f8fafc; padding: 15px; border-radius: 10px; font-size: 13px; color: #475569; border: 1px solid #f1f5f9; }
        
        .modern-table { width: 100%; border-collapse: collapse; }
        .modern-table th { text-align: left; font-size: 11px; color: #94a3b8; text-transform: uppercase; padding: 12px; border-bottom: 1px solid #f1f5f9; }
        .modern-table td { padding: 15px 12px; font-size: 13px; border-bottom: 1px solid #f8fafc; }
        .code-tag { font-weight: 700; color: #1f7a3a; background: #f0fdf4; padding: 4px 8px; border-radius: 6px; }
        .status-pill { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #f1f5f9; color: #64748b; }

        /* Estilos Drawer y Estados */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); z-index: 100; }
        .side-drawer { position: fixed; right: 0; top: 0; height: 100%; width: 400px; background: white; z-index: 101; padding: 30px; box-shadow: -10px 0 30px rgba(0,0,0,0.1); }
        .drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .drawer-form { display: flex; flex-direction: column; gap: 20px; }
        .form-section { display: flex; flex-direction: column; gap: 10px; }
        .form-section label { font-size: 12px; font-weight: 700; color: #1f7a3a; }
        input { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
        .input-row { display: flex; gap: 8px; }
        .btn-save { background: #1f7a3a; color: white; border: none; padding: 15px; border-radius: 10px; font-weight: 700; cursor: pointer; margin-top: 20px; }
        
        .state-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 15px; }
        .spinner { animation: spin 1s linear infinite; color: #1f7a3a; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .empty, .empty-row { color: #94a3b8; font-style: italic; font-size: 13px; padding: 20px; text-align: center; }
      `}</style>
    </AdminLayout>
  );
}