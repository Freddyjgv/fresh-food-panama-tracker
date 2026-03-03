import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, Phone, ArrowLeft, 
  Edit3, Loader2, AlertCircle, Plus, FileText, 
  Globe, Package, Clock, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
            <button className="btn-primary"><Plus size={16}/> Nuevo Embarque</button>
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
          {/* COLUMNA INFO CLIENTE */}
          <aside className="info-column">
            <section className="glass-card">
              <div className="card-label">Información de Contacto</div>
              <div className="detail-row"><Mail size={14}/> <span>{client.contact_email}</span></div>
              <div className="detail-row"><Phone size={14}/> <span>{client.phone || 'No asignado'}</span></div>
              <div className="detail-row"><Building2 size={14}/> <span>RUC: {client.tax_id || 'Pendiente'}</span></div>
              <button className="edit-btn-inline"><Edit3 size={14}/> Editar Perfil</button>
            </section>

            <section className="glass-card mt-20">
              <div className="card-label">Puntos de Entrega</div>
              <div className="address-stack">
                {client.shipping_addresses?.map((a:any) => (
                  <div key={a.id} className="addr-item"><MapPin size={12}/> {a.address}</div>
                ))}
              </div>
            </section>
          </aside>

          {/* COLUMNA EMBARQUES */}
          <main className="table-column">
            <div className="table-container">
              <div className="table-header">
                <h3>Historial de Movimientos</h3>
                <div className="table-filters">4 embarques encontrados</div>
              </div>
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Estado</th>
                    <th>Destino</th>
                    <th>Fecha de Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map(s => (
                    <tr key={s.id}>
                      <td><span className="code-badge">{s.code}</span></td>
                      <td><span className={`status-dot ${s.status?.toLowerCase() || 'active'}`}>{s.status || 'Recibido'}</span></td>
                      <td><div className="dest"><Globe size={12}/> {s.destination || 'Panamá (PTY)'}</div></td>
                      <td className="date-col">{new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>

      <style jsx>{`
        .page-wrapper { padding: 20px; max-width: 1300px; margin: 0 auto; color: #1e293b; }
        
        /* Header */
        .ops-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; }
        .back-btn { display: flex; align-items: center; gap: 8px; color: #64748b; text-decoration: none; font-size: 14px; margin-bottom: 10px; font-weight: 500; }
        .ops-header h1 { font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 15px; margin: 0; }
        .id-pill { font-size: 12px; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; color: #94a3b8; font-family: monospace; }
        
        .header-actions { display: flex; gap: 12px; }
        .btn-primary { background: #1f7a3a; color: white; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 4px 12px rgba(31, 122, 58, 0.2); }
        .btn-secondary { background: white; color: #1f7a3a; border: 1px solid #dcfce7; padding: 12px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-primary:hover { transform: translateY(-2px); background: #166534; }

        /* KPIs */
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
        .kpi-card { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; }
        .kpi-icon { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .kpi-icon.blue { background: #eff6ff; color: #3b82f6; }
        .kpi-icon.green { background: #f0fdf4; color: #22c55e; }
        .kpi-icon.orange { background: #fff7ed; color: #f97316; }
        .kpi-data span { font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
        .kpi-data strong { display: block; font-size: 16px; color: #1e293b; }

        /* Layout */
        .main-grid { display: grid; grid-template-columns: 320px 1fr; gap: 25px; }
        .glass-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px; }
        .card-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px; }
        .detail-row { display: flex; align-items: center; gap: 12px; margin-bottom: 15px; font-size: 14px; color: #475569; }
        .edit-btn-inline { width: 100%; margin-top: 10px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        
        .address-stack { display: flex; flex-direction: column; gap: 10px; }
        .addr-item { font-size: 13px; padding: 12px; background: #f8fafc; border-radius: 8px; display: flex; gap: 10px; color: #64748b; border: 1px solid #f1f5f9; }

        /* Table */
        .table-container { background: white; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
        .table-header { padding: 20px 25px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .table-header h3 { font-size: 16px; font-weight: 700; margin: 0; }
        .table-filters { font-size: 12px; color: #94a3b8; font-weight: 600; }
        
        .pro-table { width: 100%; border-collapse: collapse; }
        .pro-table th { background: #f8fafc; padding: 15px 25px; text-align: left; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .pro-table td { padding: 18px 25px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .code-badge { font-weight: 800; color: #1f7a3a; font-family: 'Inter', sans-serif; }
        .status-dot { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; }
        .status-dot::before { content: ""; width: 8px; height: 8px; background: #22c55e; border-radius: 50%; }
        .dest { display: flex; align-items: center; gap: 6px; color: #64748b; }
        .date-col { color: #94a3b8; }

        .mt-20 { margin-top: 20px; }
        .loader-full { height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; color: #64748b; }
        .spin { animation: spin 1s linear infinite; color: #1f7a3a; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}