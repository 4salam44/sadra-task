import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import santraLogo from '@brand/santra.svg';

const statusStyles = {
  pending: 'bg-brand-muted/80 text-brand-ink',
  'in-progress': 'bg-brand-highlight/30 text-brand-primary',
  completed: 'bg-brand-secondary/20 text-brand-secondary',
  late: 'bg-brand-accent/25 text-brand-ink',
  returned: 'bg-brand-accent/25 text-brand-ink',
};

export default function UserDashboard() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [requestNotes, setRequestNotes] = useState({});
  const [completeNotes, setCompleteNotes] = useState({});
  const [openSections, setOpenSections] = useState({});
  const [requestFiles, setRequestFiles] = useState({});
  const [completeFiles, setCompleteFiles] = useState({});
  const [detailMutations, setDetailMutations] = useState({});
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [manualRefresh, setManualRefresh] = useState(false);

  const apiBase =
    import.meta.env.VITE_FILES_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    axios.defaults.baseURL ||
    '';
  const fileBaseUrl = apiBase.replace(/\/api\/?$/, '');

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` },
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/user/tasks', authHeaders());
      setTasks(data);
      setLastFetchedAt(new Date());
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'تعذر تحميل المهام',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setManualRefresh(true);
      await fetchTasks();
    } finally {
      setManualRefresh(false);
    }
  };

  const handleRequestFileChange = (taskId, fileList) => {
    setRequestFiles((prev) => ({
      ...prev,
      [taskId]: Array.from(fileList),
    }));
  };

  const handleCompleteFileChange = (taskId, fileList) => {
    setCompleteFiles((prev) => ({
      ...prev,
      [taskId]: Array.from(fileList),
    }));
  };

  const renderAttachments = (attachments = []) => {
    if (!attachments.length) return null;
    return (
      <ul className="mt-2 space-y-1 text-xs">
        {attachments.map((file) => (
          <li key={file.filename}>
            <a
              href={
                fileBaseUrl
                  ? `${fileBaseUrl}${file.url.startsWith('/') ? file.url : `/${file.url}`}`
                  : file.url
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-primary hover:underline"
            >
              {file.originalName || file.filename}
            </a>
            {file.size ? (
              <span className="ml-2 text-brand-ink/50">
                ({Math.round(file.size / 1024)} كيلوبايت)
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  };

  const toggleSection = (taskId, section) => {
    setOpenSections((prev) => ({
      ...prev,
      [taskId]: prev[taskId] === section ? null : section,
    }));
  };

  const handleStart = async (taskId) => {
    const note = window.prompt('يمكنك إضافة ملاحظة عند بدء المهمة (اختياري):', '');
    try {
      await axios.post(
        `/user/tasks/${taskId}/start`,
        note ? { message: note } : {},
        authHeaders()
      );
      setFeedback({ type: 'success', message: 'تم تسجيل بدء العمل على المهمة.' });
      await fetchTasks();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'تعذر تسجيل بدء المهمة',
      });
    }
  };

  const handleRequest = async (taskId) => {
    const message = (requestNotes[taskId] || '').trim();
    if (!message) {
      setFeedback({ type: 'error', message: 'يرجى كتابة تفاصيل الطلب قبل الإرسال.' });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('message', message);
      (requestFiles[taskId] || []).forEach((file) => {
        formData.append('attachments', file);
      });

      await axios.post(`/user/tasks/${taskId}/request`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setFeedback({ type: 'success', message: 'تم إرسال الطلب إلى الإدمن.' });
      setRequestNotes((prev) => ({ ...prev, [taskId]: '' }));
      setRequestFiles((prev) => ({ ...prev, [taskId]: [] }));
      setOpenSections((prev) => ({ ...prev, [taskId]: null }));
      await fetchTasks();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          'تعذر إرسال الطلب',
      });
    }
  };

  const handleComplete = async (taskId) => {
    const data = completeNotes[taskId] || { message: '', progress: '100' };
    const message = data.message.trim();
    const progressValue = Number(data.progress);

    if (!message) {
      setFeedback({ type: 'error', message: 'يرجى كتابة التقرير النهائي قبل الإرسال.' });
      return;
    }

    if (Number.isNaN(progressValue) || progressValue < 0 || progressValue > 100) {
      setFeedback({ type: 'error', message: 'نسبة الإنجاز يجب أن تكون بين 0 و 100.' });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('progress', progressValue.toString());
      (completeFiles[taskId] || []).forEach((file) => {
        formData.append('attachments', file);
      });

      await axios.post(`/user/tasks/${taskId}/complete`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setFeedback({ type: 'success', message: 'تم إرسال التقرير النهائي وإكمال المهمة.' });
      setCompleteNotes((prev) => ({
        ...prev,
        [taskId]: { message: '', progress: '100' },
      }));
      setCompleteFiles((prev) => ({ ...prev, [taskId]: [] }));
      setOpenSections((prev) => ({ ...prev, [taskId]: null }));
      await fetchTasks();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          'تعذر إنهاء المهمة',
      });
    }
  };

  const handleToggleTaskDetail = async (task, detail) => {
    if (!detail?._id) return;
    const detailKey = `${task._id}:${detail._id}`;

    setDetailMutations((prev) => ({ ...prev, [detailKey]: true }));

    try {
      const { data } = await axios.patch(
        `/user/tasks/${task._id}/details/${detail._id}`,
        { isCompleted: !detail.isCompleted },
        authHeaders()
      );

      setTasks((prev) =>
        prev.map((entry) =>
          entry._id === data._id
            ? {
                ...entry,
                details: data.details || [],
                status: data.status,
                updatedAt: data.updatedAt,
              }
            : entry
        )
      );
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          'تعذر تحديث تفصيلة المهمة',
      });
    } finally {
      setDetailMutations((prev) => {
        const next = { ...prev };
        delete next[detailKey];
        return next;
      });
    }
  };

  const renderStatusTag = (status) => {
    const cls = statusStyles[status] || statusStyles.pending;
    const labels = {
      pending: 'قيد الانتظار',
      'in-progress': 'قيد التنفيذ',
      completed: 'مكتملة',
      late: 'متأخرة',
      returned: 'مُعادة',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-brand-soft/20 to-brand-muted/10">
      <Navbar />
      <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center opacity-5 lg:opacity-10">
        <img
          src={santraLogo}
          alt="شعار Santra Task"
          className="w-[min(80vw,560px)] max-w-2xl"
          aria-hidden="true"
        />
      </div>
      <div className="relative container mx-auto px-4 py-8">
        <div className="rounded-3xl border border-brand-muted/60 bg-white/90 px-6 py-6 shadow-soft backdrop-blur">
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-brand-muted/40 bg-gradient-to-l from-brand-primary/10 via-white to-brand-soft/40 p-5">
            <div className="pointer-events-none absolute -right-8 top-1/2 hidden h-36 w-36 -translate-y-1/2 opacity-20 md:block">
              <img
                src={santraLogo}
                alt="شعار Santra Task"
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
            </div>
            <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 opacity-10">
              <img
                src={santraLogo}
                alt="زخرفة شعار Santra Task"
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
            </div>
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-display text-3xl font-semibold text-brand-ink">مساحة مهامي</h2>
                <p className="mt-2 text-sm text-brand-ink/70">
                  تحكّم بمهام الفريق، ووازن بينها وبين مهامك الشخصية بمظهر موحّد وواضح.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 shadow-subtle">
                <img
                  src={santraLogo}
                  alt="شعار Santra Task"
                  className="h-10 w-auto drop-shadow-lg"
                />
                <span className="text-xs font-medium text-brand-primary/90">
                  تنظيم ذكي بين أدوارك المختلفة
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold text-brand-ink">مهامي الموكلة</h2>
            <div className="flex flex-wrap items-center gap-3">
              {lastFetchedAt ? (
                <span className="text-xs text-brand-ink/60">
                  آخر تحديث: {lastFetchedAt.toLocaleString('ar-SA')}
                </span>
              ) : null}
              <button
                onClick={handleRefresh}
                disabled={loading || manualRefresh}
                className="rounded-full border border-brand-primary px-4 py-2 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'جاري التحديث...' : 'تحديث البيانات'}
              </button>
            </div>
          </div>

        {feedback && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm shadow-subtle ${
              feedback.type === 'success'
                ? 'border-brand-secondary/40 bg-brand-secondary/10 text-brand-secondary'
                : 'border-brand-accent/40 bg-brand-accent/15 text-brand-ink'
            }`}
          >
            <div className="flex justify-between items-start gap-4">
              <span>{feedback.message}</span>
              <button
                onClick={() => setFeedback(null)}
                className="text-xs underline"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-3 text-sm text-brand-primary">
            جاري تحميل المهام...
          </p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-muted/80 bg-white/80 p-8 text-center text-brand-ink/60">
            لا توجد مهام مخصصة لك حالياً.
          </div>
        ) : (
          <div className="grid gap-4">
            {tasks.map((task) => {
              const latestFeedback = task.adminFeedback?.[0];
              const feedbackTone =
                latestFeedback?.type === 'returned'
                  ? 'border-brand-accent/40 bg-brand-accent/15 text-brand-ink'
                  : 'border-brand-highlight/50 bg-brand-highlight/15 text-brand-primary';

              return (
                <div key={task._id} className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-brand-ink">{task.title}</h3>
                      <p className="text-sm text-brand-ink/70">
                        مكلف من:{' '}
                        <span className="font-medium text-brand-ink">
                          {task.assignedBy?.fullName || 'غير محدد'}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-brand-ink/70">
                        دورك في المهمة:{' '}
                        <span className="font-medium text-brand-ink">
                          {task.userRoleInTask === 'primary' ? 'مسؤول رئيسي' : 'عضو مشارك'}
                        </span>
                      </p>
                      {!task.isPrimaryAssignee && task.assignedTo?.fullName && (
                        <p className="text-xs text-brand-ink/60">
                          المسؤول الرئيسي:{' '}
                          <span className="font-medium text-brand-ink">{task.assignedTo.fullName}</span>
                        </p>
                      )}
                      {Array.isArray(task.teamMembers) && task.teamMembers.length > 0 && (
                        <p className="text-xs text-brand-ink/60">
                          أعضاء مشاركون آخرون: {
                            task.teamMembers
                              .map((member) => member.fullName || member.username || 'عضو مجهول')
                              .join('، ')
                          }
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {renderStatusTag(task.status)}
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          task.priority === 3
                            ? 'bg-brand-accent/25 text-brand-ink'
                            : task.priority === 2
                            ? 'bg-brand-highlight/25 text-brand-primary'
                            : 'bg-brand-muted/70 text-brand-ink'
                        }`}
                      >
                        الأولوية: {task.priority === 3 ? 'عالية' : task.priority === 2 ? 'متوسطة' : 'منخفضة'}
                      </span>
                    </div>
                  </div>

                  {task.description && (
                    <p className="mt-3 text-brand-ink leading-relaxed">{task.description}</p>
                  )}

                  {Array.isArray(task.details) && task.details.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-brand-highlight/40 bg-brand-highlight/10 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-brand-primary">تفاصيل المهمة</h4>
                        <span className="text-[11px] text-brand-primary/60">
                          {task.details.length} تفصيلة
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-brand-ink/80">
                        {task.details.map((detail) => {
                          const key = `${task._id}:${detail._id}`;
                          const isUpdating = Boolean(detailMutations[key]);
                          return (
                            <li
                              key={detail._id || detail.text}
                              className="rounded-xl border border-brand-muted/60 bg-white/90 px-3 py-2"
                            >
                              <label className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 rounded border-brand-primary text-brand-primary focus:ring-brand-primary"
                                  checked={Boolean(detail.isCompleted)}
                                  disabled={isUpdating}
                                  onChange={() => handleToggleTaskDetail(task, detail)}
                                />
                                <span className="flex-1">
                                  <span
                                    className={`font-medium ${
                                      detail.isCompleted ? 'text-brand-secondary' : 'text-brand-ink'
                                    }`}
                                  >
                                    {detail.text}
                                  </span>
                                  {detail.note ? (
                                    <span className="mt-1 block text-xs text-brand-ink/60 whitespace-pre-wrap">
                                      {detail.note}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                              {isUpdating ? (
                                <p className="mt-1 text-[11px] text-brand-ink/50">جارٍ تحديث الحالة...</p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {task.dueDate && (
                    <p className="mt-2 text-sm text-brand-ink/60">
                      الموعد النهائي: {new Date(task.dueDate).toLocaleDateString('ar-SA')}
                    </p>
                  )}

                  {latestFeedback && (
                    <div className={`mt-4 rounded-xl border px-4 py-3 text-sm shadow-subtle ${feedbackTone}`}>
                      <p className="text-xs text-brand-ink/70">
                        آخر تحديث من الإدارة · {latestFeedback.userId?.fullName || 'الإدارة'} ·{' '}
                        {new Date(latestFeedback.createdAt).toLocaleString('ar-SA')}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{latestFeedback.message}</p>
                      {renderAttachments(latestFeedback.attachments)}
                    </div>
                  )}

                  {task.adminFeedback?.length > 1 && (
                    <details className="mt-2 rounded-xl border border-brand-muted/60 bg-brand-soft/60 px-4 py-2 text-sm text-brand-ink">
                      <summary className="cursor-pointer text-xs font-medium text-brand-ink/70">
                        عرض الملاحظات السابقة من الإدارة
                      </summary>
                      <div className="mt-3 space-y-3">
                        {task.adminFeedback.slice(1).map((entry) => (
                          <div key={entry._id} className="rounded-lg border border-brand-muted/60 bg-white/90 px-3 py-2">
                            <p className="text-xs text-brand-ink/60">
                              {entry.userId?.fullName || 'الإدارة'} ·{' '}
                              {new Date(entry.createdAt).toLocaleString('ar-SA')}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-xs text-brand-ink/80">{entry.message}</p>
                            {renderAttachments(entry.attachments)}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {task.status === 'returned' && (
                    <div className="mt-4 rounded-xl border border-brand-accent/50 bg-brand-accent/15 px-4 py-3 text-sm text-brand-ink">
                      تمت إعادة هذه المهمة من الإدارة. يرجى مراجعة متطلبات الإكمال والرد عليها.
                    </div>
                  )}

                  {task.status !== 'completed' ? (
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleStart(task._id)}
                        className="rounded-full bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-primaryDark"
                      >
                        بدء العمل
                      </button>
                      <button
                        onClick={() => toggleSection(task._id, 'request')}
                        className="rounded-full border border-brand-primary px-4 py-2 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/10"
                      >
                        احتياجات / طلبات
                      </button>
                      <button
                        onClick={() => toggleSection(task._id, 'complete')}
                        className="rounded-full border border-brand-secondary px-4 py-2 text-sm font-medium text-brand-secondary transition hover:bg-brand-secondary/10"
                      >
                        إتمام المهمة
                      </button>
                    </div>

                    {openSections[task._id] === 'request' && (
                      <div className="rounded-2xl border border-brand-highlight/50 bg-brand-highlight/15 p-4">
                        <h4 className="mb-2 text-sm font-semibold text-brand-primary">
                          اكتب تفاصيل الطلب أو الاحتياجات ليراجعها الإدمن
                        </h4>
                        <textarea
                          value={requestNotes[task._id] || ''}
                          onChange={(e) =>
                            setRequestNotes((prev) => ({
                              ...prev,
                              [task._id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
                          rows={3}
                          placeholder="مثال: أحتاج صلاحية VPN أو توضيح حول المتطلبات..."
                        />
                          <div className="mt-3">
                            <label className="text-sm text-brand-ink/60">إرفاق ملفات (اختياري)</label>
                            <input
                              type="file"
                              multiple
                              onChange={(e) => handleRequestFileChange(task._id, e.target.files)}
                              className="mt-1 block w-full text-sm text-brand-primary file:mr-3 file:rounded-full file:border-0 file:bg-brand-primary file:px-4 file:py-2 file:text-white hover:file:bg-brand-primaryDark"
                            />
                            {(requestFiles[task._id] || []).length > 0 && (
                              <ul className="mt-2 space-y-1 text-xs text-brand-primary">
                                {requestFiles[task._id].map((file) => (
                                  <li key={file.name}>{file.name}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleRequest(task._id)}
                            className="rounded-full bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-primaryDark"
                          >
                            إرسال الطلب
                          </button>
                        </div>
                      </div>
                    )}

                    {openSections[task._id] === 'complete' && (
                      <div className="rounded-2xl border border-brand-secondary/50 bg-brand-secondary/10 p-4">
                        <h4 className="mb-2 text-sm font-semibold text-brand-secondary">
                          أدخل التقرير النهائي ونسبة الإنجاز
                        </h4>
                        <textarea
                          value={completeNotes[task._id]?.message || ''}
                          onChange={(e) =>
                            setCompleteNotes((prev) => ({
                              ...prev,
                              [task._id]: {
                                ...prev[task._id],
                                message: e.target.value,
                                progress: prev[task._id]?.progress ?? '100',
                              },
                            }))
                          }
                          className="w-full rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/30 focus:outline-none"
                          rows={4}
                          placeholder="مثال: تم تنفيذ المهمة بالكامل، وتشمل الخطوات التالية..."
                        />
                        <div className="mt-3 flex items-center gap-3">
                          <label className="text-sm text-brand-ink/60">نسبة الإنجاز (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={completeNotes[task._id]?.progress ?? '100'}
                            onChange={(e) =>
                              setCompleteNotes((prev) => ({
                                ...prev,
                                [task._id]: {
                                  ...prev[task._id],
                                  message: prev[task._id]?.message ?? '',
                                  progress: e.target.value,
                                },
                              }))
                            }
                            className="w-20 rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/30 focus:outline-none"
                          />
                        </div>
                        <div className="mt-3">
                          <label className="text-sm text-brand-ink/60">إرفاق ملفات (اختياري)</label>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => handleCompleteFileChange(task._id, e.target.files)}
                            className="mt-1 block w-full text-sm text-brand-secondary file:mr-3 file:rounded-full file:border-0 file:bg-brand-secondary file:px-4 file:py-2 file:text-white hover:file:bg-brand-secondary/90"
                          />
                          {(completeFiles[task._id] || []).length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-brand-secondary">
                              {completeFiles[task._id].map((file) => (
                                <li key={file.name}>{file.name}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => handleComplete(task._id)}
                            className="rounded-full bg-brand-secondary px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-secondary/90"
                          >
                            إرسال التقرير النهائي
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-brand-secondary/50 bg-brand-secondary/15 px-4 py-3 text-sm text-brand-secondary">
                      تم إكمال هذه المهمة. شكراً لجهودك!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
