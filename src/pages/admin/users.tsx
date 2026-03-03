import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { requireAdminOrRedirect } from "../../lib/requireAdmin";
import { AdminLayout } from "../../components/AdminLayout";
import { useUILang } from "../../lib/uiLanguage";
import {
  RefreshCcw,
  Users as UsersIcon,
  Building2,
  KeyRound,
  Mail,
  Plus,
  Loader2,
} from "lucide-react";

type Role = "client" | "admin" | "superadmin";
type Client = { id: string; name: string; contact_email: string; created_at?: string };

async function getTokenOrRedirect() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = "/login";
    return null;
  }
  return token;
}

export default function AdminUsersPage() {
  const { lang } = useUILang();

  const [meRole, setMeRole] = useState<Role>("client");
  const [meEmail, setMeEmail] = useState<string | null>(null);

  const [tab, setTab] = useState<"clients" | "users">("clients");

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsBusy, setClientsBusy] = useState(false);

  // Crear cliente+usuario (form)
  const [cEmail, setCEmail] = useState("");
  const [cName, setCName] = useState("");
  const [cContactName, setCContactName] = useState("");
  const [clientInvite, setClientInvite] = useState(true);
  const [clientPassword, setClientPassword] = useState("");
  const [clientBusy, setClientBusy] = useState(false);
  const [clientMsg, setClientMsg] = useState<string | null>(null);

  // Crear usuario (admins/superadmins)
  const [uEmail, setUEmail] = useState("");
  const [uRole, setURole] = useState<Role>("client");
  const [invite, setInvite] = useState(true);
  const [password, setPassword] = useState("");
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // list users (solo superadmin)
  const [users, setUsers] = useState<any[]>([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const canListUsers = meRole === "superadmin";

  useEffect(() => {
    (async () => {
      const r = await requireAdminOrRedirect();
      if (!r.ok) return;

      await loadMe();
      await loadClients(true);
      setClientsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMe() {
    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/.netlify/functions/getMyProfile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      await supabase.auth.signOut();
      window.location.href = "/login";
      return;
    }

    const me = await res.json(); // { email, role, client_id }
    const r = String(me.role || "").trim().toLowerCase() as Role;

    setMeEmail(me.email || null);
    const normalized: Role = (["client", "admin", "superadmin"].includes(r) ? r : "client") as Role;
    setMeRole(normalized);

    // admin no puede crear admins/superadmins
    if (normalized === "admin") setURole("client");
  }

  async function loadClients(initial = false) {
    if (!initial) setClientsBusy(true);
    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/.netlify/functions/listClients", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (!initial) setClientsBusy(false);
      return;
    }

    const json = await res.json();
    const items = (json.items || []) as Client[];
    setClients(items);

    if (items.length && !selectedClientId) setSelectedClientId(items[0].id);
    if (!initial) setClientsBusy(false);
  }

  async function loadUsers() {
    setUsersBusy(true);
    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/.netlify/functions/listUsers", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setUsersBusy(false);
      return;
    }

    const json = await res.json();
    setUsers(json.items || []);
    setUsersBusy(false);
  }

  useEffect(() => {
    if (canListUsers) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canListUsers]);

  const roleOptions = useMemo(() => {
    if (meRole === "superadmin") return ["client", "admin", "superadmin"] as Role[];
    return ["client"] as Role[];
  }, [meRole]);

  // ======================
  // Crear CLIENTE + USUARIO (SIEMPRE) usando createUser (singular)
  // ======================
  async function onCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setClientBusy(true);
    setClientMsg(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const email = cEmail.trim().toLowerCase();
    const name = cName.trim() || null;
    const contact_name = cContactName.trim() || null;

    if (!email) {
      setClientBusy(false);
      setClientMsg(lang === "es" ? "Email requerido." : "Email is required.");
      return;
    }

    // ✅ OJO: tu Netlify createUser (cliente+usuario) espera contact_email, name, contact_name, invite, password...
    const payload: any = {
      contact_email: email,
      name: name || email,
      contact_name,
      user_email: email, // login por defecto
      invite: clientInvite,
    };

    if (!clientInvite) {
      if (!clientPassword.trim()) {
        setClientBusy(false);
        setClientMsg(lang === "es"
          ? "Debes definir una contraseña o activar 'Enviar invitación'."
          : "Set a password or enable 'Send invite'."
        );
        return;
      }
      payload.password = clientPassword;
    }

    const res = await fetch("/.netlify/functions/createUser", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    const t = await res.text();
    setClientBusy(false);

    if (!res.ok) {
      setClientMsg(t || (lang === "es" ? "No se pudo crear el cliente/usuario" : "Could not create client/user"));
      return;
    }

    setClientMsg(lang === "es" ? "✅ Cliente + usuario creado." : "✅ Client + user created.");

    // limpia
    setCEmail("");
    setCName("");
    setCContactName("");
    setClientPassword("");
    setClientInvite(true);

    await loadClients(false);
    if (meRole === "superadmin") await loadUsers();
  }

  // ======================
  // Crear USUARIO (admins/superadmin) usando createUser (singular)
  // ======================
  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const payload: any = {
      email: uEmail.trim().toLowerCase(),
      role: uRole,
      invite,
    };

    if (!invite) payload.password = password;

    if (uRole === "client") {
      if (clientMode === "existing") {
        if (!selectedClientId) {
          setMsg(lang === "es" ? "Selecciona un cliente existente" : "Select an existing client");
          setBusy(false);
          return;
        }
        payload.clientId = selectedClientId;
      } else {
        if (!newClientEmail.trim()) {
          setMsg(lang === "es" ? "Ingresa el email del nuevo cliente" : "Enter new client email");
          setBusy(false);
          return;
        }
        payload.newClientEmail = newClientEmail.trim().toLowerCase();
        payload.newClientName = newClientName.trim() || null;
      }
    }

    const res = await fetch("/.netlify/functions/createUser", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    const t = await res.text();
    setBusy(false);

    if (!res.ok) {
      setMsg(t || (lang === "es" ? "No se pudo crear usuario" : "Could not create user"));
      return;
    }

    setMsg(lang === "es" ? "✅ Usuario creado." : "✅ User created.");
    setUEmail("");
    setPassword("");
    setNewClientEmail("");
    setNewClientName("");

    await loadClients(false);
    if (meRole === "superadmin") await loadUsers();
  }

  if (clientsLoading) {
    return (
      <AdminLayout title={lang === "es" ? "Clientes" : "Clients"} subtitle={lang === "es" ? "Cargando…" : "Loading…"}>
        <div className="ff-card2">
          <div className="ff-row2">
            <Loader2 className="spin" size={16} />
            <span>{lang === "es" ? "Cargando…" : "Loading…"}</span>
          </div>
        </div>
        <style jsx>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={lang === "es" ? "Usuarios y clientes" : "Users & Clients"}
      subtitle={
        lang === "es"
          ? `Conectado: ${meEmail ?? "-"} · Rol: ${meRole}`
          : `Signed in: ${meEmail ?? "-"} · Role: ${meRole}`
      }
    >
      {/* Tabs + actions */}
      <div className="ff-card2" style={{ padding: 10 }}>
        <div className="ff-spread2" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="ff-row2" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`ff-btnSmall ${tab === "clients" ? "is-on" : ""}`}
              onClick={() => setTab("clients")}
            >
              <Building2 size={16} />
              {lang === "es" ? "Clientes" : "Clients"}
            </button>

            <button
              type="button"
              className={`ff-btnSmall ${tab === "users" ? "is-on" : ""}`}
              onClick={() => setTab("users")}
            >
              <UsersIcon size={16} />
              {lang === "es" ? "Usuarios" : "Users"}
            </button>

            <Link className="ff-btnSmall" href="/admin/shipments">
              {lang === "es" ? "Embarques" : "Shipments"}
            </Link>
          </div>

          <div className="ff-row2" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              className="ff-btnSmall"
              type="button"
              onClick={() => loadClients(false)}
              disabled={clientsBusy}
              title={lang === "es" ? "Refrescar clientes" : "Refresh clients"}
            >
              <RefreshCcw size={16} />
              {clientsBusy ? (lang === "es" ? "Actualizando…" : "Refreshing…") : (lang === "es" ? "Refrescar" : "Refresh")}
            </button>

            {meRole === "superadmin" ? (
              <button
                className="ff-btnSmall"
                type="button"
                onClick={loadUsers}
                disabled={usersBusy}
                title={lang === "es" ? "Refrescar usuarios" : "Refresh users"}
              >
                <RefreshCcw size={16} />
                {usersBusy ? (lang === "es" ? "Actualizando…" : "Refreshing…") : (lang === "es" ? "Usuarios" : "Users")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {/* TAB CLIENTES */}
      {tab === "clients" ? (
        <div className="grid2">
          {/* Create client */}
          <div className="ff-card2">
            <div className="ff-spread2">
              <div>
                <div className="h2x">{lang === "es" ? "Crear cliente + usuario" : "Create client + user"}</div>
                <div className="subx">
                  {lang === "es"
                    ? "Esto crea el cliente y su acceso (login)."
                    : "This creates the client and their login access."}
                </div>
              </div>

              <div className="pill">
                <Plus size={16} />
                {lang === "es" ? "Nuevo" : "New"}
              </div>
            </div>

            <div className="sep" />

            <form onSubmit={onCreateClient} className="form2">
              <div className="row3">
                <div className="inputIcon">
                  <Mail size={16} />
                  <input
                    className="in2"
                    placeholder={lang === "es" ? "Email (login) *" : "Email (login) *"}
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    type="email"
                    required
                  />
                </div>

                <input
                  className="in2"
                  placeholder={lang === "es" ? "Nombre comercial / Razón social" : "Company name"}
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                />

                <input
                  className="in2"
                  placeholder={lang === "es" ? "Nombre de contacto (opcional)" : "Contact name (optional)"}
                  value={cContactName}
                  onChange={(e) => setCContactName(e.target.value)}
                />
              </div>

              <div className="ff-card2" style={{ padding: 10, background: "rgba(15,23,42,.02)" }}>
                <div className="ff-spread2" style={{ alignItems: "center" }}>
                  <label className="ff-row2" style={{ gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={clientInvite}
                      onChange={(e) => setClientInvite(e.target.checked)}
                    />
                    <span className="subx">
                      {lang === "es"
                        ? "Enviar invitación (recomendado)"
                        : "Send invite (recommended)"}
                    </span>
                  </label>

                  <div className="subx">
                    {lang === "es"
                      ? "Seguridad: el cliente define su clave"
                      : "Security: client sets password"}
                  </div>
                </div>

                {!clientInvite ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="inputIcon">
                      <KeyRound size={16} />
                      <input
                        className="in2"
                        placeholder={lang === "es" ? "Contraseña temporal *" : "Temporary password *"}
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        type="password"
                        required
                      />
                    </div>
                    <div className="subx" style={{ marginTop: 6 }}>
                      {lang === "es"
                        ? "Recomendado: que la cambie al iniciar."
                        : "Recommended: change it on first login."}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="ff-spread2">
                <div className="subx">
                  {lang === "es"
                    ? "Endpoint: /.netlify/functions/createUser"
                    : "Endpoint: /.netlify/functions/createUser"}
                </div>

                <button className="ff-primary" disabled={clientBusy}>
                  {clientBusy ? (lang === "es" ? "Creando…" : "Creating…") : (lang === "es" ? "Crear" : "Create")}
                </button>
              </div>

              {clientMsg ? <div className="msg">{clientMsg}</div> : null}
            </form>
          </div>

          {/* Clients table */}
          <div className="ff-card2">
            <div className="ff-spread2">
              <div>
                <div className="h2x">{lang === "es" ? "Clientes" : "Clients"} <span className="count">({clients.length})</span></div>
                <div className="subx">{lang === "es" ? "Listado compacto" : "Compact list"}</div>
              </div>
            </div>

            <div className="sep" />

            {clients.length ? (
              <div className="tableWrap">
                <table className="t2">
                  <thead>
                    <tr>
                      <th>{lang === "es" ? "Nombre" : "Name"}</th>
                      <th>{lang === "es" ? "Email" : "Email"}</th>
                      <th style={{ width: 240 }}>{lang === "es" ? "ID" : "ID"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id}>
                        <td className="tdStrong">{c.name}</td>
                        <td className="tdMuted">{c.contact_email}</td>
                        <td className="tdMono">{c.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="subx">{lang === "es" ? "No hay clientes." : "No clients yet."}</div>
            )}
          </div>
        </div>
      ) : null}

      {/* TAB USUARIOS */}
      {tab === "users" ? (
        <div className="grid2">
          <div className="ff-card2">
            <div className="h2x">{lang === "es" ? "Crear usuario" : "Create user"}</div>
            <div className="subx">
              {lang === "es"
                ? "Admin solo crea clientes. Superadmin crea admin/superadmin."
                : "Admin can only create clients. Superadmin can create admin/superadmin."}
            </div>

            <div className="sep" />

            <form onSubmit={onCreateUser} className="form2">
              <div className="row3">
                <input
                  className="in2"
                  placeholder={lang === "es" ? "Email del usuario *" : "User email *"}
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  type="email"
                  required
                />

                <select className="in2" value={uRole} onChange={(e) => setURole(e.target.value as Role)}>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <label className="ff-row2" style={{ gap: 10 }}>
                  <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} />
                  <span className="subx">{lang === "es" ? "Enviar invite" : "Send invite"}</span>
                </label>
              </div>

              {!invite ? (
                <input
                  className="in2"
                  placeholder={lang === "es" ? "Password (si NO invite)" : "Password (no invite)"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              ) : null}

              {uRole === "client" ? (
                <div className="ff-card2" style={{ padding: 10, background: "rgba(15,23,42,.02)" }}>
                  <div className="ff-row2" style={{ flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={`ff-btnSmall ${clientMode === "existing" ? "is-on" : ""}`}
                      onClick={() => setClientMode("existing")}
                    >
                      {lang === "es" ? "Cliente existente" : "Existing client"}
                    </button>

                    <button
                      type="button"
                      className={`ff-btnSmall ${clientMode === "new" ? "is-on" : ""}`}
                      onClick={() => setClientMode("new")}
                    >
                      {lang === "es" ? "Crear cliente rápido" : "Quick new client"}
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    {clientMode === "existing" ? (
                      <select
                        className="in2"
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        required
                      >
                        <option value="">{lang === "es" ? "Selecciona un cliente" : "Select a client"}</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.contact_email}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="row2">
                        <input
                          className="in2"
                          placeholder={lang === "es" ? "Email del cliente" : "Client email"}
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          required
                        />
                        <input
                          className="in2"
                          placeholder={lang === "es" ? "Nombre (opcional)" : "Name (optional)"}
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="ff-spread2">
                <div className="subx">{lang === "es" ? "Endpoint: /.netlify/functions/createUser" : "Endpoint: /.netlify/functions/createUser"}</div>
                <button className="ff-primary" disabled={busy}>
                  {busy ? (lang === "es" ? "Creando…" : "Creating…") : (lang === "es" ? "Crear usuario" : "Create user")}
                </button>
              </div>

              {msg ? <div className="msg">{msg}</div> : null}
            </form>
          </div>

          {meRole === "superadmin" ? (
            <div className="ff-card2">
              <div className="ff-spread2">
                <div>
                  <div className="h2x">{lang === "es" ? "Usuarios" : "Users"} <span className="count">({users.length})</span></div>
                  <div className="subx">{lang === "es" ? "Visible solo para superadmin" : "Only for superadmin"}</div>
                </div>
                <button className="ff-btnSmall" type="button" onClick={loadUsers} disabled={usersBusy}>
                  <RefreshCcw size={16} />
                  {usersBusy ? (lang === "es" ? "Actualizando…" : "Refreshing…") : (lang === "es" ? "Refrescar" : "Refresh")}
                </button>
              </div>

              <div className="sep" />

              {users.length ? (
                <div className="tableWrap">
                  <table className="t2">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>{lang === "es" ? "Rol" : "Role"}</th>
                        <th>client_id</th>
                        <th style={{ width: 180 }}>{lang === "es" ? "Último login" : "Last login"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.user_id}>
                          <td className="tdStrong">{u.email}</td>
                          <td className="tdMuted">{u.role ?? "-"}</td>
                          <td className="tdMono">{u.client_id ?? "-"}</td>
                          <td className="tdMuted">
                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="subx">{lang === "es" ? "No hay usuarios." : "No users."}</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Local styles for compactness without touching your existing ff-btn system */}
      <style jsx>{`
        .grid2{ display:grid; gap:12px; grid-template-columns: 1fr; }
        @media(min-width:1100px){ .grid2{ grid-template-columns: 1.05fr .95fr; } }

        .h2x{ font-weight: 900; font-size: 14px; letter-spacing:-.2px; }
        .subx{ margin-top:4px; color: var(--ff-muted); font-size: 12px; }
        .count{ color: var(--ff-muted); font-weight: 800; }
        .sep{ height:1px; background: var(--ff-border); margin: 12px 0; }

        .form2{ display:grid; gap:12px; }
        .row3{ display:grid; gap:10px; grid-template-columns: 1fr; }
        @media(min-width:900px){ .row3{ grid-template-columns: 1.2fr .9fr .9fr; } }
        .row2{ display:grid; gap:10px; grid-template-columns: 1fr; }
        @media(min-width:900px){ .row2{ grid-template-columns: 1fr 1fr; } }

        .inputIcon{
          display:flex; align-items:center; gap:10px;
          border: 1px solid var(--ff-border);
          background:#fff;
          padding: 0 10px;
          border-radius: var(--ff-radius);
          height: 38px;
        }

        .in2{
          width:100%;
          height:38px;
          border: 1px solid var(--ff-border);
          border-radius: var(--ff-radius);
          padding: 0 10px;
          font-size: 13px;
          outline: none;
          background:#fff;
        }
        .inputIcon .in2{
          border:0; height: 36px; padding:0;
        }

        .ff-btnSmall{
          display:inline-flex;
          align-items:center;
          gap:8px;
          border: 1px solid var(--ff-border);
          background:#fff;
          border-radius: var(--ff-radius);
          height: 34px;
          padding: 0 10px;
          font-weight: 800;
          font-size: 12px;
          cursor:pointer;
          text-decoration:none;
          color: var(--ff-text);
        }
        .ff-btnSmall:hover{ background: rgba(15,23,42,.03); }
        .ff-btnSmall.is-on{
          border-color: rgba(31,122,58,.35);
          background: rgba(31,122,58,.08);
          color: var(--ff-green-dark);
        }

        .ff-primary{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          border: 1px solid rgba(31,122,58,.35);
          background: var(--ff-green);
          color:#fff;
          border-radius: var(--ff-radius);
          height: 36px;
          padding: 0 12px;
          font-weight: 900;
          font-size: 12px;
          cursor:pointer;
        }
        .ff-primary:disabled{ opacity:.6; cursor:not-allowed; }

        .pill{
          display:inline-flex; align-items:center; gap:8px;
          font-size:12px; font-weight:900;
          border: 1px solid rgba(31,122,58,.35);
          color: var(--ff-green-dark);
          background: rgba(31,122,58,.08);
          border-radius: 999px;
          padding: 6px 10px;
        }

        .msg{
          border: 1px solid rgba(31,122,58,.30);
          background: rgba(31,122,58,.08);
          border-radius: var(--ff-radius);
          padding: 10px;
          font-weight: 800;
          font-size: 12px;
        }

        .tableWrap{ overflow:auto; }
        .t2{ width:100%; border-collapse: collapse; font-size: 12px; }
        .t2 th{
          text-align:left;
          color: var(--ff-muted);
          font-weight: 900;
          padding: 10px 8px;
          border-bottom: 1px solid var(--ff-border);
        }
        .t2 td{
          padding: 10px 8px;
          border-bottom: 1px solid var(--ff-border);
          vertical-align: top;
        }
        .tdStrong{ font-weight: 900; }
        .tdMuted{ color: var(--ff-muted); font-weight: 700; }
        .tdMono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; color: var(--ff-muted); }
      `}</style>
    </AdminLayout>
  );
}