import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, PlusCircle, Building2, MapPin, NotebookPen, Landmark } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

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
    destination: "MAD",
    boxes: "200",
    weight: "",
    margin: "15"
  });

  // Client Selection State
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // NEW CLIENT STATE (Extended CRM)
  const [newClient, setNewClient] = useState<NewClientState>({
    company_name: "",
    contact_name: "",
    contact_email: "",
    tax_id: "",
    phone: "",
    country: "Panamá",
    billing_address: "",
    shipping_address: "",
    internal_notes: ""
  });

  // --- LOGIC ---
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const r = await requireAdminOrRedirect();
      if (r.ok && isMounted) setAuthOk(true);
    })();
    return () => { isMounted = false; };
  }, []);

  async function loadClients(autoSelectId?: string) {
    setClientsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch("/.netlify/functions/listClients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const items: ClientItem[] = Array.isArray(data) ? data : (data.items || []);
      
      setClients(items);
      if (autoSelectId) {
        setSelectedClientId(autoSelectId);
      } else if (items.length > 0 && !selectedClientId) {
        setSelectedClientId(items[0].id);
      }
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
      c.name.toLowerCase().includes(q) || c.contact_email.toLowerCase().includes(q)
    );
  }, [clients, clientQuery]);

  // --- ACTION: CREATE QUOTE ---
  async function handleCreate() {
    setSaving(true);
    setMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
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
        clientSnapshot = { name: newClient.company_name, email: newClient.contact_email };
      } else {
        const c = clients.find(i => i.id === selectedClientId);
        clientSnapshot = { name: c?.name, email: c?.contact_email };
      }

      const resQuote = await fetch("/.netlify/functions/createQuote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...quoteData,
          client_id: finalClientId,
          client_snapshot: clientSnapshot,
          status: "draft"
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

  if (!authOk) return <AdminLayout title="Cargando..." subtitle="" children={<div/>} />;

  return (
    <AdminLayout title="Nueva Cotización" subtitle="Configura el cliente y los parámetros base de la oferta.">
      <div className="navBar">
        <Link href="/admin/quotes" className="btnBack"><ArrowLeft size={16}/> Volver</Link>
      </div>

      <div className="mainContainer">
        <div className="card">
          <div className="cardHeader">
            <Building2 size={20} className="headerIcon" />
            <div>
              <h3>Información del Cliente</h3>
              <p>Vincula una empresa existente o registra una nueva con datos CRM.</p>
            </div>
          </div>

          <div className="tabSelector">
            <button className={clientMode === 'existing' ? 'active' : ''} onClick={() => setClientMode('existing')}>Cliente Existente</button>
            <button className={clientMode === 'new' ? 'active' : ''} onClick={() => setClientMode('new')}>Registrar Nuevo</button>
          </div>

          {clientMode === 'existing' ? (
            <div className="existingForm">
              <div className="searchBar">
                <Search size={16} />
                <input placeholder="Buscar por nombre o email..." value={clientQuery} onChange={e => setClientQuery(e.target.value)} />
              </div>
              <select className="mainSelect" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
                {filteredClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.contact_email})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="newClientGrid">
              <div className="sectionLabel"><Landmark size={14}/> Identidad Fiscal y Contacto</div>
              <div className="inputGroup">
                <input placeholder="Nombre de la Empresa *" value={newClient.company_name} onChange={e => setNewClient({...newClient, company_name: e.target.value})} />
                <input placeholder="Email de Contacto *" value={newClient.contact_email} onChange={e => setNewClient({...newClient, contact_email: e.target.value})} />
                <input placeholder="Tax ID / RUC" value={newClient.tax_id} onChange={e => setNewClient({...newClient, tax_id: e.target.value})} />
                <input placeholder="Teléfono" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
              </div>

              <div className="sectionLabel"><MapPin size={14}/> Logística de Entrega</div>
              <div className="inputGroup">
                <textarea placeholder="Dirección de Facturación" value={newClient.billing_address} onChange={e => setNewClient({...newClient, billing_address: e.target.value})} />
                <textarea placeholder="Dirección de Envío" value={newClient.shipping_address} onChange={e => setNewClient({...newClient, shipping_address: e.target.value})} />
              </div>

              <div className="sectionLabel"><NotebookPen size={14}/> Notas Internas</div>
              <textarea className="fullWidth" placeholder="Observaciones privadas..." value={newClient.internal_notes} onChange={e => setNewClient({...newClient, internal_notes: e.target.value})} />
            </div>
          )}
        </div>

        <div className="card secondaryCard">
          <h3>Parámetros de la Oferta</h3>
          <div className="quoteGrid">
            <div className="field">
              <label>Modo</label>
              <select value={quoteData.mode} onChange={e => setQuoteData({...quoteData, mode: e.target.value as any})}>
                <option value="AIR">✈️ Aéreo</option>
                <option value="SEA">🚢 Marítimo</option>
              </select>
            </div>
            <div className="field">
              <label>Moneda</label>
              <select value={quoteData.currency} onChange={e => setQuoteData({...quoteData, currency: e.target.value as any})}>
                <option value="USD">USD - Dólar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
            <div className="field">
              <label>Destino</label>
              <input value={quoteData.destination} onChange={e => setQuoteData({...quoteData, destination: e.target.value})} />
            </div>
            <div className="field">
              <label>Cant. Cajas</label>
              <input type="number" value={quoteData.boxes} onChange={e => setQuoteData({...quoteData, boxes: e.target.value})} />
            </div>
            <div className="field">
              <label>Margen (%)</label>
              <input type="number" value={quoteData.margin} onChange={e => setQuoteData({...quoteData, margin: e.target.value})} />
            </div>
          </div>

          <button className="btnCreate" onClick={handleCreate} disabled={saving}>
            {saving ? "Procesando..." : <><PlusCircle size={18}/> Crear Borrador</>}
          </button>

          {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
        </div>
      </div>

      <style jsx>{`
        .navBar { margin-bottom: 20px; }
        .btnBack { display: inline-flex; align-items: center; gap: 8px; color: #64748b; font-weight: 700; font-size: 13px; text-decoration: none; }
        .mainContainer { display: grid; grid-template-columns: 1fr 380px; gap: 24px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
        .cardHeader { display: flex; gap: 16px; margin-bottom: 24px; }
        .headerIcon { color: #16a34a; background: #f0fdf4; padding: 10px; border-radius: 12px; width: 44px; height: 44px; }
        .tabSelector { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; margin-bottom: 24px; }
        .tabSelector button { flex: 1; border: none; padding: 8px; border-radius: 8px; cursor: pointer; }
        .tabSelector button.active { background: white; color: #0f172a; }
        .newClientGrid { display: flex; flex-direction: column; gap: 16px; }
        .inputGroup { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .btnCreate { width: 100%; margin-top: 20px; padding: 12px; background: #16a34a; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; }
        .alert { margin-top: 15px; padding: 10px; border-radius: 8px; font-size: 13px; }
        .alert.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2; }
      `}</style>
    </AdminLayout>
  );
}