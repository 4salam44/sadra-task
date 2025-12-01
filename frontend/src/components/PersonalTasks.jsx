import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

const PRIORITY_OPTIONS = [
  { value: 1, label: 'منخفضة' },
  { value: 2, label: 'متوسطة' },
  { value: 3, label: 'عالية' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'قيد التخطيط' },
  { value: 'in-progress', label: 'قيد التنفيذ' },
  { value: 'completed', label: 'مكتملة' },
];

const LOG_TYPE_LABELS = {
  note: 'ملاحظة',
  session: 'جلسة تركيز',
  milestone: 'إنجاز',
  'detail-update': 'تحديث تفصيلة',
};

const REPORT_STATUS_LABELS = {
  submitted: 'قيد المراجعة',
  'needs-info': 'بحاجة لتوضيح',
  resolved: 'مكتمل',
};

const REPORT_STATUS_STYLES = {
  submitted: 'bg-brand-muted/60 text-brand-ink',
  'needs-info': 'bg-brand-accent/20 text-brand-ink',
  resolved: 'bg-brand-secondary/20 text-brand-secondary',
};

const createEmptyDetail = () => ({
  _id: `temp-${Math.random().toString(36).slice(2, 10)}`,
  text: '',
  isCompleted: false,
  note: '',
});

const buildDefaultForm = () => ({
  title: '',
  description: '',
  category: '',
  priority: 2,
  status: 'pending',
  dueDate: '',
  reminderAt: '',
  allowSharedEdit: false,
  details: [createEmptyDetail()],
  timerConfig: {
    durationMinutes: '',
    label: '',
    autoStart: false,
  },
  sharedWith: [],
});

const formatDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

const normalizeTaskToForm = (task) => {
  const form = buildDefaultForm();
  form.title = task.title || '';
  form.description = task.description || '';
  form.category = task.category || '';
  form.priority = task.priority || 2;
  form.status = task.status || 'pending';
  form.dueDate = formatDateTimeLocal(task.dueDate);
  form.reminderAt = formatDateTimeLocal(task.reminderAt);
  form.allowSharedEdit = Boolean(task.allowSharedEdit);
  form.details =
    Array.isArray(task.details) && task.details.length > 0
      ? task.details.map((detail) => ({
          _id: detail._id || createEmptyDetail()._id,
          text: detail.text || '',
          isCompleted: Boolean(detail.isCompleted),
          note: detail.note || '',
        }))
      : [createEmptyDetail()];
  if (task.timerConfig?.durationMinutes) {
    form.timerConfig.durationMinutes = task.timerConfig.durationMinutes.toString();
    form.timerConfig.label = task.timerConfig.label || '';
    form.timerConfig.autoStart = Boolean(task.timerConfig.autoStart);
  }
  form.sharedWith = Array.isArray(task.sharedWith) ? task.sharedWith : [];
  return form;
};

const buildPayloadFromForm = (form) => {
  const timerDuration = Number(form.timerConfig.durationMinutes);
  const hasTimerConfig = !Number.isNaN(timerDuration) && timerDuration > 0;

  const payload = {
    title: form.title.trim(),
    description: form.description ? form.description.trim() : '',
    category: form.category ? form.category.trim() : '',
    priority: Number(form.priority) || 2,
    status: form.status,
    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
    reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : null,
    allowSharedEdit: Boolean(form.allowSharedEdit),
    details: (form.details || [])
      .map((detail) => ({
        _id: detail._id && detail._id.startsWith('temp-') ? undefined : detail._id,
        text: detail.text?.trim() || '',
        isCompleted: Boolean(detail.isCompleted),
        note: detail.note ? detail.note.trim() : undefined,
      }))
      .filter((detail) => detail.text),
    timerConfig: hasTimerConfig
      ? {
          durationMinutes: timerDuration,
          label: form.timerConfig.label ? form.timerConfig.label.trim() : '',
          autoStart: Boolean(form.timerConfig.autoStart),
        }
      : null,
    sharedWithUserIds: (form.sharedWith || []).map((user) => user._id),
  };

  if (!payload.details.length) {
    payload.details = [];
  }

  if (!hasTimerConfig) {
    payload.timerConfig = null;
  }

  return payload;
};

const renderStatusBadge = (status) => {
  const styles = {
    pending: 'bg-brand-muted/70 text-brand-ink',
    'in-progress': 'bg-brand-highlight/20 text-brand-primary',
    completed: 'bg-brand-secondary/20 text-brand-secondary',
  };
  const labels = {
    pending: 'قيد التخطيط',
    'in-progress': 'قيد التنفيذ',
    completed: 'مكتملة',
  };
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
};

const formatTimer = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const buildDefaultLogForm = () => ({
  type: 'note',
  title: '',
  description: '',
  startedAt: '',
  endedAt: '',
  durationMinutes: '',
  progress: '',
});

const buildDefaultReportForm = () => ({
  completionPercentage: '100',
  notes: '',
  files: [],
  status: 'draft',
});

const buildDefaultReportReply = () => ({
  message: '',
  files: [],
});

const formatMinutesLabel = (minutes) => {
  const total = Number(minutes) || 0;
  if (total <= 0) return '0 دقيقة';
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) {
    return `${hours} س ${mins} د`;
  }
  if (hours) {
    return hours === 1 ? 'ساعة واحدة' : `${hours} ساعات`;
  }
  return `${mins} دقيقة`;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ar-SA', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

