import { useState, useEffect } from 'react';
import { X, Plane, Ship, Loader2, Globe, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  shippingAddresses: any[];
  defaultIncoterm?: string; // Prop nueva
}

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

export default function ShipmentDrawer({ isOpen, onClose, clientId, onSuccess, shippingAddresses, defaultIncoterm }: Props) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'Aérea' | 'Marítima'>('Aérea');

  const [f, setF] = useState({
    destination: '',
    incoterm: defaultIncoterm || 'FOB',
    product_name: 'Piña',
    product_variety: 'MD2 Golden',
    boxes: '',
    pallets: '',
    weight_kg: '',
    shipping_address: '',
    flight_number: '',
    awb: ''
  });

  // Resetear el incoterm si cambia el default en el cliente
  useEffect(() => {
    if (defaultIncoterm) setF(prev => ({ ...prev, incoterm: defaultIncoterm }));
  }, [defaultIncoterm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        clientId: clientId,
        destination: f.destination,
        incoterm: f.incoterm,
        boxes: f.boxes ? parseInt(f.boxes) : null,
        pallets: f.pallets ? parseInt(f.pallets) : null,
        weight_kg: f.weight_kg ? parseFloat(f.weight_kg) : null,
        product_name: f.product_name,
        product_variety: f.product_variety,
        product_mode: mode,
        shipping_address: f.shipping_address,
      };

      // LLAMADA A TU FUNCIÓN DE NETLIFY
      const response = await fetch('/.netlify/functions/create-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error en el servidor");
      }

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
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-container">
        <div className="drawer-header">
          <div>
            <h3>Crear Embarque Operativo</h3>
            <span className="auto-badge">Correlativo Automático FFP-{new Date().getFullYear()}</span>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="drawer-form">
          {/* Selector de Modo */}
          <div className="mode-selector">
            <button type="button" className={mode === 'Aérea' ? 'active' : ''} onClick={() => setMode('Aérea')}>
              <Plane size={16}/> Aéreo
            </button>
            <button type="button" className={mode === 'Marítima' ? 'active' : ''} onClick={() => setMode('Marítima')}>
              <Ship size={16}/> Marítimo
            </button>
          </div>

          {/* Destino e Incoterm */}
          <div className="form-row">
            <div className="field">
              <label><Globe size={12}/> Destino (IATA/Puerto)</label>
              <input required placeholder="Ej: MAD, AMS, MIA" value={f.destination} onChange={e=>setF({...f, destination: e.target.value.toUpperCase()})} />
            </div>
            <div className="field">
              <label><ShieldCheck size={12}/> Incoterm</label>
              <select value={f.incoterm} onChange={e=>setF({...f, incoterm: e.target.value})}>
                {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Punto de Entrega Final</label>
            <select required value={f.shipping_address} onChange={e=>setF({...f, shipping_address: e.target.value})}>
              <option value="">Seleccionar dirección...</option>
              {shippingAddresses.map(a => <option key={a.id} value={a.address}>{a.address}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Producto</label>
              <input required value={f.product_name} onChange={e=>setF({...f, product_name: e.target.value})} />
            </div>
            <div className="field">
              <label>Variedad</label>
              <input value={f.product_variety} onChange={e=>setF({...f, product_variety: e.target.value})} />
            </div>
          </div>

          <div className="form-row-3">
            <div className="field"><label>Cajas</label><input type="number" value={f.boxes} onChange={e=>setF({...f, boxes: e.target.value})} /></div>
            <div className="field"><label>Pallets</label><input type="number" value={f.pallets} onChange={e=>setF({...f, pallets: e.target.value})} /></div>
            <div className="field"><label>Peso (Kg)</label><input type="number" step="0.01" value={f.weight_kg} onChange={e=>setF({...f, weight_kg: e.target.value})} /></div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? <Loader2 className="spin" /> : 'Confirmar y Generar Código'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); z-index: 1000; }
        .drawer-container { position: fixed; right: 0; top: 0; height: 100%; width: 450px; background: white; z-index: 1001; padding: 40px; box-shadow: -10px 0 40px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
        .drawer-header { margin-bottom: 30px; display: flex; justify-content: space-between; }
        .auto-badge { font-size: 10px; color: #1f7a3a; font-weight: 800; background: #dcfce7; padding: 2px 8px; border-radius: 4px; }
        .drawer-form { display: flex; flex-direction: column; gap: 20px; }
        .mode-selector { display: flex; gap: 8px; background: #f1f5f9; padding: 5px; border-radius: 12px; }
        .mode-selector button { flex: 1; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; color: #64748b; }
        .mode-selector button.active { background: white; color: #1f7a3a; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .field label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        input, select { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        .submit-btn { background: #1f7a3a; color: white; border: none; padding: 18px; border-radius: 12px; font-weight: 700; cursor: pointer; margin-top: 20px; font-size: 15px; }
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}