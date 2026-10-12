import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    const targetEmail = 'superadmin@tableflow.com';

    // 1. Automatically purge superadmin@tableflow.com from Auth and DB if present
    let authUsers = [];
    try {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      authUsers = users || [];
      for (const u of authUsers) {
        if (u.email?.toLowerCase() === targetEmail || u.user_metadata?.role === 'super_admin') {
          try {
            await supabaseAdmin.auth.admin.deleteUser(u.id);
          } catch (_) {}
        }
      }
      try {
        await supabaseAdmin.from('users').delete().eq('email', targetEmail);
        await supabaseAdmin.from('users').delete().eq('role', 'super_admin');
      } catch (_) {}
    } catch (purgeErr) {
      console.warn('Super admin purge error:', purgeErr);
    }

    // 2. Fetch all registered users from public.users table
    let { data: dbUsers, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .neq('email', targetEmail)
      .neq('role', 'super_admin');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const publicUsers = dbUsers || [];
    const publicUserIds = new Set(publicUsers.map(u => u.id));
    const authMap = new Map();

    // 3. Map auth users and auto-sync missing Google / OAuth signups into public.users
    for (const au of authUsers) {
      if (au.email?.toLowerCase() === targetEmail || au.user_metadata?.role === 'super_admin') continue;
      authMap.set(au.id, au);
      if (au.email) authMap.set(au.email.toLowerCase(), au);

      // Auto-insert user into public.users if missing
      if (!publicUserIds.has(au.id)) {
        try {
          const newProfile = {
            id: au.id,
            email: au.email,
            full_name: au.user_metadata?.full_name || au.user_metadata?.name || 'Customer',
            phone_number: au.phone || au.user_metadata?.phone || null,
            role: 'customer',
            created_at: au.created_at || new Date().toISOString()
          };
          await supabaseAdmin.from('users').upsert(newProfile);
          publicUsers.push(newProfile);
          publicUserIds.add(au.id);
        } catch (_) {}
      }
    }

    // 4. Attach last_sign_in_at and extract Google profile metadata (name, email)
    const mergedUsers = publicUsers.map(u => {
      const au = authMap.get(u.id) || (u.email ? authMap.get(u.email.toLowerCase()) : null);
      const lastLogin = au?.last_sign_in_at || u.last_sign_in_at || u.created_at;
      const googleName = au?.user_metadata?.full_name || au?.user_metadata?.name;
      const finalName = (u.full_name && u.full_name !== 'Customer' && u.full_name !== 'Valued Guest') 
        ? u.full_name 
        : (googleName || u.full_name || 'Customer');

      return {
        ...u,
        full_name: finalName,
        last_sign_in_at: lastLogin
      };
    });

    // 5. Ensure uniqueness by ID
    const uniqueMap = new Map();
    for (const u of mergedUsers) {
      if (!uniqueMap.has(u.id)) {
        uniqueMap.set(u.id, u);
      }
    }

    // 6. Sort users so that the most recently logged-in / active user is at the very TOP
    const sortedUsers = Array.from(uniqueMap.values()).sort((a, b) => {
      const timeA = new Date(a.last_sign_in_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_sign_in_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json(sortedUsers);
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
