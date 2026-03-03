// netlify/functions/getUploadUrl.ts
import type { Handler } from '@netlify/functions';
import { getUserAndProfile, json, text, sbAdmin, isPrivilegedRole } from './_util';

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return text(405, 'Method not allowed');

  try {
    const { user, profile } = await getUserAndProfile(event);
    
    // 1. Validación de seguridad centralizada
    if (!user || !profile) return text(401, 'Unauthorized');
    if (!isPrivilegedRole(profile.role || "")) return text(403, 'Forbidden');

    const body = JSON.parse(event.body || '{}');
    const bucket = String(body.bucket || '').trim();
    const shipmentCode = String(body.shipmentCode || '').trim();
    const filename = String(body.filename || '').trim();

    if (!bucket || !shipmentCode || !filename) {
      return text(400, 'bucket, shipmentCode y filename son requeridos');
    }

    // Validación de buckets permitidos
    if (!['shipment-docs', 'shipment-photos'].includes(bucket)) {
      return text(400, 'bucket inválido');
    }

    // 2. Sanitización del nombre de archivo y generación de ruta
    // Reemplaza caracteres especiales por guiones bajos
    const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const path = `${shipmentCode}/${Date.now()}_${safeName}`;

    // 3. Generar URL firmada de subida (Upload)
    const { data, error } = await sbAdmin
      .storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error("Error generating Upload URL:", error.message);
      return text(500, error.message);
    }

    // Retornamos la URL y el path final para que el front lo registre en la DB después
    return json(200, { 
      uploadUrl: data.signedUrl, 
      path,
      token: data.token // Algunos SDKs requieren el token explícito
    });

  } catch (e: any) {
    console.error("Falla en getUploadUrl:", e.message);
    return text(500, e?.message || 'Server error');
  }
};