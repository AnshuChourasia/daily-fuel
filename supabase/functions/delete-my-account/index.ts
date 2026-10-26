import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return reply({ error: 'Sign in required' }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.confirmation !== 'DELETE') return reply({ error: 'Confirmation required' }, 400);
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return reply({ error: 'Invalid session' }, 401);
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: membership, error: memberError } = await admin.from('family_members')
      .select('family_id,role').eq('user_id', user.id).maybeSingle();
    if (memberError) throw memberError;
    if (membership?.role === 'admin') {
      const { count, error: countError } = await admin.from('family_members')
        .select('user_id', { count: 'exact', head: true }).eq('family_id', membership.family_id);
      if (countError) throw countError;
      if ((count ?? 0) > 1) return reply({ error: 'Remove other family members before deleting the admin account.' }, 409);
      // Remove the empty household; cascade removes this user's membership.
      const { error: familyError } = await admin.from('families').delete().eq('id', membership.family_id);
      if (familyError) throw familyError;
    }
    // food_entries and family_members reference auth.users ON DELETE CASCADE.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return reply({ success: true });
  } catch (error) {
    console.error('Account deletion failed', error);
    return reply({ error: 'Account deletion failed. Please try again or contact support.' }, 500);
  }
});
