const admin = require('firebase-admin');
const supabase = require('../config/supabase.js');
const fs = require('fs');
const path = require('path');

let isSimulationMode = true;
let firebaseApp = null;

// Initialize Firebase Admin SDK
function initFirebase() {
  try {
    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (raw.startsWith('{')) {
        serviceAccount = JSON.parse(raw);
      } else {
        const resolvedPath = path.resolve(process.cwd(), raw);
        if (fs.existsSync(resolvedPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        }
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (fs.existsSync(credPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      }
    }

    if (serviceAccount && serviceAccount.project_id) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      isSimulationMode = false;
      console.log(`\x1b[32m[FCM] Firebase Admin SDK initialized successfully for project: ${serviceAccount.project_id}\x1b[0m`);
    } else {
      isSimulationMode = true;
      console.warn('\x1b[33m⚠️ [FCM] Running in SIMULATION MODE — no real push will be sent (FIREBASE_SERVICE_ACCOUNT not configured)\x1b[0m');
    }
  } catch (err) {
    isSimulationMode = true;
    console.error('\x1b[31m[FCM] Initialization failed, falling back to SIMULATION MODE:\x1b[0m', err.message);
  }
}

initFirebase();

/**
 * Normalizes all data payload values to strings (required by FCM data payload)
 */
function sanitizeDataPayload(data = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    sanitized[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return sanitized;
}

/**
 * Records an in-app notification in the database with graceful column fallback
 */
async function recordNotification(userId, { title, body, data = {}, type = 'general' }) {
  if (!userId) return null;
  try {
    // Attempt insert with rich schema (data, type)
    const { data: inserted, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        body,
        data,
        type,
        is_read: false
      })
      .select()
      .maybeSingle();

    if (error) {
      // Fallback for legacy notifications schema (without data/type columns)
      const { data: fallbackInserted } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          body,
          is_read: false
        })
        .select()
        .maybeSingle();
      return fallbackInserted;
    }

    return inserted;
  } catch (err) {
    console.error('[FCM] Error saving in-app notification:', err.message);
    return null;
  }
}

/**
 * Fetches all registered device tokens for a user (checks user_devices, falls back to users.fcm_token)
 */
async function getUserTokens(userId) {
  if (!userId) return [];
  const tokens = new Set();

  try {
    // Try user_devices table
    const { data: devices, error } = await supabase
      .from('user_devices')
      .select('fcm_token')
      .eq('user_id', userId);

    if (!error && devices && devices.length > 0) {
      devices.forEach(d => {
        if (d.fcm_token) tokens.add(d.fcm_token);
      });
    }
  } catch (_) {
    // user_devices table might not exist yet
  }

  // Fallback to legacy single fcm_token on users table
  try {
    const { data: user } = await supabase
      .from('users')
      .select('fcm_token')
      .eq('id', userId)
      .maybeSingle();

    if (user && user.fcm_token) {
      tokens.add(user.fcm_token);
    }
  } catch (_) {}

  return Array.from(tokens);
}

/**
 * Cleans up dead / unregistered device tokens from the database
 */
async function cleanupInvalidToken(userId, token) {
  if (!token) return;
  console.log(`[FCM] Pruning invalid/unregistered token for user ${userId}: ${token.slice(0, 16)}...`);

  try {
    await supabase
      .from('user_devices')
      .delete()
      .eq('fcm_token', token);
  } catch (_) {}

  try {
    await supabase
      .from('users')
      .update({ fcm_token: null })
      .eq('id', userId)
      .eq('fcm_token', token);
  } catch (_) {}
}

/**
 * Dispatches a push notification to a specific user across all their active devices
 */
async function sendToUser(userId, { title, body, data = {}, type = 'general', sound = 'default' }) {
  // 1. Always record in in-app notification history first
  await recordNotification(userId, { title, body, data, type });

  // 2. Fetch all registered tokens
  const tokens = await getUserTokens(userId);

  // 3. Handle simulation mode or no devices
  if (isSimulationMode || tokens.length === 0) {
    console.log(`\x1b[36m[FCM Simulation]\x1b[0m User: ${userId} (${tokens.length} tokens) | "${title}" - "${body}" | Data:`, data);
    return {
      success: true,
      mode: isSimulationMode ? 'simulation' : 'no_tokens',
      deliveredCount: 0,
      tokenCount: tokens.length
    };
  }

  // 4. Live multicast dispatch
  try {
    const stringData = sanitizeDataPayload({ ...data, type });
    const message = {
      tokens,
      notification: { title, body },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          sound,
          channelId: 'tableflow_notifications'
        }
      },
      apns: {
        payload: {
          aps: {
            sound,
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Prune expired / invalid tokens
    if (response.failureCount > 0) {
      const deadTokenCodes = [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
        'messaging/invalid-argument'
      ];

      for (let i = 0; i < response.responses.length; i++) {
        const res = response.responses[i];
        if (!res.success && res.error) {
          if (deadTokenCodes.includes(res.error.code)) {
            await cleanupInvalidToken(userId, tokens[i]);
          }
        }
      }
    }

    console.log(`[FCM Live] Dispatched to user ${userId}: ${response.successCount} succeeded, ${response.failureCount} failed`);
    return {
      success: true,
      mode: 'live',
      deliveredCount: response.successCount,
      failedCount: response.failureCount
    };
  } catch (err) {
    console.error(`[FCM Live Error] Failed to send to user ${userId}:`, err.message);
    return {
      success: false,
      mode: 'live_error',
      error: err.message
    };
  }
}

/**
 * Batched send to multiple users (e.g. notifying a list of queue entries)
 */
async function sendBatchToUsers(userIds, { title, body, data = {}, type = 'general' }) {
  if (!Array.isArray(userIds) || userIds.length === 0) return { success: true, count: 0 };

  const results = [];
  for (const userId of userIds) {
    try {
      const res = await sendToUser(userId, { title, body, data, type });
      results.push(res);
    } catch (err) {
      console.error(`[FCM Batch] Error notifying ${userId}:`, err.message);
    }
  }

  return {
    success: true,
    total: userIds.length,
    results
  };
}

/**
 * Dispatches a notification to a topic (e.g. 'staff-service-calls')
 */
async function sendToTopic(topic, { title, body, data = {}, sound = 'default' }) {
  if (isSimulationMode) {
    console.log(`\x1b[35m[FCM Topic Simulation]\x1b[0m Topic: ${topic} | "${title}" - "${body}" | Data:`, data);
    return { success: true, mode: 'simulation', topic };
  }

  try {
    const stringData = sanitizeDataPayload(data);
    const message = {
      topic,
      notification: { title, body },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          sound,
          channelId: 'tableflow_staff_alerts'
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`[FCM Topic Live] Dispatched to topic ${topic}: ${response}`);
    return { success: true, mode: 'live', messageId: response };
  } catch (err) {
    console.error(`[FCM Topic Error] Failed to send to topic ${topic}:`, err.message);
    return { success: false, mode: 'live_error', error: err.message };
  }
}

/**
 * Returns FCM runtime status for /api/health
 */
function getFCMStatus() {
  return {
    mode: isSimulationMode ? 'simulation' : 'live',
    configured: !isSimulationMode
  };
}

module.exports = {
  sendToUser,
  sendBatchToUsers,
  sendToTopic,
  recordNotification,
  getUserTokens,
  cleanupInvalidToken,
  getFCMStatus
};
