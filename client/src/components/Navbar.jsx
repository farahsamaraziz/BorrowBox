import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header style={{ background: 'var(--navy)' }}>
      <div className="container row-between" style={{ height: 64 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="8" width="18" height="12" rx="1.5" stroke="white" strokeWidth="1.8" />
            <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', color: 'white' }}>
            BorrowBox
          </span>
        </Link>

        <nav className="row" style={{ gap: 22 }}>
          <NavItem to="/" end>Browse</NavItem>
          <NavItem to="/how-it-works">How it works</NavItem>
          <NavItem to="/categories">Categories</NavItem>
          {user && <NavItem to="/dashboard">Dashboard</NavItem>}
          {user && <NavItem to="/account">Account</NavItem>}
          {user?.role === 'admin' && <NavItem to="/admin">Admin</NavItem>}

          {user ? (
            <>
              <Link to={`/users/${user.id}`} className="text-sm" style={{ color: 'white' }}>
                {user.name.split(' ')[0]}
              </Link>
              <button className="btn btn-sm btn-secondary" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <NavItem to="/login">Log in</NavItem>
              <Link to="/register" className="btn btn-sm" style={{ background: 'white', color: 'var(--navy)' }}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavItem({ to, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="text-sm"
      style={({ isActive }) => ({
        color: isActive ? 'white' : 'rgba(255,255,255,0.72)',
        fontWeight: isActive ? 600 : 500,
      })}
    >
      {children}
    </NavLink>
  );
}
