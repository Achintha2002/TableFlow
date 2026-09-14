import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { full_name, email, password, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. The DB trigger creates the user record automatically. 
    // We just need to update the role to the selected staff role.
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('id', userId);

    if (dbError) {
      // If trigger hasn't fired yet, maybe fallback to insert (though trigger is sync in Postgres)
      return NextResponse.json({ error: 'User created but role update failed: ' + dbError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Staff created successfully', user: authData.user });
  } catch (error) {
    console.error('Create staff error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
