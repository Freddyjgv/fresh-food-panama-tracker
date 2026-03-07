import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { fileId } = JSON.parse(event.body || "{}");
    
    // 1. Buscamos el registro para obtener la ruta del archivo
    // NOTA: Asegúrate de que estas columnas existan (file_path o storage_path)
    const { data: fileRow, error: fetchError } = await supabase
      .from("shipment_files")
      .select("*") 
      .eq("id", fileId)
      .single();

    if (fetchError || !fileRow) {
      return { statusCode: 404, body: "Registro no encontrado en la base de datos" };
    }

    // DETERMINAR EL BUCKET Y LA RUTA
    // Si tu tabla no tiene columna 'bucket', lo definimos por la categoría
    const bucketName = fileRow.bucket || (fileRow.category === 'doc' ? 'shipment-docs' : 'shipment-photos');
    
    // Si tu columna se llama 'file_path' en lugar de 'storage_path', ajustamos:
    const pathToDelete = fileRow.storage_path || fileRow.file_path;

    if (pathToDelete) {
      // 2. Borramos del Storage (Físico)
      const { error: storageError } = await supabase.storage
        .from(bucketName) 
        .remove([pathToDelete]);

      if (storageError) {
        console.error("Error al borrar del Storage:", storageError);
        // Opcional: podrías decidir NO borrar de la DB si el storage falla
      }
    }

    // 3. Borramos la fila de la tabla (Base de Datos)
    const { error: dbError } = await supabase
      .from("shipment_files")
      .delete()
      .eq("id", fileId);

    if (dbError) throw dbError;

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: "Eliminado con éxito de DB y Storage",
        deletedPath: pathToDelete 
      }),
    };

  } catch (err: any) {
    console.error("Delete function error:", err);
    return { statusCode: 500, body: err.message };
  }
};