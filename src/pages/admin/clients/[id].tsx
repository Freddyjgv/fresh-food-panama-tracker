import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, Phone, ArrowLeft, 
  Edit3, Loader2, AlertCircle, X, Trash2, Calendar, Hash, Globe
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

  // Función de carga envuelta en useCallback para evitar loops
  const fetchFullClientData = useCallback(async (clientId: string) => {
    setLoading(true);
    try {
      // 1. Datos del Cliente
      const { data: clientData, error: cErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();

      if (cErr) throw cErr;
      if (!clientData) throw new Error("Cliente no encontrado.");

      // 2. Direcciones y Embarques en paralelo para mayor velocidad
      const [addrsRes, shipsRes] = await Promise.all([
        supabase.from('shipping_addresses').select('*').eq('client_id', clientId),
        supabase.from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      ]);

      setClient({ ...clientData, shipping_addresses: addrsRes.data || [] });
      setShipments(shipsRes.data || []);
      
      setF({
        ...clientData,
        email_corp: clientData.contact_email || "",
        phone_corp: clientData.phone || "",
        shipping_addresses: addrsRes.data && addrsRes.data.length > 0 ? addrsRes.data : [{ id: Date.now(), address: "" }]
      });
    } catch (e: any) {
      console.error("Error cargando expediente:", e);
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (router.isReady && id) {
      fetchFullClientData(id as string);
    }
  }, [id, router.isReady, fetchFullClientData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/manageClient", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify(f)
      });

      if (res.ok) {
        setIsDrawerOpen(false);
        fetchFullClientData(id as string);
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
      <div className="state-container"><Loader2 className="spinner" size={40} /><p>Cargando expediente...</p></div>
    </AdminLayout>
  );

  if (errorMsg || !client) return (
    <AdminLayout title="Error">
      <div className="state-container"><AlertCircle size={48} color="#ef4444" /><h2>Error de acceso</h2><p>{errorMsg}</p><Link href="/admin/users" className="btn-back-error">Regresar</Link></div>
    </AdminLayout>
  );

  return (
    <AdminLayout title={client.name}>
      <div className="view-container">
        <div className="top-nav">
          <Link href="/admin/users" className="back-link"><ArrowLeft size={18} /> Volver a Clientes</Link>
          <button className="edit-trigger" onClick={() => setIsDrawerOpen(true)}><Edit3 size={16}/> Editar Datos</button>
        </div>

        <div className="dashboard-layout">
          {/* LADO IZQUIERDO: PERFIL */}
          <aside className="sidebar-card">
            <div className="avatar">{client.name.charAt(0)}</div>
            <h2 className="client-name">{client.name}</h2>
            <div className="status-tag">Cliente Activo</div>

            <div className="info-section">
              <label><Building2 size={14}/> Fiscal</label>
              <p><strong>RUC:</strong> {client.tax_id || 'N/A'}</p>
              <p><strong>Razón:</strong> {client.legal_name || client.name}</p>
            </div>
            <div className="info-section">
              <label><Mail size={14}/> Contacto</label>
              <p>{client.contact_email}</p>
              <p>{client.phone || 'Sin teléfono'}</p>
            </div>
          </aside>

          {/* LADO DERECHO: OPERACIONES */}
          <main className="main-content">
            <section className="data-card">
              <div className="card-header"><MapPin size={18} /> <h3>Direcciones de Entrega</h3></div>
              <div className="address-list">
                {client.shipping_addresses?.length > 0 ? client.shipping_addresses.map((a: any) => (
                  <div key={a.id} className="address-item">{a.address}</div>
                )) : <p className="empty">No hay direcciones.</p>}
              </div>
            </section>

            <section className="data-card">
              <div className="card-header"><Ship size={18} /> <h3>Historial de Embarques</h3></div>
              <div className="table-responsive">
                <table className="ship-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Estado</th>
                      <th>Destino</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.length > 0 ? shipments.map(s => (
                      <tr key={s.id}>
                        <td className="bold-text">{s.code}</td>
                        <td><span className="pill">{s.status || 'En Proceso'}</span></td>
                        <td><div className="flex-row"><Globe size={12}/> {s.destination || 'N/A'}</div></td>
                        <td>{new Date(s.created_at).toLocaleDateString()}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="empty-msg">No se encontraron embarques.</td></tr>
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
          <div className="overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer">
            <div className="drawer-header">
              <h3>Editar Cliente</h3>
              <button className="close-btn" onClick={() => setIsDrawerOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="drawer-body">
              <div className="form-group">
                <label>Nombre Comercial</label>
                <input required value={f.name} onChange={e=>setF({...f, name:e.target.value})} />
              </div>
              <div className="form-group">
                <label>RUC / Tax ID</label>
                <input value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} />
              </div>
              <button className="save-btn" disabled={isSaving}>{isSaving ? "Guardando..." : "Actualizar"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .view-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .top-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .back-link { display: flex; align-items: center; gap: 8px; color: #64748b; text-decoration: none; font-weight: 500; }
        .edit-trigger { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        
        .dashboard-layout { display: grid; grid-template-columns: 320px 1fr; gap: 25px; }
        .sidebar-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 30px; text-align: center; height: fit-content; }
        .avatar { width: 60px; height: 60px; background: #f0fdf4; color: #1f7a3a; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 24px; font-weight: 800; border: 1px solid #dcfce7; }
        .client-name { font-size: 18px; color: #1e293b; margin-bottom: 5px; }
        .status-tag { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; display: inline-block; margin-bottom: 25px; }
        
        .info-section { text-align: left; margin-bottom: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9; }
        .info-section label { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; margin-bottom: 8px; }
        .info-section p { font-size: 13px; color: #475569; margin: 3px 0; }

        .main-content { display: flex; flex-direction: column; gap: 20px; }
        .data-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px; }
        .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; color: #1f7a3a; }
        .card-header h3 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
        
        .address-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .address-item { background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 13px; border: 1px solid #f1f5f9; color: #475569; }
        
        .ship-table { width: 100%; border-collapse: collapse; }
        .ship-table th { text-align: left; font-size: 11px; color: #94a3b8; text-transform: uppercase; padding: 12px; border-bottom: 1px solid #f1f5f9; }
        .ship-table td { padding: 15px 12px; font-size: 13px; border-bottom: 1px solid #f8fafc; }
        .bold-text { font-weight: 700; color: #1f7a3a; }
        .pill { background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
        .flex-row { display: flex; align-items: center; gap: 5px; }

        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); z-index: 100; }
        .drawer { position: fixed; right: 0; top: 0; height: 100%; width: 380px; background: white; z-index: 101; padding: 30px; box-shadow: -10px 0 30px rgba(0,0,0,0.1); }
        .drawer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
        .form-group label { font-size: 12px; font-weight: 700; color: #64748b; }
        input { padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .save-btn { background: #1f7a3a; color: white; border: none; width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-top: 20px; }
        
        .state-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 15px; }
        .spinner { animation: spin 1s linear infinite; color: #1f7a3a; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .empty, .empty-msg { color: #94a3b8; font-style: italic; font-size: 13px; text-align: center; padding: 20px; }
      `}</style>
    </AdminLayout>
  );
}