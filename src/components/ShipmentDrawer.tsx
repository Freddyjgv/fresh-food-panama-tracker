import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Package, Globe, Loader2, Check, Hash, Palette, ThermometerSun, Anchor, Plane } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface ShipmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  defaultIncoterm?: string;
}

const getFlag = (code: string) => {
  if (!code) return '🌐';
  const codePoints = code.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const MASTER_PLACES = [
  { code: 'MAD', name: 'Madrid-Barajas', country: 'ES' },
  { code: 'BCN', name: 'Puerto de Barcelona', country: 'ES' },
  { code: 'RTM', name: 'Puerto de Rotterdam', country: 'NL' },
  { code: 'ANR', name: 'Puerto de Amberes', country: 'BE' },
  { code: 'GDN', name: 'Puerto de Gdansk', country: 'PL' },
  { code: 'MIA', name: 'Miami International', country: 'US' },
];

export default function ShipmentDrawer({ isOpen, onClose, clientId, clientName, onSuccess, defaultIncoterm }: ShipmentDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<'Marítima' | 'Aérea'>('Marítima');
  
  const [products, setProducts] = useState<any[]>([]);
  const [allVarieties, setAllVarieties] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    product_id: '',
    variety_id: '',
    calibre: '',
    color: '',
    brix_grade: '>13',
    boxes: '',
    pallets: '',
    estimated_weight: '',
    incoterm: 'FOB',
    destination: '',
  });

  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        const { data: p } = await supabase.from('products').select('*').order('name');
        const { data: v } = await supabase.from('product_varieties').select('*').order('name');
        setProducts(p || []);
        setAllVarieties(v || []);
        if (defaultIncoterm) setFormData(f => ({ ...f, incoterm: defaultIncoterm }));
      };
      loadData();
    }
  }, [isOpen, defaultIncoterm]);

  const filteredVarieties = useMemo(() => {
    if (!formData.product_id) return [];
    return allVarieties.filter(v => v.product_id === formData.product_id);
  }, [formData.product_id, allVarieties]);

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, product_id: val, variety_id: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no encontrada. Por favor, reinicia sesión.");

      const selectedProduct = products.find(p => p.id === formData.product_id);
      const selectedVariety = allVarieties.find(v => v.id === formData.variety_id);

      // Payload optimizado: solo lo necesario para el backend
      const payload = {
        clientId: clientId,                             
        destination: formData.destination,              
        incoterm: formData.incoterm,                    
        boxes: formData.boxes ? parseInt(formData.boxes) : null,
        pallets: formData.pallets ? parseInt(formData.pallets) : null,
        weight_kg: formData.estimated_weight ? parseFloat(formData.estimated_weight) : null,
        product_name: selectedProduct?.name || 'Piña',      
        product_variety: selectedVariety?.name || 'MD2 Golden',  
        product_mode: mode,
        // Metadata técnica del producto
        calibre: formData.calibre,
        color: formData.color,
        brix_grade: formData.brix_grade
      };

      const response = await fetch('/.netlify/functions/createShipment', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        throw new Error(errorMsg || 'Error en el servidor');
      }

      const result = await response.json();

      if (result.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
      } else {
        throw new Error(result.message || 'La operación falló en el servidor');
      }

    } catch (err: any) {
      console.error("Submit Error:", err.message);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ 
      product_id: '', 
      variety_id: '', 
      calibre: '', 
      color: '', 
      brix_grade: '>13', 
      boxes: '', 
      pallets: '', 
      estimated_weight: '', 
      incoterm: defaultIncoterm || 'FOB', 
      destination: '' 
    });
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={handleClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        <header className="drawer-header">
          <div className="header-info">
            <h2>Nuevo Embarque</h2>
            <p className="client-name">Cliente: <strong>{clientName}</strong></p>
            <div className="id-badge">CORRELATIVO AUTOMÁTICO</div>
          </div>
          <button onClick={handleClose} className="close-btn"><X size={24} /></button>
        </header>

        <form onSubmit={handleSubmit} className="drawer-form">
          <section className="form-section">
            <h3><Package size={16} /> ESPECIFICACIONES DE PRODUCTO</h3>
            <div className="grid-2">
              <div className="input-group">
                <label>Producto</label>
                <select required value={formData.product_id} onChange={handleProductChange}>
                  <option value="">Seleccione...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Variedad</label>
                <select required disabled={!formData.product_id} value={formData.variety_id} onChange={e => setFormData({...formData, variety_id: e.target.value})}>
                  <option value="">Seleccione variedad</option>
                  {filteredVarieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-3">
              <div className="input-group"><label><Hash size={12}/> Calibre</label><input type="text" placeholder="Ej: 5" value={formData.calibre} onChange={e => setFormData({...formData, calibre: e.target.value})} /></div>
              <div className="input-group"><label><Palette size={12}/> Color</label><input type="text" placeholder="Ej: 2.5" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} /></div>
              <div className="input-group"><label><ThermometerSun size={12}/> Brix</label><input type="text" value={formData.brix_grade} onChange={e => setFormData({...formData, brix_grade: e.target.value})} /></div>
            </div>

            <div className="grid-3">
              <div className="input-group"><label>Cajas</label><input type="number" value={formData.boxes} onChange={e => setFormData({...formData, boxes: e.target.value})} /></div>
              <div className="input-group"><label>Pallets</label><input type="number" value={formData.pallets} onChange={e => setFormData({...formData, pallets: e.target.value})} /></div>
              <div className="input-group"><label>Peso (Kg)</label><input type="number" step="0.01" value={formData.estimated_weight} onChange={e => setFormData({...formData, estimated_weight: e.target.value})} /></div>
            </div>
          </section>

          <section className="form-section">
            <h3><Globe size={16} /> HUB LOGÍSTICO</h3>
            <div className="logistic-grid">
              <div className="input-group">
                <label>Modalidad de Envío</label>
                <div className="mode-selector">
                  <button type="button" className={mode === 'Marítima' ? 'active' : ''} onClick={() => setMode('Marítima')}><Anchor size={16} /> Marítima</button>
                  <button type="button" className={mode === 'Aérea' ? 'active' : ''} onClick={() => setMode('Aérea')}><Plane size={16} /> Aérea</button>
                </div>
              </div>
              <div className="input-group">
                <label>Incoterm</label>
                <select value={formData.incoterm} onChange={e => setFormData({...formData, incoterm: e.target.value})}>
                  {['FOB', 'CIF', 'CIP', 'FCA', 'CFR', 'DDP'].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            
            <div className="input-group full-width">
              <label>Lugar de Destino</label>
              <input list="places-list" required placeholder="Nombre del puerto o aeropuerto..." value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
              <datalist id="places-list">
                {MASTER_PLACES.map(p => <option key={p.code} value={`${getFlag(p.country)} ${p.name} (${p.code})`} />)}
              </datalist>
            </div>
          </section>

          <footer className="drawer-footer">
            <button type="button" onClick={handleClose} className="btn-abort">Cancelar</button>
            <button type="submit" disabled={loading || success} className={`btn-submit ${success ? 'success' : ''}`}>
              {loading ? <Loader2 className="spin" size={20} /> : success ? <Check size={20} /> : <Save size={20} />}
              <span>{success ? 'Embarque Creado' : 'Crear Embarque'}</span>
            </button>
          </footer>
        </form>
      </div>

      <style jsx>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); z-index: 1000; display: flex; justify-content: flex-end; }
        .drawer-content { width: 500px; background: white; height: 100%; box-shadow: -10px 0 50px rgba(0,0,0,0.1); display: flex; flex-direction: column; animation: slide 0.3s ease-out; }
        @keyframes slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .drawer-header { padding: 30px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; }
        .header-info h2 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
        .client-name { margin: 4px 0; font-size: 13px; color: #64748b; }
        .id-badge { display: inline-block; background: #f0fdf4; color: #166534; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 12px; font-weight: 700; border: 1px solid #dcfce7; margin-top: 8px; }
        .drawer-form { padding: 30px; flex: 1; overflow-y: auto; background: #fcfcfd; }
        .form-section { margin-bottom: 30px; }
        .form-section h3 { font-size: 11px; color: #1f7a3a; letter-spacing: 0.1em; margin-bottom: 20px; font-weight: 900; display: flex; align-items: center; gap: 8px; border-left: 3px solid #1f7a3a; padding-left: 10px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .logistic-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 15px; margin-bottom: 15px; }
        .input-group label { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }
        input, select { width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; color: #0f172a; }
        input:focus { border-color: #1f7a3a; outline: none; box-shadow: 0 0 0 3px rgba(31,122,58,0.1); }
        .mode-selector { display: flex; background: #f1f5f9; padding: 4px; border-radius: 10px; gap: 4px; }
        .mode-selector button { flex: 1; border: none; padding: 8px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; color: #64748b; background: transparent; }
        .mode-selector button.active { background: white; color: #1f7a3a; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .drawer-footer { padding: 20px 30px; border-top: 1px solid #f1f5f9; display: flex; gap: 10px; }
        .btn-submit { flex: 2; background: #1f7a3a; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .btn-submit.success { background: #16a34a; }
        .btn-abort { flex: 1; background: #f1f5f9; border: none; border-radius: 12px; color: #64748b; font-weight: 600; cursor: pointer; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}