import React, { useState, useEffect } from 'react';
import { X, Save, Ship, MapPin, Package, Anchor, Plane } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface ShipmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  defaultIncoterm?: string; // Recibe el incoterm del cliente
}

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

export default function ShipmentDrawer({ 
  isOpen, onClose, clientId, clientName, onSuccess, defaultIncoterm 
}: ShipmentDrawerProps) {
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    product_variety: '',
    incoterm: 'FOB',
    destination_point: '', // Ahora es un campo de texto libre para Puerto/Aeropuerto
    status: 'Booking Pending'
  });

  // Sincronizar el Incoterm por defecto cuando abre el drawer
  useEffect(() => {
    if (isOpen && defaultIncoterm) {
      setFormData(prev => ({ ...prev, incoterm: defaultIncoterm }));
    }
  }, [isOpen, defaultIncoterm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const shipmentCode = `SHP-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error } = await supabase.from('shipments').insert([{
        client_id: clientId,
        code: shipmentCode,
        product_name: formData.product_name,
        product_variety: formData.product_variety,
        incoterm: formData.incoterm,
        destination_port: formData.destination_point, // Guardamos el punto de destino
        status: formData.status
      }]);

      if (error) throw error;
      
      onSuccess();
      onClose();
      setFormData({ product_name: '', product_variety: '', incoterm: defaultIncoterm || 'FOB', destination_point: '', status: 'Booking Pending' });
    } catch (err: any) {
      alert('Error creando embarque: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay">
      <div className="drawer-content">
        <header className="drawer-header">
          <div>
            <h2>Nuevo Embarque</h2>
            <p>Cliente: <strong>{clientName}</strong></p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={24} /></button>
        </header>

        <form onSubmit={handleSubmit} className="drawer-form">
          <section className="form-section">
            <h3><Package size={18} /> Detalles del Producto</h3>
            <div className="input-group">
              <label>Producto</label>
              <input 
                required 
                placeholder="Ej: Piña MD2" 
                value={formData.product_name}
                onChange={e => setFormData({...formData, product_name: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>Variedad / Calibre</label>
              <input 
                placeholder="Ej: Calibre 7, Premium" 
                value={formData.product_variety}
                onChange={e => setFormData({...formData, product_variety: e.target.value})}
              />
            </div>
          </section>

          <section className="form-section">
            <h3><Anchor size={18} /> Logística de Destino</h3>
            <div className="grid-2">
              <div className="input-group">
                <label>Incoterm</label>
                <select 
                  value={formData.incoterm}
                  onChange={e => setFormData({...formData, incoterm: e.target.value})}
                >
                  {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Puerto / Aeropuerto Destino</label>
                <div className="input-with-icon">
                  <MapPin size={14} className="inner-icon" />
                  <input 
                    required
                    placeholder="Ej: Puerto de Rotterdam, NL" 
                    value={formData.destination_point}
                    onChange={e => setFormData({...formData, destination_point: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </section>

          <footer className="drawer-footer">
            <button type="button" onClick={onClose} className="btn-abort">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Creando...' : <><Save size={18} /> Crear Embarque</>}
            </button>
          </footer>
        </form>
      </div>

      <style jsx>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 1000; display: flex; justify-content: flex-end; }
        .drawer-content { width: 450px; background: white; height: 100%; box-shadow: -10px 0 30px rgba(0,0,0,0.1); display: flex; flex-direction: column; animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        
        .drawer-header { padding: 30px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .drawer-header h2 { margin: 0; font-size: 20px; color: #0f172a; }
        .drawer-header p { margin: 5px 0 0; font-size: 14px; color: #64748b; }
        
        .drawer-form { padding: 30px; flex: 1; overflow-y: auto; }
        .form-section { margin-bottom: 35px; }
        .form-section h3 { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #1f7a3a; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
        
        .input-group { margin-bottom: 20px; }
        .input-group label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; }
        input, select { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .input-with-icon { position: relative; }
        .inner-icon { position: absolute; left: 12px; top: 15px; color: #94a3b8; }
        .input-with-icon input { padding-left: 35px; }

        .drawer-footer { margin-top: 20px; display: flex; gap: 12px; }
        .btn-submit { flex: 2; background: #1f7a3a; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-abort { flex: 1; background: #f1f5f9; color: #475569; border: none; padding: 14px; border-radius: 12px; font-weight: 600; cursor: pointer; }
      `}</style>
    </div>
  );
}