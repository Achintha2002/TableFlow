import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    const targetEmail = 'superadmin@tableflow.com';

    // 1. Automatically purge superadmin@tableflow.com from Auth and DB if present
    try {
      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
      if (authUsers) {
        for (const u of authUsers) {
          if (u.email?.toLowerCase() === targetEmail || u.user_metadata?.role === 'super_admin') {
            await supabaseAdmin.auth.admin.deleteUser(u.id).catch(() => {});
          }
        }
      }
      await supabaseAdmin.from('users').delete().eq('email', targetEmail).catch(() => {});
      await supabaseAdmin.from('users').delete().eq('role', 'super_admin').catch(() => {});
    } catch (purgeErr) {
      console.warn('Super admin purge error:', purgeErr);
    }

    // 2. Fetch all registered users excluding superadmin
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .neq('email', targetEmail)
      .neq('role', 'super_admin')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
