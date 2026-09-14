import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST() {
  try {
    // 1. Fetch all users from Supabase Auth
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    let synced = 0;

    // 2. Insert into public.users if they don't exist
    for (const authUser of users) {
      const { data, error: checkError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // Doesn't exist, insert
        await supabaseAdmin.from('users').insert({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || 'Unknown',
          role: 'customer' // default
        });
        synced++;
      }
    }

    return NextResponse.json({ message: `Sync complete. Added ${synced} missing users to public profile table.` });
  } catch (error) {
    console.error('Sync users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
