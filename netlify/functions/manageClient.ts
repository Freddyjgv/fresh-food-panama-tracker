import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js'; // Importación corregida

// Inicialización del cliente fuera del handler para reutilizar conexiones
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event) => {
  // Solo permitimos peticiones POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const { 
      name, 
      legal_name, 
      tax_id, 
      email_corp, 
      phone_corp, 
      country_origin, 
      payment_condition, 
      billing_address, 
      shipping_addresses 
    } = data;

    // Validación mínima de datos
    if (!name || !email_corp) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'El nombre y el email corporativo son obligatorios' }) 
      };
    }

    // 1. Insertar o Actualizar el Cliente en la tabla 'clients'
    // El upsert basado en 'email' evita el error de "email ya existe" actualizando el registro.
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .upsert({
        name,
        legal_name,
        tax_id,
        email: email_corp,
        phone: phone_corp,
        country: country_origin,
        payment_condition,
        billing_address,
        updated_at: new Date().toISOString() // Formato ISO recomendado para PostgreSQL
      }, { onConflict: 'email' })
      .select()
      .single();

    if (clientError) throw clientError;

    // 2. Gestión de Direcciones de Entrega (Shipping) - Relación 1:N
    // Paso A: Limpiar direcciones existentes para este cliente (evita duplicados y facilita la edición)
    const { error: deleteError } = await supabase
      .from('shipping_addresses')
      .delete()
      .eq('client_id', client.id);

    if (deleteError) console.error("Error limpiando shipping previo:", deleteError);

    // Paso B: Insertar la lista nueva si contiene datos
    if (shipping_addresses && Array.isArray(shipping_addresses)) {
      const shippingToInsert = shipping_addresses
        .filter((s: any) => s.address && s.address.trim() !== "")
        .map((s: any) => ({
          client_id: client.id,
          address: s.address.trim()
        }));

      if (shippingToInsert.length > 0) {
        const { error: shipError } = await supabase
          .from('shipping_addresses')
          .insert(shippingToInsert);
        
        if (shipError) throw shipError;
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: 'Cliente y direcciones guardados correctamente', 
        id: client.id 
      }),
    };

  } catch (error: any) {
    console.error("Error en manageClient:", error);
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message || 'Error interno del servidor' }),
    };
  }
};