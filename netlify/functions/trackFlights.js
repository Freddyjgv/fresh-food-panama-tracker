// netlify/functions/trackFlights.js
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

exports.handler = async () => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Buscamos embarques que estén entre "AT_ORIGIN" e "IN_TRANSIT" y que NO hayan aterrizado
  const { data: activeShipments } = await supabase
    .from('shipments')
    .select('id, flight_number, code, status') // Añadido 'status'
    .in('status', ['AT_ORIGIN', 'IN_TRANSIT'])
    .or('flight_status.neq.landed,flight_status.is.null'); // Trae los que NO son landed O son NULL

  for (const ship of activeShipments) {
    if (!ship.flight_number) continue;

    try {
      // 2. Llamada optimizada a Aviationstack
      const res = await axios.get(`https://api.aviationstack.com/v1/flights`, {
        params: {
          access_key: process.env.AVIATIONSTACK_KEY,
          flight_iata: ship.flight_number,
          limit: 1
        }
      });

      const flightData = res.data.data[0];
      if (!flightData) continue;

      const status = flightData.flight_status; // active, landed, scheduled, etc.
      
      // 3. Mapeo de hito automático
      let newStatus = ship.status;
      if (status === 'active') newStatus = 'IN_TRANSIT';
      if (status === 'landed') newStatus = 'AT_DESTINATION';

      // 4. Actualizamos el embarque
      await supabase.from('shipments').update({
        flight_status: status,
        flight_departure_time: flightData.departure.actual || flightData.departure.estimated,
        flight_arrival_time: flightData.arrival.actual || flightData.arrival.estimated,
        status: newStatus,
        last_api_sync: new Date().toISOString()
      }).eq('id', ship.id);

    } catch (err) {
      console.error(`Error tracking ${ship.code}:`, err);
    }
  }
  return { statusCode: 200, body: "Sync complete" };
};