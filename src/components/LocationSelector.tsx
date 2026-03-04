import { useState, useEffect, useRef } from "react";
import { Plus, Plane, Ship, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

interface Location {
  code: string;
  name: string;
  country: string;
  flag: string;
  type: "AIRPORT" | "PORT";
}

export function LocationSelector({ 
  value, 
  onChange, 
  mode 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  mode: "AIR" | "SEA" 
}) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sincronizar cuando el valor inicial llega de la DB
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchLocations = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { 
      setResults([]); 
      return; 
    }
    
    setLoading(true);
    setIsOpen(true);
    
    const { data } = await supabase
      .from('locations')
      .select('*')
      .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
      .eq('type', mode === 'AIR' ? 'AIRPORT' : 'PORT')
      .limit(6);

    setResults((data as Location[]) || []);
    setLoading(false);
  };

  const handleSelect = (loc: Location) => {
    setQuery(loc.name);
    onChange(loc.name);
    setIsOpen(false);
  };

  const createNewLocation = async () => {
    if (!query) return;
    setLoading(true);
    
    // Generar un código simple para evitar nulos en la DB
    const tempCode = query.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 100);
    
    const { data, error } = await supabase
      .from('locations')
      .insert([{
        code: tempCode,
        name: query,
        country: 'Destino', // Etiqueta genérica ya que omitimos país automático
        type: mode === 'AIR' ? 'AIRPORT' : 'PORT',
        flag: mode === 'AIR' ? '✈️' : '⚓'
      }])
      .select();

    setLoading(false);
    if (!error && data) {
      handleSelect(data[0]);
    }
  };

  return (
    <div className="location-wrapper" ref={wrapperRef}>
      <div className="input-group">
        <div className="icon-prefix">
          {mode === 'AIR' ? <Plane size={16} /> : <Ship size={16} />}
        </div>
        <input 
          type="text" 
          value={query} 
          onChange={(e) => searchLocations(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={mode === 'AIR' ? "Ej: AMS o Schiphol..." : "Ej: ROT o Rotterdam..."}
        />
        {loading && <Loader2 size={14} className="spin" />}
      </div>

      {isOpen && (
        <div className="dropdown">
          {results.map((loc) => (
            <div key={loc.code} className="option" onClick={() => handleSelect(loc)}>
              <span className="flag">{loc.flag || (loc.type === 'PORT' ? '⚓' : '✈️')}</span>
              <div className="details">
                <span className="name">{loc.name}</span>
                <span className="sub">{loc.code} • {loc.country}</span>
              </div>
            </div>
          ))}

          {results.length === 0 && !loading && query.length >= 3 && (
            <div className="option create-new" onClick={createNewLocation}>
              <Plus size={14} />
              <span>Crear <b>"{query}"</b> como nuevo destino</span>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .location-wrapper { position: relative; width: 100%; }
        .input-group { 
          display: flex; align-items: center; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 12px;
          transition: border 0.2s;
        }
        .input-group:focus-within { border-color: #3b82f6; background: white; }
        .icon-prefix { color: #94a3b8; margin-right: 10px; }
        input { 
          flex: 1; border: none; padding: 11px 0; outline: none; 
          font-size: 14px; color: #1e293b; font-weight: 700; background: transparent;
        }
        .dropdown { 
          position: absolute; top: calc(100% + 5px); left: 0; right: 0; z-index: 100;
          background: white; border: 1px solid #e2e8f0; border-radius: 12px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.1); overflow: hidden;
        }
        .option { 
          display: flex; align-items: center; gap: 12px; padding: 10px 15px;
          cursor: pointer; transition: background 0.2s;
        }
        .option:hover { background: #f1f5f9; }
        .flag { font-size: 18px; width: 24px; text-align: center; }
        .details { display: flex; flex-direction: column; }
        .name { font-size: 13px; font-weight: 800; color: #0f172a; }
        .sub { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
        .create-new { color: #166534; background: #f0fdf4; border-top: 1px solid #dcfce7; }
        .spin { animation: rotate 1s linear infinite; color: #94a3b8; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}