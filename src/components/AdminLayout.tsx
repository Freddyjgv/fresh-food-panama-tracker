import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUILang } from "../lib/uiLanguage";
import {
  LayoutGrid, Package, Users, Globe, ChevronDown, LogOut, 
  UserCircle2, FileText, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle
} from "lucide-react";

const LOGO_SRC = "/brand/freshfood-logo.svg";
const LS_KEY = "ff_admin_sidebar_collapsed";

// --- SISTEMA DE TOASTS (NOTIFICACIONES) ---
export let notify: (msg: string, type?: 'success' | 'error') => void = () => {};

export function AdminLayout({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode; }) {
  const router = useRouter();
  const { lang, toggle } = useUILang();
  const [me, setMe] = useState<{ email: string | null; role: string | null }>({ email: null, role: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Configurar la función global de notificación
  notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const nav = useMemo(() => [
    { href: "/admin", label: lang === "es" ? "Dashboard" : "Dashboard", icon: LayoutGrid },
    { href: "/admin/shipments", label: lang === "es" ? "Embarques" : "Shipments", icon: Package },
    { href: "/admin/quotes", label: lang === "es" ? "Cotizaciones" : "Quotes", icon: FileText },
    { href: "/admin/users", label: lang === "es" ? "Clientes" : "Clients", icon: Users },
  ], [lang]);

  useEffect(() => {
    try { const raw = window.localStorage.getItem(LS_KEY); if (raw === "1") setSideCollapsed(true); } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(LS_KEY, sideCollapsed ? "1" : "0"); } catch {}
  }, [sideCollapsed]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as any)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) { router.push("/login"); return; }
      const res = await fetch("/.netlify/functions/getMyProfile", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setMe({ email: json.email ?? null, role: json.role ?? null });
      }
    })();
  }, []);

  const logout = async () => { await supabase.auth.signOut(); router.push("/login"); };

  return (
    <div className={`ff-app ${sideCollapsed ? "is-collapsed" : ""}`}>
      {/* TOAST OVERLAY */}
      {toast && (
        <div className={`ff-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
          <span>{toast.msg}</span>
        </div>
      )}

      <header className="ff-top">
        <div className="ff-top__inner">
          <div className="ff-top__left">
            <img src={LOGO_SRC} alt="FF" className="ff-top__logo" />
            <div className="ff-top__titleWrap">
              {title && <h1 className="ff-top__title">{title}</h1>}
              {subtitle && <div className="ff-top__sub">{subtitle}</div>}
            </div>
          </div>
          <div className="ff-top__right">
            <button type="button" className="ff-chip" onClick={toggle}>
              <Globe size={14} /> <span>{lang.toUpperCase()}</span>
            </button>
            <div className="ff-user" ref={menuRef}>
              <button type="button" className="ff-user__btn" onClick={() => setMenuOpen(!menuOpen)}>
                <UserCircle2 size={16} />
                <span className="ff-user__email">{me.email ?? "Usuario"}</span>
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="ff-user__menu">
                  <div className="ff-user__meta">
                    <div className="ff-user__metaEmail">{me.email ?? "-"}</div>
                    <div className="ff-user__metaRole">{lang === "es" ? "Rol" : "Role"}: <b>{me.role}</b></div>
                  </div>
                  <div className="ff-user__sep" />
                  <button type="button" className="ff-user__item" onClick={() => router.push("/admin/profile")}>
                    <UserCircle2 size={16} /> <span>Perfil</span>
                  </button>
                  <button type="button" className="ff-user__item danger" onClick={logout}>
                    <LogOut size={16} /> <span>{lang === "es" ? "Cerrar sesión" : "Logout"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside className="ff-side">
        <button type="button" className="ff-side__toggle" onClick={() => setSideCollapsed(!sideCollapsed)}>
          {sideCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <nav className="ff-side__nav">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = router.pathname === n.href || (n.href !== "/admin" && router.pathname.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} className={`ff-side__item ${active ? "is-active" : ""}`}>
                <span className="ff-side__ico"><Icon size={16} /></span>
                <span className="ff-side__lbl">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ff-side__foot">
          <div className="ff-side__footBadge"><span className="ff-dot" /> <span className="ff-side__footText">Online</span></div>
        </div>
      </aside>

      <div className="ff-main"><main className="ff-content">{children}</main></div>

      <style jsx global>{`
        .ff-toast {
          position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
          z-index: 9999; display: flex; align-items: center; gap: 10px;
          padding: 12px 20px; border-radius: 10px; color: white;
          font-weight: 700; font-size: 13px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          animation: slideIn 0.3s ease-out;
        }
        .ff-toast.success { background: #1f7a3a; }
        .ff-toast.error { background: #b91c1c; }
        @keyframes slideIn { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .ff-user__sep { height: 1px; background: #f1f5f9; margin: 8px 0; }
        .ff-user__meta { padding: 10px; font-size: 11px; color: #64748b; }
        .ff-user__metaEmail { font-weight: 800; color: #1e293b; margin-bottom: 2px; }
      `}</style>
    </div>
  );
}