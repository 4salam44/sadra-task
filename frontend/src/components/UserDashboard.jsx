import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Navbar from './Navbar';

export default function UserDashboard() {
  const [tasks, setTasks] = useState([]);
  const { token } = useAuth();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const { data } = await axios.get('https://sandra-task-backend.onrender.com/api/user/tasks', {
      headers: { Authorization: `Bearer ${token}` }
    });
    setTasks(data);
  };

  return (
    <div>
      <Navbar />
      <div className="container mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">مهامي الموكلة</h2>
        <div className="grid gap-4">
          {tasks.map(task => (
            <div key={task._id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between">
                <h3 className="font-bold">{task.title}</h3>
                <span className={`px-2 py-1 rounded text-sm ${
                  task.priority === 3 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                }`}>
                  {task.priority === 3 ? 'عالي' : 'متوسط'}
                </span>
              </div>
              <p className="text-gray-600 mt-2">{task.description}</p>
              <p className="text-sm text-gray-500 mt-2">🗓️ {new Date(task.dueDate).toLocaleDateString('ar-SA')}</p>
              <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                رفع تقرير
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}