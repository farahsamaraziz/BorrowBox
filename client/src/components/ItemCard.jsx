import { Link } from 'react-router-dom';
import RatingStars from './RatingStars';

export default function ItemCard({ item }) {
  return (
    <Link to={`/items/${item.id}`} className="card" style={{ display: 'block', overflow: 'hidden' }}>
      <div
        style={{
          height: 130,
          background: item.image_url ? `url(${item.image_url}) center/cover` : 'var(--paper)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--border-strong)',
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
        }}
      >
        {!item.image_url && item.title.charAt(0).toUpperCase()}
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <span className="mono text-sm" style={{ color: 'var(--indigo)', fontSize: '0.72rem' }}>
            {item.category_name}
          </span>
          {item.available_now !== undefined && (
            <span
              className="mono"
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                color: item.available_now ? 'var(--teal)' : 'var(--status-rejected)',
              }}
            >
              {item.available_now ? 'Available' : 'Booked'}
            </span>
          )}
        </div>
        <h3 style={{ fontSize: '1rem', margin: '4px 0 4px', color: 'var(--ink)' }}>{item.title}</h3>
        <p className="text-sm muted" style={{ margin: '0 0 8px' }}>Max {item.max_days} day{item.max_days === 1 ? '' : 's'}</p>
        <div className="row-between text-sm muted">
          <span className="row" style={{ gap: 4 }}>
            <RatingStars value={item.owner_rating} size={13} />
            {item.owner_rating ? <span className="mono">{item.owner_rating.toFixed(1)}</span> : <span>New</span>}
          </span>
          <span>{item.pickup_area || 'Area not set'}</span>
        </div>
      </div>
    </Link>
  );
}
