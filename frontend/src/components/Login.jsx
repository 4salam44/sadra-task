import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('https://sandra-task-backend.onrender.com/api/auth/login', {
        username, password
      });
      login(data);
      if (data.user.role === 'admin') navigate('/admin/tasks');
      else navigate('/dashboard');
    } catch (err) {
      alert('خطأ في الدخول');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h1 className="text-3xl font-bold text-center mb-8 text-purple-600">Sandra Task</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="اسم المستخدم" value={username} onChange={e => setUsername(e.target.value)}
            className="w-full p-3 border rounded" />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full p-3 border rounded" />
          <button type="submit" className="w-full bg-purple-600 text-white p-3 rounded hover:bg-purple-700">
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}