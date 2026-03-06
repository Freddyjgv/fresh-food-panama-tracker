import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Usa el Service Role para tener permiso de borrado
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { fileId, kind, shipmentId } = JSON.parse(event.body || "{}");

    // 1. Obtener la ruta del archivo en Storage antes de borrar la fila
    const table = kind === "doc" ? "shipment_documents" : "shipment_photos";
    const { data: fileData, error: fetchError } = await supabase
      .from(table)
      .select("storage_path")
      .eq("id", fileId)
      .single();

    if (fetchError || !fileData) throw new Error("Archivo no encontrado en DB");

    // 2. Borrar el archivo físico del Storage
    const bucket = kind === "doc" ? "shipment-docs" : "shipment-photos";
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([fileData.storage_path]);

    if (storageError) console.error("Error Storage:", storageError);

    // 3. Borrar la fila de la base de datos
    const { error: dbError } = await supabase
      .from(table)
      .delete()
      .eq("id", fileId);

    if (dbError) throw dbError;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Eliminado correctamente" }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};