import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Account() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', area: user.area || '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await updateProfile(form);                       // PUT /api/users/me
      setSuccess('Profile updated.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm('Delete your account? Your listings will disappear and you will be logged out.')) return;
    setError('');
    setSuccess('');
    try {
      await deleteAccount(() => navigate('/', { replace: true }));   // DELETE /api/users/me (soft delete)
    } catch (err) { setError(err.message); }           // 409 while bookings are still open
  };

  return (
    <div className="narrow" style={{ paddingTop: 48, paddingBottom: 64 }}>
      <h1>Your account</h1>
      <p className="text-sm muted" style={{ marginBottom: 24 }}>{user.email}</p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" required value={form.name} onChange={update('name')} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" value={form.phone} onChange={update('phone')} />
          </div>
          <div className="field">
            <label htmlFor="area">Area</label>
            <input id="area" value={form.area} onChange={update('area')} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </form>

      <div className="divider" />
      <h3 style={{ fontSize: '1rem' }}>Delete account</h3>
      <p className="text-sm">
        This deactivates your account. It isn't possible while you have open bookings
        (requested, approved or picked up) as a borrower or as an owner.
      </p>
      <button className="btn btn-danger" onClick={remove}>Delete my account</button>
    </div>
  );
}