export default function PersonalTasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [form, setForm] = useState(buildDefaultForm);
  const [feedback, setFeedback] = useState(null);
  const [collaboratorQuery, setCollaboratorQuery] = useState('');
  const [collaboratorResults, setCollaboratorResults] = useState([]);
  const [searchingCollaborators, setSearchingCollaborators] = useState(false);
  const [activeTimers, setActiveTimers] = useState({});
  const [taskLogs, setTaskLogs] = useState({});
  const [logsLoading, setLogsLoading] = useState({});
  const [logForms, setLogForms] = useState({});
  const [logSubmitting, setLogSubmitting] = useState({});
  const [logSharing, setLogSharing] = useState({});
  const [openTaskId, setOpenTaskId] = useState(null);
  const [taskReports, setTaskReports] = useState({});
  const [reportsLoading, setReportsLoading] = useState({});
  const [reportDrafts, setReportDrafts] = useState({});
  const [reportSubmitting, setReportSubmitting] = useState({});
  const [reportReplies, setReportReplies] = useState({});
  const [reportReplySubmitting, setReportReplySubmitting] = useState({});
  const [panelTabs, setPanelTabs] = useState({});
  const reminderTimeoutsRef = useRef({});
  const reminderNotifiedRef = useRef({});

  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${token}` },
    }),
    [token]
  );

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = setInterval(() => {
      setActiveTimers((prev) => {
        if (!prev || Object.keys(prev).length === 0) return prev;
        let mutated = false;
        const nextState = {};
        Object.entries(prev).forEach(([taskId, timer]) => {
          if (!timer.isRunning) {
            nextState[taskId] = timer;
            return;
          }
          const nextRemaining = Math.max(0, timer.remainingMs - 1000);
          const hasFinished = nextRemaining === 0;
          nextState[taskId] = {
            ...timer,
            remainingMs: nextRemaining,
            isRunning: hasFinished ? false : timer.isRunning,
            notified: hasFinished ? true : timer.notified,
          };
          if (hasFinished && !timer.notified) {
            window.alert(`انتهى عداد المهمة "${timer.label || 'مهمة بدون عنوان'}"`);
          }
          if (
            nextRemaining !== timer.remainingMs ||
            nextState[taskId].isRunning !== timer.isRunning ||
            nextState[taskId].notified !== timer.notified
          ) {
            mutated = true;
          }
        });
        return mutated ? nextState : prev;
      });
    }, 1000);

    return () => clearInterval(handler);
  }, []);

  useEffect(() => {
    Object.values(reminderTimeoutsRef.current).forEach(clearTimeout);
    reminderTimeoutsRef.current = {};

    tasks.forEach((task) => {
      if (!task.reminderAt) return;
      const reminderTime = new Date(task.reminderAt).getTime();
      if (Number.isNaN(reminderTime)) return;
      const now = Date.now();
      if (reminderTime <= now) {
        if (!reminderNotifiedRef.current[task._id]) {
          reminderNotifiedRef.current[task._id] = true;
          window.alert(`تذكير: حان وقت المهمة "${task.title}"`);
        }
      } else {
        const timeoutId = setTimeout(() => {
          if (!reminderNotifiedRef.current[task._id]) {
            reminderNotifiedRef.current[task._id] = true;
            window.alert(`تذكير: حان وقت المهمة "${task.title}"`);
          }
        }, reminderTime - Date.now());
        reminderTimeoutsRef.current[task._id] = timeoutId;
      }
    });

    return () => {
      Object.values(reminderTimeoutsRef.current).forEach(clearTimeout);
      reminderTimeoutsRef.current = {};
    };
  }, [tasks]);

  useEffect(() => {
    setActiveTimers((prev) => {
      let mutated = false;
      const next = { ...prev };
      tasks.forEach((task) => {
        const durationMinutes = Number(task.timerConfig?.durationMinutes);
        if (
          task.timerConfig?.autoStart &&
          !Number.isNaN(durationMinutes) &&
          durationMinutes > 0 &&
          !next[task._id]
        ) {
          const durationMs = durationMinutes * 60 * 1000;
          next[task._id] = {
            label: task.timerConfig.label || task.title,
            durationMs,
            remainingMs: durationMs,
            isRunning: true,
            notified: false,
          };
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [tasks]);

  useEffect(() => {
    if (!collaboratorQuery || collaboratorQuery.trim().length < 2) {
      setCollaboratorResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearchingCollaborators(true);
        const { data } = await axios.get('/personal/collaborators', {
          ...authHeaders,
          params: { q: collaboratorQuery.trim() },
          signal: controller.signal,
        });
        setCollaboratorResults(data);
      } catch (error) {
        if (error.name !== 'CanceledError') {
          console.error('Failed to search collaborators', error);
        }
      } finally {
        setSearchingCollaborators(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [collaboratorQuery, authHeaders]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/personal/tasks', authHeaders);
      setTasks(data);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'تعذر تحميل المهام الشخصية',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(buildDefaultForm());
    setEditingTaskId(null);
    setShowForm(false);
    setCollaboratorQuery('');
    setCollaboratorResults([]);
  };

  const upsertTask = (updatedTask) => {
    setTasks((prev) => {
      const exists = prev.some((task) => task._id === updatedTask._id);
      if (exists) {
        return prev.map((task) => (task._id === updatedTask._id ? updatedTask : task));
      }
      return [updatedTask, ...prev];
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setFeedback({ type: 'error', message: 'يرجى كتابة عنوان المهمة' });
      return;
    }

    const payload = buildPayloadFromForm(form);

    try {
      if (editingTaskId) {
        const { data } = await axios.put(
          `/personal/tasks/${editingTaskId}`,
          payload,
          authHeaders
        );
        upsertTask(data);
        setFeedback({ type: 'success', message: 'تم تحديث المهمة بنجاح' });
      } else {
        const { data } = await axios.post('/personal/tasks', payload, authHeaders);
        upsertTask(data);
        setFeedback({ type: 'success', message: 'تم إنشاء المهمة بنجاح' });
      }
      resetForm();
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.msg ||
          'تعذر حفظ المهمة',
      });
    }
  };

  const handleEditTask = (task) => {
    setForm(normalizeTaskToForm(task));
    setEditingTaskId(task._id);
    setShowForm(true);
  };

  const handleDeleteTask = async (taskId) => {
    const confirmation = window.confirm('هل أنت متأكد من حذف هذه المهمة؟');
    if (!confirmation) return;

    try {
      await axios.delete(`/personal/tasks/${taskId}`, authHeaders);
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
      setActiveTimers((prev) => {
        if (!prev[taskId]) return prev;
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setFeedback({ type: 'success', message: 'تم حذف المهمة بنجاح' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'تعذر حذف المهمة',
      });
    }
  };

  const handleSendToAdmin = async (taskId, title) => {
    const form = reportDrafts[taskId] || buildDefaultReportForm();
    if (!form.notes.trim() && form.files.length === 0) {
      setFeedback({
        type: 'error',
        message: 'يرجى كتابة ملخص أو إرفاق ملفات قبل المشاركة مع الإدارة.',
      });
      return;
    }

    try {
      setReportSubmitting((prev) => ({ ...prev, [taskId]: true }));
      const formData = new FormData();
      const completionValue = Number(form.completionPercentage);
      if (!Number.isNaN(completionValue)) {
        formData.append('completionPercentage', completionValue.toString());
      }
      formData.append('notes', form.notes.trim());
      form.files.forEach((file) => formData.append('attachments', file));

      const { data } = await axios.post(
        `/personal/tasks/${taskId}/report-to-admin`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setReportDrafts((prev) => ({
        ...prev,
        [taskId]: buildDefaultReportForm(),
      }));
      setTaskReports((prev) => ({
        ...prev,
        [taskId]: [data, ...(prev[taskId] || [])],
      }));
      setTasks((prev) =>
        prev.map((task) => {
          if (task._id !== taskId) return task;
          return {
            ...task,
            isSharedWithAdmin: true,
            latestReport: data,
          };
        })
      );
      setFeedback({
        type: 'success',
        message: `تم إرسال المهمة "${title}" إلى الإدمن.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.msg ||
          'تعذر إرسال التقرير للإدمن',
      });
    } finally {
      setReportSubmitting((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const ensureLogForm = (taskId) => {
    setLogForms((prev) => {
      if (prev[taskId]) return prev;
      return { ...prev, [taskId]: buildDefaultLogForm() };
    });
  };

  const ensureReportDraft = (taskId) => {
    setReportDrafts((prev) => {
      if (prev[taskId]) return prev;
      return { ...prev, [taskId]: buildDefaultReportForm() };
    });
  };

  const fetchTaskLogs = async (taskId) => {
    try {
      setLogsLoading((prev) => ({ ...prev, [taskId]: true }));
      const { data } = await axios.get(`/personal/tasks/${taskId}/logs`, authHeaders);
      setTaskLogs((prev) => ({ ...prev, [taskId]: data }));
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'تعذر تحميل السجل الشخصي للمهمة',
      });
    } finally {
      setLogsLoading((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const fetchTaskReports = async (taskId) => {
    try {
      setReportsLoading((prev) => ({ ...prev, [taskId]: true }));
      const { data } = await axios.get(`/personal/tasks/${taskId}/reports`, authHeaders);
      setTaskReports((prev) => ({ ...prev, [taskId]: data }));
      setReportReplies((prev) => {
        const next = { ...prev };
        data.forEach((report) => {
          if (!next[report._id]) {
            next[report._id] = buildDefaultReportReply();
          }
        });
        return next;
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'تعذر تحميل تقارير المهمة الشخصية',
      });
    } finally {
      setReportsLoading((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const toggleTaskLogs = async (taskId) => {
    if (openTaskId === taskId) {
      setOpenTaskId(null);
      return;
    }
    setOpenTaskId(taskId);
    ensureLogForm(taskId);
    ensureReportDraft(taskId);
    setPanelTabs((prev) => ({ ...prev, [taskId]: prev[taskId] || 'reports' }));
    if (!taskLogs[taskId]) {
      await fetchTaskLogs(taskId);
    }
    if (!taskReports[taskId]) {
      await fetchTaskReports(taskId);
    }
  };

  const setActivePanel = (taskId, panel) => {
    setPanelTabs((prev) => ({
      ...prev,
      [taskId]: panel,
    }));
  };

  const handleReportDraftChange = (taskId, key, value) => {
    setReportDrafts((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || buildDefaultReportForm()),
        [key]: value,
      },
    }));
  };

  const handleReportDraftFiles = (taskId, fileList) => {
    handleReportDraftChange(taskId, 'files', Array.from(fileList || []));
  };

  const handleReportReplyChange = (reportId, key, value) => {
    setReportReplies((prev) => ({
      ...prev,
      [reportId]: {
        ...(prev[reportId] || buildDefaultReportReply()),
        [key]: value,
      },
    }));
  };

  const handleReportReplyFiles = (reportId, fileList) => {
    handleReportReplyChange(reportId, 'files', Array.from(fileList || []));
  };

  const handleLogFieldChange = (taskId, key, value) => {
    setLogForms((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || buildDefaultLogForm()),
        [key]: value,
      },
    }));
  };

  const handleCreateLog = async (taskId) => {
    const formState = logForms[taskId] || buildDefaultLogForm();
    const payload = {
      type: formState.type,
      title: formState.title?.trim() || undefined,
      description: formState.description?.trim() || undefined,
    };
    if (formState.startedAt) payload.startedAt = formState.startedAt;
    if (formState.endedAt) payload.endedAt = formState.endedAt;
    if (formState.durationMinutes) payload.durationMinutes = Number(formState.durationMinutes);
    if (formState.progress) payload.progress = Number(formState.progress);

    try {
      setLogSubmitting((prev) => ({ ...prev, [taskId]: true }));
      const { data } = await axios.post(
        `/personal/tasks/${taskId}/logs`,
        payload,
        authHeaders
      );
      setTaskLogs((prev) => {
        const existing = prev[taskId] || [];
        return { ...prev, [taskId]: [data, ...existing] };
      });
      setLogForms((prev) => ({ ...prev, [taskId]: buildDefaultLogForm() }));
      setTasks((prev) =>
        prev.map((task) => {
          if (task._id !== taskId) return task;
          const summary = task.reportSummary || {};
          const updatedTotal = (summary.totalMinutes || 0) + (data.durationMinutes || 0);
          const lastLogAt = data.startedAt || data.createdAt || summary.lastLogAt;
          return {
            ...task,
            reportSummary: {
              ...summary,
              totalMinutes: updatedTotal,
              lastLogAt,
              sharedLogCount: summary.sharedLogCount || 0,
            },
          };
        })
      );
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'تعذر حفظ التحديث الشخصي',
      });
    } finally {
      setLogSubmitting((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const handleShareLog = async (taskId, logId) => {
    try {
      const existingLogs = taskLogs[taskId] || [];
      const wasShared =
        existingLogs.find((log) => log._id === logId)?.isSharedWithAdmin ?? false;
      setLogSharing((prev) => ({ ...prev, [logId]: true }));
      const { data } = await axios.post(
        `/personal/tasks/${taskId}/logs/${logId}/share`,
        {},
        authHeaders
      );
      setTaskLogs((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).map((log) => (log._id === logId ? data : log)),
      }));
      setTasks((prev) =>
        prev.map((task) => {
          if (task._id !== taskId) return task;
          const summary = task.reportSummary || {};
          const sharedIncrement =
            !wasShared && data.isSharedWithAdmin ? 1 : 0;
          return {
            ...task,
            isSharedWithAdmin: true,
            reportSummary: {
              ...summary,
              totalMinutes: summary.totalMinutes || 0,
              lastLogAt: summary.lastLogAt,
              sharedLogCount: (summary.sharedLogCount || 0) + sharedIncrement,
            },
          };
        })
      );
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'تعذر مشاركة التحديث مع الإدارة',
      });
    } finally {
      setLogSharing((prev) => {
        const next = { ...prev };
        delete next[logId];
        return next;
      });
    }
  };

  const handleSubmitReportReply = async (taskId, reportId) => {
    const form = reportReplies[reportId] || buildDefaultReportReply();
    const message = form.message.trim();
    if (!message && (!form.files || form.files.length === 0)) {
      setFeedback({
        type: 'error',
        message: 'يرجى كتابة رسالة أو إرفاق ملف قبل الرد على الإدارة.',
      });
      return;
    }

    const formData = new FormData();
    if (message) {
      formData.append('message', message);
    }
    (form.files || []).forEach((file) => formData.append('attachments', file));

    try {
      setReportReplySubmitting((prev) => ({ ...prev, [reportId]: true }));
      const { data } = await axios.post(
        `/personal/reports/${reportId}/respond`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setReportReplies((prev) => ({
        ...prev,
        [reportId]: buildDefaultReportReply(),
      }));
      setTaskReports((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] || []).map((report) =>
          report._id === reportId ? data : report
        ),
      }));
      setReportReplies((prev) => ({
        ...prev,
        [reportId]: buildDefaultReportReply(),
      }));
      setFeedback({
        type: 'success',
        message: 'تم إرسال الرد للإدارة.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.msg ||
          'تعذر إرسال الرد للإدارة',
      });
    } finally {
      setReportReplySubmitting((prev) => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
    }
  };

  const handleToggleDetail = async (task, detail) => {
    try {
      const { data } = await axios.patch(
        `/personal/tasks/${task._id}/details/${detail._id}`,
        { isCompleted: !detail.isCompleted },
        authHeaders
      );
      upsertTask(data);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'تعذر تحديث التفصيلة',
      });
    }
  };

  const handleTimerStart = (task) => {
    const durationMinutes = Number(task.timerConfig?.durationMinutes);
    if (Number.isNaN(durationMinutes) || durationMinutes <= 0) {
      setFeedback({
        type: 'error',
        message: 'يرجى تحديد مدة العداد في إعدادات المهمة قبل البدء.',
      });
      return;
    }
    const durationMs = durationMinutes * 60 * 1000;
    setActiveTimers((prev) => ({
      ...prev,
      [task._id]: {
        label: task.timerConfig?.label || task.title,
        durationMs,
        remainingMs: durationMs,
        isRunning: true,
        notified: false,
      },
    }));
  };

  const handleTimerPause = (taskId) => {
    setActiveTimers((prev) => {
      const timer = prev[taskId];
      if (!timer) return prev;
      return {
        ...prev,
        [taskId]: { ...timer, isRunning: false },
      };
    });
  };

  const handleTimerResume = (taskId) => {
    setActiveTimers((prev) => {
      const timer = prev[taskId];
      if (!timer) return prev;
      return {
        ...prev,
        [taskId]: { ...timer, isRunning: true },
      };
    });
  };

  const handleTimerReset = (task) => {
    setActiveTimers((prev) => {
      const timer = prev[task._id];
      if (!timer) return prev;
      return {
        ...prev,
        [task._id]: {
          ...timer,
          remainingMs: timer.durationMs,
          isRunning: false,
          notified: false,
        },
      };
    });
  };

  const handleRemoveTimer = (taskId) => {
    setActiveTimers((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const handleAddDetail = () => {
    setForm((prev) => ({
      ...prev,
      details: [...prev.details, createEmptyDetail()],
    }));
  };

  const handleDetailChange = (detailId, key, value) => {
    setForm((prev) => ({
      ...prev,
      details: prev.details.map((detail) =>
        detail._id === detailId ? { ...detail, [key]: value } : detail
      ),
    }));
  };

  const handleRemoveDetail = (detailId) => {
    setForm((prev) => {
      const filtered = prev.details.filter((detail) => detail._id !== detailId);
      return {
        ...prev,
        details: filtered.length > 0 ? filtered : [createEmptyDetail()],
      };
    });
  };

  const handleSelectCollaborator = (user) => {
    setForm((prev) => {
      const exists = prev.sharedWith.some((item) => item._id === user._id);
      if (exists) return prev;
      return {
        ...prev,
        sharedWith: [...prev.sharedWith, user],
      };
    });
    setCollaboratorQuery('');
    setCollaboratorResults([]);
  };

  const handleRemoveCollaborator = (userId) => {
    setForm((prev) => ({
      ...prev,
      sharedWith: prev.sharedWith.filter((user) => user._id !== userId),
    }));
  };

  const ownTasks = tasks.filter((task) => task.isOwner);
  const sharedTasks = tasks.filter((task) => !task.isOwner);

  const renderTaskCard = (task) => {
    const timerState = activeTimers[task._id];
    const canEdit = task.isOwner || (task.allowSharedEdit && task.isSharedWithCurrentUser);
    const summary = task.reportSummary || {};
    const hasSummaryMetrics =
      (summary.totalMinutes && summary.totalMinutes > 0) ||
      summary.lastLogAt ||
      summary.sharedLogCount;
    const logForm = logForms[task._id] || buildDefaultLogForm();
    const logsForTask = taskLogs[task._id] || [];
    const isLogsOpen = openTaskId === task._id;
    const reportDraft = reportDrafts[task._id] || buildDefaultReportForm();
    const reportsForTask = taskReports[task._id] || [];
    const reportsBusy = Boolean(reportsLoading[task._id]);
    const activePanel = panelTabs[task._id] || 'reports';

    return (
      <div
        key={task._id}
        className={`rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle space-y-4 ${
          task.isSharedWithAdmin ? 'ring-1 ring-brand-primary/40' : ''
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-brand-ink">{task.title}</h3>
            <p className="text-sm text-brand-ink/70">
              {task.description || 'بدون وصف إضافي.'}
            </p>
            <div className="mt-2 space-y-1 text-xs text-brand-ink/60">
              {task.category ? <p>التصنيف: {task.category}</p> : null}
              <p>
                المالك:{' '}
                <span className="font-medium">
                  {task.userId?.fullName || task.userId?.username || 'أنت'}
                </span>
              </p>
              {task.sharedWith?.length ? (
                <p>
                  تمت المشاركة مع:{' '}
                  {task.sharedWith
                    .map((user) => user.fullName || user.username)
                    .join('، ')}
                </p>
              ) : null}
              {task.reminderAt ? (
                <p>
                  التذكير:{' '}
                  {new Date(task.reminderAt).toLocaleString('ar-SA', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
              ) : null}
              {task.dueDate ? (
                <p>
                  الموعد النهائي:{' '}
                  {new Date(task.dueDate).toLocaleString('ar-SA', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {renderStatusBadge(task.status)}
            <span
              className={`px-2 py-1 text-xs rounded ${
                task.priority === 3
                  ? 'bg-brand-accent/25 text-brand-ink'
                  : task.priority === 2
                  ? 'bg-brand-highlight/25 text-brand-primary'
                  : 'bg-brand-muted/60 text-brand-ink'
              }`}
            >
              الأولوية: {PRIORITY_OPTIONS.find((opt) => opt.value === task.priority)?.label || 'غير محددة'}
            </span>
            {task.isSharedWithAdmin ? (
              <span className="rounded-full bg-brand-primary/15 px-3 py-1 text-[11px] text-brand-primary">
                مُرسلة للإدمن
              </span>
            ) : null}
            {!task.isOwner ? (
              <span className="rounded-full bg-brand-muted/50 px-3 py-1 text-[11px] text-brand-ink">
                مهمة مشتركة معك
              </span>
            ) : null}
          </div>
        </div>

        {hasSummaryMetrics ? (
          <div className="rounded-xl border border-brand-muted/50 bg-brand-soft/40 px-4 py-3 text-xs text-brand-ink/70">
            <div className="flex flex-wrap items-center gap-3">
              <span>الوقت المسجل: {formatMinutesLabel(summary.totalMinutes)}</span>
              {summary.lastLogAt ? (
                <span>
                  آخر تحديث:{' '}
                  {new Date(summary.lastLogAt).toLocaleString('ar-SA', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              ) : null}
              {summary.sharedLogCount ? (
                <span>تقارير مشتركة مع الإدارة: {summary.sharedLogCount}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {task.details?.length ? (
          <div className="rounded-xl border border-brand-muted/60 bg-white/90 p-4">
            <p className="text-sm font-semibold text-brand-ink mb-3">تفاصيل المهمة</p>
            <ul className="space-y-2">
              {task.details.map((detail) => (
                <li
                  key={detail._id}
                  className="flex items-start justify-between gap-3 text-sm text-brand-ink/80"
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(detail.isCompleted)}
                      onChange={() => handleToggleDetail(task, detail)}
                      disabled={!canEdit || !detail._id || detail._id.toString().startsWith('temp-')}
                    />
                    <span className={detail.isCompleted ? 'line-through text-brand-ink/50' : ''}>
                      {detail.text}
                      {detail.note ? (
                        <span className="block text-xs text-brand-ink/50 mt-0.5">{detail.note}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {task.timerConfig?.durationMinutes ? (
          <div className="rounded-xl border border-brand-highlight/50 bg-brand-highlight/10 p-3 text-sm text-brand-ink flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-brand-primary">
                عداد المهمة: {task.timerConfig.label || task.title}
              </p>
              <p className="text-xs text-brand-primary/70">
                المدة: {task.timerConfig.durationMinutes} دقيقة
                {timerState ? ` · الوقت المتبقي: ${formatTimer(timerState.remainingMs)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {!timerState ? (
                <button
                  onClick={() => handleTimerStart(task)}
                  className="rounded-full bg-brand-primary px-3 py-1 text-white hover:bg-brand-primaryDark"
                >
                  بدء العداد
                </button>
              ) : timerState.isRunning ? (
                <button
                  onClick={() => handleTimerPause(task._id)}
                  className="rounded-full border border-brand-primary px-3 py-1 text-brand-primary hover:bg-brand-primary/10"
                >
                  إيقاف مؤقت
                </button>
              ) : (
                <button
                  onClick={() => handleTimerResume(task._id)}
                  className="rounded-full border border-brand-primary px-3 py-1 text-brand-primary hover:bg-brand-primary/10"
                >
                  استئناف
                </button>
              )}
              {timerState ? (
                <>
                  <button
                    onClick={() => handleTimerReset(task)}
                    className="rounded-full border border-brand-secondary px-3 py-1 text-brand-secondary hover:bg-brand-secondary/10"
                  >
                    إعادة الضبط
                  </button>
                  <button
                    onClick={() => handleRemoveTimer(task._id)}
                    className="rounded-full border border-brand-muted px-3 py-1 text-brand-ink hover:bg-brand-muted/40"
                  >
                    إخفاء العداد
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => toggleTaskLogs(task._id)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              isLogsOpen
                ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                : 'border-brand-muted text-brand-ink hover:bg-brand-muted/40'
            }`}
          >
            {isLogsOpen ? 'إخفاء السجل' : 'السجل الشخصي'}
          </button>
          {task.isOwner ? (
            <>
              <button
                onClick={() => handleEditTask(task)}
                className="rounded-full border border-brand-primary px-4 py-1.5 text-sm text-brand-primary hover:bg-brand-primary/10"
              >
                تعديل المهمة
              </button>
              <button
                onClick={() => handleDeleteTask(task._id)}
                className="rounded-full border border-brand-accent px-4 py-1.5 text-sm text-brand-accent hover:bg-brand-accent/10"
              >
                حذف
              </button>
              <button
                onClick={() => handleSendToAdmin(task._id, task.title)}
                className="rounded-full bg-brand-secondary px-4 py-1.5 text-sm text-white hover:bg-brand-secondary/90"
              >
                مشاركة مع الإدمن
              </button>
            </>
          ) : (
            <button
              onClick={() => handleEditTask(task)}
              disabled={!task.allowSharedEdit}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                task.allowSharedEdit
                  ? 'border-brand-primary text-brand-primary hover:bg-brand-primary/10'
                  : 'border-brand-muted text-brand-ink/50 cursor-not-allowed'
              }`}
            >
              {task.allowSharedEdit ? 'تحديث التفاصيل' : 'عرض التفاصيل'}
            </button>
          )}
        </div>

        {isLogsOpen ? (
          <div className="space-y-5 rounded-2xl border border-brand-muted/60 bg-white/92 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActivePanel(task._id, 'reports')}
                className={`rounded-full border px-3 py-1 text-xs ${
                  activePanel === 'reports'
                    ? 'border-brand-secondary bg-brand-secondary/15 text-brand-secondary'
                    : 'border-brand-muted text-brand-ink hover:bg-brand-muted/40'
                }`}
              >
                التقارير المشتركة
              </button>
              <button
                onClick={() => setActivePanel(task._id, 'logs')}
                className={`rounded-full border px-3 py-1 text-xs ${
                  activePanel === 'logs'
                    ? 'border-brand-primary bg-brand-primary/15 text-brand-primary'
                    : 'border-brand-muted text-brand-ink hover:bg-brand-muted/40'
                }`}
              >
                سجل المتابعة
              </button>
            </div>

            {activePanel === 'reports' ? (
              <>
                {task.isOwner ? (
                  <section className="space-y-3 rounded-2xl border border-brand-secondary/40 bg-brand-secondary/10 p-4">
                    <h4 className="text-sm font-semibold text-brand-secondary">مشاركة مع الإدارة</h4>
                    <p className="text-xs text-brand-ink/60">
                      أرسل تقريراً مختصراً مع أي ملفات داعمة. يمكنك متابعة ردود الإدارة والرد
                      عليها من خلال هذا السجل.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                        نسبة الإنجاز الحالية %
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={reportDraft.completionPercentage}
                          onChange={(e) =>
                            handleReportDraftChange(task._id, 'completionPercentage', e.target.value)
                          }
                          className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/20"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                        إرفاق ملفات داعمة
                        <input
                          key={`draft-files-${task._id}-${reportDraft.files.length}`}
                          type="file"
                          multiple
                          onChange={(e) => handleReportDraftFiles(task._id, e.target.files)}
                          className="w-full rounded-xl border border-dashed border-brand-muted/60 bg-white px-3 py-2 text-sm text-brand-ink/70"
                        />
                        {reportDraft.files.length ? (
                          <span className="block text-[11px] text-brand-ink/50">
                            {reportDraft.files.length} ملف/ملفات مرفقة
                          </span>
                        ) : null}
                      </label>
                    </div>
                    <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                      ملخص أو نقاط رئيسية
                      <textarea
                        value={reportDraft.notes}
                        onChange={(e) => handleReportDraftChange(task._id, 'notes', e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm text-brand-ink/80 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/20"
                        placeholder="أبرز ما تم إنجازه أو ما تحتاجه من دعم..."
                      />
                    </label>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleSendToAdmin(task._id, task.title)}
                        disabled={Boolean(reportSubmitting[task._id])}
                        className="rounded-full bg-brand-secondary px-4 py-1.5 text-sm text-white hover:bg-brand-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reportSubmitting[task._id] ? 'جارٍ الإرسال...' : 'إرسال إلى الإدارة'}
                      </button>
                    </div>
                  </section>
                ) : null}

                <section className="space-y-3 rounded-2xl border border-brand-muted/50 bg-white/95 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-brand-ink">التقارير المشتركة</h4>
                    <span className="text-xs text-brand-ink/50">{reportsForTask.length} تقرير</span>
                  </div>
                  {reportsBusy ? (
                    <p className="text-xs text-brand-ink/60">جاري تحميل تقارير المهمة...</p>
                  ) : reportsForTask.length === 0 ? (
                    <p className="text-xs text-brand-ink/60">
                      لم يتم إرسال أي تقرير للإدارة بعد.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {reportsForTask.map((report) => {
                        const replyForm = reportReplies[report._id] || buildDefaultReportReply();
                        const statusLabel =
                          REPORT_STATUS_LABELS[report.status] || 'قيد المتابعة';
                        const statusStyle =
                          REPORT_STATUS_STYLES[report.status] || REPORT_STATUS_STYLES.submitted;
                        return (
                          <article
                            key={report._id}
                            className="space-y-3 rounded-xl border border-brand-muted/60 bg-white/95 p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-brand-ink">
                                  {report.personalTaskId?.title || task.title}
                                </p>
                                <p className="text-xs text-brand-ink/60">
                                  أُرسل في {formatDateTime(report.createdAt)}
                                </p>
                                {typeof report.completionPercentage === 'number' ? (
                                  <p className="text-xs text-brand-secondary/80">
                                    نسبة الإنجاز المعلنة: {report.completionPercentage}%
                                  </p>
                                ) : null}
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusStyle}`}
                              >
                                {statusLabel}
                              </span>
                            </div>

                            {report.notes ? (
                              <p className="text-sm text-brand-ink/80 whitespace-pre-wrap">
                                {report.notes}
                              </p>
                            ) : null}

                            {report.attachments?.length ? (
                              <div className="space-y-1">
                                <p className="text-[11px] font-medium text-brand-ink/70">
                                  مرفقات التقرير
                                </p>
                                <ul className="space-y-1">
                                  {report.attachments.map((file) => (
                                    <li key={file.url}>
                                      <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-brand-primary hover:underline"
                                      >
                                        {file.originalName || file.filename}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            <div className="space-y-2 rounded-xl border border-brand-muted/50 bg-brand-soft/30 p-3">
                              <h5 className="text-xs font-semibold text-brand-ink/70">
                                المحادثة مع الإدارة
                              </h5>
                            {report.conversation?.length ? (
                                <ul className="space-y-2">
                                  {report.conversation.map((entry) => (
                                    <li
                                      key={entry._id}
                                      className="rounded-lg border border-brand-muted/50 bg-white/95 p-2 text-xs text-brand-ink/80"
                                    >
                                      <div className="mb-1 flex items-center justify-between">
                                        <span className="font-semibold">
                                          {entry.authorRole === 'admin' ? 'الإدارة' : 'أنت'}
                                        </span>
                                        <span className="text-[10px] text-brand-ink/50">
                                          {formatDateTime(entry.createdAt || report.createdAt)}
                                        </span>
                                      </div>
                                      {entry.message ? (
                                        <p className="whitespace-pre-wrap">{entry.message}</p>
                                      ) : null}
                                      {entry.attachments?.length ? (
                                        <ul className="mt-1 space-y-1">
                                          {entry.attachments.map((file) => (
                                            <li key={file.url}>
                                              <a
                                                href={file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[11px] text-brand-primary hover:underline"
                                              >
                                                {file.originalName || file.filename}
                                              </a>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-[11px] text-brand-ink/60">
                                  لم يتم تبادل رسائل إضافية بعد.
                                </p>
                              )}
                            </div>

                            {task.isOwner ? (
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  handleSubmitReportReply(task._id, report._id);
                                }}
                                className="space-y-2 rounded-xl border border-brand-muted/50 bg-brand-soft/30 p-3"
                              >
                                <label className="block text-[11px] font-medium text-brand-ink/70">
                                  ردك على الإدارة
                                  <textarea
                                    value={replyForm.message}
                                    onChange={(e) =>
                                      handleReportReplyChange(report._id, 'message', e.target.value)
                                    }
                                    rows={2}
                                    className="mt-1 w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-xs text-brand-ink/80 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/20"
                                    placeholder="أضف التوضيحات المطلوبة..."
                                  />
                                </label>
                                <label className="block text-[11px] font-medium text-brand-ink/70">
                                  مرفقات إضافية
                                  <input
                                    key={`reply-files-${report._id}-${replyForm.files.length}`}
                                    type="file"
                                    multiple
                                    onChange={(e) => handleReportReplyFiles(report._id, e.target.files)}
                                    className="mt-1 w-full rounded-xl border border-dashed border-brand-muted/60 bg-white px-3 py-2 text-xs text-brand-ink/60"
                                  />
                                  {replyForm.files.length ? (
                                    <span className="block text-[10px] text-brand-ink/50">
                                      {replyForm.files.length} ملف/ملفات مرفقة
                                    </span>
                                  ) : null}
                                </label>
                                <div className="flex justify-end">
                                  <button
                                    type="submit"
                                    disabled={Boolean(reportReplySubmitting[report._id])}
                                    className="rounded-full border border-brand-secondary px-3 py-1 text-xs text-brand-secondary hover:bg-brand-secondary/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {reportReplySubmitting[report._id] ? 'جارٍ الإرسال...' : 'إرسال الرد'}
                                  </button>
                                </div>
                              </form>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            ) : null}

            {activePanel === 'logs' ? (
              <section className="space-y-3 rounded-2xl border border-brand-muted/50 bg-white/95 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-brand-ink">السجل الشخصي</h4>
                  <span className="text-xs text-brand-ink/50">{logsForTask.length} تحديث</span>
                </div>

                {task.isOwner ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleCreateLog(task._id);
                    }}
                    className="space-y-3 rounded-xl border border-brand-muted/40 bg-brand-soft/40 p-3"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                        نوع التحديث
                        <select
                          value={logForm.type}
                          onChange={(e) => handleLogFieldChange(task._id, 'type', e.target.value)}
                          className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        >
                          {Object.entries(LOG_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                        عنوان قصير (اختياري)
                        <input
                          value={logForm.title}
                          onChange={(e) => handleLogFieldChange(task._id, 'title', e.target.value)}
                          className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          placeholder="مثل: جلسة صباحية"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                        وقت البدء
                        <input
                          type="datetime-local"
                          value={logForm.startedAt}
                          onChange={(e) =>
                            handleLogFieldChange(task._id, 'startedAt', e.target.value)
                          }
                          className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                        وقت الانتهاء
                        <input
                          type="datetime-local"
                          value={logForm.endedAt}
                          onChange={(e) =>
                            handleLogFieldChange(task._id, 'endedAt', e.target.value)
                          }
                          className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                        المدة (بالدقائق)
                        <input
                          type="number"
                          min="0"
                          value={logForm.durationMinutes}
                          onChange={(e) =>
                            handleLogFieldChange(task._id, 'durationMinutes', e.target.value)
                          }
                          className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          placeholder="مثال: 45"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                        نسبة الإنجاز %
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={logForm.progress}
                          onChange={(e) => handleLogFieldChange(task._id, 'progress', e.target.value)}
                          className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          placeholder="اختياري"
                        />
                      </label>
                    </div>
                    <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                      وصف أو ملاحظات
                      <textarea
                        value={logForm.description}
                        onChange={(e) => handleLogFieldChange(task._id, 'description', e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm text-brand-ink/80 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        placeholder="دوّن ما قمت به أو ما ترغب في متابعته لاحقاً..."
                      />
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={Boolean(logSubmitting[task._id])}
                        className="rounded-full bg-brand-primary px-4 py-1.5 text-sm text-white hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {logSubmitting[task._id] ? 'جاري الحفظ...' : 'إضافة تحديث'}
                      </button>
                    </div>
                  </form>
                ) : null}

                {logsLoading[task._id] ? (
                  <p className="text-xs text-brand-ink/60">جاري تحميل السجل...</p>
                ) : logsForTask.length === 0 ? (
                  <p className="text-xs text-brand-ink/60">
                    لا توجد تحديثات شخصية بعد. ابدأ بإضافة أول تحديث لمتابعة تقدمك.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {logsForTask.map((log) => (
                      <article
                        key={log._id}
                        className="rounded-xl border border-brand-muted/50 bg-white/95 px-4 py-3 text-sm text-brand-ink"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-2 rounded-full bg-brand-muted/50 px-2.5 py-0.5 text-[11px] text-brand-ink/80">
                              {LOG_TYPE_LABELS[log.type] || 'تحديث'}
                            </span>
                            {log.title ? (
                              <p className="text-sm font-medium text-brand-ink">{log.title}</p>
                            ) : null}
                            {log.description ? (
                              <p className="text-sm text-brand-ink/70 whitespace-pre-wrap">
                                {log.description}
                              </p>
                            ) : null}
                            {log.progress !== undefined && log.progress !== null ? (
                              <p className="text-xs text-brand-secondary/80">
                                نسبة الإنجاز: {log.progress}%
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right text-xs text-brand-ink/50 space-y-1">
                            <p>{formatDateTime(log.startedAt || log.createdAt)}</p>
                            {log.durationMinutes ? (
                              <p>المدة: {formatMinutesLabel(log.durationMinutes)}</p>
                            ) : null}
                            {log.isSharedWithAdmin ? (
                              <span className="inline-flex items-center justify-end gap-1 rounded-full bg-brand-primary/15 px-2 py-0.5 text-[10px] text-brand-primary">
                                تمت المشاركة
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {log.isSharedWithAdmin && log.sharedAt ? (
                          <p className="mt-2 text-[11px] text-brand-primary/60">
                            تمت المشاركة مع الإدارة في {formatDateTime(log.sharedAt)}
                          </p>
                        ) : null}
                        {task.isOwner ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {!log.isSharedWithAdmin ? (
                              <button
                                type="button"
                                onClick={() => handleShareLog(task._id, log._id)}
                                disabled={Boolean(logSharing[log._id])}
                                className="rounded-full border border-brand-secondary px-3 py-1 text-xs text-brand-secondary hover:bg-brand-secondary/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {logSharing[log._id] ? 'جاري المشاركة...' : 'مشاركة مع الإدارة'}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-3xl font-semibold text-brand-ink">مهامي الشخصية 🔒</h2>
            <p className="text-sm text-brand-ink/60 mt-1">
              نظّم عملك الشخصي، أضف تفاصيل متعددة، اضبط التذكيرات والعداد، وشارك المهام مع فريقك.
            </p>
          </div>
          <button
            onClick={() => {
              setForm(buildDefaultForm());
              setEditingTaskId(null);
              setShowForm(true);
            }}
            className="rounded-full bg-brand-primary px-5 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-primaryDark transition"
          >
            + مهمة جديدة
          </button>
        </div>

        {feedback ? (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm shadow-subtle ${
              feedback.type === 'success'
                ? 'border-brand-secondary/40 bg-brand-secondary/10 text-brand-secondary'
                : 'border-brand-accent/40 bg-brand-accent/15 text-brand-ink'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span>{feedback.message}</span>
              <button
                onClick={() => setFeedback(null)}
                className="text-xs underline decoration-dotted text-current"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : null}

        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="mb-8 space-y-4 rounded-3xl border border-brand-muted/60 bg-white/95 p-6 shadow-subtle"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-brand-ink/70">عنوان المهمة</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="مثال: تجهيز عرض تقديمي"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-brand-ink/70">حالة المهمة</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-brand-ink/70">الفئة</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="مثال: تطوير، متابعة، تعلم"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-brand-ink/70">الأولوية</label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))
                  }
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-brand-ink/70">وصف المهمة</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-[90px] w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                placeholder="أضف ملخصاً سريعاً أو نقاطاً توضيحية للهدف."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-brand-ink/70">الموعد النهائي</label>
                <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-brand-ink/70">تذكير تلقائي</label>
                <input
                  type="datetime-local"
                  value={form.reminderAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, reminderAt: e.target.value }))}
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-brand-muted/50 bg-brand-soft/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-ink">تفاصيل المهمة</p>
                <button
                  type="button"
                  onClick={handleAddDetail}
                  className="text-xs text-brand-primary underline decoration-dotted hover:text-brand-primaryDark"
                >
                  + إضافة تفصيلة
                </button>
              </div>
              <div className="space-y-3">
                {form.details.map((detail) => (
                  <div
                    key={detail._id}
                    className="rounded-xl border border-brand-muted/60 bg-white/80 px-3 py-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={detail.text}
                        onChange={(e) => handleDetailChange(detail._id, 'text', e.target.value)}
                        placeholder="وصف التفصيلة"
                        className="flex-1 rounded-xl border border-brand-muted/60 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDetail(detail._id)}
                        className="rounded-full border border-brand-muted px-3 py-1 text-xs text-brand-ink/70 hover:bg-brand-muted/40"
                      >
                        حذف
                      </button>
                    </div>
                    <textarea
                      value={detail.note}
                      onChange={(e) => handleDetailChange(detail._id, 'note', e.target.value)}
                      placeholder="ملاحظات إضافية (اختياري)"
                      className="w-full rounded-xl border border-brand-muted/60 px-3 py-2 text-xs text-brand-ink/70 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-brand-muted/50 bg-white/90 p-4 space-y-4">
              <p className="text-sm font-semibold text-brand-ink">إعداد عداد الوقت</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-brand-ink/70">مدة العداد (بالدقائق)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.timerConfig.durationMinutes}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        timerConfig: { ...prev.timerConfig, durationMinutes: e.target.value },
                      }))
                    }
                    className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="مثل 25 أو 45"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-brand-ink/70">عنوان العداد</label>
                  <input
                    value={form.timerConfig.label}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        timerConfig: { ...prev.timerConfig, label: e.target.value },
                      }))
                    }
                    className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="مثال: جلسة تركيز"
                  />
                </div>
                <label className="mt-5 flex items-center gap-2 text-xs text-brand-ink/70">
                  <input
                    type="checkbox"
                    checked={form.timerConfig.autoStart}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        timerConfig: { ...prev.timerConfig, autoStart: e.target.checked },
                      }))
                    }
                  />
                  بدء العداد تلقائياً عند حفظ المهمة
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-muted/50 bg-brand-soft/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-ink">مشاركة المهمة</p>
                <label className="flex items-center gap-2 text-xs text-brand-ink/70">
                  <input
                    type="checkbox"
                    checked={form.allowSharedEdit}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, allowSharedEdit: e.target.checked }))
                    }
                  />
                  السماح للمستخدمين المشاركين بتعديل التفاصيل
                </label>
              </div>
              <div className="relative">
                <input
                  value={collaboratorQuery}
                  onChange={(e) => setCollaboratorQuery(e.target.value)}
                  className="w-full rounded-2xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  placeholder="ابحث عن مستخدمين بالاسم أو اسم المستخدم"
                />
                {collaboratorQuery && (
                  <div className="absolute z-20 mt-1 w-full rounded-2xl border border-brand-muted/60 bg-white shadow-subtle">
                    {searchingCollaborators ? (
                      <p className="px-3 py-2 text-xs text-brand-ink/60">جاري البحث...</p>
                    ) : collaboratorResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-brand-ink/60">
                        لم يتم العثور على مستخدمين مطابقين.
                      </p>
                    ) : (
                      <ul className="max-h-48 overflow-y-auto text-sm">
                        {collaboratorResults.map((user) => (
                          <li key={user._id}>
                            <button
                              type="button"
                              onClick={() => handleSelectCollaborator(user)}
                              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-brand-primary/10"
                            >
                              <span>
                                {user.fullName || user.username}{' '}
                                <span className="text-xs text-brand-ink/50">
                                  ({user.username})
                                </span>
                              </span>
                              <span className="text-[11px] text-brand-muted">
                                {user.role === 'admin' ? 'إدمن' : 'عضو'}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              {form.sharedWith.length ? (
                <div className="flex flex-wrap gap-2">
                  {form.sharedWith.map((user) => (
                    <span
                      key={user._id}
                      className="flex items-center gap-2 rounded-full border border-brand-muted/60 bg-white px-3 py-1 text-xs text-brand-ink"
                    >
                      {user.fullName || user.username}
                      <button
                        type="button"
                        onClick={() => handleRemoveCollaborator(user._id)}
                        className="text-brand-accent"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-ink/50">
                  لم تتم إضافة مستخدمين بعد، ستبقى المهمة خاصة بك.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-brand-muted px-5 py-2 text-sm text-brand-ink hover:bg-brand-muted/50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="rounded-full bg-brand-secondary px-6 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-secondary/90"
              >
                {editingTaskId ? 'تحديث المهمة' : 'حفظ المهمة'}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <p className="rounded-2xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-3 text-sm text-brand-primary">
            جاري تحميل مهامك الشخصية...
          </p>
        ) : tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-brand-muted/80 bg-white/80 p-10 text-center text-brand-ink/60">
            لا توجد مهام شخصية حتى الآن. اضغط على زر "مهمة جديدة" للبدء.
          </div>
        ) : (
          <div className="space-y-8">
            {ownTasks.length ? (
              <section className="space-y-4">
                <header className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-brand-ink">مهامي الأساسية</h3>
                  <span className="text-xs text-brand-ink/50">{ownTasks.length} مهمة</span>
                </header>
                <div className="grid gap-4 lg:grid-cols-2">
                  {ownTasks.map((task) => renderTaskCard(task))}
                </div>
              </section>
            ) : null}

            {sharedTasks.length ? (
              <section className="space-y-4">
                <header className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-brand-ink">مهام شاركها معي الآخرون</h3>
                  <span className="text-xs text-brand-ink/50">{sharedTasks.length} مهمة</span>
                </header>
                <div className="grid gap-4 lg:grid-cols-2">
                  {sharedTasks.map((task) => renderTaskCard(task))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}