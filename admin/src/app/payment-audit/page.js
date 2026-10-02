"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  FileCheck, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Copy, 
  Check, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Ban,
  Download,
  Calendar,
  Filter,
  FileText,
  Printer,
  TrendingUp,
  X
} from 'lucide-react';

const CANNED_REASONS = [
  "Reference number not found on bank statement",
  "Amount mismatch (paid amount is less than order total)",
  "Slip image is blurry or illegible",
  "Duplicate receipt already used for another order",
  "Transferred to incorrect bank account"
];

export default function PaymentAuditPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const [dateRange, setDateRange] = useState('all'); // 'all', 'today', '7d', '14d', '30d'
  const [activeModalOrder, setActiveModalOrder] = useState(null); // for slip preview lightbox
  const [rejectingOrder, setRejectingOrder] = useState(null); // for reject reason modal
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedRef, setCopiedRef] = useState(null);

  // Lightbox view state (zoom & rotation)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }

  // Live timer tick every 30s to keep elapsed time accurate in real-time
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  function formatAuditTime(timestamp) {
    if (!timestamp) return { date: '—', time: '—', full: '—', ago: '—' };
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return { date: timestamp, time: '', full: timestamp, ago: '' };

    const dateStr = date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    let ago = 'Just now';
    if (elapsedMinutes >= 60 * 24) {
      ago = `${Math.floor(elapsedMinutes / (60 * 24))}d ago`;
    } else if (elapsedMinutes >= 60) {
      ago = `${Math.floor(elapsedMinutes / 60)}h ago`;
    } else if (elapsedMinutes >= 1) {
      ago = `${elapsedMinutes}m ago`;
    }

    return {
      date: dateStr,
      time: timeStr,
      full: `${dateStr}, ${timeStr}`,
      ago
    };
  }

  function isWithinDateRange(timestamp, range) {
    if (range === 'all' || !timestamp) return true;
    const itemDate = new Date(timestamp).getTime();
    if (isNaN(itemDate)) return true;
    const now = Date.now();

    if (range === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return itemDate >= todayStart.getTime();
    }
    if (range === '7d') {
      return itemDate >= now - (7 * 24 * 60 * 60 * 1000);
    }
    if (range === '14d') {
      return itemDate >= now - (14 * 24 * 60 * 60 * 1000);
    }
    if (range === '30d') {
      return itemDate >= now - (30 * 24 * 60 * 60 * 1000);
    }
    return true;
  }

  function notifyOrdersUpdated() {
    try {
      if (typeof window !== 'undefined') {
        if (window.BroadcastChannel) {
          const bc = new BroadcastChannel('tableflow_orders_channel');
          bc.postMessage({ type: 'PAYMENT_AUDIT_UPDATED', timestamp: Date.now() });
          bc.close();
        }
        localStorage.setItem('tableflow_orders_last_updated', Date.now().toString());
      }
    } catch (_) {}
  }

  async function enrichOrdersWithSlips(ordersList, transactionsList = []) {
    const userFilesCache = new Map();
    const txMap = new Map();
    (transactionsList || []).forEach(t => {
      if (t.order_id) txMap.set(String(t.order_id), t);
    });

    return Promise.all((ordersList || []).map(async (order) => {
      let trans = order.payment_transaction || txMap.get(String(order.id)) || null;
      let slipUrl = trans?.slip_url || null;
      let slipPath = trans?.slip_path || null;

      const notes = (order.special_notes || '');
      const notesLower = notes.toLowerCase();

      const refMatch = notes.match(/\[Bank Transfer Ref:\s*([^\]|]+)/i) ||
                       notes.match(/Ref(?:erence)?[:\s#]+([A-Za-z0-9_-]+)/i);
      const slipMatch = notes.match(/Slip:\s*([^\s\]]+)/i);
      const rejectMatch = notes.match(/\[Rejected:\s*([^\]]+)\]/i) ||
                          notes.match(/\[Payment Rejected:\s*([^\]]+)\]/i) ||
                          notes.match(/\[Reason:\s*([^\]]+)\]/i);

      if (!slipPath && slipMatch) {
        slipPath = slipMatch[1].trim();
      }

      const isBankTransfer = (order.payment_method === 'bank_transfer') ||
                             (trans?.payment_method === 'bank_transfer') ||
                             Boolean(refMatch) ||
                             Boolean(slipMatch) ||
                             notesLower.includes('bank transfer') ||
                             notesLower.includes('slip') ||
                             order.status === 'payment_pending' ||
                             order.status === 'payment_rejected';

      const userId = order.users?.id || order.user_id;

      // Only search Supabase storage for bank transfer orders needing slip resolution
      if (isBankTransfer && !slipUrl && !slipPath && userId) {
        try {
          if (!userFilesCache.has(userId)) {
            const { data: userFiles, error: listErr } = await supabase.storage
              .from('payment-slips')
              .list(userId, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
            userFilesCache.set(userId, (!listErr && userFiles) ? userFiles : []);
          }

          const files = userFilesCache.get(userId) || [];
          if (files.length > 0) {
            const orderTime = new Date(order.created_at).getTime();
            const sorted = [...files].sort((a, b) => {
              const tsA = parseInt(a.name.split('_')[0], 10) || 0;
              const tsB = parseInt(b.name.split('_')[0], 10) || 0;
              return Math.abs(tsA - orderTime) - Math.abs(tsB - orderTime);
            });
            slipPath = `${userId}/${sorted[0].name}`;
          }
        } catch (_) {}
      }

      if (slipPath && !slipUrl) {
        try {
          const { data } = await supabase.storage
            .from('payment-slips')
            .createSignedUrl(slipPath, 86400);
          slipUrl = data?.signedUrl || null;
        } catch (_) {}

        if (!slipUrl) {
          try {
            const { data: pData } = supabase.storage
              .from('payment-slips')
              .getPublicUrl(slipPath);
            slipUrl = pData?.publicUrl || null;
          } catch (_) {}
        }
      }

      // Accurately determine payment method from notes, transactions or status
      let paymentMethodName = order.payment_method || trans?.payment_method || null;
      if (!paymentMethodName) {
        if (notesLower.includes('[settled: card') || notesLower.includes('[table settled: card') || notesLower.includes('card')) {
          paymentMethodName = 'card';
        } else if (isBankTransfer) {
          paymentMethodName = 'bank_transfer';
        } else if (notesLower.includes('online')) {
          paymentMethodName = 'online';
        } else {
          paymentMethodName = 'cash';
        }
      }

      const transactionRef = trans?.transaction_reference || 
                             (refMatch ? refMatch[1].trim() : `${paymentMethodName.toUpperCase()}-${String(order.id).slice(0, 8).toUpperCase()}`);

      const rejectionReasonVal = trans?.rejection_reason || 
                                (rejectMatch ? rejectMatch[1].trim() : (order.payment_status === 'failed' || order.status === 'cancelled' || order.status === 'payment_rejected' ? 'Payment rejected or order cancelled by desk' : null));

      let determinedStatus = 'pending_verification';
      if (order.payment_status === 'failed' || order.status === 'cancelled' || order.status === 'payment_rejected' || trans?.status === 'rejected' || rejectMatch) {
        determinedStatus = 'rejected';
      } else if (order.payment_status === 'paid' || ['completed', 'served', 'preparing', 'ready', 'confirmed'].includes(order.status) || trans?.status === 'approved') {
        determinedStatus = 'approved';
      }

      const channelName = trans?.bank_name || 
                          (notes.match(/Bank:\s*([^\s\]|]+)/i)?.[1]?.trim()) ||
                          (paymentMethodName === 'cash' ? 'Cash Tender (POS)' : 
                           paymentMethodName === 'card' ? 'Card Terminal (POS)' : 
                           paymentMethodName === 'online' ? 'Online Payment' : 
                           'Direct Transfer');

      const enrichedTrans = {
        id: trans?.id || `pt_${order.id}`,
        order_id: order.id,
        user_id: userId,
        payment_method: paymentMethodName,
        transaction_reference: transactionRef,
        bank_name: channelName,
        amount_paid: Number(order.total_amount) || 0,
        status: determinedStatus,
        slip_path: slipPath,
        slip_url: slipUrl,
        rejection_reason: rejectionReasonVal,
        reviewed_at: trans?.reviewed_at || trans?.updated_at || order.created_at,
        reviewed_by: trans?.reviewed_by || null,
        created_at: trans?.created_at || order.created_at,
        updated_at: trans?.updated_at || order.created_at
      };

      return {
        ...order,
        payment_method: paymentMethodName,
        payment_transaction: enrichedTrans
      };
    }));
  }

  async function fetchVerificationQueue() {
    try {
      setRefreshing(true);

      // 1. Fetch payment_transactions
      let txList = [];
      try {
        const { data: txData } = await supabase
          .from('payment_transactions')
          .select('*')
          .order('created_at', { ascending: false });
        txList = txData || [];
      } catch (e) {
        console.warn('payment_transactions query notice:', e.message);
      }

      // 2. Fetch all orders with multi-tier fallback so schema variations never blank the ledger
      let auditOrders = [];

      // Primary fetch: queries standard columns on orders (no updated_at / payment_method column dependency)
      const { data: primaryOrders, error: primaryErr } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          payment_status,
          special_notes,
          created_at,
          users (id, full_name, email, phone_number),
          restaurant_tables (table_number),
          order_items (
            id,
            quantity,
            unit_price,
            menu_items (id, name, price, image_url)
          )
        `)
        .order('created_at', { ascending: false });

      if (primaryErr) {
        console.warn('Primary DB fetch notice, trying standard schema:', primaryErr.message);
        const { data: stdOrders, error: stdErr } = await supabase
          .from('orders')
          .select(`
            id,
            total_amount,
            status,
            payment_status,
            special_notes,
            created_at,
            users (full_name),
            restaurant_tables (table_number),
            order_items (
              id,
              quantity,
              unit_price,
              menu_items (name)
            )
          `)
          .order('created_at', { ascending: false });

        if (stdErr) {
          console.warn('Standard schema fetch notice, trying basic orders:', stdErr.message);
          const { data: bareOrders } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
          auditOrders = bareOrders || [];
        } else {
          auditOrders = stdOrders || [];
        }
      } else {
        auditOrders = primaryOrders || [];
      }

      const enriched = await enrichOrdersWithSlips(auditOrders, txList);
      setOrders(enriched);
    } catch (err) {
      console.warn('Fetch queue notice:', err.message);
      showToast(err.message, true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchVerificationQueue();

    // Listen to realtime changes on orders & payment_transactions
    const ordersChannel = supabase
      .channel('payment_audit_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchVerificationQueue();
      })
      .subscribe();

    const transChannel = supabase
      .channel('payment_audit_trans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions' }, () => {
        fetchVerificationQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(transChannel);
    };
  }, []);

  // Handle Approve
  async function handleApprove(orderId) {
    try {
      setIsProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let success = false;
      if (token) {
        try {
          const res = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/verify`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'approve' })
          });
          if (res.ok) success = true;
        } catch (_) {}
      }

      if (!success) {
        // Fallback directly to Supabase update
        const { error: upErr } = await supabase
          .from('orders')
          .update({
            status: 'pending',
            payment_status: 'paid'
          })
          .eq('id', orderId);

        if (upErr) throw new Error(upErr.message);

        try {
          await supabase
            .from('payment_transactions')
            .update({
              status: 'approved',
              updated_at: new Date().toISOString()
            })
            .eq('order_id', orderId);
        } catch (_) {}
      }

      showToast(`Order #${orderId} payment verified! Food order sent to kitchen.`);
      setActiveModalOrder(null);
      notifyOrdersUpdated();
      fetchVerificationQueue();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsProcessing(false);
    }
  }

  // Handle Reject
  async function handleConfirmReject() {
    if (!rejectingOrder) return;
    try {
      setIsProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const reason = rejectionReason || 'Payment verification failed';

      let success = false;
      if (token) {
        try {
          const res = await fetch(`http://localhost:3000/api/admin/orders/${rejectingOrder.id}/verify`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'reject',
              rejection_reason: reason
            })
          });
          if (res.ok) success = true;
        } catch (_) {}
      }

      const cleanNotes = (rejectingOrder.special_notes || '')
        .replace(/\[Rejected:[^\]]+\]/g, '')
        .replace(/\[Payment Rejected:[^\]]+\]/g, '')
        .trim();
      const rejectedNotes = `[Rejected: ${reason}] ${cleanNotes}`.trim();

      if (!success) {
        // Fallback directly to Supabase update with status: 'cancelled'
        let { error: rejErr } = await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            payment_status: 'failed',
            special_notes: rejectedNotes
          })
          .eq('id', rejectingOrder.id);

        if (rejErr) {
          await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              special_notes: rejectedNotes
            })
            .eq('id', rejectingOrder.id);
        }

        try {
          await supabase
            .from('payment_transactions')
            .upsert({
              order_id: rejectingOrder.id,
              user_id: rejectingOrder.user_id,
              status: 'rejected',
              rejection_reason: reason,
              updated_at: new Date().toISOString()
            }, { onConflict: 'order_id' });
        } catch (_) {}
      }

      // Optimistically update local state immediately
      setOrders(prev => prev.map(o => {
        if (o.id === rejectingOrder.id) {
          return {
            ...o,
            status: 'cancelled',
            payment_status: 'failed',
            special_notes: rejectedNotes,
            payment_transaction: {
              ...(o.payment_transaction || {}),
              status: 'rejected',
              rejection_reason: reason
            }
          };
        }
        return o;
      }));

      showToast(`Order #${String(rejectingOrder.id).slice(0, 8)} payment rejected. Customer notified.`);
      setRejectingOrder(null);
      setRejectionReason('');
      setActiveModalOrder(null);
      notifyOrdersUpdated();
      fetchVerificationQueue();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setIsProcessing(false);
    }
  }

  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    setTimeout(() => setCopiedRef(null), 2000);
  }

  function isOrderRejected(order) {
    if (order.status === 'payment_rejected') return true;
    if (order.payment_transaction?.status === 'rejected') return true;
    if (order.payment_status === 'failed') return true;
    if (order.status === 'cancelled') return true;
    const notesLower = (order.special_notes || '').toLowerCase();
    if (notesLower.includes('[rejected:') || notesLower.includes('[payment rejected:') || notesLower.includes('reject')) return true;
    return false;
  }

  function isOrderApproved(order) {
    if (isOrderRejected(order)) return false;
    if (order.payment_transaction?.status === 'approved') return true;
    if (order.payment_status === 'paid') return true;
    if (['completed', 'served', 'preparing', 'ready', 'confirmed'].includes(order.status) && order.payment_status !== 'failed') return true;
    return false;
  }

  function isOrderPending(order) {
    if (isOrderRejected(order)) return false;
    if (isOrderApproved(order)) return false;
    return true;
  }

  // Filtered orders by Date Range, Status & Search Query
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Date Range Filter
      if (!isWithinDateRange(order.created_at, dateRange)) return false;

      // 2. Status Filter
      if (filterStatus === 'pending' && !isOrderPending(order)) return false;
      if (filterStatus === 'approved' && !isOrderApproved(order)) return false;
      if (filterStatus === 'rejected' && !isOrderRejected(order)) return false;

      // 3. Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const orderId = String(order.id);
      const ref = (order.payment_transaction?.transaction_reference || order.special_notes || '').toLowerCase();
      const custName = (order.users?.full_name || '').toLowerCase();
      const phone = (order.users?.phone_number || '').toLowerCase();
      const reason = (order.payment_transaction?.rejection_reason || '').toLowerCase();
      const bank = (order.payment_transaction?.bank_name || '').toLowerCase();
      return orderId.includes(q) || ref.includes(q) || custName.includes(q) || phone.includes(q) || reason.includes(q) || bank.includes(q);
    });
  }, [orders, dateRange, filterStatus, searchQuery]);

  // Counts in current Date Range
  const ordersInDateRange = useMemo(() => {
    return orders.filter(o => isWithinDateRange(o.created_at, dateRange));
  }, [orders, dateRange]);

  const pendingCount = ordersInDateRange.filter(isOrderPending).length;
  const approvedCount = ordersInDateRange.filter(isOrderApproved).length;
  const rejectedCount = ordersInDateRange.filter(isOrderRejected).length;
  const allCount = ordersInDateRange.length;

  const totalAuditedVolume = ordersInDateRange.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const approvedVolume = ordersInDateRange.filter(isOrderApproved).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const rejectedVolume = ordersInDateRange.filter(isOrderRejected).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const pendingVolume = ordersInDateRange.filter(isOrderPending).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // ── EXECUTIVE PDF EXPORT ENGINE ──
  function handleExportPDF() {
    const existingIframe = document.getElementById('tableflow-audit-print-frame');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'tableflow-audit-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const rangeLabel = dateRange === 'today' ? 'Today' 
                     : dateRange === '7d' ? 'Last 7 Days' 
                     : dateRange === '14d' ? 'Last 2 Weeks (14 Days)' 
                     : dateRange === '30d' ? 'Last 30 Days' 
                     : 'All Time History';

    const statusLabel = filterStatus === 'approved' ? 'Approved & Settled Transactions'
                      : filterStatus === 'rejected' ? 'Rejected / Disputed Payment Audit'
                      : filterStatus === 'pending' ? 'Pending Verifications'
                      : 'Consolidated Payment Audit Ledger (All Records)';

    const rowsHtml = filteredOrders.map((o, idx) => {
      const trans = o.payment_transaction;
      const timing = formatAuditTime(o.created_at);
      const isApp = isOrderApproved(o);
      const isRej = isOrderRejected(o);
      const statusText = isApp ? 'APPROVED' : isRej ? 'REJECTED' : 'PENDING';
      const statusColor = isApp ? '#059669' : isRej ? '#dc2626' : '#d97706';
      const statusBg = isApp ? '#ecfdf5' : isRej ? '#fef2f2' : '#fffbeb';
      const reason = trans?.rejection_reason || 'Verification rejected by auditor';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 7px 6px; font-weight: bold; color: #1e293b;">#${idx + 1}</td>
          <td style="padding: 7px 6px; white-space: nowrap;">
            <strong>${timing.date}</strong><br/>
            <span style="color: #64748b; font-size: 10px;">${timing.time}</span>
          </td>
          <td style="padding: 7px 6px;">
            <strong>#${String(o.id).slice(0, 8)}</strong>
            ${o.restaurant_tables?.table_number ? `<br/><span style="color: #3b82f6; font-size: 10px;">Table #${o.restaurant_tables.table_number}</span>` : ''}
          </td>
          <td style="padding: 7px 6px;">
            <strong>${o.users?.full_name || 'Guest User'}</strong><br/>
            <span style="color: #64748b; font-size: 10px;">${o.users?.phone_number || o.users?.email || '—'}</span>
          </td>
          <td style="padding: 7px 6px; font-family: monospace; font-size: 10px;">
            ${trans?.transaction_reference || '—'}<br/>
            <span style="color: #64748b;">${trans?.bank_name || 'Bank Transfer'}</span>
          </td>
          <td style="padding: 7px 6px; text-align: right; font-weight: bold; white-space: nowrap;">
            LKR ${Number(o.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="padding: 7px 6px; text-align: center;">
            <span style="background: ${statusBg}; color: ${statusColor}; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; display: inline-block;">
              ${statusText}
            </span>
          </td>
          <td style="padding: 7px 6px; font-size: 10px;">
            ${isRej ? `<div style="background: #fef2f2; color: #991b1b; padding: 4px 6px; border-radius: 4px; border: 1px solid #fecaca; font-weight: 600;">⚠️ REASON: ${reason}</div>` 
                    : isApp ? `<span style="color: #059669; font-weight: 600;">✓ Verified & Released to Kitchen</span>` 
                    : `<span style="color: #d97706; font-weight: 600;">⏳ Awaiting Slip Inspection</span>`}
          </td>
        </tr>
      `;
    }).join('');

    const nowFormatted = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const doc = iframe.contentWindow || iframe.contentDocument;
    const iframeDoc = doc.document || doc;

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TableFlow Payment Audit Report</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              font-size: 12px;
              line-height: 1.4;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #b87f5c;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .brand-title {
              font-size: 20px;
              font-weight: 800;
              letter-spacing: 0.5px;
              color: #b87f5c;
              margin: 0;
            }
            .brand-sub {
              font-size: 11px;
              color: #64748b;
              margin: 2px 0 0 0;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 16px;
            }
            .summary-box {
              padding: 10px 12px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              background: #f8fafc;
            }
            .summary-label {
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 700;
              color: #64748b;
            }
            .summary-val {
              font-size: 16px;
              font-weight: 800;
              margin-top: 3px;
              color: #0f172a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
            }
            th {
              background: #f1f5f9;
              padding: 8px 6px;
              text-align: left;
              font-size: 10px;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #cbd5e1;
            }
            .footer-sign {
              margin-top: 26px;
              display: flex;
              justify-content: space-between;
              padding-top: 14px;
              border-top: 1px dashed #cbd5e1;
              font-size: 11px;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="brand-title">TABLEFLOW BOUTIQUE</h1>
              <p class="brand-sub">Official Financial & Payment Verification Audit Report</p>
              <p style="font-size: 10px; color: #94a3b8; margin: 2px 0 0 0;">123 Galle Road, Colombo 03 • Tel: +94 11 234 5678</p>
            </div>
            <div style="text-align: right; font-size: 11px;">
              <div><strong>Period:</strong> ${rangeLabel}</div>
              <div><strong>Report:</strong> ${statusLabel}</div>
              <div><strong>Generated:</strong> ${nowFormatted}</div>
              <div><strong>Total Records:</strong> ${filteredOrders.length}</div>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-box">
              <div class="summary-label">Total Audited Volume</div>
              <div class="summary-val">LKR ${totalAuditedVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="summary-box" style="border-left: 3px solid #10b981;">
              <div class="summary-label">Approved Settlements</div>
              <div class="summary-val" style="color: #059669;">LKR ${approvedVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${approvedCount} orders verified</div>
            </div>
            <div class="summary-box" style="border-left: 3px solid #ef4444;">
              <div class="summary-label">Rejected / Disputed</div>
              <div class="summary-val" style="color: #dc2626;">LKR ${rejectedVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${rejectedCount} orders rejected</div>
            </div>
            <div class="summary-box" style="border-left: 3px solid #f59e0b;">
              <div class="summary-label">Pending Verification</div>
              <div class="summary-val" style="color: #d97706;">LKR ${pendingVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${pendingCount} orders awaiting check</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25px;">#</th>
                <th style="width: 90px;">Date & Time</th>
                <th style="width: 75px;">Order ID</th>
                <th style="width: 120px;">Customer</th>
                <th style="width: 110px;">Bank Ref</th>
                <th style="width: 95px; text-align: right;">Amount</th>
                <th style="width: 75px; text-align: center;">Status</th>
                <th>Audit Notes & Rejection Reason</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 24px; color: #94a3b8;">No payment audit records found for the selected criteria.</td></tr>'}
            </tbody>
          </table>

          <div class="footer-sign">
            <div>
              Certified By TableFlow Cashier Desk<br/>
              Authorized Signature: _______________________
            </div>
            <div style="text-align: right;">
              System Generated Audit Ledger • Confidential<br/>
              Powered by TableFlow POS Engine
            </div>
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('PDF print error:', err);
      }
    }, 250);
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, paddingBottom: '32px' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: toast.isError ? '#ef4444' : '#10b981',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toast.isError ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}

      {/* ── TOP HEADER & ACTIONS TOOLBAR ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '22px',
        padding: '18px 22px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(184, 127, 92, 0.16) 0%, rgba(212, 175, 55, 0.16) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <FileCheck size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                Payment Audit Desk
              </h1>
              <p style={{ margin: '2px 0 0 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Bank transfer slip verification, approval history & rejection dispute logs
              </p>
            </div>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Download PDF Button */}
          <button
            onClick={handleExportPDF}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            title="Download or Print Executive Audit PDF Report"
          >
            <Download size={15} color="var(--primary)" />
            <span>Download PDF Report</span>
          </button>

          {/* Refresh Queue Button */}
          <button
            onClick={fetchVerificationQueue}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid var(--border)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} color="var(--primary)" />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── 4 LUXURY EXECUTIVE METRIC CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '22px' }}>
        {/* Card 1: Total Audited Volume */}
        <div style={{
          padding: '18px 20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #faf8f5 100%)',
          border: '1px solid rgba(184, 127, 92, 0.22)',
          boxShadow: '0 6px 18px -4px rgba(184, 127, 92, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Total Audited Volume
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                LKR {totalAuditedVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(184, 127, 92, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {allCount} transactions in {dateRange === 'today' ? 'Today' : dateRange === '7d' ? 'Last 7 Days' : dateRange === '14d' ? 'Last 2 Weeks' : dateRange === '30d' ? 'Last 30 Days' : 'All Time'}
          </div>
        </div>

        {/* Card 2: Approved Settlements */}
        <div style={{
          padding: '18px 20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: '0 6px 18px -4px rgba(16, 185, 129, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Approved Settlements
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                LKR {approvedVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669'
            }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#059669', marginTop: '8px', fontWeight: 600 }}>
            ✓ {approvedCount} payments verified & released
          </div>
        </div>

        {/* Card 3: Rejected / Disputed */}
        <div style={{
          padding: '18px 20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 6px 18px -4px rgba(239, 68, 68, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Rejected / Disputed
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#b91c1c', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {rejectedCount}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444', marginLeft: '6px' }}>
                  ({rejectedVolume > 0 ? `LKR ${rejectedVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '0.00'})
                </span>
              </div>
            </div>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626'
            }}>
              <Ban size={18} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px', fontWeight: 600 }}>
            ⚠️ Issues noted & customers notified
          </div>
        </div>

        {/* Card 4: Awaiting Verification */}
        <div style={{
          padding: '18px 20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          boxShadow: '0 6px 18px -4px rgba(245, 158, 11, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Awaiting Verification
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {pendingCount}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#d97706', marginLeft: '6px' }}>
                  ({pendingVolume > 0 ? `LKR ${pendingVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'LKR 0.00'})
                </span>
              </div>
            </div>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: pendingCount > 0 ? '#b45309' : '#059669', marginTop: '8px', fontWeight: 600 }}>
            {pendingCount > 0 ? '⏳ Action required for order release' : '✨ All slips verified'}
          </div>
        </div>
      </div>

      {/* ── DATE RANGE SELECTOR BAR ── */}
      <div style={{
        marginBottom: '16px',
        padding: '10px 16px',
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="var(--primary)" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Audit Time Horizon:
          </span>
        </div>

        {/* Date Range Selector Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '14d', label: 'Last 2 Weeks' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'all', label: 'All History' }
          ].map(r => {
            const isSel = dateRange === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setDateRange(r.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: isSel ? 700 : 500,
                  border: isSel ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: isSel ? 'linear-gradient(135deg, var(--primary) 0%, #9c6848 100%)' : '#ffffff',
                  color: isSel ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  boxShadow: isSel ? '0 2px 6px rgba(184, 127, 92, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ── */}
      <div style={{ 
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '12px 18px', 
        marginBottom: '20px', 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '14px', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Status Filter Tabs */}
        <div style={{ 
          display: 'inline-flex', 
          background: '#f1f5f9', 
          padding: '4px', 
          borderRadius: '10px',
          gap: '4px',
          flexWrap: 'wrap'
        }}>
          {/* All Submissions */}
          <button
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'all' ? 700 : 500,
              background: filterStatus === 'all' ? '#ffffff' : 'transparent',
              color: filterStatus === 'all' ? '#0f172a' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: filterStatus === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>All Audits</span>
            <span style={{
              background: '#e2e8f0',
              color: '#475569',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {allCount}
            </span>
          </button>

          {/* Pending Verification */}
          <button
            onClick={() => setFilterStatus('pending')}
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'pending' ? 700 : 500,
              background: filterStatus === 'pending' ? '#ffffff' : 'transparent',
              color: filterStatus === 'pending' ? '#b45309' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: filterStatus === 'pending' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
            <span>Pending Verification</span>
            <span style={{
              background: filterStatus === 'pending' ? 'rgba(245, 158, 11, 0.20)' : '#e2e8f0',
              color: filterStatus === 'pending' ? '#b45309' : '#64748b',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {pendingCount}
            </span>
          </button>

          {/* Approved & Settled */}
          <button
            onClick={() => setFilterStatus('approved')}
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'approved' ? 700 : 500,
              background: filterStatus === 'approved' ? '#ffffff' : 'transparent',
              color: filterStatus === 'approved' ? '#047857' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: filterStatus === 'approved' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <CheckCircle2 size={13} color="#10b981" />
            <span>Approved & Settled</span>
            <span style={{
              background: filterStatus === 'approved' ? 'rgba(16, 185, 129, 0.20)' : '#e2e8f0',
              color: filterStatus === 'approved' ? '#047857' : '#64748b',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {approvedCount}
            </span>
          </button>

          {/* Rejected / Disputed */}
          <button
            onClick={() => setFilterStatus('rejected')}
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'rejected' ? 700 : 500,
              background: filterStatus === 'rejected' ? '#ffffff' : 'transparent',
              color: filterStatus === 'rejected' ? '#b91c1c' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: filterStatus === 'rejected' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <XCircle size={13} color="#ef4444" />
            <span>Rejected / Disputed</span>
            <span style={{
              background: filterStatus === 'rejected' ? 'rgba(239, 68, 68, 0.20)' : '#e2e8f0',
              color: filterStatus === 'rejected' ? '#b91c1c' : '#64748b',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              {rejectedCount}
            </span>
          </button>
        </div>

        {/* Clean Search Input */}
        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
          <Search 
            size={15} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: '#94a3b8',
              pointerEvents: 'none'
            }} 
          />
          <input
            type="text"
            placeholder="Filter Order #, Ref, Customer, Reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              paddingLeft: '34px', 
              paddingRight: searchQuery ? '30px' : '12px',
              paddingTop: '8px',
              paddingBottom: '8px',
              width: '100%', 
              fontSize: '0.83rem',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.boxShadow = '0 0 0 3px rgba(184, 127, 92, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px'
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── COMPREHENSIVE PAYMENT AUDIT TABLE ── */}
      <div style={{ 
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px -4px rgba(0,0,0,0.04)'
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', display: 'block', color: 'var(--primary)' }} />
            <h4 style={{ margin: 0, color: '#0f172a', fontSize: '15px' }}>Loading Financial Audit History...</h4>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>Synchronizing bank transfer slips, approvals & dispute reasons</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <CheckCircle2 size={40} style={{ margin: '0 auto 12px auto', display: 'block', color: '#10b981' }} />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontFamily: 'var(--font-serif)' }}>No Records in this Filter</h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>
              No transactions match the selected date range ({dateRange}) and status ({filterStatus}).
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 16px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 700 }}>
                  Date & Real Time
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 700 }}>
                  Order & Table
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 700 }}>
                  Customer
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 700 }}>
                  Bank Reference
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 700 }}>
                  Amount
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 700 }}>
                  Bank Slip
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 700 }}>
                  Audit Status & Notes
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 700, textAlign: 'right' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const trans = order.payment_transaction;
                const isPending = isOrderPending(order);
                const isRejected = isOrderRejected(order);
                const isApproved = isOrderApproved(order);
                const timing = formatAuditTime(order.created_at);

                return (
                  <tr 
                    key={order.id} 
                    style={{ 
                      borderBottom: '1px solid #f1f5f9', 
                      background: isPending ? 'rgba(254, 243, 199, 0.15)' : 'transparent',
                      transition: 'background 0.15s' 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isPending ? 'rgba(254, 243, 199, 0.28)' : '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isPending ? 'rgba(254, 243, 199, 0.15)' : 'transparent'}
                  >
                    {/* 1. Date & Real Time Column */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                        {timing.date}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Clock size={11} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{timing.time}</span>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span style={{ color: '#94a3b8' }}>{timing.ago}</span>
                      </div>
                    </td>

                    {/* 2. Order & Table Column */}
                    <td style={{ padding: '14px 16px' }}>
                      <div 
                        style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem', letterSpacing: '0.4px' }}
                        title={`Order ID: #${order.id}`}
                      >
                        #{String(order.id).length > 10 ? `${String(order.id).slice(0, 8)}...` : order.id}
                      </div>
                      <div style={{ marginTop: '3px' }}>
                        {order.restaurant_tables?.table_number ? (
                          <span style={{ background: 'rgba(59, 130, 246, 0.10)', color: '#2563eb', padding: '2px 7px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700 }}>
                            Table #{order.restaurant_tables.table_number}
                          </span>
                        ) : (
                          <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.70rem', fontWeight: 600 }}>
                            Direct / Takeaway
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Customer Column */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                        {order.users?.full_name || 'Guest User'}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '2px' }}>
                        {order.users?.phone_number || order.users?.email || 'No phone recorded'}
                      </div>
                    </td>

                    {/* 4. Bank Reference Column */}
                    <td style={{ padding: '14px 16px' }}>
                      {trans?.transaction_reference ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <code style={{ 
                            background: 'rgba(184, 127, 92, 0.10)', 
                            color: '#9c6848',
                            padding: '2px 7px', 
                            borderRadius: '5px', 
                            fontSize: '0.78rem', 
                            fontWeight: 700, 
                            letterSpacing: '0.4px' 
                          }}>
                            {trans.transaction_reference}
                          </code>
                          <button
                            onClick={() => copyToClipboard(trans.transaction_reference)}
                            title="Copy Reference Code"
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                          >
                            {copiedRef === trans.transaction_reference ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                      )}
                      {trans?.bank_name && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                          {trans.bank_name}
                        </div>
                      )}
                    </td>

                    {/* 5. Amount Column */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        LKR {Number(order.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.70rem', color: '#94a3b8', marginTop: '1px' }}>
                        {(order.order_items || []).reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)} items
                      </div>
                    </td>

                    {/* 6. Slip Preview Trigger */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => {
                          setActiveModalOrder(order);
                          setZoomLevel(1);
                          setRotation(0);
                        }}
                        style={{
                          padding: '5px 12px',
                          fontSize: '0.76rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: trans?.slip_url ? 'rgba(184, 127, 92, 0.12)' : 'rgba(100, 116, 139, 0.08)',
                          color: trans?.slip_url ? 'var(--primary)' : '#64748b',
                          border: trans?.slip_url ? '1px solid rgba(184, 127, 92, 0.3)' : '1px solid rgba(100, 116, 139, 0.20)',
                          borderRadius: '7px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Eye size={13} /> {trans?.slip_url ? 'View Slip' : 'Inspect'}
                      </button>
                    </td>

                    {/* 7. Audit Status & Reason Column */}
                    <td style={{ padding: '14px 16px', maxWidth: '240px' }}>
                      {isPending && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ 
                            background: 'rgba(245, 158, 11, 0.15)', 
                            color: '#b45309', 
                            padding: '3px 9px', 
                            borderRadius: '5px', 
                            fontSize: '0.74rem', 
                            fontWeight: 800, 
                            letterSpacing: '0.5px' 
                          }}>
                            PENDING REVIEW
                          </span>
                        </div>
                      )}

                      {isApproved && (
                        <div>
                          <span style={{ 
                            background: 'rgba(16, 185, 129, 0.14)', 
                            color: '#047857', 
                            padding: '3px 9px', 
                            borderRadius: '5px', 
                            fontSize: '0.74rem', 
                            fontWeight: 800, 
                            letterSpacing: '0.5px' 
                          }}>
                            ✓ VERIFIED & SETTLED
                          </span>
                          <div style={{ fontSize: '0.70rem', color: '#059669', marginTop: '3px' }}>
                            Order dispatched to Kitchen
                          </div>
                        </div>
                      )}

                      {/* PROMINENT REJECTION REASON DISPLAY */}
                      {isRejected && (
                        <div>
                          <div style={{ display: 'inline-block' }}>
                            <span style={{ 
                              background: 'rgba(239, 68, 68, 0.14)', 
                              color: '#b91c1c', 
                              padding: '3px 9px', 
                              borderRadius: '5px', 
                              fontSize: '0.74rem', 
                              fontWeight: 800, 
                              letterSpacing: '0.5px' 
                            }}>
                              ✕ REJECTED
                            </span>
                          </div>

                          {/* REASON CALLOUT BOX */}
                          <div style={{
                            marginTop: '5px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '5px 8px',
                            fontSize: '0.73rem',
                            color: '#991b1b',
                            lineHeight: 1.35
                          }}>
                            <strong>Reason:</strong> {trans?.rejection_reason || 'Bank reference invalid or verification failed'}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 8. Action Column */}
                    <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isPending ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={isProcessing}
                            title="Verify & Release to Kitchen"
                            style={{
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '7px',
                              fontWeight: 700,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
                            }}
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectingOrder(order);
                              setRejectionReason('');
                            }}
                            disabled={isProcessing}
                            title="Reject Slip"
                            style={{
                              background: 'transparent',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              padding: '6px 10px',
                              borderRadius: '7px',
                              fontWeight: 700,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.76rem', color: isApproved ? '#059669' : '#dc2626', fontWeight: 700 }}>
                          {isApproved ? 'Audited ✓' : 'Disputed ✕'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ============================================================================== */}
      {/* Lightbox Modal: Slip Zoom, Rotate & Side-by-Side Review Pane */}
      {/* ============================================================================== */}
      {activeModalOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            width: '95vw',
            maxWidth: '1100px',
            height: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)'
          }}>
            {/* Modal Topbar */}
            <div style={{
              padding: '16px 22px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>
                  Slip Inspection — Order #{activeModalOrder.id.slice(0, 8)}...
                </span>
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                  BANK TRANSFER
                </span>
                {activeModalOrder.payment_transaction?.slip_url && (
                  <a
                    href={activeModalOrder.payment_transaction.slip_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#b45309',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      background: '#fef3c7',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fde68a'
                    }}
                  >
                    <ExternalLink size={13} /> Open in New Tab
                  </a>
                )}
              </div>
              <button
                onClick={() => setActiveModalOrder(null)}
                style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 10px', borderRadius: '6px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Split Screen */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: Interactive Slip Image Viewer */}
              <div style={{
                flex: 1.2,
                background: '#0f172a',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {/* Image Toolbar Floating */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  zIndex: 10,
                  display: 'flex',
                  gap: '8px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.15)'
                }}>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                    title="Zoom In"
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                    title="Zoom Out"
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    title="Rotate 90°"
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <RotateCw size={18} />
                  </button>
                  <button
                    onClick={() => { setZoomLevel(1); setRotation(0); }}
                    title="Reset View"
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0 4px' }}
                  >
                    Reset
                  </button>
                </div>

                {/* The Slip Image */}
                {activeModalOrder.payment_transaction?.slip_url ? (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'auto',
                    padding: '20px'
                  }}>
                    {activeModalOrder.payment_transaction.slip_url.toLowerCase().includes('.pdf') ? (
                      <div style={{ textAlign: 'center', color: '#fff' }}>
                        <p style={{ marginBottom: '14px', fontSize: '0.95rem' }}>📄 PDF Payment Slip Attached</p>
                        <a
                          href={activeModalOrder.payment_transaction.slip_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#d97706',
                            color: '#fff',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)'
                          }}
                        >
                          <ExternalLink size={16} /> Open PDF Slip in New Tab
                        </a>
                      </div>
                    ) : (
                      <img
                        src={activeModalOrder.payment_transaction.slip_url}
                        alt="Bank Transfer Slip"
                        style={{
                          maxWidth: '90%',
                          maxHeight: '90%',
                          objectFit: 'contain',
                          transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                          borderRadius: '4px'
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#94a3b8' }}>No slip image file detected in storage</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '6px', color: '#64748b' }}>
                      Reference was submitted without an attached receipt
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Verification Details & Action Pane */}
              <div style={{
                flex: 0.9,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: '1px solid #e2e8f0',
                background: '#ffffff',
                overflowY: 'auto'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', fontWeight: 700 }}>
                    Payment Verification Checklist
                  </h3>

                  {/* Reference Comparison */}
                  <div style={{ marginBottom: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Bank / Transaction Reference
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <code style={{ fontSize: '1.15rem', fontWeight: 800, color: '#9c6848', background: 'rgba(184, 127, 92, 0.12)', padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.5px' }}>
                        {activeModalOrder.payment_transaction?.transaction_reference || 'N/A'}
                      </code>
                      <button
                        onClick={() => copyToClipboard(activeModalOrder.payment_transaction?.transaction_reference)}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                        title="Copy"
                      >
                        {copiedRef === activeModalOrder.payment_transaction?.transaction_reference ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                      </button>
                    </div>
                    {activeModalOrder.payment_transaction?.bank_name && (
                      <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '6px' }}>
                        Bank: <strong style={{ color: '#0f172a' }}>{activeModalOrder.payment_transaction.bank_name}</strong>
                      </div>
                    )}
                  </div>

                  {/* Required Amount */}
                  <div style={{ marginBottom: '16px', background: '#f0fdf4', padding: '14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', textTransform: 'uppercase', fontWeight: 700 }}>
                      Total Amount Required
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                      LKR {Number(activeModalOrder.total_amount).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '3px' }}>
                      Check if receipt shows exact or greater amount.
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                      Customer Details
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#0f172a' }}>
                      {activeModalOrder.users?.full_name || 'Guest User'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {activeModalOrder.users?.phone_number || activeModalOrder.users?.email || 'N/A'}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                      Items Reserved ({activeModalOrder.order_items?.length || 0})
                    </div>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px' }}>
                      {(activeModalOrder.order_items || []).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#1e293b', fontWeight: 500 }}>{item.quantity}x {item.menu_items?.name}</span>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>LKR {(item.quantity * item.unit_price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Approve / Reject Buttons */}
                <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <button
                    onClick={() => {
                      setRejectingOrder(activeModalOrder);
                      setRejectionReason('');
                    }}
                    disabled={isProcessing}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <XCircle size={18} /> Reject Slip
                  </button>

                  <button
                    onClick={() => handleApprove(activeModalOrder.id)}
                    disabled={isProcessing}
                    style={{
                      flex: 1.5,
                      padding: '12px',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                    }}
                  >
                    <CheckCircle2 size={18} /> Verify & Release to Kitchen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* Rejection Reason Modal */}
      {/* ============================================================================== */}
      {rejectingOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: '#ffffff',
            colorScheme: 'light',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: '#fee2e2', padding: '12px', borderRadius: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                  Reject Payment for Order #{String(rejectingOrder.id).slice(0, 8)}...
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                  The customer will be notified via push alert and allowed to re-upload a valid slip.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                Select a standard reason:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CANNED_REASONS.map((r, i) => {
                  const isSelected = rejectionReason === r;
                  return (
                    <button
                      key={i}
                      onClick={() => setRejectionReason(r)}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: isSelected ? '#fef2f2' : '#f8fafc',
                        border: isSelected ? '1.5px solid #dc2626' : '1px solid #e2e8f0',
                        color: isSelected ? '#991b1b' : '#334155',
                        fontSize: '0.85rem',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      • {r}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Or enter a custom message:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain clearly why this payment slip cannot be verified..."
                rows={3}
                style={{ 
                  width: '100%', 
                  fontSize: '0.88rem',
                  padding: '12px 14px',
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  lineHeight: '1.5'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#dc2626';
                  e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                  e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setRejectingOrder(null);
                  setRejectionReason('');
                }}
                disabled={isProcessing}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                style={{
                  padding: '10px 18px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isProcessing || !rejectionReason.trim()}
                onMouseEnter={(e) => {
                  if (!isProcessing && rejectionReason.trim()) {
                    e.currentTarget.style.background = '#b91c1c';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isProcessing && rejectionReason.trim()) {
                    e.currentTarget.style.background = '#dc2626';
                  }
                }}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: (isProcessing || !rejectionReason.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (!rejectionReason.trim() || isProcessing) ? 0.5 : 1,
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                  transition: 'background 0.15s ease'
                }}
              >
                {isProcessing ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
