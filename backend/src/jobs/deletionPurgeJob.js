/**
 * TableFlow - Scheduled Account Deletion Purge Job
 * Automatically hard-deletes users whose 30-day grace period has expired
 * (scheduled_deletion_at <= NOW() and is_pending_deletion = true).
 * Safely preserves financial and audit records (orders, reservations, transactions).
 */

let isRunning = false;

async function runDeletionPurgeCheck(supabaseAdmin) {
  if (isRunning) return;
  isRunning = true;

  try {
    const nowIso = new Date().toISOString();

    // 1. Find users pending deletion whose grace period has expired
    const { data: expiredUsers, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, scheduled_deletion_at')
      .eq('is_pending_deletion', true)
      .lte('scheduled_deletion_at', nowIso);

    if (findError) {
      // Column might not be migrated yet or query failed
      if (findError.message && !findError.message.includes('column')) {
        console.warn('[Account Purge] Error querying pending deletions:', findError.message);
      }
      return;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return;
    }

    console.log(`[Account Purge] Found ${expiredUsers.length} user(s) due for permanent deletion.`);

    for (const user of expiredUsers) {
      try {
        const userId = user.id;

        // Atomic check: Ensure user hasn't cancelled deletion right before purge
        const { data: currentUser, error: checkErr } = await supabaseAdmin
          .from('users')
          .select('is_pending_deletion')
          .eq('id', userId)
          .maybeSingle();

        if (checkErr || !currentUser || !currentUser.is_pending_deletion) {
          console.log(`[Account Purge] User ${userId} is no longer pending deletion. Skipping.`);
          continue;
        }

        // 2. Preserve Financial & Audit Records (Set user_id = NULL)
        try {
          await supabaseAdmin
            .from('orders')
            .update({ user_id: null })
            .eq('user_id', userId);
        } catch (e) {
          console.warn(`[Account Purge] Note: could not nullify orders for user ${userId}:`, e.message);
        }

        try {
          await supabaseAdmin
            .from('reservations')
            .update({ user_id: null })
            .eq('user_id', userId);
        } catch (e) {
          console.warn(`[Account Purge] Note: could not nullify reservations for user ${userId}:`, e.message);
        }

        try {
          await supabaseAdmin
            .from('payment_transactions')
            .update({ user_id: null })
            .eq('user_id', userId);
        } catch (_) {}

        try {
          await supabaseAdmin
            .from('service_requests')
            .update({ user_id: null })
            .eq('user_id', userId);
        } catch (_) {}

        // 3. Remove customer-specific cascaded records
        try {
          await supabaseAdmin.from('notifications').delete().eq('user_id', userId);
        } catch (_) {}

        try {
          await supabaseAdmin.from('user_vouchers').delete().eq('user_id', userId);
        } catch (_) {}

        try {
          await supabaseAdmin.from('user_discount_tasks').delete().eq('user_id', userId);
        } catch (_) {}

        try {
          await supabaseAdmin.from('accessibility_settings').delete().eq('user_id', userId);
        } catch (_) {}

        // 4. Hard-delete from Supabase Auth
        const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authDeleteErr) {
          console.warn(`[Account Purge] Supabase auth delete warning for ${userId}:`, authDeleteErr.message);
        }

        // 5. Ensure row is removed from public.users
        const { error: dbDeleteErr } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId);

        if (dbDeleteErr) {
          console.warn(`[Account Purge] DB row delete warning for ${userId}:`, dbDeleteErr.message);
        }

        console.log(`[Account Purge] Successfully purged user account ${userId} (${user.email || 'N/A'}).`);
      } catch (userErr) {
        console.error(`[Account Purge] Error purging user ${user.id}:`, userErr.message);
      }
    }
  } catch (err) {
    console.error('[Account Purge] Unexpected error during purge run:', err);
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the deletion purge scheduler.
 * Runs on startup (after 15 seconds) and every intervalMs (defaults to 1 hour).
 */
function startDeletionPurgeScheduler(supabaseAdmin, intervalMs = 60 * 60 * 1000) {
  setTimeout(() => runDeletionPurgeCheck(supabaseAdmin), 15000);
  const intervalId = setInterval(() => runDeletionPurgeCheck(supabaseAdmin), intervalMs);
  return intervalId;
}

module.exports = {
  startDeletionPurgeScheduler,
  runDeletionPurgeCheck
};
