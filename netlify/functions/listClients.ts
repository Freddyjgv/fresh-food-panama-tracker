import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  // Verificación de método
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    // Traemos los clientes con sus campos de acceso y datos fiscales
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id, 
        name, 
        legal_name, 
        tax_id, 
        contact_email, 
        phone, 
        country, 
        has_platform_access,
        billing_address,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: data }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};