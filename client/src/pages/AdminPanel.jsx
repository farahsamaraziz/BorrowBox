import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    const [s, u, c] = await Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/users'),
      api.get('/categories'),
    ]);
    setStats(s);
    setUsers(u.users);
    setCategories(c.categories);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleUser = async (u) => {
    setError('');
    try {
      await api.patch(`/admin/users/${u.id}/status`, { is_active: !u.is_active });
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setError('');
    try {
      await api.post('/categories', { name: newCategory.trim() });
      setNewCategory('');
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const renameCategory = async (c) => {
    const name = window.prompt('Rename category', c.name);
    if (!name || !name.trim() || name.trim() === c.name) return;
    setError('');
    try {
      await api.put(`/categories/${c.id}`, { name: name.trim() });   // PUT /api/categories/:id
      loadAll();
    } catch (e) { setError(e.message); }
  };

  const deleteCategory = async (id) => {
    setError('');
    try {
      await api.del(`/categories/${id}`);
      loadAll();
    } catch (e) { setError(e.message); }
  };

  if (!stats) return <div className="container" style={{ paddingTop: 40 }}><p className="muted">Loading…</p></div>;

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 64 }}>
      <h1>Admin panel</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '24px 0 36px' }}>
        <StatCard label="Total users" value={stats.total_users} />
        <StatCard label="Active items" value={stats.active_items} />
        <StatCard label="Total items" value={stats.total_items} />
        <StatCard label="Open bookings" value={
          (stats.bookings_by_status.REQUESTED || 0) +
          (stats.bookings_by_status.APPROVED || 0) +
          (stats.bookings_by_status.PICKED_UP || 0)
        } />
      </div>

      <h2 style={{ fontSize: '1.2rem' }}>Bookings by status</h2>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 36 }}>
        {Object.entries(stats.bookings_by_status).map(([status, n]) => (
          <div key={status} className="row" style={{ gap: 8 }}>
            <StatusBadge status={status} /> <span className="mono">{n}</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.2rem' }}>Users</h2>
      <div className="card" style={{ overflow: 'hidden', marginBottom: 40 }}>
        {users.map((u) => (
          <div key={u.id} className="row-between" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{u.name} <span className="text-sm muted mono">#{u.id}</span></div>
              <div className="text-sm muted">{u.email} · {u.role}</div>
            </div>
            <div className="row">
              <span className="status-badge" style={{
                color: u.is_active ? 'var(--teal)' : 'var(--status-rejected)',
                background: u.is_active ? 'var(--status-returned-bg)' : 'var(--status-rejected-bg)',
              }}>
                {u.is_active ? 'Active' : 'Deactivated'}
              </span>
              {u.role !== 'admin' && (
                <button className="btn btn-sm btn-secondary" onClick={() => toggleUser(u)}>
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.2rem' }}>Categories</h2>
      <form onSubmit={addCategory} className="row" style={{ marginBottom: 16 }}>
        <input placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 4, flex: 1, maxWidth: 260 }} />
        <button className="btn btn-sm btn-primary">Add category</button>
      </form>
      <div className="card">
        {categories.map((c) => (
          <div key={c.id} className="row-between" style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
            <span>{c.name}</span>
            <div className="row">
              <button className="btn btn-sm btn-secondary" onClick={() => renameCategory(c)}>Rename</button>
              <button className="btn btn-sm btn-danger" onClick={() => deleteCategory(c.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 600, color: 'var(--navy)' }}>{value}</div>
      <div className="text-sm muted">{label}</div>
    </div>
  );
}
