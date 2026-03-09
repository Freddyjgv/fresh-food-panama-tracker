import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { LogIn, ShieldCheck, CheckCircle2 } from "lucide-react";

type Role = "client" | "admin" | "superadmin" | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TUS COLORES OFICIALES
  const FF_DARK_GREEN = "#234d23";

  /** * ✅ TU LÓGICA ORIGINAL INTACTA
   */
  async function routeByRole(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;

    const res = await fetch("/.netlify/functions/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      await supabase.auth.signOut();
      return false;
    }

    const me: { email: string; role: Role; client_id: string | null } = await res.json();
    const role = String(me.role || "").toLowerCase();

    if (role === "admin" || role === "superadmin") {
      window.location.href = "/admin/shipments";
    } else {
      window.location.href = "/shipments";
    }
    return true;
  }

  useEffect(() => {
    (async () => {
      try {
        const redirected = await routeByRole();
        if (!redirected) setChecking(false);
      } catch {
        setChecking(false);
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    const redirected = await routeByRole();
    setLoading(false);

    if (!redirected) {
      setError("Sesión creada, pero no se pudo determinar tu rol. Intenta de nuevo.");
    }
  }

  // PANTALLA DE CARGA (Sincronizada con tu estilo)
  if (checking) {
    return (
      <div className="ff-login-viewport">
        <div className="ff-loading-box">
          <div className="ff-spinner"></div>
          <p>Verificando sesión segura...</p>
        </div>
        <style jsx>{`
          .ff-login-viewport { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
          .ff-loading-box { text-align: center; color: ${FF_DARK_GREEN}; font-weight: 600; }
          .ff-spinner { width: 30px; height: 30px; border: 3px solid #e2e8f0; border-top-color: ${FF_DARK_GREEN}; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="ff-login-viewport">
      <div className="ff-login-container">
        
        {/* LADO IZQUIERDO: BRANDING & VISUAL */}
        <div className="ff-login-visual">
          <div className="ff-visual-overlay"></div>
          <div className="ff-visual-content">
            <img 
              src="https://www.freshfoodpanama.com/wp-content/uploads/2023/08/logo-fresh-food-panama.png" 
              alt="FreshFood Panama" 
              className="ff-v-logo" 
            />
            <h2>Logística de exportación que conecta a Panamá con el mundo.</h2>
            <div className="ff-features">
              <div className="ff-f-item"><CheckCircle2 size={16} /> <span>Trazabilidad en tiempo real</span></div>
              <div className="ff-f-item"><CheckCircle2 size={16} /> <span>Documentación digital segura</span></div>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO */}
        <div className="ff-login-form-side">
          <div className="ff-form-header">
            <h1>Portal de Clientes</h1>
            <p>Ingresa tus credenciales para acceder a tus embarques.</p>
          </div>

          <form onSubmit={onSubmit} className="ff-login-form">
            <div className="ff-input-group">
              <label>Correo Electrónico</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="usuario@freshfoodpanama.com"
                required
              />
            </div>

            <div className="ff-input-group">
              <label>Contraseña</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <div className="ff-error-msg">{error}</div>}

            <button disabled={loading} className="ff-submit-btn">
              {loading ? "Verificando..." : "Ingresar al Portal"}
              {!loading && <LogIn size={18} />}
            </button>
          </form>

          <div className="ff-form-footer">
            <ShieldCheck size={14} />
            <span>Acceso encriptado mediante SSL</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ff-login-viewport {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f4f2;
          padding: 20px;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .ff-login-container {
          display: flex;
          width: 100%;
          max-width: 1050px;
          min-height: 620px;
          background: white;
          border-radius: 30px;
          overflow: hidden;
          box-shadow: 0 40px 100px -20px rgba(35, 77, 35, 0.15);
        }

        .ff-login-visual {
          flex: 1.1;
          background-image: url('https://images.unsplash.com/photo-1550411234-747356d3293e?auto=format&fit=crop&q=80'); 
          background-size: cover;
          background-position: center;
          position: relative;
          display: flex;
          padding: 50px;
          align-items: flex-end;
        }

        .ff-visual-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(35, 77, 35, 0.9) 0%, rgba(0,0,0,0.5) 100%);
        }

        .ff-visual-content { position: relative; z-index: 2; color: white; }
        .ff-v-logo { height: 70px; margin-bottom: 30px; }
        .ff-visual-content h2 { font-size: 26px; font-weight: 300; line-height: 1.3; margin-bottom: 30px; }
        .ff-features { display: grid; gap: 12px; }
        .ff-f-item { display: flex; align-items: center; gap: 10px; font-size: 14px; opacity: 0.9; }

        .ff-login-form-side {
          flex: 1;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .ff-form-header h1 { font-size: 28px; font-weight: 800; color: ${FF_DARK_GREEN}; margin-bottom: 8px; }
        .ff-form-header p { color: #64748b; font-size: 14px; margin-bottom: 40px; }

        .ff-input-group { margin-bottom: 20px; }
        .ff-input-group label { display: block; font-size: 11px; font-weight: 700; color: ${FF_DARK_GREEN}; text-transform: uppercase; margin-bottom: 8px; }
        .ff-input-group input {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: 2px solid #f1f5f9;
          background: #f8fafc;
          font-size: 15px;
          transition: all 0.2s;
        }
        .ff-input-group input:focus { border-color: ${FF_DARK_GREEN}; background: white; outline: none; }

        .ff-error-msg { 
          background: #fef2f2; border: 1px solid #fee2e2; color: #991b1b; 
          padding: 12px; border-radius: 10px; font-size: 13px; margin-bottom: 20px;
        }

        .ff-submit-btn {
          width: 100%;
          padding: 16px;
          background: ${FF_DARK_GREEN};
          color: white;
          border: none;
          border-radius: 14px;
          font-weight: 700;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: 0.2s;
        }
        .ff-submit-btn:hover { background: #1a3a1a; transform: translateY(-1px); }
        .ff-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .ff-form-footer { margin-top: 40px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #94a3b8; font-size: 11px; }

        @media (max-width: 900px) {
          .ff-login-visual { display: none; }
        }
      `}</style>
    </div>
  );
}