// frontend/src/components/AdminDashboard.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import Navbar from "./Navbar";

export default function AdminDashboard() {
  const { token } = useAuth();

  /* ‑‑‑‑‑‑‑ حالات البيانات ‑‑‑‑‑‑‑ */
  const [tasks, setTasks]           = useState([]);
  const [users, setUsers]           = useState([]);
  const [reports, setReports]       = useState([]);      // تقارير المهام المُسندة
  const [extraReports, setExtraReports] = useState([]);  // تقارير المهام الشخصية المُرسلة
  const [loading, setLoading]       = useState(true);

  /* ‑‑‑‑‑‑‑ حالات النماذج ‑‑‑‑‑‑‑ */
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: "", description: "", priority: 2,
    assignedTo: "", dueDate: ""
  });
  const [userForm, setUserForm] = useState({
    fullName: "", username: "", password: "", role: "user"
  });

  /* ‑‑‑‑‑‑‑ جلب البيانات عند التحميل ‑‑‑‑‑‑‑ */
  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchReports();
    fetchExtraReports();
  }, []);

  /* ‑‑‑‑‑‑‑ دوال الـ API ‑‑‑‑‑‑‑ */
  const authHeader = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const fetchTasks = async () => {
    const { data } = await axios.get('/admin/tasks', authHeader());
    setTasks(data);
  };

  const fetchUsers = async () => {
    const { data } = await axios.get('/admin/users', authHeader());
    setUsers(data);
  };

  const fetchReports = async () => {
    // تقارير تسليم المهام المُسندة (يمكنك توسيع الـ endpoint لاحقاً)
    const { data } = await axios.get('/admin/reports', authHeader());
    setReports(data);
  };

  const fetchExtraReports = async () => {
    // التقارير الإضافية القادمة من المهام الشخصية
    const { data } = await axios.get('/admin/personal-reports', authHeader());
    setExtraReports(data);
  };

  /* ‑‑‑‑‑‑‑ إنشاء مهمة جديدة ‑‑‑‑‑‑‑ */
  const createTask = async (e) => {
    e.preventDefault();
    await axios.post('/admin/tasks', taskForm, authHeader());
    setTaskForm({ title: "", description: "", priority: 2, assignedTo: "", dueDate: "" });
    setShowTaskForm(false);
    fetchTasks();
  };

  /* ‑‑‑‑‑‑‑ حذف مهمة ‑‑‑‑‑‑‑ */
  const deleteTask = async (id) => {
    if (!window.confirm("متأكد من حذف المهمة؟")) return;
    await axios.delete(`/admin/tasks/${id}`, authHeader());
    fetchTasks();
  };

  /* ‑‑‑‑‑‑‑ إنشاء مستخدم جديد ‑‑‑‑‑‑‑ */
  const createUser = async (e) => {
    e.preventDefault();
    await axios.post('/admin/users', userForm, authHeader());
    setUserForm({ fullName: "", username: "", password: "", role: "user" });
    setShowUserForm(false);
    fetchUsers();
  };

  /* ‑‑‑‑‑‑‑ تبديل حالة المستخدم (تفعيل/تعطيل) ‑‑‑‑‑‑‑ */
  const toggleUser = async (id, current) => {
    await axios.put(`/admin/users/${id}`, { isActive: !current }, authHeader());
    fetchUsers();
  };

  /* ‑‑‑‑‑‑‑ JSX ‑‑‑‑‑‑‑ */
  return (
    <>
      <Navbar />

      <div className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">لوحة الإدمن</h1>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="المستخدمين" value={users.length} />
          <StatCard label="المهام" value={tasks.length} />
          <StatCard label="التقارير" value={reports.length} />
          <StatCard label="تقارير إضافية" value={extraReports.length} />
        </div>

        {/* قسم المستخدمين */}
        <Section title="إدارة المستخدمين">
          <button
            onClick={() => setShowUserForm((s) => !s)}
            className="mb-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            {showUserForm ? "إلغاء" : "+ مستخدم جديد"}
          </button>

          {showUserForm && (
            <form onSubmit={createUser} className="bg-white p-4 rounded shadow mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
              <input placeholder="الاسم الكامل" value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} className="border p-2 rounded" required />
              <input placeholder="اسم المستخدم" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} className="border p-2 rounded" required />
              <input placeholder="كلمة المرور" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="border p-2 rounded" required />
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="border p-2 rounded">
                <option value="user">مستخدم</option>
                <option value="admin">إدمن</option>
              </select>
              <button type="submit" className="bg-blue-600 text-white rounded hover:bg-blue-700">إنشاء</button>
            </form>
          )}

          <div className="grid gap-3">
            {users.map((u) => (
              <div key={u._id} className="bg-white p-3 rounded shadow flex items-center justify-between">
                <div>
                  <p className="font-semibold">{u.fullName} <span className="text-sm text-gray-500">({u.username})</span></p>
                  <p className="text-xs text-gray-400">{u.role === "admin" ? "إدمن" : "مستخدم"}</p>
                </div>
                <button onClick={() => toggleUser(u._id, u.isActive)} className={`px-3 py-1 rounded text-sm ${u.isActive ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                  {u.isActive ? "تعطيل" : "تفعيل"}
                </button>
              </div>
            ))}
          </div>
        </Section>

        {/* قسم المهام */}
        <Section title="إدارة المهام">
          <button
            onClick={() => setShowTaskForm((s) => !s)}
            className="mb-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            {showTaskForm ? "إلغاء" : "+ مهمة جديدة"}
          </button>

          {showTaskForm && (
            <form onSubmit={createTask} className="bg-white p-4 rounded shadow mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
              <input placeholder="عنوان المهمة" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="border p-2 rounded" required />
              <input placeholder="الوصف" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} className="border p-2 rounded" />
              <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: Number(e.target.value) })} className="border p-2 rounded">
                <option value={1}>منخفض</option>
                <option value={2}>متوسط</option>
                <option value={3}>عالي</option>
              </select>
              <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} className="border p-2 rounded" required />
              <button type="submit" className="bg-blue-600 text-white rounded hover:bg-blue-700">إنشاء</button>
            </form>
          )}

          <div className="grid gap-3">
            {tasks.map((t) => (
              <div key={t._id} className="bg-white p-4 rounded shadow flex items-center justify-between">
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-sm text-gray-500">مُسندة لـ: {t.assignedTo?.fullName}</p>
                </div>
                <button onClick={() => deleteTask(t._id)} className="text-red-600 hover:underline">حذف</button>
              </div>
            ))}
          </div>
        </Section>

        {/* قسم التقارير الإضافية (القادمة من المهام الشخصية) */}
        {extraReports.length > 0 && (
          <Section title="تقارير إضافية (من مهام شخصية)">
            <div className="grid gap-3">
              {extraReports.map((r) => (
                <div key={r._id} className="bg-blue-50 border border-blue-200 p-4 rounded">
                  <p className="font-semibold">{r.personalTaskId?.title}</p>
                  <p className="text-sm text-gray-600">بواسطة: {r.userId?.fullName} · نسبة الإنجاز: {r.completionPercentage}%</p>
                  {r.notes && <p className="text-sm mt-2">{r.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

/* مكوّن مساعد: بطاقة إحصائية */
function StatCard({ label, value }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-2xl font-bold text-purple-600">{value}</p>
    </div>
  );
}

/* مكوّن مساعد: قسم بعنوان */
function Section({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold mb-4 text-gray-700">{title}</h2>
      {children}
    </div>
  );
}
