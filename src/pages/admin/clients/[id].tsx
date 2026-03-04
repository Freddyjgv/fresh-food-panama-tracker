import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AdminLayout, notify } from '../../../components/AdminLayout';
import { 
  Building2, MapPin, Ship, Mail, Phone, Edit3, Loader2, Plus, 
  FileText, ExternalLink, Hash, User, FileUp, Save, Bell
} from 'lucide-react';
import Link from 'next/link';

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [client, setClient] = useState<any>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  // LÓGICA DE EXTRACCIÓN DE PAÍS DESDE EL PUERTO (Ej: "Rotterdam, NL")
  const getFlagCode = (portString: string) => {
    if (!portString) return null;
    const parts = portString.split(',');
    if (parts.length < 2) return null;
    const code = parts[parts.length - 1].trim().toLowerCase();
    return code.length === 2 ? code : null;
  };

  const fetchData = useCallback(async (clientId: string) => {
    try {
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
      const { data: shipsRes } = await supabase.from('shipments').select('*').eq('client_id', clientId).order('created_at', { ascending: false });

      const fullClient = { 
        ...clientData, 
        consignee_info: clientData?.consignee_info || { name: '', address: '' },
        notify_party: clientData?.notify_party || { name: '', address: '' }
      };

      setClient(fullClient);
      setEditData(fullClient);
      setShipments(shipsRes || []);
    } catch (e) {
      notify("Error de conexión", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (router.isReady && id) fetchData(id as string);
  }, [id, router.isReady, fetchData]);

  // SOLUCIÓN CARGA DE LOGO (Verificar bucket 'client-logos')
  const handleLogoUpload = async (e: any) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      if (!file) return;
      
      const fileName = `${id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('client-logos').upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('client-logos').getPublicUrl(fileName);
      await supabase.from('clients').update({ logo_url: publicUrl }).eq('id', id);
      
      setClient({ ...client, logo_url: publicUrl });
      notify("Logo actualizado", "success");
    } catch (err) {
      notify("Error subiendo logo. Verifica el bucket 'client-logos'", "error");
    } finally {
      setUploading(false);
    }
  };

  // SOLUCIÓN CARGA KYC (Verificar bucket 'kyc-documents')
  const handleKYCUpload = async (e: any) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      const fileName = `${id}/${file.name}`;
      const { error } = await supabase.storage.from('kyc-documents').upload(fileName, file);
      if (error) throw error;
      notify("Documento guardado", "success");
    } catch (err) {
      notify("Error en KYC. Verifica el bucket 'kyc-documents'", "error");
    }
  };

  if (loading) return <div className="loader-full"><Loader2 className="animate-spin text-green-700" size={40}/></div>;

  return (
    <AdminLayout title={client?.name}>
      <div className="view-container">
        
        {/* HEADER CON SEPARADORES GRISES Y CENTRADO */}
        <header className="header-refined">
          <div className="h-left">
            <div className="avatar-wrapper">
              {client.logo_url ? <img src={client.logo_url} alt="Logo" /> : <Building2 size={24} className="opacity-20"/>}
              <label className="edit-overlay">
                <FileUp size={14} />
                <input type="file" hidden onChange={handleLogoUpload} />
              </label>
            </div>
            <div className="client-titles">
              <div className="top-row">
                <h1>{client.name}</h1>
                <span className="pill-active">Cliente Activo</span>
              </div>
              <div className="bot-row">
                <span>Tax ID: <strong>{client.tax_id}</strong></span>
                <span className="geo"><MapPin size={12}/> {client.country}</span>
              </div>
            </div>
          </div>

          <div className="h-center">
            <div className="stat-box">
              <label>Embarques</label>
              <strong>{shipments.length}</strong>
            </div>
            <div className="v-divider"></div>
            <div className="stat-box">
              <label>Incoterm</label>
              <strong>{client.default_incoterm || 'CIP'}</strong>
            </div>
            <div className="v-divider"></div>
            <div className="stat-box">
              <label>Último Despacho</label>
              <strong>{shipments[0] ? new Date(shipments[0].created_at).toLocaleDateString() : '--'}</strong>
            </div>
          </div>

          <div className="h-right">
            <button className="btn-edit" onClick={() => setIsEditing(true)}><Edit3 size={14}/> Editar Perfil</button>
            <button className="btn-new"><Plus size={14}/> Nuevo Embarque</button>
          </div>
        </header>

        <div className="main-layout">
          {/* COLUMNA IZQUIERDA: CONTACTO Y KYC */}
          <aside className="col-side">
            <div className="card-glass">
              <h4 className="card-t">Contacto</h4>
              <div className="card-body">
                <div className="info-item">
                  <Mail size={14}/>
                  <div><label>Email</label><span>{client.contact_email}</span></div>
                </div>
                <div className="info-item">
                  <Phone size={14}/>
                  <div><label>Teléfono</label><span>{client.phone || 'N/A'}</span></div>
                </div>
              </div>
            </div>

            <div className="card-glass mt-4">
              <h4 className="card-t">Documentación KYC</h4>
              <div className="card-body">
                <div className="doc-row"><FileText size={14}/> Registro Fiscal.pdf</div>
                <div className="doc-row"><FileText size={14}/> Pacto Social.pdf</div>
                <label className="btn-upload-doc">
                  <Plus size={12}/> Adjuntar
                  <input type="file" hidden onChange={handleKYCUpload} />
                </label>
              </div>
            </div>
          </aside>

          {/* CENTRO: TABLA ALINEADA Y BANDERAS DINÁMICAS */}
          <main className="col-main">
            <div className="card-glass">
              <div className="card-h-row">
                <h3>Actividad Reciente</h3>
                <span className="link-ext">Ver todo <ExternalLink size={12}/></span>
              </div>
              <table className="table-centered">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Producto</th>
                    <th>Destino</th>
                    <th>Cajas / Peso</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map(s => {
                    const flag = getFlagCode(s.destination_port);
                    return (
                      <tr key={s.id}>
                        <td className="txt-center"><span className="id-tag">{s.code}</span></td>
                        <td>
                          <div className="cell-flex-center">
                            <strong>{s.product_name}</strong>
                            <small>{s.product_variety}</small>
                          </div>
                        </td>
                        <td>
                          <div className="cell-flex-center">
                             {flag && <img src={`https://flagcdn.com/w20/${flag}.png`} className="mini-flag" />}
                             <span>{s.destination_port}</span>
                          </div>
                        </td>
                        <td className="txt-center">
                          <div className="cell-flex-center">
                            <strong>{s.boxes} CX</strong>
                            <small className="text-muted">{s.weight} KG</small>
                          </div>
                        </td>
                        <td className="txt-center">
                          <span className={`pill-status ${s.status?.toLowerCase()}`}>{s.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </main>

          {/* COLUMNA DERECHA: LOGÍSTICA COMPLETA */}
          <aside className="col-side">
            <div className="card-glass">
              <h4 className="card-t">Logística</h4>
              <div className="card-body">
                <div className="log-block">
                  <div className="log-h"><FileText size={12}/> Facturación</div>
                  <p>{client.billing_address || 'Sin dirección registrada'}</p>
                </div>
                <div className="log-block">
                  <div className="log-h"><User size={12}/> Consignatario</div>
                  <p>{client.consignee_info?.name || 'Mismo que cliente'}</p>
                </div>
                <div className="log-block">
                  <div className="log-h"><Bell size={12}/> Notificar a (Notify Party)</div>
                  <p>{client.notify_party?.name || 'No especificado'}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .view-container { padding: 25px 40px; background: #f8fafc; min-height: 100vh; font-family: 'Inter', sans-serif; }
        
        /* HEADER REFINADO */
        .header-refined { 
          background: white; border-radius: 16px; padding: 20px 30px; 
          display: flex; justify-content: space-between; align-items: center;
          border: 1px solid #e2e8f0; margin-bottom: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        }
        .h-left { display: flex; align-items: center; gap: 20px; flex: 1; }
        .avatar-wrapper { 
          width: 65px; height: 65px; background: #f1f5f9; border: 1px dashed #cbd5e1; 
          border-radius: 12px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;
        }
        .avatar-wrapper img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
        .edit-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); color: white; display: flex; align-items: center; justify-content: center; opacity: 0; cursor: pointer; transition: 0.2s; }
        .avatar-wrapper:hover .edit-overlay { opacity: 1; }

        .client-titles h1 { font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; }
        .bot-row { display: flex; gap: 12px; font-size: 12px; color: #64748b; margin-top: 4px; }
        .pill-active { background: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }

        /* SEPARADORES Y CENTRADO */
        .h-center { display: flex; align-items: center; gap: 30px; flex: 1; justify-content: center; }
        .stat-box { display: flex; flex-direction: column; align-items: center; }
        .stat-box label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px; }
        .stat-box strong { font-size: 16px; color: #1e293b; }
        .v-divider { width: 1px; height: 35px; background: #e2e8f0; }

        .h-right { display: flex; gap: 10px; flex: 1; justify-content: flex-end; }
        .btn-edit { background: white; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .btn-new { background: #1f7a3a; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }

        /* LAYOUT */
        .main-layout { display: grid; grid-template-columns: 280px 1fr 280px; gap: 20px; }
        .card-glass { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        .card-t { padding: 15px 20px 0; font-size: 11px; font-weight: 800; color: #1f7a3a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
        .card-body { padding: 0 20px 20px; }

        /* TABLA CENTRADA */
        .table-centered { width: 100%; border-collapse: collapse; }
        .table-centered th { background: #f8fafc; padding: 12px; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
        .table-centered td { padding: 15px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
        .txt-center { text-align: center; }
        .cell-flex-center { display: flex; flex-direction: column; align-items: center; gap: 1px; line-height: 1.2; }
        .cell-flex-center strong { color: #1e293b; }
        .cell-flex-center small { color: #94a3b8; font-size: 11px; }
        .mini-flag { width: 18px; border-radius: 2px; margin-bottom: 4px; }

        .pill-status { font-size: 9px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
        .pill-status.packed { background: #f0fdf4; color: #166534; }
        .pill-status.at_destination { background: #eff6ff; color: #1e40af; }
        
        /* LOGISTICA */
        .log-block { margin-bottom: 15px; }
        .log-h { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
        .log-block p { font-size: 12px; color: #334155; margin: 0; line-height: 1.4; }

        .mt-4 { margin-top: 20px; }
        .loader-full { height: 100vh; display: flex; align-items: center; justify-content: center; }
      `}</style>
    </AdminLayout>
  );
}