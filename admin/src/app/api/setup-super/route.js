import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(req) {
  try {
    const email = 'superadmin@tableflow.com';
    const password = 'SuperAdmin@2026';
    const fullName = 'Super Admin';
    const role = 'super_admin';

    // 1. Check if auth user exists
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    let superUser = users?.find(u => u.email === email);

    if (!superUser) {
      const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role }
      });

      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }
      superUser = data.user;
    } else {
      // Ensure password & metadata are explicitly reset to SuperAdmin@2026
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(superUser.id, {
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role }
      });
      if (updateErr) {
        console.warn('Update superadmin password note:', updateErr.message);
      }
    }

    // 2. Ensure public.users entry
    const { error: dbErr } = await supabaseAdmin.from('users').upsert({
      id: superUser.id,
      email: email,
      full_name: fullName,
      role: role
    }, { onConflict: 'id' });

    if (dbErr) {
      console.warn('DB upsert error:', dbErr.message);
      // Even if enum isn't updated yet, auth login can still proceed
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Super Admin credentials confirmed and ready.',
      userId: superUser.id 
    });
  } catch (error) {
    console.error('Setup super error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
