import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Navbar from './Navbar';

export default function PersonalTasks() {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: '', priority: 2 });
  const { token } = useAuth();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const { data } = await axios.get('https://sandra-task-backend.onrender.com/api/personal/tasks', {
      headers: { Authorization: `Bearer ${token}` }
    });
    setTasks(data);
  };

  const createTask = async (e) => {
    e.preventDefault();
    await axios.post('https://sandra-task-backend.onrender.com/api/personal/tasks', form, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setForm({ title: '', description: '', category: '', priority: 2 });
    setShowForm(false);
    fetchTasks();
  };

  const sendToAdmin = async (taskId) => {
    await axios.post(`https://sandra-task-backend.onrender.com/api/personal/tasks/${taskId}/report-to-admin`, {
      completionPercentage: 100, notes: 'تم الانتهاء'
    }, { headers: { Authorization: `Bearer ${token}` } });
    alert('تم إرسال التقرير للإدمن');
  };

  return (
    <div>
      <Navbar />
      <div className="container mx-auto p-6">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-bold">مهامي الشخصية 🔒</h2>
          <button onClick={() => setShowForm(true)} className="bg-purple-600 text-white px-4 py-2 rounded">
            + مهمة شخصية جديدة
          </button>
        </div>

        {showForm && (
          <form onSubmit={createTask} className="bg-white p-4 rounded-lg shadow mb-6">
            <input placeholder="العنوان" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              className="w-full p-2 border rounded mb-2" required />
            <textarea placeholder="الوصف" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              className="w-full p-2 border rounded mb-2" />
            <input placeholder="التصنيف" value={form.category} onChange={e => setForm({...form, category: e.target.value})}
              className="w-full p-2 border rounded mb-2" />
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">إنشاء</button>
          </form>
        )}

        <div className="grid gap-4">
          {tasks.map(task => (
            <div key={task._id} className={`bg-white p-4 rounded-lg shadow ${task.isSharedWithAdmin ? 'border-2 border-blue-400' : ''}`}>
              <h3 className="font-bold">{task.title} {task.isSharedWithAdmin && '📤'}</h3>
              <p className="text-gray-600">{task.description}</p>
              {!task.isSharedWithAdmin && (
                <button onClick={() => sendToAdmin(task._id)}
                  className="mt-3 bg-blue-600 text-white px-3 py-1 rounded text-sm">
                  إرسال للإدمن
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}