// src/components/ClientLayout.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUILang } from "../lib/uiLanguage";
import { Package, Globe, ChevronDown, LogOut, UserCircle2 } from "lucide-react";

const LOGO_SRC = "/brand/freshfood-logo.svg";

type Me = { email: string | null; role: string | null };

async function getTokenOrRedirect() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = "/login";
    return null;
  }
  return token;
}

export function ClientLayout({
  title,
  subtitle,
  children,
  wide = true, // ✅ cliente por defecto "wide"
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();
  const { lang, toggle } = useUILang();

  const [me, setMe] = useState<Me>({ email: null, role: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const nav = useMemo(
    () => [
      {
        href: "/shipments",
        label: lang === "es" ? "Embarques" : "Shipments",
        icon: Package,
      },
    ],
    [lang]
  );

  // Cierra menú al click afuera
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as any)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Cierra menú al cambiar de ruta
  useEffect(() => {
    const onRoute = () => setMenuOpen(false);
    router.events?.on("routeChangeStart", onRoute);
    return () => router.events?.off("routeChangeStart", onRoute);
  }, [router.events]);

  // Carga perfil (email/role)
  useEffect(() => {
    (async () => {
      const token = await getTokenOrRedirect();
      if (!token) return;

      const res = await fetch("/.netlify/functions/getMyProfile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const json = await res.json();
      setMe({ email: json.email ?? null, role: json.role ?? null });
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  // pathname en Next para /shipments/[id] viene como "/shipments/[id]"
  const activePath = router.pathname;

  return (
    <div className="ff-app">
      {/* Header */}
      <header className="ff-top">
        <div className="ff-top__inner">
          <div className="ff-top__left">
            <img src={LOGO_SRC} alt="Fresh Food Panamá" className="ff-top__logo" />
            <div className="ff-top__titleWrap">
              {title ? <h1 className="ff-top__title">{title}</h1> : null}
              {subtitle ? <div className="ff-top__sub">{subtitle}</div> : null}
            </div>
          </div>

          <div className="ff-top__right">
            {/* Toggle ES/EN */}
            <button
              type="button"
              className="ff-chip"
              onClick={toggle}
              title={lang === "es" ? "Cambiar a English" : "Switch to Español"}
            >
              <Globe size={14} />
              <span>{lang.toUpperCase()}</span>
            </button>

            {/* User dropdown */}
            <div className="ff-user" ref={menuRef}>
              <button
                type="button"
                className="ff-user__btn"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <UserCircle2 size={16} />
                <span className="ff-user__email">
                  {me.email ?? (lang === "es" ? "Usuario" : "User")}
                </span>
                <ChevronDown size={14} />
              </button>

              {menuOpen ? (
                <div className="ff-user__menu">
                  <div>
                    <div className="ff-user__metaEmail">{me.email ?? "-"}</div>
                    <div className="ff-user__metaRole">
                      {lang === "es" ? "Rol" : "Role"}: <b>{String(me.role ?? "-")}</b>
                    </div>
                  </div>

                  <div className="ff-user__sep" />

                  <button
                    type="button"
                    className="ff-user__item"
                    onClick={() => router.push("/profile")}
                  >
                    <UserCircle2 size={16} />
                    <span>{lang === "es" ? "Perfil" : "Profile"}</span>
                  </button>

                  <button type="button" className="ff-user__item danger" onClick={logout}>
                    <LogOut size={16} />
                    <span>{lang === "es" ? "Cerrar sesión" : "Logout"}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="ff-side">
        <nav className="ff-side__nav">
          {nav.map((n) => {
            const Icon = n.icon;

            // ✅ Activo también para rutas hijas (ej: /shipments/[id])
            const active =
              activePath === n.href ||
              activePath.startsWith(`${n.href}/`) ||
              activePath === "/shipments/[id]";

            return (
              <Link
                key={n.href}
                href={n.href}
                className={`ff-side__item ${active ? "is-active" : ""}`}
              >
                <Icon size={16} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ff-side__foot">
          <div className="ff-side__footBadge">
            <span className="ff-dot" />
            <span className="ff-side__footText">
              {lang === "es" ? "Conectado" : "Connected"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="ff-main">
        <main className={`ff-content ${wide ? "ff-content--wide" : ""}`}>{children}</main>
      </div>
    </div>
  );
}