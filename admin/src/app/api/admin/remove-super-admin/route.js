import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    const deletedAuth = [];
    const targetEmail = 'superadmin@tableflow.com';

    // 1. Find in Supabase Auth
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (!listErr && users) {
      for (const u of users) {
        if (u.email?.toLowerCase() === targetEmail.toLowerCase() || u.user_metadata?.role === 'super_admin') {
          const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
          if (!delErr) {
            deletedAuth.push({ id: u.id, email: u.email });
          } else {
            console.error('Failed to delete auth user:', delErr);
          }
        }
      }
    }

    // 2. Delete from public.users table
    const { data: dbDeleted, error: dbErr } = await supabaseAdmin
      .from('users')
      .delete()
      .or(`email.eq.${targetEmail},role.eq.super_admin`)
      .select();

    return NextResponse.json({
      success: true,
      message: 'Super Admin account deleted successfully',
      deletedAuth,
      deletedDb: dbDeleted || [],
      error: dbErr?.message || null
    });
  } catch (err) {
    console.error('Delete super admin error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
