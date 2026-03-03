import { useState } from 'react';
import { X, Plane, Ship, Package, Info, Calendar, FileText, Hash } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  shippingAddresses: any[];
}

export default function ShipmentDrawer({ isOpen, onClose, clientId, clientName, onSuccess, shippingAddresses }: Props) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'Aéreo' | 'Marítimo'>('Aéreo');

  const [f, setF] = useState({
    code: '',
    destination: '',
    product_name: 'Piña',
    product_variety: 'MD2',
    product_mode: 'Aéreo',
    boxes: '',
    pallets: '',
    weight_kg: '',
    flight_number: '',
    awb: '',
    caliber: '',
    color: '',
    status: 'Registrado'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('shipments').insert([{
        ...f,
        client_id: clientId,
        product_mode: mode,
        boxes: f.boxes ? parseInt(f.boxes) : null,
        pallets: f.pallets ? parseInt(f.pallets) : null,
        weight_kg: f.weight_kg ? parseFloat(f.weight_kg) : null,
      }]);

      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <h3>Nuevo Embarque</h3>
            <p>Cliente: <strong>{clientName}</strong></p>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="drawer-content">
          {/* MODO DE TRANSPORTE */}
          <div className="mode-tabs">
            <button type="button" className={mode === 'Aéreo' ? 'active' : ''} onClick={() => setMode('Aéreo')}>
              <Plane size={16}/> Aéreo
            </button>
            <button type="button" className={mode === 'Marítimo' ? 'active' : ''} onClick={() => setMode('Marítimo')}>
              <Ship size={16}/> Marítimo
            </button>
          </div>

          {/* DATOS BÁSICOS */}
          <section className="form-section">
            <label><Hash size={14}/> Identificación</label>
            <div className="grid-2">
              <input required placeholder="Código (FFP-XXXX)" value={f.code} onChange={e=>setF({...f, code: e.target.value})} />
              <select required value={f.destination} onChange={e=>setF({...f, destination: e.target.value})}>
                <option value="">Destino Final...</option>
                {shippingAddresses.map(a => <option key={a.id} value={a.address}>{a.address}</option>)}
              </select>
            </div>
          </section>

          {/* ATRIBUTOS DE FRUTA */}
          <section className="form-section">
            <label><Package size={14}/> Detalles del Producto</label>
            <div className="grid-2">
              <select value={f.product_name} onChange={e=>setF({...f, product_name: e.target.value})}>
                <option value="Piña">Piña</option>
                <option value="Pitahaya">Pitahaya</option>
                <option value="Guayaba">Guayaba</option>
              </select>
              <input placeholder="Variedad (Ej: MD2, Amarilla)" value={f.product_variety} onChange={e=>setF({...f, product_variety: e.target.value})} />
            </div>
            <div className="grid-2 mt-10">
              <input placeholder="Calibre (Ej: 6, 7, 8)" value={f.caliber} onChange={e=>setF({...f, caliber: e.target.value})} />
              <input placeholder="Color / Grado" value={f.color} onChange={e=>setF({...f, color: e.target.value})} />
            </div>
          </section>

          {/* CARGA FISICA */}
          <section className="form-section">
            <label><Info size={14}/> Pesos y Medidas</label>
            <div className="grid-3">
              <input type="number" placeholder="Cajas" value={f.boxes} onChange={e=>setF({...f, boxes: e.target.value})} />
              <input type="number" placeholder="Pallets" value={f.pallets} onChange={e=>setF({...f, pallets: e.target.value})} />
              <input type="number" step="0.01" placeholder="Peso Kg" value={f.weight_kg} onChange={e=>setF({...f, weight_kg: e.target.value})} />
            </div>
          </section>

          {/* LOGISTICA ESPECIFICA */}
          {mode === 'Aéreo' && (
            <section className="form-section">
              <label><Plane size={14}/> Datos de Vuelo</label>
              <div className="grid-2">
                <input placeholder="No. Vuelo" value={f.flight_number} onChange={e=>setF({...f, flight_number: e.target.value})} />
                <input placeholder="AWB (Guía)" value={f.awb} onChange={e=>setF({...f, awb: e.target.value})} />
              </div>
            </section>
          )}

          <button className="submit-btn" disabled={loading}>
            {loading ? "Registrando..." : "Crear Embarque"}
          </button>
        </form>
      </div>

      <style jsx>{`
        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); z-index: 1000; }
        .drawer { position: fixed; right: 0; top: 0; height: 100%; width: 420px; background: white; z-index: 1001; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.1); }
        .drawer-header { padding: 25px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .drawer-header h3 { margin: 0; font-size: 18px; color: #1e293b; }
        .drawer-header p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
        .drawer-content { padding: 25px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; }
        
        .mode-tabs { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .mode-tabs button { flex: 1; padding: 10px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748b; background: transparent; transition: 0.2s; }
        .mode-tabs button.active { background: white; color: #1f7a3a; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

        .form-section label { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; color: #1f7a3a; text-transform: uppercase; margin-bottom: 10px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .mt-10 { margin-top: 10px; }
        
        input, select { padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; width: 100%; }
        input:focus { border-color: #1f7a3a; outline: none; box-shadow: 0 0 0 2px rgba(31, 122, 58, 0.1); }

        .submit-btn { background: #1f7a3a; color: white; border: none; padding: 16px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; margin-top: 10px; }
        .submit-btn:hover { background: #166534; transform: translateY(-2px); }
        .close-btn { background: #f8fafc; border: none; padding: 8px; border-radius: 50%; cursor: pointer; color: #64748b; }
      `}</style>
    </>
  );
}