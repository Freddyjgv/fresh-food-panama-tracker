import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, CreditCard, Ship, Mail, 
  Phone, Globe, ArrowLeft, Edit3, UserCheck 
} from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchFullClientData();
  }, [id]);

  const fetchFullClientData = async () => {
    setLoading(true);
    try {
      // 1. Datos del cliente + sus direcciones de shipping
      const { data: clientData, error: cErr } = await supabase
        .from('clients')
        .select('*, shipping_addresses(*)')
        .eq('id', id)
        .single();

      if (cErr) throw cErr;

      // 2. Historial de embarques
      const { data: shipData } = await supabase
        .from('shipments')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      setClient(clientData);
      setShipments(shipData || []);
    } catch (e) {
      console.error("Error cargando cliente:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AdminLayout title="Cargando..."><div>Cargando expediente...</div></AdminLayout>;
  if (!client) return <AdminLayout title="Error"><div>Cliente no encontrado.</div></AdminLayout>;

  return (
    <AdminLayout title={client.name} subtitle={`Expediente ID: ${client.id.split('-')[0]}...`}>
      
      <div className="top-bar">
        <Link href="/admin/users" className="btn-back">
          <ArrowLeft size={16} /> Volver al listado
        </Link>
        <div className="actions">
          <button className="btn-secondary"><Edit3 size={16}/> Editar Ficha</button>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* COLUMNA IZQUIERDA: PERFIL */}
        <div className="profile-card">
          <div className="card-section">
            <h3 className="section-h"><Building2 size={18}/> Información Fiscal</h3>
            <div className="info-item">
              <label>Razón Social</label>
              <p>{client.legal_name || 'No definida'}</p>
            </div>
            <div className="info-item">
              <label>Tax ID / RUC</label>
              <p>{client.tax_id || 'N/A'}</p>
            </div>
            <div className="info-item">
              <label>Website</label>
              <p>{client.website ? <a href={client.website} target="_blank">{client.website}</a> : 'N/A'}</p>
            </div>
          </div>

          <div className="card-section">
            <h3 className="section-h"><Mail size={18}/> Contacto Logístico</h3>
            <div className="info-item">
              <label>Email Corporativo</label>
              <p>{client.contact_email}</p>
            </div>
            <div className="info-item">
              <label>Teléfono</label>
              <p>{client.phone || 'No registrado'}</p>
            </div>
            <div className="info-item">
              <label>País de Origen</label>
              <p>{client.country}</p>
            </div>
          </div>

          <div className="card-section">
            <h3 className="section-h"><CreditCard size={18}/> Facturación</h3>
            <div className="info-item">
              <label>Condición de Pago</label>
              <span className="pago-tag">{client.payment_condition}</span>
            </div>
            <div className="info-item">
              <label>Dirección de Billing</label>
              <p className="addr-text">{client.billing_address || 'No definida'}</p>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: OPERACIONES */}
        <div className="ops-card">
          <div className="card-section">
            <h3 className="section-h"><MapPin size={18}/> Puntos de Entrega (Shipping Addresses)</h3>
            <div className="shipping-grid">
              {client.shipping_addresses?.length > 0 ? (
                client.shipping_addresses.map((addr: any) => (
                  <div key={addr.id} className="addr-pill">{addr.address}</div>
                ))
              ) : (
                <p className="empty">No hay direcciones de entrega registradas.</p>
              )}
            </div>
          </div>

          <div className="card-section">
            <h3 className="section-h"><Ship size={18}/> Historial de Embarques</h3>
            <div className="table-container">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Destino</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.code}</strong></td>
                      <td>{s.destination}</td>
                      <td><span className={`st-tag ${s.status.toLowerCase()}`}>{s.status}</span></td>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {shipments.length === 0 && <tr><td colSpan={4} className="empty-td">Sin embarques previos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .btn-back { display: flex; align-items: center; gap: 8px; color: #64748b; text-decoration: none; font-size: 14px; }
        .dashboard-grid { display: grid; grid-template-columns: 350px 1fr; gap: 20px; align-items: start; }
        
        .profile-card, .ops-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; }
        .card-section { margin-bottom: 30px; }
        .section-h { display: flex; align-items: center; gap: 10px; color: #1f7a3a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 15px; }
        
        .info-item { margin-bottom: 15px; }
        .info-item label { display: block; font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: bold; }
        .info-item p { font-size: 14px; color: #1e293b; margin: 4px 0; }
        
        .pago-tag { background: #f0fdf4; color: #166534; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; border: 1px solid #bbf7d0; }
        .addr-text { font-size: 13px !important; line-height: 1.4; color: #475569 !important; }
        
        .shipping-grid { display: flex; flex-direction: column; gap: 8px; }
        .addr-pill { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; font-size: 13px; color: #475569; border-left: 4px solid #1f7a3a; }
        
        .mini-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .mini-table th { text-align: left; padding: 10px; color: #64748b; border-bottom: 2px solid #f1f5f9; }
        .mini-table td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; }
        
        .st-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
        .st-tag.created { background: #fef3c7; color: #92400e; }
        .empty { color: #94a3b8; font-style: italic; font-size: 13px; }
        
        .btn-secondary { background: white; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .btn-secondary:hover { background: #f8fafc; }
      `}</style>
    </AdminLayout>
  );
}