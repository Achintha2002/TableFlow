import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

const DEFAULT_TASKS = [
  {
    task_key: 'dine_3_orders',
    title: 'Dine-In Explorer',
    description: 'Complete 3 served dine-in meals at TableFlow to unlock 10% OFF.',
    icon_type: 'restaurant',
    target_progress: 3,
    reward_discount_percent: 10,
    trigger_type: 'dine_in_orders',
    trigger_value: null,
    is_active: true
  },
  {
    task_key: 'weekday_booking',
    title: 'Weekday Gourmet',
    description: 'Book and complete a table reservation between Monday and Thursday.',
    icon_type: 'calendar',
    target_progress: 1,
    reward_discount_percent: 10,
    trigger_type: 'weekday_booking',
    trigger_value: null,
    is_active: true
  },
  {
    task_key: 'chef_special',
    title: "Chef's Signature Fan",
    description: "Order any signature dish from our Chef's Special menu.",
    icon_type: 'flame',
    target_progress: 1,
    reward_discount_percent: 10,
    trigger_type: 'chef_special',
    trigger_value: null,
    is_active: true
  }
];

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const resetKey = url.searchParams.get('reset');


    if (resetKey) {
      try {
        await supabaseAdmin
          .from('user_discount_tasks')
          .update({
            current_progress: 0,
            is_completed: false,
            is_claimed: false,
            updated_at: new Date().toISOString()
          })
          .eq('task_key', resetKey);
      } catch (_) {}
    }

    const { data: tasks, error } = await supabaseAdmin
      .from('reward_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      const errMsg = error.message || '';
      const isMissing =
        errMsg.includes('does not exist') ||
        errMsg.includes('Could not find the table') ||
        errMsg.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.code === 'PGRST200';

      if (isMissing) {
        return NextResponse.json({
          success: true,
          tableNotCreated: true,
          tasks: DEFAULT_TASKS
        });
      }

      console.error('Fetch reward_tasks error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If table exists but empty, auto seed default tasks
    if (!tasks || tasks.length === 0) {
      const { data: seeded } = await supabaseAdmin
        .from('reward_tasks')
        .insert(DEFAULT_TASKS)
        .select();

      return NextResponse.json({
        success: true,
        tableNotCreated: false,
        tasks: seeded || DEFAULT_TASKS
      });
    }

    // Also fetch stats: how many total user completions & claims
    const { data: userStats } = await supabaseAdmin
      .from('user_discount_tasks')
      .select('task_key, is_completed, is_claimed');

    const statsMap = {};
    if (userStats) {
      userStats.forEach(st => {
        if (!statsMap[st.task_key]) {
          statsMap[st.task_key] = { activeCount: 0, completedCount: 0, claimedCount: 0 };
        }
        statsMap[st.task_key].activeCount++;
        if (st.is_completed) statsMap[st.task_key].completedCount++;
        if (st.is_claimed) statsMap[st.task_key].claimedCount++;
      });
    }

    const enriched = tasks.map(t => ({
      ...t,
      stats: statsMap[t.task_key] || { activeCount: 0, completedCount: 0, claimedCount: 0 }
    }));

    return NextResponse.json({
      success: true,
      tableNotCreated: false,
      tasks: enriched
    });
  } catch (err) {
    console.error('Reward tasks GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      task_key,
      icon_type = 'restaurant',
      target_progress = 1,
      reward_discount_percent = 10,
      trigger_type = 'dine_in_orders',
      trigger_value = null,
      is_active = true
    } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    // Generate unique slug key if not supplied
    const finalKey = (task_key || title.toLowerCase().replace(/[^a-z0-9]+/g, '_'))
      .trim()
      .replace(/^_+|_+$/g, '');

    const nowIso = new Date().toISOString();
    const record = {
      task_key: finalKey,
      title: title.trim(),
      description: description.trim(),
      icon_type,
      target_progress: parseInt(target_progress) || 1,
      reward_discount_percent: parseInt(reward_discount_percent) || 10,
      trigger_type,
      trigger_value: trigger_value ? parseFloat(trigger_value) : null,
      is_active: Boolean(is_active),
      created_at: nowIso,
      updated_at: nowIso
    };

    const { data, error } = await supabaseAdmin
      .from('reward_tasks')
      .insert(record)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync task to all existing users' discount tasks so they immediately see it starting at 0 progress
    try {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id')
        .limit(500);

      if (users && users.length > 0) {
        const toInsert = users.map(u => ({
          user_id: u.id,
          task_key: record.task_key,
          title: record.title,
          description: record.description,
          current_progress: 0,
          target_progress: record.target_progress,
          reward_discount_percent: record.reward_discount_percent,
          is_completed: false,
          is_claimed: false,
          created_at: nowIso,
          updated_at: nowIso
        }));

        // Upsert to ensure any recycled or existing task key starts freshly at 0 progress
        await supabaseAdmin
          .from('user_discount_tasks')
          .upsert(toInsert, { onConflict: 'user_id,task_key' });
      }
    } catch (syncErr) {
      console.warn('Sync to users warning:', syncErr.message);
    }

    return NextResponse.json({ success: true, task: data });
  } catch (err) {
    console.error('Reward tasks POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id && !updates.task_key) {
      return NextResponse.json({ error: 'Task ID or task_key is required' }, { status: 400 });
    }

    const cleanUpdates = {
      updated_at: new Date().toISOString()
    };
    if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();
    if (updates.description !== undefined) cleanUpdates.description = updates.description.trim();
    if (updates.icon_type !== undefined) cleanUpdates.icon_type = updates.icon_type;
    if (updates.target_progress !== undefined) cleanUpdates.target_progress = parseInt(updates.target_progress) || 1;
    if (updates.reward_discount_percent !== undefined) cleanUpdates.reward_discount_percent = parseInt(updates.reward_discount_percent) || 10;
    if (updates.trigger_type !== undefined) cleanUpdates.trigger_type = updates.trigger_type;
    if (updates.trigger_value !== undefined) {
      cleanUpdates.trigger_value = (updates.trigger_value !== '' && updates.trigger_value !== null)
        ? parseFloat(updates.trigger_value)
        : null;
    }
    if (updates.is_active !== undefined) cleanUpdates.is_active = Boolean(updates.is_active);

    let query = supabaseAdmin.from('reward_tasks').update(cleanUpdates);
    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('task_key', updates.task_key);
    }

    const { data: updatedRows, error } = await query.select();

    if (error) {
      console.error('Reward tasks PUT Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updatedTask = (updatedRows && updatedRows.length > 0) ? updatedRows[0] : null;
    const taskKey = updatedTask?.task_key || updates.task_key;

    // If title or description changed, update user_discount_tasks
    if (taskKey && (cleanUpdates.title || cleanUpdates.description || cleanUpdates.target_progress || cleanUpdates.reward_discount_percent)) {
      try {
        const userUpdates = {
          updated_at: new Date().toISOString()
        };
        if (cleanUpdates.title) userUpdates.title = cleanUpdates.title;
        if (cleanUpdates.description) userUpdates.description = cleanUpdates.description;
        if (cleanUpdates.target_progress) userUpdates.target_progress = cleanUpdates.target_progress;
        if (cleanUpdates.reward_discount_percent) userUpdates.reward_discount_percent = cleanUpdates.reward_discount_percent;

        await supabaseAdmin
          .from('user_discount_tasks')
          .update(userUpdates)
          .eq('task_key', taskKey);
      } catch (e) {
        console.warn('Update user_discount_tasks warning:', e.message);
      }
    }

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (err) {
    console.error('Reward tasks PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('reward_tasks')
      .select('task_key')
      .eq('id', id)
      .single();

    const { error } = await supabaseAdmin
      .from('reward_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optionally cleanup unclaimed user tasks
    if (existing?.task_key) {
      try {
        await supabaseAdmin
          .from('user_discount_tasks')
          .delete()
          .eq('task_key', existing.task_key)
          .eq('is_claimed', false);
      } catch (_) {}
    }

    return NextResponse.json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Reward tasks DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
