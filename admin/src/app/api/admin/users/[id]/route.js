import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    // Check caller role
    let callerRole = 'admin';
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: callerUser } } = await supabaseAdmin.auth.getUser(token);
        if (callerUser) {
          const { data: callerRec } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', callerUser.id)
            .maybeSingle();
          if (callerRec?.role) callerRole = callerRec.role;
        }
      } catch (_) {}
    }

    // Prevent self-deletion if caller id matches
    if (callerRole && req.headers.get('authorization')) {
      try {
        const token = req.headers.get('authorization').replace('Bearer ', '');
        const { data: { user: callerUser } } = await supabaseAdmin.auth.getUser(token);
        if (callerUser && callerUser.id === id) {
          return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
        }
      } catch (_) {}
    }

    // Preserve financial & business audit compliance
    try { await supabaseAdmin.from('orders').update({ user_id: null }).eq('user_id', id); } catch (_) {}
    try { await supabaseAdmin.from('reservations').update({ user_id: null }).eq('user_id', id); } catch (_) {}
    try { await supabaseAdmin.from('payment_transactions').update({ user_id: null }).eq('user_id', id); } catch (_) {}
    try { await supabaseAdmin.from('service_requests').update({ user_id: null }).eq('user_id', id); } catch (_) {}

    // Delete customer-specific data
    try { await supabaseAdmin.from('user_vouchers').delete().eq('user_id', id); } catch (_) {}
    try { await supabaseAdmin.from('user_discount_tasks').delete().eq('user_id', id); } catch (_) {}
    try { await supabaseAdmin.from('notifications').delete().eq('user_id', id); } catch (_) {}
    try { await supabaseAdmin.from('accessibility_settings').delete().eq('user_id', id); } catch (_) {}
    try { await supabaseAdmin.from('queue_entries').delete().eq('user_id', id); } catch (_) {}

    // Delete user from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      console.warn('Auth delete error:', authError.message);
    }

    // Ensure row deleted from public.users table
    await supabaseAdmin.from('users').delete().eq('id', id);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
