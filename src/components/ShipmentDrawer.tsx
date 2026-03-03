import React, { useState, useEffect } from 'react';
import { X, Save, Package, Anchor, Plane, Layers, Globe, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface ShipmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  defaultIncoterm?: string;
}

// Mapa de banderas simple basado en ISO Country Code
const getFlag = (code: string) => {
  if (!code) return '🌐';
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export default function ShipmentDrawer({ 
  isOpen, onClose, clientId, clientName, onSuccess, defaultIncoterm 
}: ShipmentDrawerProps) {
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Estados para Data de la BD
  const [products, setProducts] = useState<any[]>([]);
  const [allVarieties, setAllVarieties] = useState<any[]>([]);
  const [filteredVarieties, setFilteredVarieties] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    product_id: '',
    variety_id: '',
    incoterm: 'FOB',
    place_id: '',
    status: 'Booking Pending'
  });

  // 1. Cargar datos maestros al abrir
  useEffect(() => {
    if (isOpen) {
      loadMasterData();
      if (defaultIncoterm) setFormData(prev => ({ ...prev, incoterm: defaultIncoterm }));
    }
  }, [isOpen]);

  const loadMasterData = async () => {
    const { data: p } = await supabase.from('products').select('*').order('name');
    const { data: v } = await supabase.from('product_varieties').select('*');
    const { data: l } = await supabase.from('logistics_places').select('*').eq('is_active', true);
    
    setProducts(p || []);
    setAllVarieties(v || []);
    setPlaces(l || []);
  };

  // 2. Filtrar variedades cuando cambie el producto
  useEffect(() => {
    if (formData.product_id) {
      const filtered = allVarieties.filter(v => v.product_id === formData.product_id);
      setFilteredVarieties(filtered);
      setFormData(prev => ({ ...prev, variety_id: '' })); // Reset variedad
    }
  }, [formData.product_id, allVarieties]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedProduct = products.find(p => p.id === formData.product_id);
      const selectedVariety = allVarieties.find(v => v.id === formData.variety_id);
      const selectedPlace = places.find(p => p.id === formData.place_id);
      const shipmentCode = `SHP-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error } = await supabase.from('shipments').insert([{
        client_id: clientId,
        code: shipmentCode,
        product_name: selectedProduct?.name,
        product_variety: selectedVariety?.name,
        incoterm: formData.incoterm,
        destination_port: `${selectedPlace?.name} (${selectedPlace?.code})`,
        status: formData.status
      }]);

      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ product_id: '', variety_id: '', incoterm: defaultIncoterm || 'FOB', place_id: '', status: 'Booking Pending' });
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={handleClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        <header className="drawer-header">
          <div>
            <h2>Nuevo Embarque</h2>
            <p>Cliente: <strong>{clientName}</strong></p>
          </div>
          <button onClick={handleClose} className="close-btn"><X size={24} /></button>
        </header>

        <form onSubmit={handleSubmit} className="drawer-form">
          {/* SECCIÓN A: CARGA */}
          <section className="form-section">
            <h3><Package size={16} /> Configuración de Carga</h3>
            <div className="input-group">
              <label>Producto</label>
              <select 
                required 
                value={formData.product_id}
                onChange={e => setFormData({...formData, product_id: e.target.value})}
              >
                <option value="">Seleccione Producto...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            
            <div className={`input-group ${!formData.product_id ? 'disabled' : ''}`}>
              <label>Variedad / Calibre</label>
              <select 
                required 
                disabled={!formData.product_id}
                value={formData.variety_id}
                onChange={e => setFormData({...formData, variety_id: e.target.value})}
              >
                <option value="">{formData.product_id ? 'Seleccione Variedad...' : 'Primero elija producto'}</option>
                {filteredVarieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </section>

          {/* SECCIÓN B: LOGÍSTICA */}
          <section className="form-section">
            <h3><Globe size={16} /> Hub Logístico</h3>
            <div className="logistics-grid">
              <div className="input-group">
                <label>Incoterm</label>
                <select 
                  value={formData.incoterm}
                  onChange={e => setFormData({...formData, incoterm: e.target.value})}
                >
                  {['FOB', 'CIF', 'CIP', 'FCA', 'CFR', 'DDP', 'DAP'].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div className="input-group flex-2">
                <label>Puerto / Aeropuerto Destino</label>
                <select 
                  required
                  value={formData.place_id}
                  onChange={e => setFormData({...formData, place_id: e.target.value})}
                >
                  <option value="">Buscar destino...</option>
                  {places.map(p => (
                    <option key={p.id} value={p.id}>
                      {getFlag(p.country_code)} {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {formData.place_id && (
              <div className="place-preview">
                {places.find(p => p.id === formData.place_id)?.type === 'Sea' ? <Anchor size={14}/> : <Plane size={14}/>}
                <span>Destino detectado como terminal de {places.find(p => p.id === formData.place_id)?.type === 'Sea' ? 'Mar' : 'Aire'}</span>
              </div>
            )}
          </section>

          <footer className="drawer-footer">
            <button type="button" onClick={handleClose} className="btn-abort">Cancelar</button>
            <button 
              type="submit" 
              disabled={loading || success} 
              className={`btn-submit ${success ? 'success' : ''}`}
            >
              {loading ? <Loader2 className="spin" size={20} /> : success ? <Check size={20} /> : <Save size={20} />}
              <span>{loading ? 'Procesando...' : success ? '¡Embarque Creado!' : 'Crear Embarque'}</span>
            </button>
          </footer>
        </form>
      </div>

      <style jsx>{`
        .drawer-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); z-index: 1000; display: flex; justify-content: flex-end; }
        .drawer-content { width: 480px; background: white; height: 100%; box-shadow: -10px 0 50px rgba(0,0,0,0.15); display: flex; flex-direction: column; animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        
        .drawer-header { padding: 35px 30px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .drawer-header h2 { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
        .drawer-header p { margin: 5px 0 0; font-size: 14px; color: #64748b; }
        
        .drawer-form { padding: 30px; flex: 1; overflow-y: auto; background: #fcfcfd; }
        .form-section { margin-bottom: 40px; }
        .form-section h3 { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #1f7a3a; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; }
        
        .input-group { margin-bottom: 22px; transition: 0.2s; }
        .input-group.disabled { opacity: 0.5; pointer-events: none; }
        .input-group label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; }
        
        select { width: 100%; padding: 12px 15px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; background: white; appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 15px center; background-size: 15px; }
        select:focus { outline: none; border-color: #1f7a3a; box-shadow: 0 0 0 4px rgba(31, 122, 58, 0.1); }

        .logistics-grid { display: flex; gap: 15px; }
        .flex-2 { flex: 2; }

        .place-preview { display: flex; align-items: center; gap: 8px; margin-top: -10px; padding: 10px; background: #f0fdf4; border-radius: 8px; color: #166534; font-size: 11px; font-weight: 600; }

        .drawer-footer { padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; gap: 12px; }
        .btn-submit { flex: 2; background: #1f7a3a; color: white; border: none; padding: 16px; border-radius: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s; }
        .btn-submit.success { background: #16a34a; }
        .btn-submit:hover:not(:disabled) { background: #166534; transform: translateY(-2px); }
        .btn-abort { flex: 1; background: #fff; color: #64748b; border: 1px solid #e2e8f0; padding: 16px; border-radius: 14px; font-weight: 600; cursor: pointer; }
        
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}