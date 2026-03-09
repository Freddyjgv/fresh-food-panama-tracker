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

  const FF_DARK_GREEN = "#234d23";

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
      setError("Sesión creada, pero no se pudo determinar tu rol.");
    }
  }

  if (checking) {
    return (
      <div className="ff-login-viewport">
        <div className="ff-loading-box">
          <div className="ff-spinner"></div>
          <p>Sincronizando con Fresh Connect...</p>
        </div>
        <style jsx>{`
          .ff-login-viewport { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: 'Poppins', sans-serif; }
          .ff-spinner { width: 30px; height: 30px; border: 3px solid #f1f5f9; border-top-color: ${FF_DARK_GREEN}; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="ff-login-viewport">
      <div className="ff-login-container">
        
        {/* LADO IZQUIERDO: CAMPO DE PIÑAS */}
        <div className="ff-login-visual">
          <div className="ff-visual-overlay"></div>
          <div className="ff-visual-content">
            <h2>Logística de exportación que conecta a Panamá con el mundo.</h2>
            <div className="ff-features">
              <div className="ff-f-item"><CheckCircle2 size={16} /> <span>Trazabilidad Fresh Connect</span></div>
              <div className="ff-f-item"><CheckCircle2 size={16} /> <span>Gestión de Documentos</span></div>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO CON LOGO CENTRADO */}
        <div className="ff-login-form-side">
          <div className="ff-form-header">
            <img 
              src="/brand/freshfood_logo.png" 
              alt="FreshFood Panama" 
              className="ff-form-logo" 
            />
            <h1>Portal de Clientes</h1>
            <p>Ingresa tus credenciales para continuar.</p>
          </div>

          <form onSubmit={onSubmit} className="ff-login-form">
            <div className="ff-input-group">
              <label>Correo Electrónico</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="ejemplo@freshfoodpanama.com"
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
              {loading ? "Ingresando..." : "Acceder al Panel"}
              {!loading && <LogIn size={18} />}
            </button>
          </form>

          <div className="ff-form-footer">
            <ShieldCheck size={14} />
            <span>Acceso Encriptado SSL</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Importar Poppins si no está en tu layout global */
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;700;800;900&display=swap');

        .ff-login-viewport {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f7f5;
          padding: 24px;
          font-family: 'Poppins', sans-serif;
        }

        .ff-login-container {
          display: flex;
          width: 100%;
          max-width: 1050px;
          min-height: 640px;
          background: white;
          border-radius: 40px;
          overflow: hidden;
          box-shadow: 0 40px 100px -20px rgba(35, 77, 35, 0.15);
        }

        .ff-login-visual {
          flex: 1.2;
          background-image: url('/brand/pineapplefield.jpg'); 
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
          background: linear-gradient(135deg, rgba(35, 77, 35, 0.8) 0%, rgba(0,0,0,0.3) 100%);
        }

        .ff-visual-content { position: relative; z-index: 2; color: white; }
        .ff-visual-content h2 { font-size: 26px; font-weight: 300; line-height: 1.3; margin-bottom: 24px; }
        .ff-features { display: grid; gap: 12px; }
        .ff-f-item { display: flex; align-items: center; gap: 10px; font-size: 14px; opacity: 0.9; }

        .ff-login-form-side {
          flex: 1;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center; /* Centra el contenido del formulario */
          text-align: center;
        }

        .ff-form-logo {
          height: 65px;
          width: auto;
          margin-bottom: 20px;
          object-fit: contain;
        }

        .ff-form-header { width: 100%; }
        .ff-form-header h1 { font-size: 26px; font-weight: 800; color: ${FF_DARK_GREEN}; margin-bottom: 4px; letter-spacing: -0.03em; }
        .ff-form-header p { color: #64748b; font-size: 13px; margin-bottom: 35px; }

        .ff-login-form { width: 100%; text-align: left; }
        .ff-input-group { margin-bottom: 20px; }
        .ff-input-group label { display: block; font-size: 11px; font-weight: 700; color: ${FF_DARK_GREEN}; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; }
        .ff-input-group input {
          width: 100%;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1.5px solid #edf2f7;
          background: #f8fafc;
          font-family: 'Poppins', sans-serif;
          font-size: 14px;
          transition: 0.2s;
        }
        .ff-input-group input:focus { border-color: ${FF_DARK_GREEN}; background: white; outline: none; box-shadow: 0 0 0 4px rgba(35, 77, 35, 0.06); }

        .ff-error-msg { background: #fff5f5; border: 1px solid #fed7d7; color: #c53030; padding: 12px; border-radius: 10px; font-size: 12px; margin-bottom: 20px; font-weight: 600; width: 100%; }

        .ff-submit-btn {
          width: 100%;
          padding: 16px;
          background: ${FF_DARK_GREEN};
          color: white;
          border: none;
          border-radius: 14px;
          font-weight: 700;
          font-size: 15px;
          font-family: 'Poppins', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: 0.2s;
        }
        .ff-submit-btn:hover { background: #1a3a1a; transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(35, 77, 35, 0.2); }

        .ff-form-footer { margin-top: 30px; display: flex; align-items: center; gap: 8px; color: #a0aec0; font-size: 11px; font-weight: 600; text-transform: uppercase; }

        @media (max-width: 900px) {
          .ff-login-visual { display: none; }
          .ff-login-form-side { padding: 40px; }
        }
      `}</style>
    </div>
  );
}