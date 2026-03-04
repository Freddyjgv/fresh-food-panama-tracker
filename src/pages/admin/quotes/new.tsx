// src/pages/admin/quotes/new.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, PlusCircle, Building2, MapPin, Landmark, Globe, Ship, Plane, Search } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";
import { LocationSelector } from "../../../components/LocationSelector"; // ✅ Importado

// --- TYPES ---
interface ClientItem {
  id: string;
  name: string;
  contact_email: string;
  tax_id?: string;
}

interface NewClientState {
  company_name: string;
  contact_name: string;
  contact_email: string;
  tax_id: string;
  phone: string;
  country: string;
  billing_address: string;
  shipping_address: string;
  internal_notes: string;
}

export default function AdminQuoteNew() {
  const [authOk, setAuthOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'info', text: string } | null>(null);

  // Quote State
  const [quoteData, setQuoteData] = useState({
    mode: "AIR" as "AIR" | "SEA",
    currency: "USD" as "USD" | "EUR",
    destination: "", // Se manejará vía LocationSelector
    boxes: "200",
    weight: "0",
    margin: "15"
  });

  // Client Selection State
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const [newClient, setNewClient] = useState<NewClientState>({
    company_name: "", contact_name: "", contact_email: "", tax_id: "",
    phone: "", country: "Panamá", billing_address: "", shipping_address: "", internal_notes: ""
  });

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok) setAuthOk(true);
    })();
  }, []);

  async function loadClients() {
    setClientsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const res = await fetch("/.netlify/functions/listClients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataJson = await res.json();
      const items: ClientItem[] = Array.isArray(dataJson) ? dataJson : (dataJson.items || []);
      
      setClients(items);
      if (items.length > 0) setSelectedClientId(items[0].id);
    } catch (e) {
      setMsg({ type: 'error', text: "Error cargando clientes" });
    } finally {
      setClientsLoading(false);
    }
  }

  useEffect(() => { if (authOk) loadClients(); }, [authOk]);

  const filteredClients = useMemo(() => {
    const q = clientQuery.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(q) || (c.contact_email && c.contact_email.toLowerCase().includes(q))
    );
  }, [clients, clientQuery]);

  async function handleCreate() {
    if (!quoteData.destination) {
      setMsg({ type: 'error', text: "Por favor selecciona un puerto o aeropuerto de destino." });
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sesión expirada");

      let finalClientId = selectedClientId;
      let clientSnapshot = {};

      if (clientMode === "new") {
        if (!newClient.company_name || !newClient.contact_email) {
          throw new Error("Nombre de empresa y Email son obligatorios");
        }
        const resClient = await fetch("/.netlify/functions/createClient", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...newClient, mode: "invite" }),
        });
        const clientJson = await resClient.json();
        if (!resClient.ok) throw new Error(clientJson.error || "Error creando cliente");
        finalClientId = clientJson.clientId;
        clientSnapshot = { name: newClient.company_name, contact_email: newClient.contact_email, tax_id: newClient.tax_id };
      } else {
        const c = clients.find(i => i.id === selectedClientId);
        clientSnapshot = { name: c?.name, contact_email: c?.contact_email, tax_id: c?.tax_id };
      }

      // ✅ INSERCIÓN LIMPIA: Evita el error de NOT NULL constraint
      const resQuote = await fetch("/.netlify/functions/createQuote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...quoteData,
          boxes: Number(quoteData.boxes),
          margin_markup: Number(quoteData.margin),
          client_id: finalClientId,
          client_snapshot: clientSnapshot,
          status: "draft",
          // Objeto de costos inicializado (Schema JSONB)
          costs: {
            c_fruit: 0, c_freight: 0, c_origin: 0, c_aduana: 0, 
            c_insp: 0, c_doc: 0, c_tax: 0, c_other: 0
          },
          // Totales inicializados
          totals: {
            total: 0,
            meta: { pallets: 0, incoterm: "CIP", place: quoteData.destination }
          }
        }),
      });

      const quoteJson = await resQuote.json();
      if (!resQuote.ok) throw new Error(quoteJson.error || "Error creando cotización");

      window.location.href = `/admin/quotes/${quoteJson.id}`;
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
      setSaving(false);
    }
  }

  if (!authOk) return <AdminLayout title="Cargando..."><div/></AdminLayout>;

  return (
    <AdminLayout title="Nueva Cotización" subtitle="Paso 1: Cliente y logística base.">
      <div className="navBar">
        <Link href="/admin/quotes" className="btnBack"><ArrowLeft size={16}/> Volver al listado</Link>
      </div>

      <div className="mainContainer">
        <div className="card">
          <div className="cardHeader">
            <div className="headerIcon"><Building2 size={22} /></div>
            <div>
              <h3>Información del Cliente</h3>
              <p className="muted">¿A quién va dirigida la oferta?</p>
            </div>
          </div>

          <div className="tabSelector">
            <button className={clientMode === 'existing' ? 'active' : ''} onClick={() => setClientMode('existing')}>Cliente Existente</button>
            <button className={clientMode === 'new' ? 'active' : ''} onClick={() => setClientMode('new')}>Nuevo Cliente</button>
          </div>

          {clientMode === 'existing' ? (
            <div className="existingForm">
              <div className="searchBar">
                <Search size={16} />
                <input placeholder="Buscar por nombre o email..." value={clientQuery} onChange={e => setClientQuery(e.target.value)} />
              </div>
              <div className="selectWrapper">
                <select className="mainSelect" size={8} value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
                  {filteredClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.contact_email}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="newClientGrid">
              <div className="sectionLabel"><Landmark size={14}/> Datos de Empresa</div>
              <div className="inputGroup">
                <div className="field"><label>Nombre Empresa *</label><input value={newClient.company_name} onChange={e => setNewClient({...newClient, company_name: e.target.value})} /></div>
                <div className="field"><label>Email *</label><input value={newClient.contact_email} onChange={e => setNewClient({...newClient, contact_email: e.target.value})} /></div>
                <div className="field"><label>Tax ID / RUC</label><input value={newClient.tax_id} onChange={e => setNewClient({...newClient, tax_id: e.target.value})} /></div>
                <div className="field"><label>País</label><input value={newClient.country} onChange={e => setNewClient({...newClient, country: e.target.value})} /></div>
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card secondaryCard">
            <h3>Logística Base</h3>
            <div className="quoteGrid">
              <div className="field full">
                <label>Modo</label>
                <div className="modeToggle">
                  <button className={quoteData.mode === 'AIR' ? 'active' : ''} onClick={() => setQuoteData({...quoteData, mode: 'AIR'})}><Plane size={14}/> Aéreo</button>
                  <button className={quoteData.mode === 'SEA' ? 'active' : ''} onClick={() => setQuoteData({...quoteData, mode: 'SEA'})}><Ship size={14}/> Marítimo</button>
                </div>
              </div>
              
              {/* ✅ INTEGRACIÓN DEL SELECTOR INTELIGENTE */}
              <div className="field full">
                <label>Puerto/Aeropuerto Destino</label>
                <LocationSelector 
                  value={quoteData.destination} 
                  onChange={(val) => setQuoteData({...quoteData, destination: val})} 
                  mode={quoteData.mode} 
                />
              </div>

              <div className="field">
                <label>Cajas</label>
                <input type="number" value={quoteData.boxes} onChange={e => setQuoteData({...quoteData, boxes: e.target.value})} />
              </div>
              <div className="field">
                <label>Margen %</label>
                <input type="number" value={quoteData.margin} onChange={e => setQuoteData({...quoteData, margin: e.target.value})} />
              </div>
            </div>

            <button className="btnCreate" onClick={handleCreate} disabled={saving || !quoteData.destination}>
              {saving ? "Creando..." : <><PlusCircle size={18}/> Iniciar Borrador</>}
            </button>
            {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Mantén tus estilos originales, solo asegúrate de que el stack se vea bien */
        .navBar { margin-bottom: 20px; }
        .btnBack { display: inline-flex; align-items: center; gap: 8px; color: #64748b; font-weight: 800; font-size: 13px; text-decoration: none; }
        .mainContainer { display: grid; grid-template-columns: 1fr 420px; gap: 24px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .cardHeader { display: flex; gap: 16px; margin-bottom: 24px; }
        .headerIcon { color: #1f7a3a; background: #f0fdf4; padding: 10px; border-radius: 14px; display: flex; align-items: center; }
        .tabSelector { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; margin-bottom: 24px; }
        .tabSelector button { flex: 1; border: none; padding: 10px; border-radius: 9px; cursor: pointer; font-weight: 800; font-size: 12px; color: #64748b; }
        .tabSelector button.active { background: white; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .searchBar { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 12px; margin-bottom: 12px; }
        .searchBar input { border: none; background: transparent; outline: none; width: 100%; font-size: 14px; }
        .mainSelect { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px; font-size: 14px; outline: none; height: 180px; }
        .inputGroup { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field.full { grid-column: 1 / -1; }
        .field label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; }
        .field input, .field select { padding: 12px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-weight: 600; }
        .modeToggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .modeToggle button { padding: 10px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .modeToggle button.active { background: #1f7a3a; color: white; border-color: #1f7a3a; }
        .btnCreate { width: 100%; margin-top: 10px; padding: 16px; background: #1f7a3a; color: white; border: none; border-radius: 16px; font-weight: 900; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 16px; transition: 0.2s; }
        .btnCreate:disabled { background: #cbd5e1; cursor: not-allowed; }
        .alert { margin-top: 15px; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: 700; text-align: center; }
        .alert.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2; }
      `}</style>
    </AdminLayout>
  );
}