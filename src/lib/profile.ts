import { supabase } from './supabaseClient';

export type UserRole = 'admin' | 'client';

export async function getMyProfile() {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { user: null, profile: null };

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id, role, client_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return { user, profile };
}
