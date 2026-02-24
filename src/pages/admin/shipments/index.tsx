import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Filter, PlusCircle, Search, Package2, X, Check, UserPlus, Users, Plus } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { labelStatus } from "../../../lib/shipmentFlow";
import { requireAdminOrRedirect } from "../../../lib/requireAdmin";
import { AdminLayout } from "../../../components/AdminLayout";

type ShipmentListItem = {
  id: string;
  code: string;
  destination: string;
  status: string;
  created_at: string;
  client_name?: string | null;
  product_name?: string | null;
  product_variety?: string | null;
  product_mode?: string | null;
};

type ApiResponse = {
  items: ShipmentListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: { field: string; dir: "asc" | "desc" };
};

type Dir = "asc" | "desc";

type ClientItem = {
  id: string;
  name: string;
  contact_email: string;
  contact_name?: string | null;
  phone?: string | null;
  country?: string | null;
  status?: string | null;
};

type CreateClientMode = "invite" | "manual";

type ProductDef = {
  name: string;
  varieties: string[];
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-PA");
  } catch {
    return iso;
  }
}

function badgeTone(status: string): "neutral" | "success" | "warn" | "info" {
  const s = (status || "").toUpperCase();
  if (["PACKED", "DOCS_READY", "AT_DESTINATION", "DELIVERED", "CLOSED"].includes(s)) return "success";
  if (["AT_ORIGIN", "ARRIVED_PTY", "DEPARTED"].includes(s)) return "warn";
  if (["IN_TRANSIT"].includes(s)) return "info";
  return "neutral";
}

