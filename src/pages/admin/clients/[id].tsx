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

  useEffect(() => {
    if (!id) return;
    fetchFullClientData();
  }, [id]);

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
      const { data: clientData, error: cErr } = await supabase.from('clients').select('*').eq('id', id).single();
      if (cErr) throw cErr;

      const { data: addrData } = await supabase.from('shipping_addresses').select('*').eq('client_id', id);
      const { data: shipData } = await supabase.from('shipments').select('*').eq('client_id', id).order('created_at', { ascending: false });

      const fullClient = { ...clientData, shipping_addresses: addrData || [] };
      setClient(fullClient);
      setShipments(shipData || []);
      
      // Preparar el formulario con los datos actuales
      setF({
        ...fullClient,
        email_corp: fullClient.contact_email,
        phone_corp: fullClient.phone,
        country_origin: fullClient.country || "Panamá",
        shipping_addresses: fullClient.shipping_addresses.length > 0 
          ? fullClient.shipping_addresses 
          : [{ id: Date.now(), address: "" }]
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
      const res = await fetch("/.netlify/functions/manageClient", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(f)
      });

      if (res.ok) {
        setIsDrawerOpen(false);
        await fetchFullClientData(); // Recargar datos frescos
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

  if (loading) return <AdminLayout title="Cargando..."> <div className="loading-state"><Loader2 className="animate-spin" size={32} /><p>Cargando expediente...</p></div> </AdminLayout>;
  if (errorMsg || !client) return <AdminLayout title="Error"> <div className="error-state"><AlertCircle size={48} color="#ef4444" /><h2>Cliente no encontrado</h2><Link href="/admin/users" className="btn-error-back">Volver</Link></div> </AdminLayout>;

  return (
    <AdminLayout title={client.name} subtitle={`Expediente: ${client.tax_id || client.id.substring(0,8)}`}>
      
      <div className="top-bar">
        <Link href="/admin/users" className="btn-back"><ArrowLeft size={16} /> Volver</Link>
        <button className="btn-edit-main" onClick={() => setIsDrawerOpen(true)}><Edit3 size={16}/> Editar Ficha</button>
      </div>

      <div className="dashboard-grid">
        {/* VISTA DE DATOS (Igual a la anterior pero con estilos pulidos) */}
        <div className="profile-card">
          <div className="card-section">
            <h3 className="section-h"><Building2 size={18}/> Información Fiscal</h3>
            <div className="info-item"><label>Razón Social</label><p>{client.legal_name || 'N/A'}</p></div>
            <div className="info-item"><label>Tax ID / RUC</label><p><strong>{client.tax_id || 'N/A'}</strong></p></div>
          </div>
          <div className="card-section">
            <h3 className="section-h"><Mail size={18}/> Contacto</h3>
            <div className="info-item"><label>Email</label><p>{client.contact_email}</p></div>
            <div className="info-item"><label>Teléfono</label><p>{client.phone || 'N/A'}</p></div>
          </div>
        </div>

        <div className="ops-card">
          <div className="card-section">
            <h3 className="section-h"><MapPin size={18}/> Direcciones de Entrega</h3>
            <div className="shipping-grid">
              {client.shipping_addresses?.map((addr: any) => (
                <div key={addr.id} className="addr-pill">{addr.address}</div>
              ))}
            </div>
          </div>
          <div className="card-section">
            <h3 className="section-h"><Ship size={18}/> Historial</h3>
            <div className="table-wrapper">
              <table className="mini-table">
                <thead><tr><th>Código</th><th>Estado</th><th>Fecha</th></tr></thead>
                <tbody>
                  {shipments.map(s => (
                    <tr key={s.id}><td><strong>{s.code}</strong></td><td>{s.status}</td><td>{new Date(s.created_at).toLocaleDateString()}</td></tr>
                  ))}
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
              <h3>Editar Información de Cliente</h3>
              <button className="btn-close" onClick={() => setIsDrawerOpen(false)}><X size={20} /></button>
            </div>
            <form className="d-body" onSubmit={handleSave}>
              <div className="group">
                <label>IDENTIDAD COMERCIAL</label>
                <input required value={f.name} onChange={e=>setF({...f, name:e.target.value})} placeholder="Nombre" />
                <input value={f.legal_name} onChange={e=>setF({...f, legal_name:e.target.value})} placeholder="Razón Social" />
                <input value={f.tax_id} onChange={e=>setF({...f, tax_id:e.target.value})} placeholder="Tax ID" />
              </div>
              <div className="group">
                <label>CONTACTO</label>
                <input required value={f.email_corp} onChange={e=>setF({...f, email_corp:e.target.value})} placeholder="Email" />
                <input value={f.phone_corp} onChange={e=>setF({...f, phone_corp:e.target.value})} placeholder="Teléfono" />
              </div>
              <div className="group">
                <label>PUNTOS DE ENTREGA</label>
                {f.shipping_addresses.map((s: any, i: number) => (
                  <div key={s.id} className="row-input">
                    <input value={s.address} onChange={e => {
                      const ns = [...f.shipping_addresses]; ns[i].address = e.target.value; setF({...f, shipping_addresses: ns});
                    }} />
                    <button type="button" onClick={() => setF({...f, shipping_addresses: f.shipping_addresses.filter((x:any) => x.id !== s.id)})} className="btnDel"><Trash2 size={14}/></button>
                  </div>
                ))}
                <button type="button" className="btn-add" onClick={() => setF({...f, shipping_addresses: [...f.shipping_addresses, {id:Date.now(), address:""}]})}>+ Añadir</button>
              </div>
              <button className="btnSubmit" disabled={isSaving}>{isSaving ? "Guardando..." : "Actualizar Expediente"}</button>
            </form>
          </div>
        </>
      )}

      <style jsx>{`
        /* Estilos de la ficha igual que antes */
        .top-bar { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .dashboard-grid { display: grid; grid-template-columns: 350px 1fr; gap: 20px; }
        .profile-card, .ops-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; }
        .section-h { display: flex; align-items: center; gap: 10px; color: #1f7a3a; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }
        .info-item label { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; }
        .info-item p { font-size: 14px; margin: 4px 0 15px; }
        .addr-pill { background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 13px; border-left: 4px solid #1f7a3a; }
        .btn-edit-main { background: #1f7a3a; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; }

        /* Estilos del Drawer */
        .drawer { position: fixed; right: 0; top: 0; width: 450px; height: 100%; background: white; z-index: 1001; display: flex; flex-direction: column; box-shadow: -5px 0 20px rgba(0,0,0,0.1); }
        .d-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .d-body { padding: 20px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; backdrop-filter: blur(2px); }
        .group { background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 10px; }
        .group label { font-size: 10px; font-weight: 800; color: #1f7a3a; }
        input { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
        .row-input { display: flex; gap: 5px; }
        .btnDel { background: #fee2e2; color: #ef4444; border: none; padding: 8px; border-radius: 8px; cursor: pointer; }
        .btn-add { background: none; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 12px; }
        .btnSubmit { background: #1f7a3a; color: white; border: none; padding: 15px; border-radius: 10px; cursor: pointer; font-weight: 800; margin-top: 10px; }
        .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}