import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { formatRange, todayStr } from '../utils/dates';

const textareaStyle = { width: '100%', marginTop: 6, padding: 10, border: '1px solid var(--border-strong)', borderRadius: 4 };

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ start_date: '', end_date: '', message: '' });

  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [editingReview, setEditingReview] = useState(false);

  // GET /api/bookings/:id -> booking + condition_logs + reviews in one request
  const load = useCallback(async () => {
    const d = await api.get(`/bookings/${id}`);
    setData(d);
  }, [id]);

  useEffect(() => { load().catch((e) => setLoadError(e.message)); }, [load]);

  if (loadError) return <div className="container" style={{ paddingTop: 40 }}><div className="alert alert-error">{loadError}</div></div>;
  if (!data) return <div className="container" style={{ paddingTop: 40 }}><p className="muted">Loading…</p></div>;

  const { booking, condition_logs, reviews } = data;
  const isOwner = user.id === booking.owner_id;
  const isBorrower = user.id === booking.borrower_id;
  const myReview = reviews.find((r) => r.reviewer_id === user.id);
  const otherParty = isOwner ? booking.borrower_name : booking.owner_name;

  const run = async (fn) => {
    setError('');
    setBusy(true);
    try { await fn(); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  // PATCH /api/bookings/:id/status  { action, note }
  const doAction = (action, noteText) => run(async () => {
    await api.patch(`/bookings/${id}/status`, noteText ? { action, note: noteText } : { action });
    setNote('');
    setRejectReason('');
  });

  const startEdit = () => {
    setEditForm({ start_date: booking.start_date, end_date: booking.end_date, message: booking.message || '' });
    setEditing(true);
  };
  const saveEdit = (e) => {
    e.preventDefault();
    run(async () => {
      await api.put(`/bookings/${id}`, editForm);                 // PUT /api/bookings/:id
      setEditing(false);
    });
  };

  const removeBooking = async () => {
    if (!window.confirm('Remove this booking from your list?')) return;
    setError('');
    try {
      await api.del(`/bookings/${id}`);                            // DELETE /api/bookings/:id
      navigate('/dashboard');
    } catch (e) { setError(e.message); }
  };

  const submitReview = (e) => {
    e.preventDefault();
    run(async () => {
      if (editingReview) await api.put(`/reviews/${myReview.id}`, reviewForm);          // PUT /api/reviews/:id
      else await api.post(`/bookings/${id}/reviews`, reviewForm);                      // POST /api/bookings/:id/reviews
      setEditingReview(false);
      setReviewForm({ rating: 5, comment: '' });
    });
  };
  const startEditReview = () => {
    setReviewForm({ rating: myReview.rating, comment: myReview.comment || '' });
    setEditingReview(true);
  };
  const removeReview = () => {
    if (!window.confirm('Delete your review?')) return;
    run(() => api.del(`/reviews/${myReview.id}`));                                       // DELETE /api/reviews/:id
  };

  const ownerCanAct = isOwner && ['REQUESTED', 'APPROVED', 'PICKED_UP'].includes(booking.status);
  const borrowerCanAct = isBorrower && ['REQUESTED', 'APPROVED'].includes(booking.status);
  const canDelete = isBorrower && ['REJECTED', 'CANCELLED'].includes(booking.status);
  const showReviewForm = !myReview || editingReview;

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 720, marginInline: 'auto' }}>
      <Link to="/dashboard" className="text-sm">← Back to dashboard</Link>

      <div className="row-between" style={{ margin: '16px 0 4px' }}>
        <h1 style={{ margin: 0 }}>{booking.item_title}</h1>
        <div className="row" style={{ gap: 8 }}>
          <StatusBadge status={booking.status} overdue={booking.is_overdue} />
        </div>
      </div>
      <p className="mono text-sm muted">
        {formatRange(booking.start_date, booking.end_date)} ·{' '}
        {isOwner ? `borrowed by ${booking.borrower_name}` : `owned by ${booking.owner_name}`}
      </p>
      {booking.message && <p className="text-sm">"{booking.message}"</p>}
      {booking.status === 'REJECTED' && booking.reject_reason && (
        <p className="text-sm"><strong>Reason:</strong> {booking.reject_reason}</p>
      )}
      {booking.is_overdue && (
        <div className="alert alert-error">
          The end date ({booking.end_date}) has passed and this item hasn't been marked as returned.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ fontSize: '0.95rem' }}>Actions</h3>

        {isOwner && booking.status === 'REQUESTED' && (
          <div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => doAction('approve')}>Approve</button>
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="text-sm" style={{ fontWeight: 600 }} htmlFor="bookingdetail-reject-optional-reason">Reject (optional reason)</label>
              <textarea id="bookingdetail-reject-optional-reason" rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Sorry, I need it that week." style={textareaStyle} />
              <button className="btn btn-sm btn-danger" style={{ marginTop: 8 }} disabled={busy}
                onClick={() => doAction('reject', rejectReason.trim())}>Reject request</button>
            </div>
          </div>
        )}

        {borrowerCanAct && (
          <div className="row" style={{ flexWrap: 'wrap', marginTop: isOwner ? 12 : 0 }}>
            {booking.status === 'REQUESTED' && !editing && (
              <button className="btn btn-sm btn-secondary" disabled={busy} onClick={startEdit}>Edit dates / message</button>
            )}
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => doAction('cancel')}>Cancel request</button>
          </div>
        )}

        {editing && (
          <form onSubmit={saveEdit} style={{ marginTop: 16 }}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="bookingdetail-start-date">Start date</label>
                <input id="bookingdetail-start-date" type="date" required min={todayStr()} value={editForm.start_date}
                  onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="bookingdetail-end-date">End date</label>
                <input id="bookingdetail-end-date" type="date" required min={editForm.start_date || todayStr()} value={editForm.end_date}
                  onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="bookingdetail-message">Message</label>
              <textarea id="bookingdetail-message" rows={2} value={editForm.message} onChange={(e) => setEditForm({ ...editForm, message: e.target.value })} />
            </div>
            <div className="row">
              <button className="btn btn-sm btn-primary" disabled={busy}>Save changes</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Discard</button>
            </div>
          </form>
        )}

        {isOwner && booking.status === 'APPROVED' && (
          <div style={{ marginTop: 16 }}>
            <label className="text-sm" style={{ fontWeight: 600 }} htmlFor="bookingdetail-record-handover-condition">Record handover condition</label>
            <textarea id="bookingdetail-record-handover-condition" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Good, one scratch on the handle." style={textareaStyle} />
            <button className="btn btn-sm btn-teal" style={{ marginTop: 8 }} disabled={busy || !note.trim()}
              onClick={() => doAction('pickup', note.trim())}>
              Mark picked up
            </button>
          </div>
        )}

        {isOwner && booking.status === 'PICKED_UP' && (
          <div style={{ marginTop: 16 }}>
            <label className="text-sm" style={{ fontWeight: 600 }} htmlFor="bookingdetail-record-return-condition">Record return condition</label>
            <textarea id="bookingdetail-record-return-condition" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Returned as given." style={textareaStyle} />
            <button className="btn btn-sm btn-teal" style={{ marginTop: 8 }} disabled={busy || !note.trim()}
              onClick={() => doAction('return', note.trim())}>
              Mark returned
            </button>
          </div>
        )}

        {canDelete && (
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-sm btn-danger" onClick={removeBooking}>Remove booking</button>
          </div>
        )}

        {!ownerCanAct && !borrowerCanAct && !canDelete && (
          <p className="text-sm muted" style={{ margin: 0 }}>No actions available right now.</p>
        )}
      </div>

      {condition_logs.length > 0 && (
        <div className="card" style={{ padding: 20, marginTop: 20 }}>
          <h3 style={{ fontSize: '0.95rem' }}>Condition log</h3>
          <div className="stack">
            {condition_logs.map((log) => (
              <div key={log.id} className="text-sm">
                <span className="mono" style={{ color: 'var(--indigo)' }}>{log.stage}</span> — {log.note}
                <div className="muted" style={{ fontSize: '0.75rem' }}>
                  {log.logged_by_name} · {new Date(log.logged_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {booking.status === 'RETURNED' && (
        <div className="card" style={{ padding: 20, marginTop: 20 }}>
          <h3 style={{ fontSize: '0.95rem' }}>Reviews</h3>
          {reviews.length === 0 && <p className="text-sm muted">No reviews yet. Rate {otherParty} to build their trust score.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="text-sm" style={{ marginBottom: 8 }}>
              <strong>{r.reviewer_id === user.id ? 'You' : r.reviewer_name}</strong> rated {r.rating}/5 {r.comment && `— "${r.comment}"`}
            </div>
          ))}

          {myReview && !editingReview && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-sm btn-secondary" disabled={busy} onClick={startEditReview}>Edit my review</button>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={removeReview}>Delete my review</button>
            </div>
          )}

          {showReviewForm && (
            <form onSubmit={submitReview} style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="bookingdetail-your-rating-for">Your rating for {otherParty}</label>
                <select id="bookingdetail-your-rating-for" value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="bookingdetail-comment">Comment (optional)</label>
                <textarea id="bookingdetail-comment" rows={2} value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} />
              </div>
              <div className="row">
                <button className="btn btn-sm btn-primary" disabled={busy}>{editingReview ? 'Save review' : 'Submit review'}</button>
                {editingReview && (
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditingReview(false)}>Discard</button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
