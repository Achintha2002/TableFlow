import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(req) {
  try {
    const body = await req.json();
    const { task_key, user_id, action = 'complete', count = 1 } = body;

    if (!task_key) {
      return NextResponse.json({ error: 'task_key is required' }, { status: 400 });
    }

    // 1. Fetch task details
    let task = null;
    try {
      const { data, error: taskErr } = await supabaseAdmin
        .from('reward_tasks')
        .select('*')
        .eq('task_key', task_key)
        .maybeSingle();
      if (!taskErr && data) task = data;
    } catch (_) {}

    const defaultNames = {
      dine_3_orders: 'Dine-In Explorer',
      weekday_booking: 'Weekday Gourmet',
      chef_special: "Chef's Signature Fan"
    };

    const title = task?.title || defaultNames[task_key] || task_key;
    const targetProgress = task?.target_progress || (task_key === 'dine_3_orders' ? 3 : 1);

    // 2. Fetch users to target
    let targetUserIds = [];
    if (user_id && user_id !== 'all') {
      targetUserIds = [user_id];
    } else {
      const { data: allUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .limit(200);
      targetUserIds = (allUsers || []).map(u => u.id);
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'No users found to award task' }, { status: 404 });
    }

    // 3. Batch fetch existing user tasks in 1 single query
    const { data: existingTasks } = await supabaseAdmin
      .from('user_discount_tasks')
      .select('*')
      .eq('task_key', task_key)
      .in('user_id', targetUserIds);

    const existingMap = new Map((existingTasks || []).map(t => [t.user_id, t]));

    const batchToUpsert = [];
    const notificationsToInsert = [];

    for (const uid of targetUserIds) {
      const userTask = existingMap.get(uid);
      const current = userTask?.current_progress || 0;
      let nextProgress = current;
      let willComplete = false;
      let willClaimed = userTask?.is_claimed || false;

      if (action === 'reset') {
        nextProgress = 0;
        willComplete = false;
        willClaimed = false;
      } else if (action === 'complete') {
        nextProgress = targetProgress;
        willComplete = true;
      } else {
        // increment
        nextProgress = Math.min(targetProgress, current + count);
        willComplete = nextProgress >= targetProgress;
      }

      batchToUpsert.push({
        user_id: uid,
        task_key: task_key,
        title: title,
        description: task?.description || 'Exclusive TableFlow Challenge',
        current_progress: nextProgress,
        target_progress: targetProgress,
        reward_discount_percent: task?.reward_discount_percent || 10,
        is_completed: willComplete,
        is_claimed: willClaimed,
        updated_at: new Date().toISOString()
      });

      if (willComplete && !userTask?.is_completed) {
        notificationsToInsert.push({
          user_id: uid,
          title: `🎉 Task Completed: ${title}!`,
          body: `You completed "${title}". Head over to My Vouchers to claim your reward!`,
          is_read: false
        });
      }
    }

    // 4. Execute single batch upsert
    const { error: upsertErr } = await supabaseAdmin
      .from('user_discount_tasks')
      .upsert(batchToUpsert, { onConflict: 'user_id,task_key' });

    if (upsertErr) {
      console.error('Batch upsert error:', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    if (notificationsToInsert.length > 0) {
      supabaseAdmin.from('notifications').insert(notificationsToInsert).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `Successfully awarded task to ${updatedCount} customer(s)!`,
      updatedCount
    });
  } catch (err) {
    console.error('Manual award task error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
