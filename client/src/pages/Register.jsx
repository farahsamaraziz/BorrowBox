import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', area: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/browse');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="narrow" style={{ paddingTop: 64, paddingBottom: 64 }}>
      <h1>Create an account</h1>
      <p style={{ marginBottom: 28 }}>One account to lend your things and borrow from neighbours.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" required value={form.name} onChange={update('name')} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={form.email} onChange={update('email')} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" minLength={6} required value={form.password} onChange={update('password')} />
          <div className="field-hint">At least 6 characters.</div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="phone">Phone (optional)</label>
            <input id="phone" value={form.phone} onChange={update('phone')} />
          </div>
          <div className="field">
            <label htmlFor="area">Area (optional)</label>
            <input id="area" placeholder="e.g. DHA Phase 5" value={form.area} onChange={update('area')} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm" style={{ marginTop: 20, textAlign: 'center' }}>
        Already a member? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
