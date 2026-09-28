import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { formatRange } from '../utils/dates';

const TABS = [
  { key: 'items', label: 'My Items' },
  { key: 'borrowings', label: 'My Borrowings' },
  { key: 'incoming', label: 'Incoming Requests' },
];

export default function Dashboard() {
  const [tab, setTab] = useState('items');
  const [summary, setSummary] = useState(null);

  const loadSummary = useCallback(() => {
    api.get('/dashboard/summary').then(setSummary).catch(() => {});
  }, []);

  useEffect(() => { loadSummary(); }, [tab, loadSummary]);

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 64 }}>
      <div className="row-between" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        {tab === 'items' && (
          <Link to="/items/new" className="btn btn-primary btn-sm">+ List an item</Link>
        )}
      </div>

      <div className="row" style={{ gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="btn-sm"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px',
              borderBottom: tab === t.key ? '2px solid var(--navy)' : '2px solid transparent',
              color: tab === t.key ? 'var(--navy)' : 'var(--muted)',
              fontWeight: 600,
            }}
          >
            {t.label}
            {t.key === 'items' && summary ? ` (${summary.active_items})` : ''}
            {t.key === 'borrowings' && summary ? ` (${summary.open_borrowings})` : ''}
            {t.key === 'incoming' && summary ? ` (${summary.pending_incoming_requests})` : ''}
          </button>
        ))}
      </div>

      {tab === 'items' && <MyItems />}
      {tab === 'borrowings' && <MyBorrowings onChange={loadSummary} />}
      {tab === 'incoming' && <IncomingRequests onChange={loadSummary} />}
    </div>
  );
}

function MyItems() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/items/mine').then((d) => setItems(d.items)).catch((e) => setError(e.message));   // GET /api/items/mine
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!items) return <p className="muted">Loading…</p>;
  if (items.length === 0) return <div className="empty-state">You haven't listed anything yet.</div>;

  return (
    <div className="stack">
      {items.map((item) => (
        <div key={item.id} className="card row-between" style={{ padding: '14px 18px' }}>
          <div>
            <Link to={`/items/${item.id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.title}</Link>
            <div className="text-sm muted">{item.category_name} · {item.condition} · max {item.max_days} day{item.max_days === 1 ? '' : 's'}</div>
          </div>
          <div className="row">
            <span className="status-badge" style={{
              color: item.is_active ? 'var(--teal)' : 'var(--muted)',
              background: item.is_active ? 'var(--status-returned-bg)' : 'var(--status-cancelled-bg)',
            }}>
              {item.is_active ? 'Active' : 'Inactive'}
            </span>
            <Link to={`/items/${item.id}/edit`} className="btn btn-sm btn-secondary">Edit</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function MyBorrowings({ onChange }) {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api.get('/bookings/mine').then((d) => setBookings(d.bookings)).catch((e) => setError(e.message)),   // GET /api/bookings/mine
    []
  );
  useEffect(() => { load(); }, [load]);

  const cancel = async (id) => {
    setError('');
    try {
      await api.patch(`/bookings/${id}/status`, { action: 'cancel' });
      await load();
      onChange();
    } catch (e) { setError(e.message); }
  };

  if (!bookings) return error ? <div className="alert alert-error">{error}</div> : <p className="muted">Loading…</p>;
  if (bookings.length === 0) return <div className="empty-state">You haven't requested to borrow anything yet.</div>;

  return (
    <div className="stack">
      {error && <div className="alert alert-error">{error}</div>}
      {bookings.map((b) => (
        <div key={b.id} className="card row-between" style={{ padding: '14px 18px' }}>
          <div>
            <Link to={`/bookings/${b.id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>{b.item_title}</Link>
            <div className="text-sm muted mono">{formatRange(b.start_date, b.end_date)} · from {b.owner_name}</div>
            {b.status === 'REJECTED' && b.reject_reason && (
              <div className="text-sm" style={{ marginTop: 4 }}>Reason: {b.reject_reason}</div>
            )}
          </div>
          <div className="row">
            <StatusBadge status={b.status} overdue={b.is_overdue} />
            {['REQUESTED', 'APPROVED'].includes(b.status) && (
              <button className="btn btn-sm btn-danger" onClick={() => cancel(b.id)}>Cancel</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function IncomingRequests({ onChange }) {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api.get('/bookings/incoming').then((d) => setBookings(d.bookings)).catch((e) => setError(e.message)),   // GET /api/bookings/incoming
    []
  );
  useEffect(() => { load(); }, [load]);

  // PATCH /api/bookings/:id/status  { action: 'approve' | 'reject' }
  const act = async (id, action) => {
    setError('');
    try {
      await api.patch(`/bookings/${id}/status`, { action });
      await load();
      onChange();
    } catch (e) { setError(e.message); }
  };

  if (!bookings) return error ? <div className="alert alert-error">{error}</div> : <p className="muted">Loading…</p>;
  if (bookings.length === 0) return <div className="empty-state">No one has requested your items yet.</div>;

  return (
    <div className="stack">
      {error && <div className="alert alert-error">{error}</div>}
      {bookings.map((b) => (
        <div key={b.id} className="card row-between" style={{ padding: '14px 18px' }}>
          <div>
            <Link to={`/bookings/${b.id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>{b.item_title}</Link>
            <div className="text-sm muted mono">{formatRange(b.start_date, b.end_date)} · to {b.borrower_name}</div>
            {b.message && <div className="text-sm" style={{ marginTop: 4 }}>"{b.message}"</div>}
          </div>
          <div className="row">
            <StatusBadge status={b.status} overdue={b.is_overdue} />
            {b.status === 'REQUESTED' && (
              <>
                <button className="btn btn-sm btn-primary" onClick={() => act(b.id, 'approve')}>Approve</button>
                <button className="btn btn-sm btn-danger" onClick={() => act(b.id, 'reject')}>Reject</button>
              </>
            )}
            {['APPROVED', 'PICKED_UP'].includes(b.status) && (
              <Link to={`/bookings/${b.id}`} className="btn btn-sm btn-secondary">Manage</Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
