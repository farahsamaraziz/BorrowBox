import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import HowItWorks from './pages/HowItWorks';
import Categories from './pages/Categories';
import ItemDetail from './pages/ItemDetail';
import ItemForm from './pages/ItemForm';
import Dashboard from './pages/Dashboard';
import BookingDetail from './pages/BookingDetail';
import PublicProfile from './pages/PublicProfile';
import AdminPanel from './pages/AdminPanel';
import Account from './pages/Account';

function NotFound() {
  return (
    <div className="container" style={{ paddingTop: 64, textAlign: 'center' }}>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/browse" element={<Navigate to="/" replace />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/items/new" element={<ProtectedRoute><ItemForm /></ProtectedRoute>} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/items/:id/edit" element={<ProtectedRoute><ItemForm /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
          <Route path="/users/:id" element={<PublicProfile />} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
