import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Categories() {
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/categories').then((d) => setCategories(d.categories)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 64 }}>
      <h1 style={{ marginBottom: 8 }}>Categories</h1>
      <p style={{ marginBottom: 28, maxWidth: 560 }}>Jump straight to what you're looking for.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {!categories ? (
        <p className="muted">Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {categories.map((c) => (
            <Link key={c.id} to={`/?category=${c.id}`} className="card" style={{ display: 'block', padding: 20 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{c.name}</h3>
              <p className="text-sm muted" style={{ margin: 0 }}>
                {c.item_count} item{c.item_count === 1 ? '' : 's'} listed
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
