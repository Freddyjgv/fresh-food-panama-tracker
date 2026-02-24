import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LogOut, Package, Users } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

type Role = "client" | "admin" | "superadmin" | null;

type Me = {
  email: string | null;
  role: Role;
  client_id: string | null;
};

export function AppHeader({ variant }: { variant: "client" | "admin" }) {
  const [me, setMe] = useState<Me>({ email: null, role: null, client_id: null });
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const isPrivileged = useMemo(() => {
    const r = String(me.role || "").toLowerCase();
    return r === "admin" || r === "superadmin";
  }, [me.role]);

  const roleLabel = useMemo(() => {
    if (me.role === "superadmin") return "Superadmin";
    if (me.role === "admin") return "Admin";
    if (me.role === "client") return "Cliente";
    return "—";
  }, [me.role]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        mounted && setLoading(false);
        return;
      }

      const res = await fetch("/.netlify/functions/whoami", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!mounted) return;

      if (res.ok) {
        const json = await res.json();
        setMe({
          email: json.email ?? null,
          role: json.role ?? null,
          client_id: json.client_id ?? null,
        });
      } else {
        setMe({ email: data.session?.user?.email ?? null, role: null, client_id: null });
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const btnStyle: React.CSSProperties = {
    height: 28,
    padding: "0 10px",
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
  };

  const username = loading ? "…" : me.email?.split("@")[0] ?? "Usuario";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#fff",
        borderBottom: "1px solid var(--ff-border)",
      }}
    >
      <div
        className="ff-shell ff-spread"
        style={{
          height: 64,
          alignItems: "center",
          paddingLeft: 18,
          paddingRight: 18,
          maxWidth: 1480,
        }}
      >
        {/* IZQUIERDA */}
        <div className="ff-row" style={{ gap: 14, alignItems: "center", minWidth: 320 }}>
          {/* Contenedor SIN recorte */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <img
              src="/brand/freshfood-logo.svg"
              alt="Fresh Food Panamá"
              style={{ height: 34, width: "auto", display: "block" }}
              onError={(e) => {
                // fallback visible si la ruta falla
                (e.currentTarget as HTMLImageElement).src = "/brand/freshfood-logo.png";
              }}
            />
          </div>

          <div style={{ display: "grid", lineHeight: 1.1 }}>
            <div style={{ fontWeight: 650, fontSize: 13 }}>
              Fresh Food Panamá Tracker
            </div>
            <div style={{ fontSize: 11, color: "var(--ff-muted)" }}>
              {variant === "admin" ? "Panel administrativo" : "Portal de cliente"}
            </div>
          </div>
        </div>

        {/* DERECHA */}
        <div className="ff-row" style={{ gap: 10, alignItems: "center" }}>
          <Link
            className="ff-btn ff-btn-ghost"
            href={variant === "admin" ? "/admin/shipments" : "/shipments"}
            style={btnStyle}
          >
            <Package size={14} />
            Embarques
          </Link>

          {isPrivileged ? (
            <Link className="ff-btn ff-btn-ghost" href="/admin/users" style={btnStyle}>
              <Users size={14} />
              Usuarios
            </Link>
          ) : null}

          {/* Usuario + dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="ff-btn ff-btn-ghost"
              style={{
                ...btnStyle,
                border: "1px solid var(--ff-border)",
                background: "#fff",
              }}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span style={{ fontWeight: 650 }}>{username}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(16,24,40,.10)",
                  background: "rgba(16,24,40,.04)",
                  color: "var(--ff-muted)",
                  fontWeight: 700,
                }}
              >
                {roleLabel}
              </span>
              <ChevronDown size={14} />
            </button>

            {menuOpen ? (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 36,
                  width: 220,
                  background: "#fff",
                  border: "1px solid var(--ff-border)",
                  borderRadius: 10,
                  boxShadow: "0 8px 22px rgba(16,24,40,.10)",
                  overflow: "hidden",
                }}
              >
                <Link
                  href="/profile"
                  className="ff-btn ff-btn-ghost"
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    borderRadius: 0,
                    height: 40,
                    padding: "0 12px",
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  Ver perfil
                </Link>

                <button
                  type="button"
                  className="ff-btn ff-btn-ghost"
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    borderRadius: 0,
                    height: 40,
                    padding: "0 12px",
                  }}
                  onClick={logout}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}