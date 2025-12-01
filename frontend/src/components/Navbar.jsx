import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import santraLogo from '@brand/santra.svg';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="relative z-20 bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-soft">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link
          to={user?.role === 'admin' ? '/admin/tasks' : '/dashboard'}
          className="group flex items-center gap-3 text-white transition"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 p-2 backdrop-blur-sm transition group-hover:bg-white/20">
            <img
              src={santraLogo}
              alt="شعار Santra Task"
              className="h-full w-full object-contain drop-shadow-lg"
            />
          </span>
          <div className="font-display text-2xl tracking-wide">
            SANTRA <span className="font-semibold text-brand-highlight">TASK</span>
          </div>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link to="/dashboard" className="transition hover:text-brand-highlight/90">
            مهامي
          </Link>
          <Link to="/personal-tasks" className="transition hover:text-brand-highlight/90">
            مهامي الشخصية
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin/tasks" className="transition hover:text-brand-highlight/90">
              لوحة الإدمن
            </Link>
          )}
          <button
            onClick={logout}
            className="rounded-full bg-white/15 px-4 py-1.5 transition hover:bg-white/25"
          >
            خروج
          </button>
        </div>
      </div>
    </nav>
  );
}