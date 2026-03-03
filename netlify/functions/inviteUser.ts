import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Usamos el SERVICE_ROLE_KEY porque solo un admin puede invitar usuarios
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  // Manejo de CORS y Método
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" }, body: "" };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { email, full_name, role, client_id } = JSON.parse(event.body || '{}');

    if (!email || !full_name) {
      return { statusCode: 400, body: JSON.stringify({ message: "Email y Nombre son requeridos" }) };
    }

    // 1. Invitación oficial de Supabase Auth
    // Esto envía el correo automático de "Has sido invitado..."
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: { 
          full_name: full_name,
          role: role || 'client' // 'client' o 'admin'
        },
        // Opcional: Redirigir a una página específica para completar el registro
        // redirectTo: 'https://tusistema.com/complete-profile' 
      }
    );

    if (inviteError) throw inviteError;

    // 2. Vincular con la tabla de Clientes (Si es un cliente)
    // Actualizamos la ficha para que el sistema sepa que ya tiene acceso
    if (role === 'client' && client_id) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          has_platform_access: true,
          auth_user_id: inviteData.user.id // Guardamos el ID de Auth para futuras relaciones
        })
        .eq('id', client_id);

      if (updateError) console.error("Error vinculando cliente:", updateError);
    }

    // 3. (Opcional) Si es STAFF, podrías insertarlo en una tabla de perfiles internos
    if (role === 'admin' || role === 'superadmin') {
      await supabase.from('profiles').upsert({
        id: inviteData.user.id,
        full_name,
        role,
        email
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: `Invitación enviada exitosamente a ${email}`,
        user: inviteData.user 
      }),
    };

  } catch (error: any) {
    console.error("Error en inviteUser:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};