import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-purple-600 text-white p-4">
      <div className="container mx-auto flex justify-between">
        <div className="text-xl font-bold">Sandra Task</div>
        <div className="flex gap-4">
          <Link to="/dashboard" className="hover:text-purple-200">مهامي</Link>
          <Link to="/personal-tasks" className="hover:text-purple-200">مهامي الشخصية</Link>
          <Link to="/admin/tasks" className={`${user?.role === 'admin' ? '' : 'hidden'} hover:text-purple-200`}>
            لوحة الإدمن
          </Link>
          <button onClick={logout} className="hover:text-purple-200">خروج</button>
        </div>
      </div>
    </nav>
  );
}