import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, CreditCard, Ship, Mail, 
  Phone, ArrowLeft, Edit3, Loader2, AlertCircle, X, Trash2
} from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  // Estados de datos
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados del Drawer de Edición
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [f, setF] = useState<any>(null);
  const tokenRef = useRef<string | null>(null);

  // EFECTO CRÍTICO: Esperar a que el router esté listo para capturar el ID real
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
      // 1. Cargar Datos Base del Cliente (Usamos maybeSingle para evitar errores ruidosos si no existe)
      const { data: clientData, error: cErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (cErr) throw new Error(`Error Supabase: ${cErr.message}`);
      if (!clientData) throw new Error("El expediente solicitado no existe en la base de datos.");

      // 2. Cargar Direcciones (Bloque aislado: si la tabla no existe, no rompe la ficha)
      let addrData = [];
      try {
        const { data: addrs } = await supabase.from('shipping_addresses').select('*').eq('client_id', id);
        addrData = addrs || [];
      } catch (e) { 
        console.warn("Aviso: Tabla shipping_addresses no accesible."); 
      }

      // 3. Cargar Embarques (Bloque aislado)
      let shipData = [];
      try {
        const { data: ships } = await supabase.from('shipments').select('*').eq('client_id', id).order('created_at', { ascending: false });
        shipData = ships || [];
      } catch (e) { 
        console.warn("Aviso: Tabla shipments no accesible."); 
      }

      const fullClient = { ...clientData, shipping_addresses: addrData };
      setClient(fullClient);
      setShipments(shipData);
      
      // Preparar formulario para edición
      setF({
        ...fullClient,
        email_corp: fullClient.contact_email || "",
        phone_corp: fullClient.phone || "",
        country_origin: fullClient.country || "Panamá",
        shipping_addresses: addrData.length > 0 ? addrData : [{ id: Date.now(), address: "" }]
      });

    } catch (e: any) {
      console.error("Fallo en fetchFullClientData:", e.message);
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
      alert("Error de conexión al servidor");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return (
    <AdminLayout title="Cargando...">
      <div className="loading-state">
        <Loader2 className="animate-spin" size={32} color="#1f7a3a" />
        <p>Sincronizando expediente con Supabase...</p>
      </div>
    </AdminLayout>
  );

  if (errorMsg || !client) return (
    <AdminLayout title="Error de Acceso">
      <div className="error-state">
        <AlertCircle size={48} color="#ef4444" />
        <h2>Expediente no disponible</h2>
        <p className="debug-msg">Detalle: {errorMsg || "ID no encontrado o error de red"}</p>
        <Link href="/admin/users" className="btn-error-back">Volver al listado principal</Link>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title={client.name} subtitle={`Expediente: ${client.tax_id || client.id.slice(0,8)}`}>
      
      <div className="top-bar">
        <Link href="/admin/users" className="btn-back">
          <ArrowLeft size={16} /> Volver a Clientes
        </Link>
        <button className="btn-edit-main" onClick={() => setIsDrawerOpen(true)}>
          <Edit3 size={16}/> Editar Información
        </button>
      </div>

      <div className="dashboard-grid">
        {/* COLUMNA IZQUIERDA: PERFIL */}
        <div className="profile-card">
          <div className="card-section">
            <h3 className="section-h"><Building2 size={18}/> Datos Legales</h3>
            <div className="info-item"><label>Razón Social</label><p>{client.legal_name || 'No registrada'}</p></div>
            <div className="info-item"><label>RUC / TAX ID</label><p><strong>{client.tax_id || 'N/A'}</strong></p></div>
          </div>
          <div className="card-section">
            <h3 className="section-h"><Mail size={18}/> Comunicación</h3>
            <div className="info-item"><label>Email Corporativo</label><p>{client.contact_email}</p></div>
            <div className="info-item"><label>Teléfono</label><p>{client.phone || 'N/A'}</p></div>
          </div>
        </div>

        {/* COLUMNA DERECHA: OPERACIONES */}
        <div className="ops-card">
          <div className="card-section">
            <h3 className="section-h"><MapPin size={18}/> Direcciones de Entrega</h3>
            <div className="shipping-grid">
              {client.shipping_addresses && client.shipping_addresses.length > 0 ? (
                client.shipping_addresses.map((addr: any) => (
                  <div key={addr.id} className="addr-pill">{addr.address}</div>
                ))
              ) : (
                <p className="empty-text">No se han definido puntos de entrega.</p>
              )}
            </div>
          </div>
          <div className="card-section">
            <h3 className="section-h"><Ship size={18}/> Historial de Embarques</h3>
            <div className="table-wrapper">
              <table className="mini-table">
                <thead><tr><th>Código</th><th>Status</th><th>Fecha</th></tr></thead>
                <tbody>
                  {shipments.length > 0 ? shipments.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.code}</strong></td>
                      <td><span className="st-tag">{s.status}</span></td>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="empty-td">Este cliente no posee historial aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* DRAWER DE EDICIÓN */}
      {isDrawerOpen && (
        <>
          <div className="overlay" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer">
            <div className="d-header">
              <h3>Modificar Registro</h3>
              <button className="btn-close" onClick={() => setIsDrawerOpen(false)}><X size={20} /></button>
            </div>
            <form className="d-body" onSubmit={handleSave}>
              <div className="group">
                <label>IDENTIDAD FISCAL</label>
                <input required value={f.name} onChange={e=>setF({...f, name:e.target.value})} placeholder="Nombre Comercial" />
                <input value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} placeholder="Razón Social" />
                <input value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} placeholder="RUC" />
              </div>
              <div className="group">
                <label>CONTACTO</label>
                <input required value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} placeholder="Email Principal" />
                <input value={f.phone_corp} onChange={e=>setF({...f, phone_corp:e.target.value})} placeholder="Teléfono" />
              </div>
              <div className="group">
                <label>LOGÍSTICA (DESTINOS)</label>
                {f.shipping_addresses.map((s: any, i: number) => (
                  <div key={s.id} className="row-input">
                    <input value={s.address} onChange={e => {
                      const ns = [...f.shipping_addresses]; ns[i].address = e.target.value; setF({...f, shipping_addresses: ns});
                    }} placeholder="Dirección completa..." />
                    <button type="button" onClick={() => setF({...f, shipping_addresses: f.shipping_addresses.filter((x:any) => x.id !== s.id)})} className="btnDel"><Trash2 size={14}/></button>
                  </div>
                ))}
                <button type="button" className="btn-add" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir Dirección</button>
              </div>
              <button className="btnSubmit" disabled={isSaving}>{isSaving ? "Guardando cambios..." : "Actualizar Cliente"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .btn-back { display: flex; align-items: center; gap: 8px; color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500; }
        .btn-back:hover { color: #1f7a3a; }
        .dashboard-grid { display: grid; grid-template-columns: 350px 1fr; gap: 20px; }
        
        .profile-card, .ops-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 25px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .section-h { display: flex; align-items: center; gap: 10px; color: #1f7a3a; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 20px; font-weight: 800; letter-spacing: 0.5px; }
        
        .info-item { margin-bottom: 18px; }
        .info-item label { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; }
        .info-item p { font-size: 15px; margin: 4px 0; color: #1e293b; }
        
        .addr-pill { background: #f8fafc; padding: 14px; border-radius: 8px; margin-bottom: 10px; font-size: 13px; border-left: 4px solid #1f7a3a; color: #334155; }
        .btn-edit-main { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; transition: all 0.2s; }
        .btn-edit-main:hover { background: #166534; transform: translateY(-1px); }

        .mini-table { width: 100%; border-collapse: collapse; }
        .mini-table th { text-align: left; padding: 10px; font-size: 11px; color: #94a3b8; border-bottom: 1px solid #f1f5f9; }
        .mini-table td { padding: 12px 10px; font-size: 13px; border-bottom: 1px solid #f8fafc; color: #1e293b; }
        .st-tag { background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; color: #475569; }

        .drawer { position: fixed; right: 0; top: 0; width: 450px; height: 100%; background: white; z-index: 1001; display: flex; flex-direction: column; box-shadow: -10px 0 40px rgba(0,0,0,0.15); }
        .d-header { padding: 25px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .btn-close { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 5px; }
        .d-body { padding: 25px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 1000; backdrop-filter: blur(3px); }
        
        .group { background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 12px; }
        .group label { font-size: 10px; font-weight: 900; color: #1f7a3a; letter-spacing: 0.8px; }
        input { padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
        input:focus { border-color: #1f7a3a; outline: none; box-shadow: 0 0 0 3px rgba(31, 122, 58, 0.1); }
        
        .row-input { display: flex; gap: 8px; }
        .btnDel { background: #fee2e2; color: #ef4444; border: none; padding: 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; }
        .btnDel:hover { background: #fecaca; }
        .btn-add { background: white; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 12px; color: #64748b; font-weight: 700; }
        .btn-add:hover { border-color: #1f7a3a; color: #1f7a3a; }
        .btnSubmit { background: #1f7a3a; color: white; border: none; padding: 16px; border-radius: 10px; cursor: pointer; font-weight: 800; margin-top: 10px; box-shadow: 0 4px 10px rgba(31, 122, 58, 0.2); transition: 0.2s; }
        .btnSubmit:disabled { opacity: 0.5; cursor: not-allowed; }

        .loading-state, .error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; text-align: center; gap: 15px; }
        .debug-msg { color: #94a3b8; font-size: 13px; font-family: monospace; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .btn-error-back { background: #1f7a3a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; margin-top: 15px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .empty-text, .empty-td { color: #94a3b8; font-style: italic; font-size: 13px; text-align: center; padding: 20px 0; }
      `}</style>
    </AdminLayout>
  );
}