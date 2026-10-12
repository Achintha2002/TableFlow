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
    const { data: task, error: taskErr } = await supabaseAdmin
      .from('reward_tasks')
      .select('*')
      .eq('task_key', task_key)
      .maybeSingle();

    const title = task?.title || task_key;
    const targetProgress = task?.target_progress || 1;

    // 2. Determine target users
    let targetUserIds = [];
    if (user_id && user_id !== 'all') {
      targetUserIds = [user_id];
    } else {
      // Fetch recent customer IDs
      const { data: customers } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'customer')
        .limit(50);
      targetUserIds = (customers || []).map(c => c.id);
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'No customers found to award task' }, { status: 404 });
    }

    let updatedCount = 0;
    for (const uid of targetUserIds) {
      // Find or create user_discount_task
      const { data: userTask } = await supabaseAdmin
        .from('user_discount_tasks')
        .select('*')
        .eq('user_id', uid)
        .eq('task_key', task_key)
        .maybeSingle();

      const current = userTask?.current_progress || 0;
      let nextProgress = current;
      let willComplete = false;

      if (action === 'complete') {
        nextProgress = targetProgress;
        willComplete = true;
      } else {
        nextProgress = Math.min(targetProgress, current + count);
        willComplete = nextProgress >= targetProgress;
      }

      const upsertData = {
        user_id: uid,
        task_key: task_key,
        title: title,
        description: task?.description || 'Exclusive TableFlow Challenge',
        current_progress: nextProgress,
        target_progress: targetProgress,
        reward_discount_percent: task?.reward_discount_percent || 10,
        is_completed: willComplete,
        is_claimed: userTask?.is_claimed || false,
        updated_at: new Date().toISOString()
      };

      if (userTask?.id) {
        await supabaseAdmin
          .from('user_discount_tasks')
          .update(upsertData)
          .eq('id', userTask.id);
      } else {
        await supabaseAdmin
          .from('user_discount_tasks')
          .insert(upsertData);
      }

      updatedCount++;

      // If newly completed, send in-app notification
      if (willComplete && !userTask?.is_completed) {
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: uid,
            title: `🎉 Task Completed: ${title}!`,
            body: `Admin awarded you completion for "${title}". Head over to My Vouchers to claim your reward!`,
            is_read: false
          });
      }
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
