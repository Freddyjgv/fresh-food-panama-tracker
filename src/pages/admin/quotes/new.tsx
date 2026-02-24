// src/pages/admin/quotes/new.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, PlusCircle } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

type ClientItem = {
  id: string;
  name: string;
  contact_email: string;
  created_at?: string;
};

type CreateClientResponse = {
  ok: boolean;
  client_id: string;
  auth_user_id?: string;
  mode?: string;
  message?: string;
};

export default function AdminQuoteNew() {
  const [authOk, setAuthOk] = useState(false);

  // Quote base
  const [mode, setMode] = useState<"AIR" | "SEA">("AIR");
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [destination, setDestination] = useState("MAD");
  const [boxes, setBoxes] = useState("200");
  const [weight, setWeight] = useState("");
  const [margin, setMargin] = useState("15");

  // Client selection/creation
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // New client form
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Panamá");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function getTokenOrRedirect() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      return null;
    }
    return token;
  }

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      setAuthOk(true);
    })();
  }, []);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const em = String(c.contact_email || "").toLowerCase();
      return name.includes(q) || em.includes(q);
    });
  }, [clients, clientQuery]);

  async function loadClients(nextSelectId?: string) {
    setClientsLoading(true);
    setMsg(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/.netlify/functions/listClients", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      setMsg(t || "No se pudieron cargar clientes");
      setClientsLoading(false);
      return;
    }

    const json = await res.json();
    const items: ClientItem[] = json.items || [];
    setClients(items);

    // Si nos pasan un id para auto-seleccionar (ej: recién creado), úsalo.
    if (nextSelectId) {
      setSelectedClientId(nextSelectId);
    } else {
      // Si ya hay uno seleccionado, mantenlo. Si no hay, usa el primero (si existe).
      if (!selectedClientId && items.length) setSelectedClientId(items[0].id);
    }

    setClientsLoading(false);
  }

  useEffect(() => {
    if (!authOk) return;
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOk]);

  function pickedClientSnapshot(client: ClientItem | undefined | null) {
    if (!client) return {};
    return {
      name: client.name,
      contact_email: client.contact_email,
    };
  }

  function validateNewClient() {
    const company = companyName.trim();
    const contact = contactName.trim();
    const email = contactEmail.trim();
    const ph = phone.trim();
    const ctry = country.trim();

    if (!company) return "Falta: Empresa *";
    if (!contact) return "Falta: Contacto *";
    if (!email) return "Falta: Email *";
    if (!ph) return "Falta: Teléfono *";
    if (!ctry) return "Falta: País *";
    return null;
  }

  async function createClientIfNeeded(token: string): Promise<{ clientId: string; snapshot: any } | null> {
    if (clientMode === "existing") {
      const client = clients.find((c) => c.id === selectedClientId);
      if (!selectedClientId || !client) {
        setMsg("Selecciona un cliente existente o cambia a 'Crear nuevo'.");
        return null;
      }
      return { clientId: client.id, snapshot: pickedClientSnapshot(client) };
    }

    // new client
    const vErr = validateNewClient();
    if (vErr) {
      setMsg(vErr);
      return null;
    }

    const body = {
      mode: "invite",
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      phone: phone.trim(),
      country: country.trim(),
    };

    const res = await fetch("/.netlify/functions/createClient", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const t = await res.text().catch(() => "");
    if (!res.ok) {
      setMsg(t || "No se pudo crear el cliente");
      return null;
    }

    const json = JSON.parse(t) as CreateClientResponse;
    if (!json.client_id) {
      setMsg("createClient no devolvió client_id");
      return null;
    }

    // refrescamos lista y auto-seleccionamos el nuevo
    await loadClients(json.client_id).catch(() => {});

    // snapshot consistente: usamos lo que tenemos, pero si ya cargó lista,
    // preferimos el registro real (por si backend normaliza email/nombre)
    const created = clients.find((c) => c.id === json.client_id);

    return {
      clientId: json.client_id,
      snapshot: created ? pickedClientSnapshot(created) : {
        name: companyName.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        phone: phone.trim(),
        country: country.trim(),
      },
    };
  }

  async function createQuote() {
    setSaving(true);
    setMsg(null);

    const token = await getTokenOrRedirect();
    if (!token) {
      setSaving(false);
      return;
    }

    const resolved = await createClientIfNeeded(token);
    if (!resolved) {
      setSaving(false);
      return;
    }

    const body = {
      status: "draft",
      mode,
      currency,
      destination: destination.trim(),
      boxes: Number(boxes || 0),
      weight_kg: weight ? Number(weight) : null,
      margin_markup: Number(margin || 15),

      client_id: resolved.clientId,
      client_snapshot: resolved.snapshot,

      costs: {},
      totals: {},
    };

    const res = await fetch("/.netlify/functions/createQuote", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const t = await res.text().catch(() => "");
    setSaving(false);

    if (!res.ok) {
      setMsg(t || "No se pudo crear la cotización");
      return;
    }

    const json = JSON.parse(t);
    window.location.href = `/admin/quotes/${json.id}`;
  }

  if (!authOk) {
    return (
      <AdminLayout title="Nueva cotización" subtitle="Verificando permisos…">
        <div className="ff-card2">Cargando…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Nueva cotización" subtitle="Crea un borrador con cliente y abre el editor.">
      <div className="ff-spread2" style={{ marginBottom: 12 }}>
        <Link href="/admin/quotes" className="ff-btnSmall">
          <ArrowLeft size={16} />
          Volver
        </Link>
      </div>

      <div className="ff-card2" style={{ padding: 12 }}>
        <div style={{ fontWeight: 950, fontSize: 14, letterSpacing: "-.2px" }}>Cliente</div>
        <div style={{ marginTop: 2, color: "var(--ff-muted)", fontSize: 12 }}>
          Selecciona un cliente existente o crea uno nuevo (tipo CRM).
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        <div className="seg">
          <button
            type="button"
            className={`segBtn ${clientMode === "existing" ? "active" : ""}`}
            onClick={() => setClientMode("existing")}
          >
            Existente
          </button>
          <button
            type="button"
            className={`segBtn ${clientMode === "new" ? "active" : ""}`}
            onClick={() => setClientMode("new")}
          >
            Crear nuevo
          </button>
        </div>

        <div style={{ height: 10 }} />

        {clientMode === "existing" ? (
          <>
            <div className="inputIcon">
              <Search size={16} />
              <input
                className="in2"
                style={{ border: 0, height: 36, padding: 0 }}
                placeholder="Buscar por empresa o email…"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
              />
            </div>

            <div style={{ height: 10 }} />

            <select
              className="in2"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              disabled={clientsLoading}
            >
              {clientsLoading ? <option>Cargando…</option> : null}
              {!clientsLoading && filteredClients.length === 0 ? <option>No hay coincidencias</option> : null}
              {filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.contact_email}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="grid2">
            <input className="in2" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Empresa *" />
            <input className="in2" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contacto *" />
            <input className="in2" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email *" />
            <input className="in2" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono *" />
            <input className="in2" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="País *" />
          </div>
        )}

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        <div style={{ fontWeight: 950, fontSize: 14, letterSpacing: "-.2px" }}>Datos base de la oferta</div>
        <div style={{ marginTop: 2, color: "var(--ff-muted)", fontSize: 12 }}>
          Esto crea el registro en Supabase. Luego completas costos/terms en el editor.
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        <div className="row3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <select className="in2" value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="AIR">Aéreo</option>
            <option value="SEA">Marítimo</option>
          </select>

          <select className="in2" value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>

          <input className="in2" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destino (ej: MAD)" />
        </div>

        <div style={{ height: 10 }} />

        <div className="row3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <input className="in2" value={boxes} onChange={(e) => setBoxes(e.target.value)} placeholder="Cajas" />
          <input className="in2" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Peso kg (opcional)" />
          <input className="in2" value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="Markup % (ej: 15)" />
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        <div className="ff-spread2">
          <div style={{ color: "var(--ff-muted)", fontSize: 12 }}>
            Se abrirá el editor al crear.
          </div>
          <button className="ff-primary" type="button" disabled={saving} onClick={createQuote}>
            <PlusCircle size={16} />
            {saving ? "Creando…" : "Crear borrador"}
          </button>
        </div>

        {msg ? (
          <div className="msgWarn" style={{ marginTop: 10 }}>
            {msg}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .grid2 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .grid2 {
            grid-template-columns: 1fr 1fr;
          }
        }
        .row3 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .row3 {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }

        .seg {
          display: inline-flex;
          gap: 6px;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.10);
          border-radius: 12px;
          padding: 6px;
        }
        .segBtn {
          height: 32px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
          color: var(--ff-text);
        }
        .segBtn.active {
          background: #fff;
          border-color: rgba(15, 23, 42, 0.10);
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
        }

        .inputIcon {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--ff-border);
          background: #fff;
          padding: 0 10px;
          border-radius: var(--ff-radius);
          height: 38px;
        }
        .in2 {
          width: 100%;
          height: 38px;
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          padding: 0 10px;
          font-size: 13px;
          outline: none;
          background: #fff;
        }
        .ff-btnSmall {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--ff-border);
          background: #fff;
          border-radius: var(--ff-radius);
          height: 34px;
          padding: 0 10px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
          text-decoration: none;
          color: var(--ff-text);
          white-space: nowrap;
        }
        .ff-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(31, 122, 58, 0.35);
          background: var(--ff-green);
          color: #fff;
          border-radius: var(--ff-radius);
          height: 36px;
          padding: 0 12px;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
        }
        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          padding: 10px;
          border-radius: var(--ff-radius);
          font-size: 12px;
          font-weight: 800;
        }
      `}</style>
    </AdminLayout>
  );
}