import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Usa el Service Role para tener permiso de borrado
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { fileId } = JSON.parse(event.body || "{}");
    
    // 1. Buscamos en la tabla UNIFICADA: shipment_files
    const { data: fileRow, error: fetchError } = await supabase
      .from("shipment_files")
      .select("storage_path, bucket")
      .eq("id", fileId)
      .single();

    if (fetchError || !fileRow) {
      return { statusCode: 404, body: "Archivo no encontrado en shipment_files" };
    }

    // 2. Borramos del Storage usando el bucket que ya viene en la fila
    const { error: storageError } = await supabase.storage
      .from(fileRow.bucket) 
      .remove([fileRow.storage_path]);

    if (storageError) console.error("Storage error (no crítico):", storageError);

    // 3. Borramos la fila de la tabla shipment_files
    const { error: dbError } = await supabase
      .from("shipment_files")
      .delete()
      .eq("id", fileId);

    if (dbError) throw dbError;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Eliminado con éxito" }),
    };

  } catch (err: any) {
    return { statusCode: 500, body: err.message };
  }
};