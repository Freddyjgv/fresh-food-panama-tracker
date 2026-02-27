// src/pages/auth/reset.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Lock, CheckCircle2, AlertTriangle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type ViewState = "checking" | "ready" | "done" | "error";

function isStrongEnough(pw: string) {
  if (!pw) return false;
  const okLen = pw.length >= 8;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  return okLen && hasLetter && hasNumber;
}

function parseHashParams() {
  // Ejemplo: #access_token=...&refresh_token=...&type=recovery
  const h = typeof window !== "undefined" ? window.location.hash : "";
  if (!h || !h.startsWith("#")) return new URLSearchParams();
  return new URLSearchParams(h.slice(1));
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [view, setView] = useState<ViewState>("checking");
  const [msg, setMsg] = useState<string | null>(null);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    if (!pw1 || !pw2) return false;
    if (pw1 !== pw2) return false;
    if (!isStrongEnough(pw1)) return false;
    return true;
  }, [pw1, pw2]);

  useEffect(() => {
    let alive = true;

    function toError(message: string) {
      if (!alive) return;
      setView("error");
      setMsg(message);
    }

    async function ensureRecoverySession() {
      try {
        // 1) Escucha eventos: cuando Supabase detecta PASSWORD_RECOVERY, habilitamos form.
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (!alive) return;
          if (event === "PASSWORD_RECOVERY") {
            setView("ready");
          }
        });

        // 2) Si venimos con tokens en el hash, establecemos sesión explícitamente (rápido y confiable)
        const hp = parseHashParams();
        const access_token = hp.get("access_token");
        const refresh_token = hp.get("refresh_token");
        const type = (hp.get("type") || "").toLowerCase();

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            sub.subscription.unsubscribe();
            toError("El enlace de restablecimiento no es válido o ya expiró. Solicita uno nuevo.");
            return;
          }

          // Limpia el hash para evitar re-procesos/ruido al recargar
          if (typeof window !== "undefined" && window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          }
        }

        // 3) Confirmamos si ya hay sesión (sin redirigir)
        //    *Importante*: NO fallar de inmediato; damos una ventana corta.
        const started = Date.now();
        const maxWaitMs = 1800;

        while (alive && Date.now() - started < maxWaitMs) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            if (!alive) break;
            setView("ready");
            sub.subscription.unsubscribe();
            return;
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        // 4) Si no hay sesión, mostramos error útil (sin mandar a login).
        sub.subscription.unsubscribe();

        if (type === "recovery") {
          toError("El enlace de restablecimiento no es válido o ya expiró. Solicita uno nuevo.");
        } else {
          toError("No detectamos un enlace de recuperación válido. Solicita un restablecimiento de contraseña.");
        }
      } catch {
        toError("No pudimos procesar el restablecimiento. Intenta solicitar el enlace nuevamente.");
      }
    }

    ensureRecoverySession();

    return () => {
      alive = false;
    };
  }, []);

  async function onSave() {
    if (!canSave || saving) return;

    setSaving(true);
    setMsg(null);

    try {
      // Aquí NO necesitamos validar sesión “a mano” con redirects.
      // Si el enlace era válido, setSession/getSession ya dejó todo listo.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setView("error");
        setMsg("Sesión de restablecimiento inválida o expirada. Solicita un enlace nuevo.");
        setSaving(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) {
        setMsg(error.message || "No se pudo actualizar la contraseña.");
        setSaving(false);
        return;
      }

      setView("done");
      setSaving(false);

      // Opcional: cerrar sesión para forzar login limpio (recomendado)
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/login");
      }, 900);
    } catch {
      setMsg("Ocurrió un error inesperado. Intenta nuevamente.");
      setSaving(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <div className="head">
          <div className="brand">
            <img src="/brand/freshfood-logo.svg" alt="Fresh Food Panamá" className="logo" draggable={false} />
          </div>

          <div className="title">Restablecer contraseña</div>
          <div className="sub">Define una nueva clave para tu cuenta.</div>
        </div>

        <div className="ff-divider" style={{ margin: "12px 0" }} />

        {view === "checking" ? (
          <div className="state">
            <div className="spinner" />
            <div>
              <div className="stateTitle">Validando enlace…</div>
              <div className="stateSub">Esto toma un instante.</div>
            </div>
          </div>
        ) : view === "error" ? (
          <div className="msgWarn">
            <div className="msgRow">
              <AlertTriangle size={16} />
              <b>Error</b>
            </div>
            <div className="msgBody">{msg ?? "No se pudo procesar el restablecimiento."}</div>

            <div style={{ height: 10 }} />

            <div className="actions">
              <Link href="/login" className="btnSecondary">
                <ArrowLeft size={16} />
                Volver a login
              </Link>
            </div>
          </div>
        ) : view === "done" ? (
          <div className="msgOk">
            <div className="msgRow">
              <CheckCircle2 size={16} />
              <b>Contraseña actualizada</b>
            </div>
            <div className="msgBody">Listo. Te llevaremos al login.</div>

            <div style={{ height: 10 }} />

            <div className="actions">
              <Link href="/login" className="btnPrimary">
                Ir al login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid">
              <label className="field">
                <span className="lbl">Nueva contraseña</span>
                <div className="inputWrap">
                  <Lock size={16} />
                  <input
                    type={show1 ? "text" : "password"}
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    placeholder="Mínimo 8 caracteres (letras y números)"
                    autoComplete="new-password"
                  />
                  <button type="button" className="eye" onClick={() => setShow1((v) => !v)} title="Mostrar/ocultar">
                    {show1 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="field">
                <span className="lbl">Confirmar contraseña</span>
                <div className="inputWrap">
                  <Lock size={16} />
                  <input
                    type={show2 ? "text" : "password"}
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    placeholder="Repite la contraseña"
                    autoComplete="new-password"
                  />
                  <button type="button" className="eye" onClick={() => setShow2((v) => !v)} title="Mostrar/ocultar">
                    {show2 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            </div>

            <div className="help">
              <span className={`dot ${isStrongEnough(pw1) ? "ok" : ""}`} />
              <span>
                Reglas: <b>8+</b> caracteres, al menos <b>1 letra</b> y <b>1 número</b>.
              </span>
              {pw1 && pw2 && pw1 !== pw2 ? <span className="bad">Las contraseñas no coinciden.</span> : null}
            </div>

            {msg ? (
              <div className="msgWarn" style={{ marginTop: 10 }}>
                <div className="msgRow">
                  <AlertTriangle size={16} />
                  <b>Atención</b>
                </div>
                <div className="msgBody">{msg}</div>
              </div>
            ) : null}

            <div style={{ height: 12 }} />

            <div className="actions">
              <Link href="/login" className="btnSecondary">
                <ArrowLeft size={16} />
                Cancelar
              </Link>

              <button className="btnPrimary" type="button" onClick={onSave} disabled={!canSave || saving}>
                {saving ? "Guardando…" : "Guardar contraseña"}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px 14px;
          background: #f6f8fb;
        }

        .card {
          width: 100%;
          max-width: 520px;
          background: var(--ff-surface, #fff);
          border: 1px solid var(--ff-border, rgba(15, 23, 42, 0.12));
          border-radius: var(--ff-radius, 14px);
          box-shadow: var(--ff-shadow, 0 10px 26px rgba(2, 6, 23, 0.08));
          padding: 14px;
        }

        .head {
          display: grid;
          gap: 6px;
        }
        .brand {
          display: flex;
          align-items: center;
          justify-content: center;
          padding-top: 4px;
        }
        .logo {
          height: 32px;
          width: auto;
          user-select: none;
        }

        .title {
          text-align: center;
          font-weight: 950;
          letter-spacing: -0.3px;
          font-size: 16px;
        }
        .sub {
          text-align: center;
          font-size: 12px;
          color: var(--ff-muted, rgba(15, 23, 42, 0.6));
        }

        .grid {
          display: grid;
          gap: 10px;
        }

        .field {
          display: grid;
          gap: 6px;
        }
        .lbl {
          font-size: 12px;
          font-weight: 900;
          color: rgba(15, 23, 42, 0.72);
        }

        .inputWrap {
          display: grid;
          grid-template-columns: 18px 1fr 34px;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 12px;
          padding: 10px 10px;
          background: #fff;
        }
        .inputWrap:focus-within {
          border-color: rgba(31, 122, 58, 0.28);
          box-shadow: 0 0 0 4px rgba(31, 122, 58, 0.1);
        }
        input {
          border: 0;
          outline: 0;
          background: transparent;
          font-size: 13px;
          width: 100%;
        }

        .eye {
          border: 0;
          background: transparent;
          height: 30px;
          width: 30px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: rgba(15, 23, 42, 0.6);
        }
        .eye:hover {
          background: rgba(31, 122, 58, 0.06);
          color: rgba(15, 23, 42, 0.75);
        }

        .help {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 12px;
          color: var(--ff-muted, rgba(15, 23, 42, 0.62));
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 99px;
          background: rgba(15, 23, 42, 0.18);
        }
        .dot.ok {
          background: rgba(31, 122, 58, 0.85);
        }
        .bad {
          color: rgba(185, 28, 28, 0.92);
          font-weight: 900;
        }

        .actions {
          display: flex;
          gap: 10px;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .btnPrimary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(31, 122, 58, 0.28);
          background: var(--ff-green, rgba(31, 122, 58, 1));
          color: #fff;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
          text-decoration: none;
        }
        .btnPrimary:hover {
          filter: brightness(0.98);
          box-shadow: 0 10px 22px rgba(2, 6, 23, 0.1);
          transform: translateY(-1px);
        }
        .btnPrimary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btnSecondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #fff;
          color: rgba(15, 23, 42, 0.86);
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
          text-decoration: none;
        }
        .btnSecondary:hover {
          background: rgba(31, 122, 58, 0.05);
          border-color: rgba(31, 122, 58, 0.18);
        }

        .state {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 2px;
        }
        .spinner {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.18);
          border-top-color: rgba(31, 122, 58, 0.9);
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .stateTitle {
          font-weight: 950;
          font-size: 13px;
        }
        .stateSub {
          margin-top: 2px;
          font-size: 12px;
          color: var(--ff-muted, rgba(15, 23, 42, 0.62));
        }

        .msgWarn,
        .msgOk {
          border-radius: 12px;
          padding: 10px;
          font-size: 12px;
        }
        .msgWarn {
          border: 1px solid rgba(209, 119, 17, 0.35);
          background: rgba(209, 119, 17, 0.08);
          color: rgba(122, 63, 0, 0.95);
        }
        .msgOk {
          border: 1px solid rgba(31, 122, 58, 0.25);
          background: rgba(31, 122, 58, 0.08);
          color: rgba(15, 23, 42, 0.86);
        }
        .msgRow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .msgBody {
          color: inherit;
          opacity: 0.95;
        }
      `}</style>
    </div>
  );
}