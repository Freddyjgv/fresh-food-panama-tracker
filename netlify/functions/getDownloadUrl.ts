import type { Handler } from '@netlify/functions';
import { getUserAndProfile, json, text, supabaseAdmin } from './_util';

export const handler: Handler = async (event) => {
  try {
    const { user, profile } = await getUserAndProfile(event);
    if (!user || !profile) return text(401, 'Unauthorized');

    const fileId = event.queryStringParameters?.fileId;
    if (!fileId) return text(400, 'Missing fileId');

    const sb = supabaseAdmin();

    const { data: file, error: fErr } = await sb
      .from('shipment_files')
      .select('id, shipment_id, bucket, storage_path')
      .eq('id', fileId)
      .maybeSingle();

    if (fErr) return text(500, fErr.message);
    if (!file) return text(404, 'Not found');

    const { data: ship, error: sErr } = await sb
      .from('shipments')
      .select('id, client_id')
      .eq('id', file.shipment_id)
      .maybeSingle();

    if (sErr) return text(500, sErr.message);
    if (!ship) return text(404, 'Not found');

    const isAdmin = profile.role === 'admin';
    if (!isAdmin) {
      if (!profile.client_id || ship.client_id !== profile.client_id) return text(403, 'Forbidden');
    }

    const { data, error } = await sb.storage.from(file.bucket).createSignedUrl(file.storage_path, 300);
    if (error) return text(500, error.message);

    return json(200, { url: data.signedUrl });
  } catch (e: any) {
    return text(500, e?.message || 'Server error');
  }
};
