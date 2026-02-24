import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Role = "client" | "admin" | "superadmin" | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ✅ ÚNICA fuente de verdad: /.netlify/functions/whoami
   * - Si NO hay sesión => return false (mostrar login)
   * - Si hay sesión y whoami OK => redirige según rol y return true
   * - Si whoami falla => signOut y return false (mostrar login, SIN loop)
   */
  async function routeByRole(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) return false;

    const res = await fetch("/.netlify/functions/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      // Importante: NO hacemos window.location.href="/login" aquí (estás en /login)
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

  // ✅ Si ya está logueado, redirige (si no, muestra login)
  useEffect(() => {
    (async () => {
      try {
        const redirected = await routeByRole();
        if (!redirected) setChecking(false);
      } catch {
        // Si algo explota, mostramos login
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // ✅ Después de login, usamos EXACTAMENTE la misma lógica
    const redirected = await routeByRole();
    setLoading(false);

    if (!redirected) {
      setError("Sesión creada, pero no se pudo determinar tu rol. Intenta de nuevo.");
    }
  }

  if (checking) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Fresh Food Panamá Tracker</div>
          <div style={{ color: "#667085", marginTop: 6 }}>Verificando sesión…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={styles.logoDot} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Fresh Food Panamá Tracker</div>
            <div style={{ color: "#667085", fontSize: 13 }}>Acceso único</div>
          </div>
        </div>

        <h1 style={{ margin: "18px 0 10px", fontSize: 26 }}>Iniciar sesión</h1>
        <p style={{ margin: "0 0 14px", color: "#667085", fontSize: 13 }}>
          Ingresa tus credenciales. Te enviaremos automáticamente al portal correcto.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={styles.label}>
            Correo
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
            />
          </label>

          <label style={styles.label}>
            Contraseña
            <input
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button disabled={loading} style={styles.button}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f7fb", padding: 24 },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "white",
    border: "1px solid #eef2f6",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 10px 30px rgba(16,24,40,.06)",
  },
  logoDot: { width: 12, height: 12, borderRadius: 999, background: "#14532d" },
  label: { display: "grid", gap: 6, fontSize: 12, color: "#344054", fontWeight: 700 },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d0d5dd", fontSize: 13 },
  button: { padding: "10px 14px", borderRadius: 10, border: "none", background: "#14532d", color: "white", fontWeight: 900, cursor: "pointer" },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#7f1d1d", padding: 10, borderRadius: 10, fontSize: 13 },
};