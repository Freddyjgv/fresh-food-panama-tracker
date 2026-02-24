import type { Handler } from '@netlify/functions';
import { getUserAndProfile, json, text, supabaseAdmin } from './_util';

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, 'Unauthorized');
    if (profile.role !== 'admin') return text(403, 'Forbidden');
    if (event.httpMethod !== 'POST') return text(405, 'Method not allowed');

    const body = JSON.parse(event.body || '{}');
    const bucket = String(body.bucket || '').trim();
    const shipmentCode = String(body.shipmentCode || '').trim();
    const filename = String(body.filename || '').trim();

    if (!bucket || !shipmentCode || !filename) return text(400, 'bucket, shipmentCode, filename requeridos');
    if (!['shipment-docs', 'shipment-photos'].includes(bucket)) return text(400, 'bucket inválido');

    const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const path = `${shipmentCode}/${Date.now()}_${safeName}`;

    const sb = supabaseAdmin();
    const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);
    if (error) return text(500, error.message);

    return json(200, { uploadUrl: data.signedUrl, path });
  } catch (e: any) {
    return text(500, e?.message || 'Server error');
  }
};
