"use client";
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Image as ImageIcon, Upload, X } from 'lucide-react';

function badge(type, text) {
  return <span className={`badge badge-${type}`}>{text}</span>;
}

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'Mains',
    price: 0,
    description: '',
    image_url: '',
    is_available: true
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  async function fetchMenu() {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchMenu();
  }, []);

  async function toggleAvailability(id, current) {
    await supabase.from('menu_items').update({ is_available: !current }).eq('id', id);
    fetchMenu();
  }

  function openAddModal() {
    setEditingId(null);
    setFormData({ name: '', category: 'Mains', price: 0, description: '', image_url: '', is_available: true });
    setImageFile(null);
    setPreviewUrl('');
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description || '',
      image_url: item.image_url || '',
      is_available: item.is_available
    });
    setImageFile(null);
    setPreviewUrl(item.image_url || '');
    setIsModalOpen(true);
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File is too large. Maximum size is 10MB.");
        return;
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }

  async function handleSaveItem(e) {
    e.preventDefault();
    setSaving(true);
    
    try {
      let finalImageUrl = formData.image_url;

      // Upload image if a new one is selected
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append('image', imageFile);

        const res = await fetch('http://localhost:3000/api/admin/upload-image', {
          method: 'POST',
          body: uploadData,
        });
        
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to upload image');
        
        finalImageUrl = result.url;
      }

      const payload = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        price: parseFloat(formData.price),
        image_url: finalImageUrl,
        is_available: formData.is_available
      };

      if (editingId) {
        await supabase.from('menu_items').update(payload).eq('id', editingId);
      } else {
        await supabase.from('menu_items').insert(payload);
      }
      
      setIsModalOpen(false);
      fetchMenu();
    } catch (error) {
      console.error("Failed to save item:", error);
      alert("Error: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading menu...</p>;

  return (
    <>
      <div className="full-data-card">
        <div className="data-card-header">
          <h3>Restaurant Menu</h3>
          <button className="btn btn-primary" onClick={openAddModal}>+ Add Item</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Image</th>
              <th>Item</th>
              <th>Category</th>
              <th>Price</th>
              <th>Availability</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(m => (
              <tr key={m.id}>
                <td>
                  {m.image_url ? (
                    <img src={m.image_url} alt={m.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <ImageIcon size={16} />
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.description || 'No description'}</div>
                </td>
                <td>{m.category}</td>
                <td>LKR {(m.price ?? 0).toFixed(2)}</td>
                <td>{badge(m.is_available ? 'success' : 'muted', m.is_available ? 'Available' : 'Sold Out')}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => openEditModal(m)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => toggleAvailability(m.id, m.is_available)}>
                      {m.is_available ? 'Mark Sold Out' : 'Mark Available'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="full-data-card" style={{ width: 500, padding: 32, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>{editingId ? 'Edit Menu Item' : 'Add New Item'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Image Upload Area */}
              <div 
                style={{ 
                  height: 140, borderRadius: 12, border: '2px dashed var(--border)', 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: previewUrl ? `url(${previewUrl}) center/cover` : 'var(--bg-surface)',
                  position: 'relative', cursor: 'pointer', overflow: 'hidden'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: previewUrl ? 'rgba(0,0,0,0.5)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  <Upload size={24} style={{ color: previewUrl ? '#fff' : 'var(--text-secondary)', marginBottom: 8 }} />
                  <span style={{ fontSize: 13, color: previewUrl ? '#fff' : 'var(--text-secondary)', fontWeight: 500 }}>
                    {previewUrl ? 'Click to change image' : 'Upload item image (Max 10MB)'}
                  </span>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" style={{ display: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 2 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Item Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Price (LKR)</label>
                  <input type="number" step="0.01" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8 }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8 }}>
                  <option value="Starters">Starters</option>
                  <option value="Mains">Mains</option>
                  <option value="Desserts">Desserts</option>
                  <option value="Drinks">Drinks</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Description</label>
                <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="A short description of the dish..." style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, resize: 'none', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <input type="checkbox" id="avail" checked={formData.is_available} onChange={e => setFormData({...formData, is_available: e.target.checked})} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="avail" style={{ fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer' }}>Available to Order</label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px' }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
