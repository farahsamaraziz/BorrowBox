import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import RatingStars from '../components/RatingStars';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { todayStr, daysInclusive, rangesOverlap, formatRange } from '../utils/dates';

const CONDITION_LABEL = { new: 'New', good: 'Good', fair: 'Fair' };

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [booked, setBooked] = useState([]);           // GET /items/:id/availability
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [bookingForm, setBookingForm] = useState({ start_date: '', end_date: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [itemRes, availability] = await Promise.all([
        api.get(`/items/${id}`),
        api.get(`/items/${id}/availability`),
      ]);
      setItem(itemRes.item);
      setBooked(availability.booked);
    } catch (e) { setLoadError(e.message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const { start_date, end_date } = bookingForm;
  const daysSelected = start_date && end_date ? daysInclusive(start_date, end_date) : 0;

  // Client-side guard so the form blocks choices the API would reject anyway.
  const dateProblem = useMemo(() => {
    if (!item || !start_date || !end_date) return '';
    if (start_date < todayStr()) return 'The start date cannot be in the past.';
    if (end_date < start_date) return 'The end date must be on or after the start date.';
    if (daysSelected > item.max_days) {
      return `This item can be borrowed for at most ${item.max_days} day${item.max_days === 1 ? '' : 's'}.`;
    }
    // The calendar itself disables booked days, but dates can also be typed
    // directly into the "From"/"To" inputs, so re-check the overlap here too.
    const clash = booked.find((b) => rangesOverlap(start_date, end_date, b.start_date, b.end_date));
    if (clash) return `Those dates overlap an existing booking (${formatRange(clash.start_date, clash.end_date)}).`;
    return '';
  }, [item, booked, start_date, end_date, daysSelected]);

  if (loadError) return <div className="container" style={{ paddingTop: 40 }}><div className="alert alert-error">{loadError}</div></div>;
  if (!item) return <div className="container" style={{ paddingTop: 40 }}><p className="muted">Loading…</p></div>;

  const isOwner = user?.id === item.owner_id;

  const selectRange = (start, end) => {
    setBookingForm((f) => ({ ...f, start_date: start, end_date: end }));
    setFormError('');
    setSuccess('');
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.post('/bookings', { item_id: item.id, ...bookingForm });
      setSuccess('Request sent. The owner will approve or reject it soon.');
      setBookingForm({ start_date: '', end_date: '', message: '' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 64 }}>
      <p className="text-sm muted" style={{ marginBottom: 20 }}>
        <Link to="/">Browse</Link> / <span>{item.category_name}</span> / <span>{item.title}</span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 40 }}>
        <div>
          <div
            style={{
              height: 300,
              background: item.image_url ? `url(${item.image_url}) center/cover` : 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--border-strong)', fontFamily: 'var(--font-display)', fontSize: '3.4rem',
            }}
          >
            {!item.image_url && item.title.charAt(0).toUpperCase()}
          </div>

          <h1 style={{ margin: '0 0 10px' }}>{item.title}</h1>

          <div className="row" style={{ gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            <Badge>{item.category_name}</Badge>
            <Badge>Condition: {CONDITION_LABEL[item.condition] || item.condition}</Badge>
            <Badge>Max borrow: {item.max_days} day{item.max_days === 1 ? '' : 's'}</Badge>
          </div>

          {!item.is_active && <div className="alert alert-warn">This listing is currently inactive.</div>}
          <p>{item.description || 'No description provided.'}</p>
          {item.pickup_area && <p className="text-sm muted">Pickup: {item.pickup_area}</p>}

          <h3 style={{ fontSize: '1rem', marginTop: 20 }}>Already booked</h3>
          {booked.length === 0 ? (
            <p className="text-sm muted">No upcoming bookings — every date is free.</p>
          ) : (
            <ul className="text-sm">
              {booked.map((b, i) => (
                <li key={i} className="mono">{formatRange(b.start_date, b.end_date)}</li>
              ))}
            </ul>
          )}

          <div className="divider" />

          <h3 style={{ fontSize: '1rem' }}>Owner</h3>
          <div className="row" style={{ gap: 12, marginBottom: 4 }}>
            <div
              className="mono"
              style={{
                width: 40, height: 40, borderRadius: '50%', background: 'var(--indigo)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flex: '0 0 auto',
              }}
            >
              {item.owner_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0 }}>
                {item.owner_name}
                {item.owner_area && <span className="muted"> · {item.owner_area}</span>}
              </p>
              <div className="row" style={{ gap: 6 }}>
                <RatingStars value={item.owner_rating} />
                <span className="mono text-sm muted">
                  {item.owner_rating ? item.owner_rating.toFixed(1) : 'No ratings yet'}
                  {item.owner_review_count > 0 && ` · ${item.owner_review_count} review${item.owner_review_count === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>
            <Link to={`/users/${item.owner_id}`} className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }}>
              View profile
            </Link>
          </div>
        </div>

        <div>
          {isOwner ? (
            <div className="card" style={{ padding: 20 }}>
              <p className="text-sm muted">This is your item.</p>
              <Link to={`/items/${item.id}/edit`} className="btn btn-secondary btn-block">Edit item</Link>
            </div>
          ) : !item.is_active ? (
            <div className="card" style={{ padding: 20 }}>
              <p className="text-sm">This item can't be requested right now.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Request to borrow</h3>
                <span className="text-sm muted">Max {item.max_days} day{item.max_days === 1 ? '' : 's'}</span>
              </div>
              <p className="text-sm muted" style={{ marginBottom: 16 }}>Owner approval required</p>

              {formError && <div className="alert alert-error">{formError}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <AvailabilityCalendar booked={booked} start={start_date} end={end_date} onSelect={selectRange} />

              <div style={{ margin: '16px 0' }}>
                {start_date && end_date ? (
                  <div className={`alert ${dateProblem ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 0 }}>
                    {dateProblem || `${daysSelected} day${daysSelected === 1 ? '' : 's'} selected (max ${item.max_days})`}
                  </div>
                ) : (
                  <p className="field-hint" style={{ margin: 0 }}>Tap a start date, then an end date, on the calendar above.</p>
                )}
              </div>

              <form onSubmit={submitBooking}>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="itemdetail-start-date">From</label>
                    <input
                      id="itemdetail-start-date" type="date" required min={todayStr()} value={start_date}
                      onChange={(e) => setBookingForm({ ...bookingForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="itemdetail-end-date">To</label>
                    <input
                      id="itemdetail-end-date" type="date" required min={start_date || todayStr()} value={end_date}
                      onChange={(e) => setBookingForm({ ...bookingForm, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="itemdetail-message-to-owner">Message to owner (optional)</label>
                  <textarea
                    id="itemdetail-message-to-owner" rows={3} value={bookingForm.message}
                    onChange={(e) => setBookingForm({ ...bookingForm, message: e.target.value })}
                  />
                </div>

                {user ? (
                  <button className="btn btn-primary btn-block" disabled={submitting || !start_date || !end_date || Boolean(dateProblem)}>
                    {submitting ? 'Sending…' : 'Send request'}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/login', { state: { from: { pathname: `/items/${item.id}` } } })}>
                    Log in to request
                  </button>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: '0.74rem', padding: '4px 10px', borderRadius: 100,
        background: 'var(--status-approved-bg)', color: 'var(--navy)',
      }}
    >
      {children}
    </span>
  );
}
