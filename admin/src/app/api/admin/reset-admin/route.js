import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    const targetEmail = 'tableflow@gmail.com';
    const targetPassword = 'adminPassword123!';

    // 1. List users to find if tableflow@gmail.com exists
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;

    const existingUser = users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());

    let userId;
    if (existingUser) {
      userId = existingUser.id;
      // Reset password directly via service role
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: targetPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Admin' }
      });
      if (updateErr) throw updateErr;
    } else {
      // Create user directly
      const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        password: targetPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Admin' }
      });
      if (createErr) throw createErr;
      userId = newAuth.user.id;
    }

    // 2. Ensure public.users role is 'admin'
    await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: targetEmail,
        full_name: 'Admin User',
        role: 'admin'
      });

    // Also collect all other staff/admin accounts for reference
    const allUsers = users.map(u => ({
      email: u.email,
      id: u.id,
      confirmed: Boolean(u.email_confirmed_at)
    }));

    return NextResponse.json({
      success: true,
      message: `Password for ${targetEmail} has been reset to: ${targetPassword}`,
      email: targetEmail,
      password: targetPassword,
      role: 'admin',
      existing_users_in_system: allUsers
    });
  } catch (err) {
    console.error('Reset admin error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