function StatusPill({ status }: { status: string }) {
  const tone = badgeTone(status);

  const style: React.CSSProperties =
    tone === "success"
      ? { background: "rgba(31,122,58,.10)", borderColor: "rgba(31,122,58,.22)", color: "var(--ff-green-dark)" }
      : tone === "warn"
      ? { background: "rgba(209,119,17,.12)", borderColor: "rgba(209,119,17,.24)", color: "#7a3f00" }
      : tone === "info"
      ? { background: "rgba(59,130,246,.10)", borderColor: "rgba(59,130,246,.22)", color: "rgba(30,64,175,1)" }
      : { background: "rgba(15,23,42,.04)", borderColor: "rgba(15,23,42,.12)", color: "var(--ff-text)" };

  return (
    <span
      className="ff-badge"
      style={{
        ...style,
        fontSize: 12,
        fontWeight: 900,
        borderRadius: "999px",
        border: "1px solid",
        padding: "6px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {labelStatus(status)}
    </span>
  );
}

function norm(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export default function AdminShipments() {
  // Gate admin
  const [authOk, setAuthOk] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // Clients
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState("");

  // Client modals
  const [openPickClient, setOpenPickClient] = useState(false);
  const [pickQuery, setPickQuery] = useState("");

  const [openCreateClient, setOpenCreateClient] = useState(false);
  const [ccCompany, setCcCompany] = useState("");
  const [ccContact, setCcContact] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [ccPhone, setCcPhone] = useState("");
  const [ccCountry, setCcCountry] = useState("");
  const [ccMode, setCcMode] = useState<CreateClientMode>("invite");
  const [ccPassword, setCcPassword] = useState("");
  const [ccBusy, setCcBusy] = useState(false);
  const [ccMsg, setCcMsg] = useState<string | null>(null);

  // Products (UI-safe: no editable inputs for name/variety)
  const [products, setProducts] = useState<ProductDef[]>([
    { name: "Piña", varieties: ["MD2 Golden"] },
  ]);
  const [productName, setProductName] = useState("Piña");
  const [productVariety, setProductVariety] = useState("MD2 Golden");
  const [productMode, setProductMode] = useState("Aérea");

  const [openAddProduct, setOpenAddProduct] = useState(false);
  const [openAddVariety, setOpenAddVariety] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newVarietyName, setNewVarietyName] = useState("");

  // List
  const [items, setItems] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [destination, setDestination] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<Dir>("desc");
  const [page, setPage] = useState(1);

  // Create shipment
  const [destNew, setDestNew] = useState("MAD");
  const [boxes, setBoxes] = useState("");
  const [pallets, setPallets] = useState("");
  const [weight, setWeight] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

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
      setAuthChecking(true);
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;
      setAuthOk(true);
      setAuthChecking(false);
    })();
  }, []);

  async function loadClients() {
    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/.netlify/functions/listClients", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return;

    const json = await res.json();
    const list = (json.items || []) as ClientItem[];
    setClients(list);

    if (!selectedClientId && list.length) {
      setSelectedClientId(list[0].id);
    }
  }

  // load clients (authOk)
  useEffect(() => {
    if (!authOk) return;
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOk]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("dir", dir);
    if (destination) p.set("destination", destination);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (q.trim()) p.set("q", q.trim());
    p.set("mode", "admin");
    return p.toString();
  }, [page, dir, destination, from, to, q]);

  async function load() {
    setLoading(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch(`/.netlify/functions/listShipments?${queryString}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      setError(t || "Error cargando embarques");
      setLoading(false);
      return;
    }

    const json = (await res.json()) as ApiResponse;
    setItems(json.items || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!authOk) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authOk, queryString]);

  // Keep variety in-sync when product changes
  useEffect(() => {
    const p = products.find((x) => x.name === productName);
    const vars = p?.varieties || [];
    if (!vars.includes(productVariety)) {
      setProductVariety(vars[0] || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName, products]);

  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId) || null, [clients, selectedClientId]);

  const filteredClients = useMemo(() => {
    const q = norm(pickQuery).toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const hay = `${c.name} ${c.contact_email} ${c.contact_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clients, pickQuery]);

  const currentProduct = useMemo(() => products.find((p) => p.name === productName) || null, [products, productName]);

  async function createShipment(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const body: any = {
      destination: destNew,
      boxes: boxes ? Number(boxes) : null,
      pallets: pallets ? Number(pallets) : null,
      weight_kg: weight ? Number(weight) : null,

      product_name: norm(productName) || null,
      product_variety: norm(productVariety) || null,
      product_mode: norm(productMode) || null,
    };

    if (clientMode === "existing") {
      if (!selectedClientId) {
        setCreateMsg("Selecciona un cliente existente");
        setCreating(false);
        return;
      }
      body.clientId = selectedClientId;
    } else {
      // En el modo nuevo, ahora NO creamos por createShipment, sino por modal createClient
      setCreateMsg("Crea el cliente desde el popup y luego crea el embarque.");
      setCreating(false);
      return;
    }

    const res = await fetch("/.netlify/functions/createShipment", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const t = await res.text().catch(() => "");
    setCreating(false);

    if (!res.ok) {
      setCreateMsg(t || "No se pudo crear el embarque");
      return;
    }

    setCreateMsg(t || "✅ Embarque creado.");
    setBoxes("");
    setPallets("");
    setWeight("");
    setPage(1);

    // defaults
    setProductName("Piña");
    setProductVariety("MD2 Golden");
    setProductMode("Aérea");

    load();
  }

  async function submitCreateClient() {
    setCcMsg(null);

    const company = norm(ccCompany);
    const contact = norm(ccContact);
    const email = normEmail(ccEmail);
    const phone = norm(ccPhone);
    const country = norm(ccCountry);
    const password = norm(ccPassword);

    if (!company) return setCcMsg("Falta: nombre de la empresa");
    if (!contact) return setCcMsg("Falta: nombre del contacto");
    if (!email) return setCcMsg("Falta: email");
    if (!phone) return setCcMsg("Falta: teléfono");
    if (!country) return setCcMsg("Falta: país");
    if (ccMode === "manual" && !password) return setCcMsg("Para password manual, debes indicar el password");

    setCcBusy(true);
    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/.netlify/functions/createClient", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        company_name: company,
        contact_name: contact,
        contact_email: email,
        phone,
        country,
        mode: ccMode,
        password: ccMode === "manual" ? password : undefined,
      }),
    });

    const payloadText = await res.text().catch(() => "");
    setCcBusy(false);

    if (!res.ok) {
      setCcMsg(payloadText || "No se pudo crear el cliente");
      return;
    }

    // intentar parsear JSON
    let createdClientId: string | null = null;
    try {
      const js = JSON.parse(payloadText);
      createdClientId = js?.client_id || null;
    } catch {
      // ignore
    }

    await loadClients();

    if (createdClientId) {
      setSelectedClientId(createdClientId);
      setClientMode("existing");
    }

    // limpiar modal
    setCcCompany("");
    setCcContact("");
    setCcEmail("");
    setCcPhone("");
    setCcCountry("");
    setCcPassword("");
    setCcMode("invite");
    setCcMsg("✅ Cliente creado.");
    setTimeout(() => {
      setCcMsg(null);
      setOpenCreateClient(false);
    }, 600);
  }

  function addProduct() {
    const name = norm(newProductName);
    if (!name) return;

    setProducts((prev) => {
      if (prev.some((p) => p.name.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, { name, varieties: ["General"] }];
    });

    setProductName(name);
    setProductVariety("General");

    setNewProductName("");
    setOpenAddProduct(false);
  }

  function addVariety() {
    const v = norm(newVarietyName);
    if (!v) return;

    setProducts((prev) =>
      prev.map((p) => {
        if (p.name !== productName) return p;
        const exists = p.varieties.some((x) => x.toLowerCase() === v.toLowerCase());
        if (exists) return p;
        return { ...p, varieties: [...p.varieties, v] };
      })
    );

    setProductVariety(v);
    setNewVarietyName("");
    setOpenAddVariety(false);
  }

  function closeOnBackdrop(e: React.MouseEvent<HTMLDivElement, MouseEvent>, close: () => void) {
    if (e.target === e.currentTarget) close();
  }

  if (authChecking) {
    return (
      <AdminLayout title="Embarques" subtitle="Verificando acceso…">
        <div className="ff-card2">Cargando…</div>
      </AdminLayout>
    );
  }
  if (!authOk) return null;

  return (
    <AdminLayout title="Embarques" subtitle="Administra hitos, documentos y fotos de cada exportación.">
      {/* Crear embarque */}
      <div className="ff-card2" style={{ padding: 12 }}>
        <div className="ff-spread2">
          <div className="ff-row2" style={{ gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(31,122,58,.22)",
                background: "rgba(31,122,58,.08)",
                borderRadius: "var(--ff-radius)",
              }}
            >
              <PlusCircle size={16} color="var(--ff-green-dark)" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "-.2px" }}>Crear embarque</div>
              <div style={{ marginTop: 2, color: "var(--ff-muted)", fontSize: 12 }}>
                Se crea y queda visible para el cliente con su historial.
              </div>
            </div>
          </div>
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        <form onSubmit={createShipment} style={{ display: "grid", gap: 10 }}>
          {/* Cliente (toggle + modales) */}
          <div className="ff-card2" style={{ padding: 10, background: "rgba(15,23,42,.02)" }}>
            <div className="ff-row2" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className={`ff-btnSmall ${clientMode === "existing" ? "is-on" : ""}`}
                onClick={() => {
                  setClientMode("existing");
                  setPickQuery("");
                  setOpenPickClient(true);
                }}
              >
                <Users size={16} />
                Cliente existente
              </button>

              <button
                type="button"
                className={`ff-btnSmall ${clientMode === "new" ? "is-on" : ""}`}
                onClick={() => {
                  setClientMode("new");
                  setCcMsg(null);
                  setOpenCreateClient(true);
                }}
              >
                <UserPlus size={16} />
                Crear nuevo cliente
              </button>

              <div style={{ flex: "1 1 auto" }} />

              {clientMode === "existing" && selectedClient ? (
                <span className="pillOk" title={selectedClient.contact_email}>
                  <Check size={16} />
                  {selectedClient.name}
                </span>
              ) : null}
            </div>

            <div style={{ marginTop: 10, color: "var(--ff-muted)", fontSize: 12 }}>
              {clientMode === "existing"
                ? "Selecciona el cliente desde el popup para evitar errores."
                : "Crea el cliente desde el popup. Al finalizar, quedará seleccionado automáticamente."}
            </div>
          </div>

          {/* Producto (no editable) */}
          <div className="ff-card2" style={{ padding: 10, background: "rgba(15,23,42,.02)" }}>
            <div className="ff-row2" style={{ gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(15,23,42,.12)",
                  background: "rgba(15,23,42,.03)",
                  borderRadius: "var(--ff-radius)",
                  flex: "0 0 auto",
                }}
                aria-hidden="true"
              >
                <Package2 size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 13, lineHeight: "18px" }}>Producto</div>
                <div style={{ marginTop: 2, color: "var(--ff-muted)", fontSize: 12 }}>
                  Bloqueado para evitar creación accidental. Usa el menú o agrega desde “+”.
                </div>
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="row4">
              <div className="withAdd">
                <select className="in2" value={productName} onChange={(e) => setProductName(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button className="iconBtn" type="button" title="Agregar producto" onClick={() => setOpenAddProduct(true)}>
                  <Plus size={16} />
                </button>
              </div>

              <div className="withAdd">
                <select className="in2" value={productVariety} onChange={(e) => setProductVariety(e.target.value)}>
                  {(currentProduct?.varieties || []).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  className="iconBtn"
                  type="button"
                  title="Agregar variedad"
                  onClick={() => setOpenAddVariety(true)}
                  disabled={!productName}
                >
                  <Plus size={16} />
                </button>
              </div>

              <select className="in2" value={productMode} onChange={(e) => setProductMode(e.target.value)}>
                <option value="Aérea">Aérea</option>
                <option value="Marítima">Marítima</option>
                <option value="Terrestre">Terrestre</option>
              </select>
            </div>
          </div>

          {/* datos */}
          <div className="row3" style={{ gridTemplateColumns: "1fr .9fr .9fr .9fr" }}>
            <select className="in2" value={destNew} onChange={(e) => setDestNew(e.target.value)}>
              <option value="MAD">Madrid (MAD)</option>
              <option value="AMS">Amsterdam (AMS)</option>
              <option value="CDG">Paris (CDG)</option>
            </select>

            <input className="in2" placeholder="Cajas" value={boxes} onChange={(e) => setBoxes(e.target.value)} />
            <input className="in2" placeholder="Pallets" value={pallets} onChange={(e) => setPallets(e.target.value)} />
            <input className="in2" placeholder="Peso (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>

          <div className="ff-spread2">
            <div style={{ color: "var(--ff-muted)", fontSize: 12 }}>
              Tip: deja en blanco cajas/pallets/peso si aún no está confirmado.
            </div>
            <button className="ff-primary" type="submit" disabled={creating || clientMode !== "existing"}>
              {creating ? "Creando…" : "Crear"}
            </button>
          </div>

          {clientMode !== "existing" ? (
            <div className="msg" style={{ borderColor: "rgba(209,119,17,.35)", background: "rgba(209,119,17,.08)" }}>
              Primero crea el cliente desde el popup. Luego podrás crear el embarque.
            </div>
          ) : null}

          {createMsg ? (
            <div
              className="msg"
              style={{
                borderColor: createMsg.toLowerCase().includes("error") ? "rgba(209,119,17,.35)" : "rgba(31,122,58,.30)",
                background: createMsg.toLowerCase().includes("error") ? "rgba(209,119,17,.08)" : "rgba(31,122,58,.08)",
              }}
            >
              {createMsg}
            </div>
          ) : null}
        </form>
      </div>

      <div style={{ height: 12 }} />

      {/* Filtros */}
      <div className="ff-card2" style={{ padding: 12 }}>
        <div className="ff-row2" style={{ gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(15,23,42,.12)",
              background: "rgba(15,23,42,.03)",
              borderRadius: "var(--ff-radius)",
            }}
          >
            <Filter size={16} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "-.2px" }}>Filtros</div>
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        <div className="row3" style={{ gridTemplateColumns: ".7fr .8fr .8fr 1.2fr auto auto" }}>
          <select className="in2" value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">Todos</option>
            <option value="MAD">MAD</option>
            <option value="AMS">AMS</option>
            <option value="CDG">CDG</option>
          </select>

          <input className="in2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="in2" type="date" value={to} onChange={(e) => setTo(e.target.value)} />

          <div className="inputIcon">
            <Search size={16} />
            <input
              className="in2"
              style={{ border: 0, height: 36, padding: 0 }}
              placeholder="Buscar por # embarque…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <button
            className="ff-btnSmall"
            type="button"
            onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
            title="Ordenar por fecha"
          >
            <ArrowUpDown size={16} />
            Fecha {dir === "desc" ? "↓" : "↑"}
          </button>

          <button className="ff-primary" type="button" onClick={() => setPage(1)}>
            Aplicar
          </button>
        </div>

        <div style={{ marginTop: 8, color: "var(--ff-muted)", fontSize: 12 }}>
          Tip: para búsqueda rápida, escribe parte del código y presiona “Aplicar”.
        </div>
      </div>

      <div style={{ height: 12 }} />

      {/* Listado */}
      <div className="ff-card2" style={{ padding: 12 }}>
        <div className="ff-spread2">
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "-.2px" }}>
              Listado
              <span style={{ marginLeft: 8, color: "var(--ff-muted)", fontWeight: 800 }}>({items.length})</span>
            </div>
            <div style={{ marginTop: 2, color: "var(--ff-muted)", fontSize: 12 }}>
              Vista compacta, consistente con todo el panel.
            </div>
          </div>

          <Link className="ff-btnSmall" href="/admin/users">
            Clientes
          </Link>
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        {loading ? <div style={{ color: "var(--ff-muted)", fontSize: 12 }}>Cargando…</div> : null}

        {!loading && error ? (
          <div className="msg" style={{ borderColor: "rgba(209,119,17,.35)", background: "rgba(209,119,17,.08)" }}>
            <b style={{ display: "block", marginBottom: 4 }}>No se pudo cargar</b>
            <span style={{ color: "var(--ff-muted)" }}>{error}</span>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div style={{ color: "var(--ff-muted)", fontSize: 12 }}>No hay embarques.</div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((s) => (
              <Link
                key={s.id}
                href={`/admin/shipments/${s.id}`}
                className="ff-row2"
                style={{
                  padding: "10px 10px",
                  border: "1px solid var(--ff-border)",
                  background: "var(--ff-surface)",
                  borderRadius: "var(--ff-radius)",
                  textDecoration: "none",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, lineHeight: "18px" }}>
                    {s.code}
                    {s.client_name ? (
                      <span style={{ marginLeft: 8, color: "var(--ff-muted)", fontWeight: 800 }}>· {s.client_name}</span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 2, color: "var(--ff-muted)", fontSize: 12 }}>
                    Destino: <b>{s.destination}</b> · Creado: {fmtDate(s.created_at)}
                  </div>
                </div>

                <StatusPill status={s.status} />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {/* ===== MODALS ===== */}

      {/* Modal: Pick existing client */}
      {openPickClient ? (
        <div className="overlay" onMouseDown={(e) => closeOnBackdrop(e, () => setOpenPickClient(false))}>
          <div className="modal">
            <div className="modalHead">
              <div style={{ minWidth: 0 }}>
                <div className="modalTitle">Seleccionar cliente</div>
                <div className="modalSub">Busca por empresa, email o contacto. Click para asignar.</div>
              </div>
              <button className="iconBtn2" type="button" onClick={() => setOpenPickClient(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="inputIcon" style={{ height: 40 }}>
              <Search size={16} />
              <input
                className="in2"
                style={{ border: 0, height: 38, padding: 0 }}
                placeholder="Buscar cliente…"
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ height: 10 }} />

            <div className="listBox">
              {filteredClients.length ? (
                filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pickRow ${c.id === selectedClientId ? "is-on" : ""}`}
                    onClick={() => {
                      setSelectedClientId(c.id);
                      setOpenPickClient(false);
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="pickTitle">
                        {c.name}
                        {c.status && c.status !== "active" ? (
                          <span className="tinyWarn" style={{ marginLeft: 8 }}>
                            {c.status}
                          </span>
                        ) : null}
                      </div>
                      <div className="pickMeta">
                        {c.contact_email}
                        {c.contact_name ? ` · ${c.contact_name}` : ""}
                      </div>
                    </div>

                    {c.id === selectedClientId ? (
                      <span className="tinyOk">
                        <Check size={14} /> Asignado
                      </span>
                    ) : (
                      <span className="tinyBtn">Seleccionar</span>
                    )}
                  </button>
                ))
              ) : (
                <div className="muted" style={{ padding: 10 }}>
                  No hay resultados.
                </div>
              )}
            </div>

            <div className="modalFoot">
              <button className="btnSmall" type="button" onClick={() => setOpenPickClient(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Create client */}
      {openCreateClient ? (
        <div className="overlay" onMouseDown={(e) => closeOnBackdrop(e, () => setOpenCreateClient(false))}>
          <div className="modal">
            <div className="modalHead">
              <div style={{ minWidth: 0 }}>
                <div className="modalTitle">Crear nuevo cliente</div>
                <div className="modalSub">Campos obligatorios: empresa, contacto, email, teléfono, país.</div>
              </div>
              <button className="iconBtn2" type="button" onClick={() => setOpenCreateClient(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="row2">
              <div>
                <label className="lbl">Empresa *</label>
                <input className="in2" value={ccCompany} onChange={(e) => setCcCompany(e.target.value)} placeholder="Ej: ACME Trading" />
              </div>
              <div>
                <label className="lbl">Contacto *</label>
                <input className="in2" value={ccContact} onChange={(e) => setCcContact(e.target.value)} placeholder="Ej: Juan Pérez" />
              </div>
            </div>

            <div className="row2" style={{ marginTop: 10 }}>
              <div>
                <label className="lbl">Email *</label>
                <input className="in2" value={ccEmail} onChange={(e) => setCcEmail(e.target.value)} placeholder="correo@empresa.com" />
              </div>
              <div>
                <label className="lbl">Teléfono *</label>
                <input className="in2" value={ccPhone} onChange={(e) => setCcPhone(e.target.value)} placeholder="+507 6xxx-xxxx" />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="lbl">País *</label>
              <input className="in2" value={ccCountry} onChange={(e) => setCcCountry(e.target.value)} placeholder="Panamá" />
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <div className="ff-row2" style={{ justifyContent: "space-between" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>Acceso</div>
                <div className="muted">Invitar por email o asignar password manual.</div>
              </div>

              <div className="ff-row2" style={{ gap: 8 }}>
                <button
                  type="button"
                  className={`ff-btnSmall ${ccMode === "invite" ? "is-on" : ""}`}
                  onClick={() => setCcMode("invite")}
                >
                  Invitar
                </button>
                <button
                  type="button"
                  className={`ff-btnSmall ${ccMode === "manual" ? "is-on" : ""}`}
                  onClick={() => setCcMode("manual")}
                >
                  Password manual
                </button>
              </div>
            </div>

            {ccMode === "manual" ? (
              <div style={{ marginTop: 10 }}>
                <label className="lbl">Password *</label>
                <input
                  className="in2"
                  value={ccPassword}
                  onChange={(e) => setCcPassword(e.target.value)}
                  placeholder="Mínimo recomendado: 8+ caracteres"
                />
              </div>
            ) : null}

            {ccMsg ? (
              <div
                className="msg"
                style={{
                  marginTop: 12,
                  borderColor: ccMsg.toLowerCase().includes("✅") ? "rgba(31,122,58,.30)" : "rgba(209,119,17,.35)",
                  background: ccMsg.toLowerCase().includes("✅") ? "rgba(31,122,58,.08)" : "rgba(209,119,17,.08)",
                }}
              >
                {ccMsg}
              </div>
            ) : null}

            <div className="modalFoot">
              <button className="btnSmall" type="button" onClick={() => setOpenCreateClient(false)} disabled={ccBusy}>
                Cancelar
              </button>
              <button className="ff-primary" type="button" onClick={submitCreateClient} disabled={ccBusy}>
                {ccBusy ? "Guardando…" : "Crear cliente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Add product */}
      {openAddProduct ? (
        <div className="overlay" onMouseDown={(e) => closeOnBackdrop(e, () => setOpenAddProduct(false))}>
          <div className="modal small">
            <div className="modalHead">
              <div style={{ minWidth: 0 }}>
                <div className="modalTitle">Agregar producto</div>
                <div className="modalSub">Esto agrega a la lista del UI (no DB) para evitar romper nada.</div>
              </div>
              <button className="iconBtn2" type="button" onClick={() => setOpenAddProduct(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <label className="lbl">Nombre *</label>
            <input className="in2" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Ej: Piña" />

            <div className="modalFoot">
              <button className="btnSmall" type="button" onClick={() => setOpenAddProduct(false)}>
                Cancelar
              </button>
              <button className="ff-primary" type="button" onClick={addProduct}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Add variety */}
      {openAddVariety ? (
        <div className="overlay" onMouseDown={(e) => closeOnBackdrop(e, () => setOpenAddVariety(false))}>
          <div className="modal small">
            <div className="modalHead">
              <div style={{ minWidth: 0 }}>
                <div className="modalTitle">Agregar variedad</div>
                <div className="modalSub">Se agrega a la lista del producto seleccionado (UI only).</div>
              </div>
              <button className="iconBtn2" type="button" onClick={() => setOpenAddVariety(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="ff-divider" style={{ margin: "12px 0" }} />

            <label className="lbl">Variedad *</label>
            <input className="in2" value={newVarietyName} onChange={(e) => setNewVarietyName(e.target.value)} placeholder="Ej: MD2 Golden" />

            <div className="modalFoot">
              <button className="btnSmall" type="button" onClick={() => setOpenAddVariety(false)}>
                Cancelar
              </button>
              <button className="ff-primary" type="button" onClick={addVariety}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* styles compact */}
      <style jsx>{`
        .row2 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .row2 {
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

        .row4 {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 900px) {
          .row4 {
            grid-template-columns: 1.1fr 1.1fr 0.8fr;
          }
        }

        .withAdd {
          display: flex;
          gap: 8px;
          align-items: center;
          min-width: 0;
        }

        .iconBtn {
          width: 38px;
          height: 38px;
          border-radius: var(--ff-radius);
          border: 1px solid var(--ff-border);
          background: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 0 0 auto;
        }
        .iconBtn:hover {
          background: rgba(15, 23, 42, 0.03);
        }
        .iconBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
          min-width: 0;
        }
        .in2:focus {
          border-color: rgba(31, 122, 58, 0.4);
          box-shadow: 0 0 0 4px rgba(31, 122, 58, 0.1);
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
        .ff-btnSmall:hover {
          background: rgba(15, 23, 42, 0.03);
        }
        .ff-btnSmall.is-on {
          border-color: rgba(31, 122, 58, 0.35);
          background: rgba(31, 122, 58, 0.08);
          color: var(--ff-green-dark);
        }

        .pillOk {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          background: rgba(31, 122, 58, 0.08);
          border: 1px solid rgba(31, 122, 58, 0.22);
          color: var(--ff-green-dark);
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
        .ff-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .msg {
          border: 1px solid rgba(31, 122, 58, 0.3);
          background: rgba(31, 122, 58, 0.08);
          border-radius: var(--ff-radius);
          padding: 10px;
          font-weight: 800;
          font-size: 12px;
        }

        /* ===== Modal system (no libs) ===== */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 60;
        }
        .modal {
          width: min(860px, 100%);
          background: var(--ff-surface);
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          padding: 12px;
        }
        .modal.small {
          width: min(520px, 100%);
        }
        .modalHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .modalTitle {
          font-weight: 950;
          font-size: 14px;
          letter-spacing: -0.2px;
        }
        .modalSub {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
        }
        .iconBtn2 {
          width: 34px;
          height: 34px;
          border-radius: var(--ff-radius);
          border: 1px solid var(--ff-border);
          background: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 0 0 auto;
        }
        .iconBtn2:hover {
          background: rgba(15, 23, 42, 0.03);
        }
        .modalFoot {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 12px;
        }

        .listBox {
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          background: #fff;
          overflow: hidden;
          max-height: 380px;
          overflow-y: auto;
        }
        .pickRow {
          width: 100%;
          text-align: left;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border: 0;
          background: #fff;
          cursor: pointer;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }
        .pickRow:hover {
          background: rgba(15, 23, 42, 0.02);
        }
        .pickRow.is-on {
          background: rgba(31, 122, 58, 0.06);
        }
        .pickTitle {
          font-weight: 900;
          font-size: 13px;
          line-height: 18px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 620px;
        }
        .pickMeta {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 620px;
        }
        .tinyBtn {
          border: 1px solid var(--ff-border);
          background: #fff;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }
        .tinyOk {
          border: 1px solid rgba(31, 122, 58, 0.22);
          background: rgba(31, 122, 58, 0.08);
          color: var(--ff-green-dark);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .tinyWarn {
          border: 1px solid rgba(209, 119, 17, 0.24);
          background: rgba(209, 119, 17, 0.10);
          color: #7a3f00;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .lbl {
          display: block;
          font-size: 12px;
          font-weight: 900;
          color: var(--ff-muted);
          margin-bottom: 6px;
        }
        .btnSmall {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 10px;
          border-radius: var(--ff-radius);
          border: 1px solid var(--ff-border);
          background: #fff;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          color: var(--ff-text);
          text-decoration: none;
          white-space: nowrap;
        }
        .btnSmall:hover {
          background: rgba(15, 23, 42, 0.03);
        }

        .muted {
          font-size: 12px;
          color: var(--ff-muted);
        }
      `}</style>
    </AdminLayout>
  );
}