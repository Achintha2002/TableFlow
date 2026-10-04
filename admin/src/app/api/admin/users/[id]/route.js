import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    // Check if target user is an Admin
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('id, role, email')
      .eq('id', id)
      .maybeSingle();

    if (targetUser && targetUser.role === 'admin') {
      return NextResponse.json({ error: 'Admin accounts cannot be deleted.' }, { status: 403 });
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
