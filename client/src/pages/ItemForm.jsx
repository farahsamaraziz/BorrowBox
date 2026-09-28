import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

const EMPTY = {
  title: '', description: '', category_id: '', condition: 'good', max_days: 3,
  pickup_area: '', image_url: '',
};

export default function ItemForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    api.get('/categories').then((d) => setCategories(d.categories)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (isEdit) {
      api.get(`/items/${id}`).then(({ item }) => {
        setForm({
          title: item.title,
          description: item.description || '',
          category_id: item.category_id,
          condition: item.condition,
          max_days: item.max_days,
          pickup_area: item.pickup_area || '',
          image_url: item.image_url || '',
        });
        setIsActive(item.is_active);
      }).catch((e) => setError(e.message));
    }
  }, [id, isEdit]);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form, category_id: Number(form.category_id), max_days: Number(form.max_days) };
      if (isEdit) {
        await api.put(`/items/${id}`, payload);     // PUT /api/items/:id
      } else {
        await api.post('/items', payload);          // POST /api/items
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async () => {
    setError('');
    try {
      await api.put(`/items/${id}`, { is_active: !isActive });
      setIsActive(!isActive);
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this item? If it has any booking history it will be deactivated instead.')) return;
    setError('');
    try {
      await api.del(`/items/${id}`);
      navigate('/dashboard');
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="narrow" style={{ paddingTop: 48, paddingBottom: 64 }}>
      <h1>{isEdit ? 'Edit item' : 'List an item'}</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="itemform-title">Title</label>
          <input id="itemform-title" required value={form.title} onChange={update('title')} placeholder="e.g. Cordless Drill" />
        </div>
        <div className="field">
          <label htmlFor="itemform-description">Description</label>
          <textarea id="itemform-description" rows={3} value={form.description} onChange={update('description')} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="itemform-category">Category</label>
            <select id="itemform-category" required value={form.category_id} onChange={update('category_id')}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="itemform-condition">Condition</label>
            <select id="itemform-condition" value={form.condition} onChange={update('condition')}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="itemform-max-days">Max days</label>
            <input id="itemform-max-days" type="number" min={1} required value={form.max_days} onChange={update('max_days')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="itemform-pickup-area">Pickup area</label>
          <input id="itemform-pickup-area" value={form.pickup_area} onChange={update('pickup_area')} />
        </div>
        <div className="field">
          <label htmlFor="itemform-image-url">Image URL (optional)</label>
          <input id="itemform-image-url" value={form.image_url} onChange={update('image_url')} />
        </div>

        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'List item'}
        </button>
      </form>

      {isEdit && (
        <>
          <div className="divider" />
          <div className="row-between">
            <button className="btn btn-secondary" onClick={toggleActive}>
              {isActive ? 'Deactivate listing' : 'Activate listing'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete item</button>
          </div>
        </>
      )}
    </div>
  );
}
