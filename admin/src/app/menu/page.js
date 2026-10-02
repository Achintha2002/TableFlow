"use client";
import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Tag,
  Flame,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  List,
  Edit3,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  RefreshCw,
  Percent,
  Sparkles,
  ArrowUpDown,
  Check,
  Clock,
  Eye,
  DollarSign
} from 'lucide-react';

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search, Filters & View Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('category'); // category, name_asc, price_asc, price_desc, discount_desc
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Toast State
  const [toast, setToast] = useState(null);
  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Mains',
    price: 1500,
    discount_percent: 0,
    description: '',
    image_url: '',
    is_available: true
  });

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Quick Action Pending
  const [actionPendingId, setActionPendingId] = useState(null);

  // Fetch Menu from API (with fallback)
  async function fetchMenu(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/menu');
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
      } else {
        // Fallback to direct supabase
        const { data } = await supabase
          .from('menu_items')
          .select('*')
          .order('category', { ascending: true })
          .order('name', { ascending: true });

        const enriched = (data || []).map(item => {
          let discount_percent = Number(item.discount_percent) || 0;
          let cleanDescription = item.description || '';
          if (discount_percent <= 0 && cleanDescription.includes('[PROMO:')) {
            const match = cleanDescription.match(/\[PROMO:(\d+(?:\.\d+)?)%\]/i);
            if (match) {
              discount_percent = parseFloat(match[1]) || 0;
              cleanDescription = cleanDescription.replace(/\[PROMO:\d+(?:\.\d+)?%\]\s*/gi, '').trim();
            }
          }
          const basePrice = Number(item.price) || 0;
          const finalPrice = discount_percent > 0 ? basePrice * (1 - discount_percent / 100) : basePrice;
          return {
            ...item,
            discount_percent,
            display_description: cleanDescription,
            effective_price: Math.round(finalPrice * 100) / 100
          };
        });
        setItems(enriched);
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err);
      showToast('Could not load menu: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchMenu();

    // Real-time synchronization
    const channel = supabase
      .channel('realtime_menu_items_mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenu();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Quick 1-Click Toggle: Sold Out / Available
  async function toggleAvailability(item) {
    const newStatus = !item.is_available;
    setActionPendingId(item.id);

    // Optimistic UI update
    setItems(prev => prev.map(m => m.id === item.id ? { ...m, is_available: newStatus } : m));

    try {
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: newStatus })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to update status');
      }

      showToast(`"${item.name}" marked as ${newStatus ? 'Available' : 'Sold Out'}`);
      fetchMenu();
    } catch (err) {
      console.error('Toggle error:', err);
      showToast('Error: ' + err.message, 'error');
      // Revert optimistic update
      fetchMenu();
    } finally {
      setActionPendingId(null);
    }
  }

  // Open Add Modal
  function openAddModal() {
    setEditingId(null);
    setFormData({
      name: '',
      category: 'Mains',
      price: 1500,
      discount_percent: 0,
      description: '',
      image_url: '',
      is_available: true
    });
    setImageFile(null);
    setPreviewUrl('');
    setIsModalOpen(true);
  }

  // Open Edit Modal
  function openEditModal(item) {
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      category: item.category || 'Mains',
      price: item.price || 0,
      discount_percent: item.discount_percent || 0,
      description: item.display_description || item.description || '',
      image_url: item.image_url || '',
      is_available: item.is_available !== false
    });
    setImageFile(null);
    setPreviewUrl(item.image_url || '');
    setIsModalOpen(true);
  }

  // Open Delete Modal
  function openDeleteModal(item) {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  }

  // Confirm Delete
  async function handleConfirmDelete() {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/menu/${itemToDelete.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to delete dish');
      }

      showToast(`Dish "${itemToDelete.name}" was permanently removed`);
      setDeleteModalOpen(false);
      setItemToDelete(null);
      fetchMenu();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Delete failed: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  // Handle Image Upload
  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast('Image file is too large (max 10MB)', 'error');
        return;
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  // Handle Save (Add / Edit)
  async function handleSaveItem(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Dish name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = formData.image_url;

      // Upload image if selected
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append('image', imageFile);

        const res = await fetch('/api/admin/upload-image', {
          method: 'POST',
          body: uploadData,
        });

        if (res.ok) {
          const result = await res.json();
          finalImageUrl = result.url;
        } else {
          // Fallback to backend upload if admin route fails
          const backendRes = await fetch('http://localhost:3000/api/admin/upload-image', {
            method: 'POST',
            body: uploadData,
          });
          if (backendRes.ok) {
            const backendResult = await backendRes.json();
            finalImageUrl = backendResult.url;
          }
        }
      }

      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        price: parseFloat(formData.price) || 0,
        discount_percent: Math.min(100, Math.max(0, parseFloat(formData.discount_percent) || 0)),
        description: formData.description.trim(),
        image_url: finalImageUrl,
        is_available: formData.is_available
      };

      let res;
      if (editingId) {
        res = await fetch(`/api/admin/menu/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/admin/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to save menu item');
      }

      showToast(editingId ? `Dish "${payload.name}" updated successfully` : `Dish "${payload.name}" added to menu`);
      setIsModalOpen(false);
      fetchMenu();
    } catch (err) {
      console.error('Save item error:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // Metrics KPI calculations
  const metrics = useMemo(() => {
    const total = items.length;
    const available = items.filter(i => i.is_available).length;
    const soldOut = total - available;
    const onPromo = items.filter(i => (i.discount_percent || 0) > 0).length;
    return { total, available, soldOut, onPromo };
  }, [items]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach(i => { if (i.category) set.add(i.category); });
    return Array.from(set).sort();
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        // Category / Status Filter
        if (selectedCategory === 'ON_PROMO') {
          if ((item.discount_percent || 0) <= 0) return false;
        } else if (selectedCategory === 'SOLD_OUT') {
          if (item.is_available) return false;
        } else if (selectedCategory !== 'ALL') {
          if (item.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.name?.toLowerCase().includes(q);
          const matchDesc = item.display_description?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
          const matchCat = item.category?.toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'price_asc') return (a.effective_price || a.price || 0) - (b.effective_price || b.price || 0);
        if (sortBy === 'price_desc') return (b.effective_price || b.price || 0) - (a.effective_price || a.price || 0);
        if (sortBy === 'discount_desc') return (b.discount_percent || 0) - (a.discount_percent || 0);
        // Default: Category then Name
        const catComp = (a.category || '').localeCompare(b.category || '');
        if (catComp !== 0) return catComp;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [items, selectedCategory, searchQuery, sortBy]);

  // Live Modal calculations
  const modalCalculations = useMemo(() => {
    const base = parseFloat(formData.price) || 0;
    const disc = Math.min(100, Math.max(0, parseFloat(formData.discount_percent) || 0));
    const effective = disc > 0 ? base * (1 - disc / 100) : base;
    const savings = base - effective;
    return {
      base,
      disc,
      effective: Math.round(effective * 100) / 100,
      savings: Math.round(savings * 100) / 100
    };
  }, [formData.price, formData.discount_percent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          padding: '12px 18px',
          borderRadius: '10px',
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '13px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        background: '#ffffff',
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 800,
              fontFamily: "'Playfair Display', Georgia, serif",
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px'
            }}>
              Restaurant Menu
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 8px',
              borderRadius: '20px',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '11px',
              fontWeight: 700,
              border: '1px solid #a7f3d0'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              Live Kitchen Sync
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            Curate culinary dishes, configure promotional discounts, and manage real-time table ordering
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchMenu(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 15px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={openAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #a06a4b 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(184, 127, 92, 0.28)',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={16} />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* 4 Stat KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Total Dishes */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(184, 127, 92, 0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <UtensilsCrossed size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Dishes
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {metrics.total}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
              Across {categories.length} categories
            </div>
          </div>
        </div>

        {/* Card 2: On Promotion (Discounts) */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderRadius: '14px',
          border: '1px solid #fecdd3',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#fff1f2',
            color: '#e11d48',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Flame size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#e11d48', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Special Offers / Promo
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#be123c', marginTop: '2px' }}>
              {metrics.onPromo}
            </div>
            <div style={{ fontSize: '11px', color: '#f43f5e', marginTop: '1px' }}>
              Items with active discount
            </div>
          </div>
        </div>

        {/* Card 3: Available for Order */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderRadius: '14px',
          border: '1px solid #bbf7d0',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#dcfce7',
            color: '#15803d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ready To Order
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#166534', marginTop: '2px' }}>
              {metrics.available}
            </div>
            <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '1px' }}>
              Active in POS & Customer App
            </div>
          </div>
        </div>

        {/* Card 4: Sold Out */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderRadius: '14px',
          border: '1px solid #fed7aa',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: '#fff7ed',
            color: '#c2410c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Sold Out / Inactive
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#9a3412', marginTop: '2px' }}>
              {metrics.soldOut}
            </div>
            <div style={{ fontSize: '11px', color: '#ea580c', marginTop: '1px' }}>
              Temporarily unorderable
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category Tabs, Sort, View Toggle */}
      <div style={{
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        {/* Top Row: Search & Sort & View */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Input */}
          <div style={{
            position: 'relative',
            flex: '1 1 280px',
            maxWidth: '420px'
          }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search dishes by name or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#f8fafc',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'}
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
                  padding: 0
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="category">Category (Default)</option>
                <option value="name_asc">Name (A → Z)</option>
                <option value="price_asc">Price (Low → High)</option>
                <option value="price_desc">Price (High → Low)</option>
                <option value="discount_desc">Highest Discount First</option>
              </select>
            </div>

            {/* View Mode Switcher */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={() => setViewMode('grid')}
                title="Food Card Grid View"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary)' : '#64748b',
                  fontWeight: viewMode === 'grid' ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <LayoutGrid size={14} />
                <span>Grid</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                title="Compact Table View"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? 'var(--primary)' : '#64748b',
                  fontWeight: viewMode === 'table' ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <List size={14} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Row: Category & Status Filter Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}>
          {/* ALL Tab */}
          <button
            onClick={() => setSelectedCategory('ALL')}
            style={{
              padding: '6px 13px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: selectedCategory === 'ALL' ? '1px solid var(--primary)' : '1px solid #e2e8f0',
              background: selectedCategory === 'ALL' ? 'rgba(184, 127, 92, 0.12)' : '#ffffff',
              color: selectedCategory === 'ALL' ? 'var(--primary)' : '#64748b',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            All Items ({metrics.total})
          </button>

          {/* Dynamic Categories */}
          {categories.map(cat => {
            const count = items.filter(i => i.category === cat).length;
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid #e2e8f0',
                  background: isSelected ? 'rgba(184, 127, 92, 0.12)' : '#ffffff',
                  color: isSelected ? 'var(--primary)' : '#64748b',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat} ({count})
              </button>
            );
          })}

          {/* Special Filter: On Promo */}
          <button
            onClick={() => setSelectedCategory('ON_PROMO')}
            style={{
              padding: '6px 13px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: selectedCategory === 'ON_PROMO' ? '1px solid #f43f5e' : '1px solid #fecdd3',
              background: selectedCategory === 'ON_PROMO' ? '#fff1f2' : '#ffffff',
              color: selectedCategory === 'ON_PROMO' ? '#e11d48' : '#be123c',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <Flame size={12} />
            <span>On Promo ({metrics.onPromo})</span>
          </button>

          {/* Special Filter: Sold Out */}
          <button
            onClick={() => setSelectedCategory('SOLD_OUT')}
            style={{
              padding: '6px 13px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: selectedCategory === 'SOLD_OUT' ? '1px solid #ea580c' : '1px solid #fed7aa',
              background: selectedCategory === 'SOLD_OUT' ? '#fff7ed' : '#ffffff',
              color: selectedCategory === 'SOLD_OUT' ? '#c2410c' : '#9a3412',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            <AlertTriangle size={12} />
            <span>Sold Out ({metrics.soldOut})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <RefreshCw size={28} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>Loading Menu Ledger...</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Synchronizing recipes, promo discounts, and kitchen inventory</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <UtensilsCrossed size={36} color="#cbd5e1" style={{ margin: '0 auto 12px auto' }} />
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>No Dishes Found</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {searchQuery ? `No menu item matching "${searchQuery}" in this view` : 'Try changing category filter or add a new culinary creation'}
          </div>
          <button
            onClick={openAddModal}
            style={{
              marginTop: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            <span>Add First Dish</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ========================================================================= */
        /* VIEW MODE 1: VISUAL FOOD CARDS GRID                                       */
        /* ========================================================================= */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(295px, 1fr))',
          gap: '20px'
        }}>
          {filteredItems.map(item => {
            const hasDiscount = (item.discount_percent || 0) > 0;
            const isSoldOut = !item.is_available;
            const isPending = actionPendingId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: isSoldOut ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.07)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                }}
              >
                {/* Image Header with Badges */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '180px',
                  background: '#f1f5f9',
                  overflow: 'hidden'
                }}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: isSoldOut ? 'grayscale(80%) brightness(0.9)' : 'none',
                        transition: 'filter 0.2s ease'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      gap: '6px'
                    }}>
                      <ImageIcon size={32} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>No photography</span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)'
                  }} />

                  {/* Top-Left Category Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.92)',
                      backdropFilter: 'blur(6px)',
                      color: '#1e293b',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      padding: '3px 9px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}>
                      {item.category}
                    </span>
                  </div>

                  {/* Top-Right Discount Promo Badge */}
                  {hasDiscount && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px'
                    }}>
                      <span style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 900,
                        letterSpacing: '0.4px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)'
                      }}>
                        <Flame size={12} />
                        <span>{item.discount_percent}% OFF</span>
                      </span>
                    </div>
                  )}

                  {/* Bottom-Left Status Pill (on image) */}
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px'
                  }}>
                    {isSoldOut ? (
                      <span style={{
                        background: 'rgba(239, 68, 68, 0.95)',
                        backdropFilter: 'blur(6px)',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.5px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <AlertTriangle size={10} />
                        <span>SOLD OUT</span>
                      </span>
                    ) : (
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.95)',
                        backdropFilter: 'blur(6px)',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.5px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffffff' }} />
                        <span>AVAILABLE</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      lineHeight: '1.3'
                    }}>
                      {item.name}
                    </h3>
                  </div>

                  <p style={{
                    margin: '6px 0 12px 0',
                    fontSize: '12px',
                    color: '#64748b',
                    lineHeight: '1.45',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minHeight: '34px'
                  }}>
                    {item.display_description || item.description || 'No description provided.'}
                  </p>

                  {/* Price Section */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: hasDiscount ? '#fff1f2' : '#f8fafc',
                    border: hasDiscount ? '1px solid #fecdd3' : '1px solid #f1f5f9',
                    marginBottom: '14px'
                  }}>
                    <span style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: hasDiscount ? '#be123c' : 'var(--primary)'
                    }}>
                      LKR {(item.effective_price || item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>

                    {hasDiscount && (
                      <span style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        textDecoration: 'line-through',
                        fontWeight: 600
                      }}>
                        LKR {(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>

                  {/* Action Footer (1-Click Sold Out Toggle, Edit, Delete) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: 'auto',
                    paddingTop: '10px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    {/* 1-Click Sold Out Toggle Button */}
                    <button
                      onClick={() => toggleAvailability(item)}
                      disabled={isPending}
                      title={isSoldOut ? 'Click to make this item available' : 'Click to mark as sold out'}
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: isPending ? 'not-allowed' : 'pointer',
                        border: isSoldOut ? '1px solid #a7f3d0' : '1px solid #fed7aa',
                        background: isSoldOut ? '#ecfdf5' : '#fff7ed',
                        color: isSoldOut ? '#059669' : '#c2410c',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isPending ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : isSoldOut ? (
                        <>
                          <CheckCircle2 size={12} />
                          <span>Mark Available</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={12} />
                          <span>Mark Sold Out</span>
                        </>
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => openEditModal(item)}
                      title="Edit dish and discount"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => openDeleteModal(item)}
                      title="Permanently remove dish"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        background: '#fee2e2',
                        border: '1px solid #fca5a5',
                        color: '#b91c1c',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#dc2626';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = '#dc2626';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = '#fee2e2';
                        e.currentTarget.style.color = '#b91c1c';
                        e.currentTarget.style.borderColor = '#fca5a5';
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW MODE 2: LUXURY TABLE VIEW (100% FIXED - ZERO HORIZONTAL SCROLL)     */
        /* ========================================================================= */
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ width: '100%', overflowX: 'hidden' }}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  <th style={{ width: '6%', padding: '14px 12px', fontWeight: 700, textAlign: 'center' }}>Photo</th>
                  <th style={{ width: '28%', padding: '14px 12px', fontWeight: 700 }}>Dish Name & Description</th>
                  <th style={{ width: '12%', padding: '14px 12px', fontWeight: 700 }}>Category</th>
                  <th style={{ width: '18%', padding: '14px 12px', fontWeight: 700 }}>Price & Promotion</th>
                  <th style={{ width: '12%', padding: '14px 12px', fontWeight: 700, textAlign: 'center' }}>Availability</th>
                  <th style={{ width: '24%', padding: '14px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const hasDiscount = (item.discount_percent || 0) > 0;
                  const isSoldOut = !item.is_available;
                  const isPending = actionPendingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#fafbfc'}
                    >
                      {/* 1. Photo */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: '1px solid #e2e8f0',
                              filter: isSoldOut ? 'grayscale(80%)' : 'none'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            background: '#f1f5f9',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8'
                          }}>
                            <ImageIcon size={18} />
                          </div>
                        )}
                      </td>

                      {/* 2. Dish Name & Description */}
                      <td style={{ padding: '12px', overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.display_description || item.description || 'No description'}
                        </div>
                      </td>

                      {/* 3. Category */}
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(184, 127, 92, 0.12)',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}>
                          {item.category}
                        </span>
                      </td>

                      {/* 4. Price & Promotion */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontWeight: 800,
                            fontSize: '13px',
                            color: hasDiscount ? '#be123c' : 'var(--text-primary)'
                          }}>
                            LKR {(item.effective_price || item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>

                          {hasDiscount && (
                            <span style={{
                              fontSize: '11px',
                              color: '#94a3b8',
                              textDecoration: 'line-through'
                            }}>
                              LKR {(item.price || 0).toFixed(2)}
                            </span>
                          )}

                          {hasDiscount && (
                            <span style={{
                              background: '#ffe4e6',
                              color: '#e11d48',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800
                            }}>
                              {item.discount_percent}% OFF
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Availability Status Pill */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {isSoldOut ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '16px',
                            fontSize: '10px',
                            fontWeight: 800,
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca'
                          }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} />
                            SOLD OUT
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '16px',
                            fontSize: '10px',
                            fontWeight: 800,
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0'
                          }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a' }} />
                            AVAILABLE
                          </span>
                        )}
                      </td>

                      {/* 6. Action Buttons */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', flexWrap: 'nowrap' }}>
                          {/* 1-Click Sold Out / Available Toggle */}
                          <button
                            onClick={() => toggleAvailability(item)}
                            disabled={isPending}
                            title={isSoldOut ? 'Mark as available' : 'Mark as sold out'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              cursor: isPending ? 'not-allowed' : 'pointer',
                              border: isSoldOut ? '1px solid #a7f3d0' : '1px solid #fed7aa',
                              background: isSoldOut ? '#ecfdf5' : '#fff7ed',
                              color: isSoldOut ? '#059669' : '#c2410c'
                            }}
                          >
                            {isPending ? (
                              <RefreshCw size={11} className="animate-spin" />
                            ) : isSoldOut ? (
                              <>
                                <CheckCircle2 size={12} />
                                <span>Available</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={12} />
                                <span>Sold Out</span>
                              </>
                            )}
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(item)}
                            title="Edit dish and discount"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => openDeleteModal(item)}
                            title="Delete dish"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 9px',
                              borderRadius: '6px',
                              background: '#fee2e2',
                              border: '1px solid #fca5a5',
                              color: '#b91c1c',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT DISH WITH DISCOUNT ENGINE & LIVE PREVIEW              */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              background: '#fafbfc',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {editingId ? 'Edit Dish & Promotional Offer' : 'Add New Culinary Offering'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  {editingId ? 'Update pricing, promotional discount, or kitchen availability' : 'Introduce a new recipe to the restaurant catalog and POS'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: 2-Column Layout */}
            <form onSubmit={handleSaveItem} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                
                {/* Column 1: Image & Live Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Dish Photography (Max 10MB)
                    </label>
                    <div
                      style={{
                        height: '160px',
                        borderRadius: '12px',
                        border: '2px dashed #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: previewUrl ? `url(${previewUrl}) center/cover` : '#f8fafc',
                        position: 'relative',
                        cursor: 'pointer',
                        overflow: 'hidden'
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: previewUrl ? 'rgba(0,0,0,0.45)' : 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}>
                        <Upload size={22} style={{ color: previewUrl ? '#ffffff' : '#64748b' }} />
                        <span style={{ fontSize: '12px', color: previewUrl ? '#ffffff' : '#64748b', fontWeight: 600 }}>
                          {previewUrl ? 'Click to replace photo' : 'Upload dish image'}
                        </span>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>

                  {/* Live Customer Preview Card */}
                  <div style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Eye size={13} color="var(--primary)" />
                      <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>
                        Live Customer View Preview
                      </span>
                    </div>

                    <div style={{
                      background: '#ffffff',
                      borderRadius: '10px',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(184, 127, 92, 0.12)', color: 'var(--primary)' }}>
                          {formData.category}
                        </span>
                        {modalCalculations.disc > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px', background: '#ffe4e6', color: '#e11d48' }}>
                            🔥 {modalCalculations.disc}% OFF
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b', marginTop: '6px' }}>
                        {formData.name || 'Sample Dish Name'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: modalCalculations.disc > 0 ? '#be123c' : 'var(--primary)' }}>
                          LKR {modalCalculations.effective.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {modalCalculations.disc > 0 && (
                          <span style={{ fontSize: '11px', color: '#94a3b8', textDecoration: 'line-through' }}>
                            LKR {modalCalculations.base.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {modalCalculations.disc > 0 && (
                        <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: 700, marginTop: '4px' }}>
                          ✓ Guest saves LKR {modalCalculations.savings.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column 2: Form Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Dish Name */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Dish Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Artisanal Pistachio Tiramisu"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Category & Regular Price */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                        Category
                      </label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          background: '#ffffff',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Starters">Starters</option>
                        <option value="Mains">Mains</option>
                        <option value="Desserts">Desserts</option>
                        <option value="Drinks">Drinks</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                        Regular Price (LKR) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* ======================================================= */}
                  {/* PROMOTIONAL DISCOUNT ENGINE                             */}
                  {/* ======================================================= */}
                  <div style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Flame size={15} color="#e11d48" />
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#be123c' }}>
                          Promotional Discount (%)
                        </span>
                      </div>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 900,
                        color: modalCalculations.disc > 0 ? '#e11d48' : '#94a3b8'
                      }}>
                        {modalCalculations.disc}% OFF
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        step="5"
                        value={formData.discount_percent}
                        onChange={e => setFormData({ ...formData, discount_percent: e.target.value })}
                        style={{
                          flex: 1,
                          accentColor: '#e11d48',
                          cursor: 'pointer'
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={formData.discount_percent}
                        onChange={e => setFormData({ ...formData, discount_percent: e.target.value })}
                        style={{
                          width: '60px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #fca5a5',
                          fontSize: '12px',
                          fontWeight: 800,
                          textAlign: 'center',
                          color: '#be123c',
                          background: '#ffffff',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Quick discount chips */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {[0, 10, 15, 20, 25, 50].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setFormData({ ...formData, discount_percent: pct })}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: Number(formData.discount_percent) === pct ? '1px solid #e11d48' : '1px solid #fecdd3',
                            background: Number(formData.discount_percent) === pct ? '#e11d48' : '#ffffff',
                            color: Number(formData.discount_percent) === pct ? '#ffffff' : '#be123c'
                          }}
                        >
                          {pct === 0 ? 'No Discount' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                      Culinary Description
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Ingredients, flavors, preparation notes..."
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  {/* Availability Toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer'
                  }}
                  onClick={() => setFormData({ ...formData, is_available: !formData.is_available })}
                  >
                    <input
                      type="checkbox"
                      id="availToggle"
                      checked={formData.is_available}
                      onChange={e => setFormData({ ...formData, is_available: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="availToggle" style={{ fontSize: '13px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      Ready and Available to Order in Restaurant
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #a06a4b 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(184, 127, 92, 0.28)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving Offering...</span>
                    </>
                  ) : (
                    <span>{editingId ? 'Save Changes' : 'Create Dish Offering'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DELETE CONFIRMATION MODAL                                        */}
      {/* ========================================================================= */}
      {deleteModalOpen && itemToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            border: '1px solid #fecdd3',
            overflow: 'hidden'
          }}>
            {/* Danger Header */}
            <div style={{
              background: '#fff1f2',
              padding: '20px 24px',
              borderBottom: '1px solid #fecdd3',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#fee2e2',
                color: '#e11d48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#9f1239' }}>
                  Delete Menu Item
                </h3>
                <div style={{ fontSize: '12px', color: '#be123c', marginTop: '2px' }}>
                  This action cannot be undone
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                Are you sure you want to permanently delete this culinary item from the restaurant menu and customer mobile application?
              </p>

              {/* Item Summary Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0'
              }}>
                {itemToDelete.image_url ? (
                  <img
                    src={itemToDelete.image_url}
                    alt={itemToDelete.name}
                    style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <ImageIcon size={20} />
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {itemToDelete.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {itemToDelete.category} • LKR {(itemToDelete.effective_price || itemToDelete.price || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {deleting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Delete Dish</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
