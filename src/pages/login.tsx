import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { LogIn, ShieldCheck, Globe } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // El color verde exacto de tu web es aproximadamente #16a34a o similar
  const FF_GREEN = "#16a34a"; 

  return (
    <div className="ff-login-viewport">
      <div className="ff-login-container">
        {/* LADO IZQUIERDO: IMAGEN/BRANDING (Como en las webs modernas) */}
        <div className="ff-login-visual">
          <div className="ff-visual-overlay"></div>
          <div className="ff-visual-content">
            <img src="/logo-white.png" alt="FreshFood Panama" className="ff-v-logo" />
            <h2>Logística internacional que conecta la frescura de Panamá con el mundo.</h2>
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO */}
        <div className="ff-login-form-side">
          <div className="ff-form-header">
  {/* Logo centrado arriba del formulario para reforzar la marca */}
  <img 
    src="https://www.freshfoodpanama.com/wp-content/uploads/2023/08/logo-fresh-food-panama.png" 
    alt="FreshFood Panama" 
    style={{ height: '60px', marginBottom: '24px', objectFit: 'contain' }} 
  />
  <h1>Portal de Clientes</h1>
  <p>Bienvenido al sistema de trazabilidad de <strong>FreshFood Panama</strong>.</p>
</div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) alert(error.message);
            setLoading(false);
          }}>
            <div className="ff-input-wrapper">
              <label>Usuario / Email</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ejemplo@freshfoodpanama.com"
                required 
              />
            </div>

            <div className="ff-input-wrapper">
              <label>Contraseña</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required 
              />
            </div>

            <button className="ff-submit-btn" disabled={loading}>
              {loading ? "Iniciando..." : "Acceder al Panel"}
              <LogIn size={18} />
            </button>
          </form>

          <div className="ff-form-footer">
            <div className="ff-secure-badge">
              <ShieldCheck size={14} /> <span>Conexión Segura SSL</span>
            </div>
            <p>© 2026 FreshFood Panama. All rights reserved.</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ff-login-viewport {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f7f6; /* Un gris verdoso muy sutil */
          font-family: 'Inter', sans-serif;
        }

        .ff-login-container {
          display: flex;
          width: 100%;
          max-width: 1000px;
          height: 600px;
          background: white;
          border-radius: 30px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
        }

        /* Lado de la imagen */
        .ff-login-visual {
          flex: 1;
          background-image: url('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80'); /* Imagen de frutas frescas de alta calidad */
          background-size: cover;
          background-position: center;
          position: relative;
          display: flex;
          align-items: flex-end;
          padding: 40px;
        }

        .ff-visual-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(22, 163, 74, 0.9), rgba(0,0,0,0.2));
        }

        .ff-visual-content {
          position: relative;
          color: white;
          z-index: 2;
        }

        .ff-v-logo { height: 50px; margin-bottom: 20px; }
        .ff-visual-content h2 { font-size: 24px; font-weight: 300; line-height: 1.4; }

        /* Lado del Formulario */
        .ff-login-form-side {
          width: 450px;
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .ff-form-header h1 { font-size: 28px; font-weight: 800; color: #1a202c; margin-bottom: 10px; }
        .ff-form-header p { font-size: 14px; color: #718096; margin-bottom: 30px; }

        .ff-input-wrapper { margin-bottom: 20px; }
        .ff-input-wrapper label { display: block; font-size: 12px; font-weight: 700; color: #4a5568; margin-bottom: 8px; text-transform: uppercase; }
        .ff-input-wrapper input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1.5px solid #edf2f7;
          background: #f8fafc;
          transition: 0.2s;
        }

        .ff-input-wrapper input:focus {
          border-color: ${FF_GREEN};
          outline: none;
          background: white;
        }

        .ff-submit-btn {
          width: 100%;
          padding: 14px;
          background: ${FF_GREEN};
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: 0.3s;
        }

        .ff-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(22, 163, 74, 0.4); }

        .ff-form-footer { margin-top: auto; text-align: center; }
        .ff-secure-badge { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; color: #a0aec0; margin-bottom: 10px; }
        .ff-form-footer p { font-size: 11px; color: #cbd5e0; }

        @media (max-width: 800px) {
          .ff-login-visual { display: none; }
          .ff-login-form-side { width: 100%; padding: 40px; }
        }
      `}</style>
    </div>
  );
}