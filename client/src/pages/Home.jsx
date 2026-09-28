import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import ItemCard from '../components/ItemCard';

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

// Route "/" — search bar with a date range up top, a category/condition
// sidebar, and the resulting item grid. GET /api/items does the filtering
// (search, category ids, condition, from/to availability), this page just
// turns the sidebar state into that query string.
export default function Home() {
  const [params, setParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState(params.get('search') || '');
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');
  const [selectedCategories, setSelectedCategories] = useState(
    () => new Set((params.get('category') || '').split(',').filter(Boolean))
  );
  const [selectedConditions, setSelectedConditions] = useState(
    () => new Set((params.get('condition') || '').split(',').filter(Boolean))
  );
  const [sort, setSort] = useState(params.get('sort') || 'newest');
  const [page, setPage] = useState(Number(params.get('page')) || 1);

  useEffect(() => {
    api.get('/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const dateRangeIncomplete = Boolean(from) !== Boolean(to);

  const query = useMemo(() => {
    const q = { sort, page };
    if (search) q.search = search;
    if (!dateRangeIncomplete && from && to) { q.from = from; q.to = to; }
    if (selectedCategories.size) q.category = [...selectedCategories].join(',');
    if (selectedConditions.size) q.condition = [...selectedConditions].join(',');
    return q;
  }, [search, from, to, dateRangeIncomplete, selectedCategories, selectedConditions, sort, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/items', query);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (e) {
      setItems([]);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  // Keep the URL shareable/refreshable without fighting the user's typing.
  useEffect(() => {
    const next = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => { if (v && !(k === 'page' && v === 1)) next.set(k, v); });
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const runSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const toggle = (setFn) => (value) => setFn((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  });
  const toggleCategory = toggle(setSelectedCategories);
  const toggleCondition = toggle(setSelectedConditions);

  const clearFilters = () => {
    setSearch(''); setFrom(''); setTo('');
    setSelectedCategories(new Set()); setSelectedConditions(new Set());
    setSort('newest'); setPage(1);
  };
  const hasFilters = search || from || to || selectedCategories.size || selectedConditions.size || sort !== 'newest';

  useEffect(() => { setPage(1); }, [selectedCategories, selectedConditions, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ paddingTop: 40, paddingBottom: 32 }}>
          <h1 style={{ fontSize: '2.1rem', maxWidth: 620, marginBottom: 20 }}>
            Borrow what you need. Lend what you're not using.
          </h1>

          <form onSubmit={runSearch} className="card" style={{ padding: 14 }}>
            <div className="field-row" style={{ marginBottom: 0, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 2, marginBottom: 0 }}>
                <label htmlFor="home-search">Search</label>
                <input
                  id="home-search"
                  placeholder="Search tools & gadgets…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="home-from">From</label>
                <input id="home-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="home-to">To</label>
                <input id="home-to" type="date" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ height: 41 }}>Search</button>
            </div>
            {dateRangeIncomplete && (
              <p className="field-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Pick both a "from" and a "to" date to filter by availability — showing all items until then.
              </p>
            )}
          </form>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 28, paddingBottom: 64 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, alignItems: 'flex-start' }}>
          <aside className="stack" style={{ position: 'sticky', top: 16 }}>
            <div>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Filters</h3>
                {hasFilters && (
                  <button type="button" className="btn btn-sm btn-secondary" onClick={clearFilters}>Clear filters</button>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm" style={{ fontWeight: 600, marginBottom: 8 }}>Category</p>
              <div className="stack" style={{ gap: 8 }}>
                {categories.map((c) => (
                  <label key={c.id} className="row text-sm" style={{ gap: 8, cursor: 'pointer', fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.has(String(c.id))}
                      onChange={() => toggleCategory(String(c.id))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="divider" style={{ margin: '4px 0' }} />

            <div>
              <p className="text-sm" style={{ fontWeight: 600, marginBottom: 8 }}>Condition</p>
              <div className="stack" style={{ gap: 8 }}>
                {CONDITIONS.map((c) => (
                  <label key={c.value} className="row text-sm" style={{ gap: 8, cursor: 'pointer', fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={selectedConditions.has(c.value)}
                      onChange={() => toggleCondition(c.value)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="divider" style={{ margin: '4px 0' }} />

            <div>
              <label htmlFor="home-sort" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>
                Sort by
              </label>
              <select id="home-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title_asc">Title A–Z</option>
                <option value="title_desc">Title Z–A</option>
              </select>
            </div>
          </aside>

          <div>
            <div className="row-between" style={{ marginBottom: 16 }}>
              <p className="text-sm muted" style={{ margin: 0 }}>
                {loading ? 'Searching…' : `${pagination.total} item${pagination.total === 1 ? '' : 's'} found`}
              </p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card" style={{ height: 210 }} />)}
              </div>
            ) : items.length === 0 ? (
              <div className="empty-state">No items match your search yet. Try widening the filters.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                  {items.map((item) => <ItemCard key={item.id} item={item} />)}
                </div>

                {pagination.total_pages > 1 && (
                  <div className="row" style={{ justifyContent: 'center', marginTop: 32 }}>
                    <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </button>
                    <span className="text-sm muted">Page {pagination.page} of {pagination.total_pages}</span>
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={page >= pagination.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
