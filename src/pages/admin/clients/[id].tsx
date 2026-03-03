import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, Phone, ArrowLeft, 
  Edit3, Loader2, AlertCircle, Plus, FileText, 
  Globe, Package, Clock, CheckCircle2, User, Info, FileUp
} from 'lucide-react';
import Link from 'next/link';
import ShipmentDrawer from '../../../components/ShipmentDrawer';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados nuevos para Drawer y Acordeones
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [openAcc, setOpenAcc] = useState<string | null>('entrega');

  const fetchData = useCallback(async (clientId: string) => {
    setLoading(true);
    try {
      const { data: clientData, error: cErr } = await supabase
        .from('clients').select('*').eq('id', clientId).maybeSingle();

      if (cErr) throw cErr;
      if (!clientData) throw new Error("Cliente no encontrado.");

      const [addrsRes, shipsRes] = await Promise.all([
        supabase.from('shipping_addresses').select('*').eq('client_id', clientId),
        supabase.from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
      ]);

      setClient({ ...clientData, shipping_addresses: addrsRes.data || [] });
      setShipments(shipsRes.data || []);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (router.isReady && id) fetchData(id as string);
  }, [id, router.isReady, fetchData]);

  if (loading) return (
    <AdminLayout title="Cargando...">
      <div className="loader-full"><Loader2 className="spin" size={40} /><p>Preparando expediente profesional...</p></div>
    </AdminLayout>
  );

  return (
    <AdminLayout title={client?.name || "Detalle de Cliente"}>
      <div className="page-wrapper">
        
        {/* HEADER OPERATIVO */}
        <header className="ops-header">
          <div className="header-left">
            <Link href="/admin/users" className="back-btn"><ArrowLeft size={18} /> Panel de Clientes</Link>
            <h1>{client.name} <span className="id-pill">ID: {client.id.slice(0,8)}</span></h1>
          </div>
          <div className="header-actions">
            <button className="btn-secondary"><FileText size={16}/> Reporte</button>
            <button className="btn-primary" onClick={() => setIsDrawerOpen(true)}><Plus size={16}/> Nuevo Embarque</button>
          </div>
        </header>

        {/* INDICADORES CLAVE (KPIs) */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon blue"><Package size={20}/></div>
            <div className="kpi-data">
              <span>Total Embarques</span>
              <strong>{shipments.length} Registrados</strong>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon green"><CheckCircle2 size={20}/></div>
            <div className="kpi-data">
              <span>Estado Fiscal</span>
              <strong>Verificado</strong>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon orange"><Clock size={20}/></div>
            <div className="kpi-data">
              <span>Última Actividad</span>
              <strong>{shipments[0] ? new Date(shipments[0].created_at).toLocaleDateString() : 'N/A'}</strong>
            </div>
          </div>
        </div>

        <div className="main-grid">
          {/* COLUMNA IZQUIERDA: INFO Y DOCUMENTOS */}
          <aside className="info-column">
            <section className="glass-card">
              <div className="card-label">Contacto Principal</div>
              <div className="detail-row"><Mail size={14}/> <span>{client.contact_email}</span></div>
              <div className="detail-row"><Phone size={14}/> <span>{client.phone || 'No asignado'}</span></div>
              <div className="detail-row"><Building2 size={14}/> <span>RUC: {client.tax_id || 'Pendiente'}</span></div>
            </section>

            <section className="glass-card mt-20">
              <div className="card-label">Documentos del Cliente</div>
              <div className="doc-list">
                <div className="doc-item"><FileText size={14}/> <span>Aviso de Operación</span></div>
                <div className="doc-item"><FileText size={14}/> <span>Cédula Rep. Legal</span></div>
                <button className="upload-btn"><FileUp size={12}/> Cargar Nuevo</button>
              </div>
            </section>
          </aside>

          {/* COLUMNA CENTRAL: EMBARQUES */}
          <main className="table-column">
            <div className="table-container">
              <div className="table-header">
                <h3>Historial de Movimientos</h3>
                <div className="table-filters">{shipments.length} embarques encontrados</div>
              </div>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Fruta</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map(s => (
                    <tr key={s.id}>
                      <td><span className="code-badge">{s.code}</span></td>
                      <td>{s.product_name} <small>({s.product_variety})</small></td>
                      <td><span className={`status-dot ${s.status?.toLowerCase() || 'active'}`}>{s.status}</span></td>
                      <td className="date-col">{new Date(s.created_at).toLocaleDateString('es-ES')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>

          {/* COLUMNA DERECHA: ACORDEONES */}
          <aside className="info-column">
             <div className="glass-card">
                <div className="card-label">Logística y Direcciones</div>
                
                {/* ACORDEÓN: FACTURACIÓN */}
                <div className={`accordion ${openAcc === 'fact' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc(openAcc === 'fact' ? null : 'fact')}>
                      <Building2 size={14}/> Facturación
                   </button>
                   <div className="acc-body">{client.billing_address || 'Misma que domicilio fiscal.'}</div>
                </div>

                {/* ACORDEÓN: CONSIGNATARIO */}
                <div className={`accordion ${openAcc === 'cons' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc(openAcc === 'cons' ? null : 'cons')}>
                      <User size={14}/> Consignatario
                   </button>
                   <div className="acc-body">{client.name}<br/>Ciudad de Panamá, Panamá.</div>
                </div>

                {/* ACORDEÓN: NOTIFY (FIJO) */}
                <div className={`accordion ${openAcc === 'notify' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc(openAcc === 'notify' ? null : 'notify')}>
                      <Info size={14}/> Notify Party (Fijo)
                   </button>
                   <div className="acc-body notify-box">
                      <strong>Logistics Solutions PTY</strong>
                      <p>Atn: Operaciones</p>
                      <p>Vía España, Torre Delta</p>
                      <p>+507 888-8888</p>
                   </div>
                </div>

                {/* ACORDEÓN: PUNTOS DE ENTREGA */}
                <div className={`accordion ${openAcc === 'entrega' ? 'active' : ''}`}>
                   <button onClick={() => setOpenAcc(openAcc === 'entrega' ? null : 'entrega')}>
                      <MapPin size={14}/> Puntos de Entrega
                   </button>
                   <div className="acc-body">
                      {client.shipping_addresses?.map((a:any) => (
                        <div key={a.id} className="mini-addr">{a.address}</div>
                      ))}
                   </div>
                </div>
             </div>
          </aside>
        </div>
      </div>

      <ShipmentDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)}
        clientId={id as string}
        clientName={client.name}
        onSuccess={() => fetchData(id as string)}
        shippingAddresses={client.shipping_addresses}
      />

      <style jsx>{`
        .page-wrapper { padding: 20px; max-width: 1400px; margin: 0 auto; color: #1e293b; }
        .ops-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; }
        .back-btn { display: flex; align-items: center; gap: 8px; color: #64748b; text-decoration: none; font-size: 14px; margin-bottom: 10px; font-weight: 500; }
        .ops-header h1 { font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 15px; margin: 0; }
        .id-pill { font-size: 12px; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; color: #94a3b8; font-family: monospace; }
        .header-actions { display: flex; gap: 12px; }
        .btn-primary { background: #1f7a3a; color: white; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-secondary { background: white; color: #1f7a3a; border: 1px solid #dcfce7; padding: 12px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; }

        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .kpi-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; }
        .kpi-icon { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .kpi-icon.blue { background: #eff6ff; color: #3b82f6; }
        .kpi-icon.green { background: #f0fdf4; color: #22c55e; }
        .kpi-icon.orange { background: #fff7ed; color: #f97316; }
        .kpi-data span { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
        .kpi-data strong { display: block; font-size: 16px; color: #1e293b; }

        .main-grid { display: grid; grid-template-columns: 280px 1fr 280px; gap: 20px; }
        .glass-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
        .card-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 0.05em; }
        .detail-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 13px; color: #475569; }
        
        /* Acordeón */
        .accordion { border-bottom: 1px solid #f1f5f9; }
        .accordion button { width: 100%; padding: 12px 0; border: none; background: none; display: flex; align-items: center; gap: 8px; font-weight: 700; color: #475569; cursor: pointer; font-size: 13px; text-align: left; }
        .acc-body { max-height: 0; overflow: hidden; transition: 0.3s; font-size: 12px; color: #64748b; }
        .accordion.active .acc-body { max-height: 150px; padding-bottom: 12px; }
        .notify-box strong { color: #1f7a3a; display: block; margin-bottom: 4px; }
        .mini-addr { padding: 6px; background: #f8fafc; border-radius: 4px; margin-bottom: 4px; border: 1px solid #f1f5f9; }

        .doc-list { display: flex; flex-direction: column; gap: 8px; }
        .doc-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; padding: 8px; background: #f8fafc; border-radius: 6px; }
        .upload-btn { margin-top: 10px; width: 100%; padding: 8px; background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }

        .table-container { background: white; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
        .table-header { padding: 15px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { background: #f8fafc; padding: 12px 20px; text-align: left; font-size: 11px; color: #94a3b8; text-transform: uppercase; }
        .pro-table td { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .code-badge { font-weight: 800; color: #1f7a3a; }
        .status-dot { display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .status-dot::before { content: ""; width: 7px; height: 7px; background: #22c55e; border-radius: 50%; }

        .loader-full { height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}