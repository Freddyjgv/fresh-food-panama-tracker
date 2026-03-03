// netlify/functions/getDownloadUrl.ts
import type { Handler } from '@netlify/functions';
import { getUserAndProfile, json, text, sbAdmin, isPrivilegedRole } from './_util';

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, 'Unauthorized');

    const fileId = event.queryStringParameters?.fileId;
    if (!fileId) return text(400, 'Missing fileId');

    // 1. Obtener los metadatos del archivo
    const { data: file, error: fErr } = await sbAdmin
      .from('shipment_files')
      .select('id, shipment_id, bucket, storage_path')
      .eq('id', fileId)
      .maybeSingle();

    if (fErr) return text(500, fErr.message);
    if (!file) return text(404, 'File record not found');

    // 2. Obtener el embarque para validar propiedad (RLS manual)
    const { data: ship, error: sErr } = await sbAdmin
      .from('shipments')
      .select('id, client_id')
      .eq('id', file.shipment_id)
      .maybeSingle();

    if (sErr) return text(500, sErr.message);
    if (!ship) return text(404, 'Shipment not found');

    // 3. Validación de Seguridad: Admin o Dueño del embarque
    const privileged = isPrivilegedRole(profile.role || "");
    if (!privileged) {
      if (!profile.client_id || ship.client_id !== profile.client_id) {
        return text(403, 'Forbidden: You do not have access to this file');
      }
    }

    // 4. Generar URL firmada por 5 minutos (300 segundos)
    const { data, error } = await sbAdmin.storage
      .from(file.bucket)
      .createSignedUrl(file.storage_path, 300);

    if (error) return text(500, error.message);

    return json(200, { url: data.signedUrl });
  } catch (e: any) {
    console.error("Error en getDownloadUrl:", e.message);
    return text(500, e?.message || 'Server error');
  }
};