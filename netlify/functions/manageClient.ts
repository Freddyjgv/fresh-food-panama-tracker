import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const data = JSON.parse(event.body || '{}');
    const { 
      name, legal_name, tax_id, email_corp, phone_corp, 
      country_origin, billing_address, shipping_addresses 
    } = data;

    // 1. UPSERT INTELIGENTE
    // Usamos contact_email como ancla para no duplicar prospectos.
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .upsert({
        name: name.trim(),
        legal_name: legal_name || null,
        tax_id: tax_id || null,
        contact_email: email_corp.trim().toLowerCase(), // Obligatorio para prospectos
        phone: phone_corp || null,
        country: country_origin || 'Panamá',
        billing_address: billing_address || null,
        updated_at: new Date().toISOString()
        // NOTA: No tocamos 'has_platform_access' aquí para no resetear 
        // el acceso si estamos editando un cliente que ya es usuario.
      }, { 
        onConflict: 'contact_email' 
      })
      .select()
      .single();

    if (clientError) throw clientError;

    // 2. GESTIÓN DE DIRECCIONES (SHIPPING)
    // Borramos las anteriores y guardamos las nuevas 
    // (Esto mantiene la integridad de la lista dinámica del drawer)
    await supabase.from('shipping_addresses').delete().eq('client_id', client.id);

    if (shipping_addresses && Array.isArray(shipping_addresses)) {
      const validShipping = shipping_addresses
        .filter((s: any) => s.address && s.address.trim() !== "")
        .map((s: any) => ({
          client_id: client.id,
          address: s.address.trim()
        }));

      if (validShipping.length > 0) {
        const { error: shipErr } = await supabase
          .from('shipping_addresses')
          .insert(validShipping);
        if (shipErr) console.error("Error en shipping:", shipErr);
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: 'Ficha de prospecto guardada correctamente', 
        id: client.id,
        status: client.has_platform_access ? 'Active User' : 'Prospect'
      }),
    };

  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: error.message }),
    };
  }
};