import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import RatingStars from '../components/RatingStars';

export default function PublicProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/users/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="container" style={{ paddingTop: 40 }}><div className="alert alert-error">{error}</div></div>;
  if (!data) return <div className="container" style={{ paddingTop: 40 }}><p className="muted">Loading…</p></div>;

  const { user, trust_score, review_count, reviews } = data;

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 620, marginInline: 'auto' }}>
      <h1>{user.name}</h1>
      {user.area && <p className="text-sm muted">{user.area}</p>}

      <div className="row" style={{ margin: '16px 0 24px' }}>
        <RatingStars value={trust_score} size={20} />
        <span className="mono text-sm">{trust_score !== null ? trust_score.toFixed(1) : '—'} · {review_count} review{review_count === 1 ? '' : 's'}</span>
      </div>

      <div className="divider" />

      <h3 style={{ fontSize: '1rem' }}>What people say</h3>
      {reviews.length === 0 ? (
        <p className="muted text-sm">No reviews yet.</p>
      ) : (
        <div className="stack">
          {reviews.map((r) => (
            <div key={r.id} className="card" style={{ padding: 16 }}>
              <div className="row-between">
                <strong className="text-sm">{r.reviewer_name}</strong>
                <RatingStars value={r.rating} />
              </div>
              {r.comment && <p className="text-sm" style={{ marginTop: 6 }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
