// frontend/src/components/AdminDashboard.jsx
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import Navbar from "./Navbar";
import KanbanBoard from "./admin/KanbanBoard";
import santraLogo from "@brand/santra.svg";

const PRIMARY_TABS = [
  { id: "overview", label: "القائمة العامة" },
  { id: "tasks", label: "إدارة المهام" },
  { id: "requests", label: "إدارة الطلبات" },
  { id: "users", label: "إدارة المستخدمين" },
  { id: "reports", label: "إدارة التقارير" },
  { id: "analytics", label: "إحصائيات وتحليلات" },
];

const PERSONAL_LOG_TYPE_LABELS = {
  note: "ملاحظة",
  session: "جلسة تركيز",
  milestone: "إنجاز",
  "detail-update": "تحديث تفصيلة",
};

const ADMIN_REPORT_STATUS_OPTIONS = [
  { value: "needs-info", label: "طلب توضيح" },
  { value: "resolved", label: "اعتبارها مكتملة" },
];

const REPORT_STATUS_BADGES = {
  submitted: { label: "قيد المراجعة", className: "bg-brand-muted/60 text-brand-ink" },
  "needs-info": { label: "بحاجة لتوضيح", className: "bg-brand-accent/20 text-brand-ink" },
  resolved: { label: "مكتمل", className: "bg-brand-secondary/20 text-brand-secondary" },
};

const buildAdminReportReplyForm = () => ({
  message: "",
  status: "needs-info",
  files: [],
});

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ar-SA", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const createTaskDetailDraft = () => ({
  id: `detail-${Math.random().toString(36).slice(2, 9)}`,
  text: "",
  note: "",
});

const formatMinutesLabel = (minutes) => {
  const total = Number(minutes) || 0;
  if (total <= 0) return "0 دقيقة";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) {
    return `${hours} س ${mins} د`;
  }
  if (hours) {
    return hours === 1 ? "ساعة واحدة" : `${hours} ساعات`;
  }
  return `${mins} دقيقة`;
};

export default function AdminDashboard() {
  const { token } = useAuth();

  /* ‑‑‑‑‑‑‑ حالات البيانات ‑‑‑‑‑‑‑ */
  const [tasks, setTasks]           = useState([]);
  const [users, setUsers]           = useState([]);
  const [reports, setReports]       = useState([]);      // تقارير المهام المُسندة
  const [extraReports, setExtraReports] = useState([]);  // تقارير المهام الشخصية المُرسلة
  const [personalTasks, setPersonalTasks] = useState([]); // المهام الشخصية المشاركة
  const [sharedPersonalLogs, setSharedPersonalLogs] = useState([]); // تحديثات شخصية مُشاركة
  const [progressFeed, setProgressFeed] = useState([]);
  const [personalReportReplies, setPersonalReportReplies] = useState({});
  const [personalReportSubmitting, setPersonalReportSubmitting] = useState({});
  const [expandedPersonalReports, setExpandedPersonalReports] = useState({});
  const [loading, setLoading]       = useState(true);
  const [progressLoading, setProgressLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  /* ‑‑‑‑‑‑‑ حالات النماذج ‑‑‑‑‑‑‑ */
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: 2,
    type: "individual",
    assignedTo: "",
    collaborators: [],
    dueDate: "",
    details: [createTaskDetailDraft()],
  });
  const [taskError, setTaskError] = useState("");
  const [userForm, setUserForm] = useState({
    fullName: "", username: "", password: "", role: "user"
  });
  const [timelineTask, setTimelineTask] = useState(null);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [responseNotes, setResponseNotes] = useState({});
  const [openResponse, setOpenResponse] = useState({});
  const [returnNotes, setReturnNotes] = useState({});
  const [openReturn, setOpenReturn] = useState({});
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [responseFiles, setResponseFiles] = useState({});
  const [returnFiles, setReturnFiles] = useState({});
  const [openAccept, setOpenAccept] = useState({});
  const [acceptNotes, setAcceptNotes] = useState({});
  const [acceptFiles, setAcceptFiles] = useState({});
  const [activeTab, setActiveTab] = useState("overview");

  const apiBase =
    import.meta.env.VITE_FILES_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    axios.defaults.baseURL ||
    "";
  const fileBaseUrl = apiBase.replace(/\/api\/?$/, "");

  /* ‑‑‑‑‑‑‑ جلب البيانات عند التحميل ‑‑‑‑‑‑‑ */
  useEffect(() => {
    refreshData();
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

  const fetchPersonalTasks = async () => {
    const { data } = await axios.get('/admin/personal-tasks', authHeader());
    setPersonalTasks(data);
  };

  const fetchSharedPersonalLogs = async () => {
    const { data } = await axios.get('/admin/personal-logs', authHeader());
    setSharedPersonalLogs(data);
  };

  const togglePersonalReportExpanded = (reportId) => {
    setExpandedPersonalReports((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  };

  const getPersonalReportReplyForm = (reportId) =>
    personalReportReplies[reportId] || buildAdminReportReplyForm();

  const handlePersonalReportReplyChange = (reportId, key, value) => {
    setPersonalReportReplies((prev) => ({
      ...prev,
      [reportId]: {
        ...(prev[reportId] || buildAdminReportReplyForm()),
        [key]: value,
      },
    }));
  };

  const handlePersonalReportReplyFiles = (reportId, fileList) => {
    handlePersonalReportReplyChange(reportId, 'files', Array.from(fileList || []));
  };

  const submitPersonalReportResponse = async (reportId) => {
    const form = getPersonalReportReplyForm(reportId);
    const message = form.message.trim();
    if (!message && (!form.files || form.files.length === 0)) {
      setActionFeedback({
        type: 'error',
        message: 'يرجى كتابة رد أو إرفاق ملف قبل الإرسال.',
      });
      return;
    }

    const formData = new FormData();
    if (message) {
      formData.append('message', message);
    }
    if (form.status) {
      formData.append('status', form.status);
    }
    (form.files || []).forEach((file) => formData.append('attachments', file));

    try {
      setPersonalReportSubmitting((prev) => ({ ...prev, [reportId]: true }));
      const { data } = await axios.post(
        `/admin/personal-reports/${reportId}/respond`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setPersonalReportReplies((prev) => ({
        ...prev,
        [reportId]: buildAdminReportReplyForm(),
      }));
      setExtraReports((prev) =>
        prev.map((report) => (report._id === data._id ? data : report))
      );
      setActionFeedback({
        type: 'success',
        message: 'تم إرسال ردك للمستخدم.',
      });
    } catch (error) {
      setActionFeedback({
        type: 'error',
        message:
          error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.msg ||
          'تعذر إرسال الرد للمستخدم.',
      });
    } finally {
      setPersonalReportSubmitting((prev) => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
    }
  };

  const fetchTaskProgress = async () => {
    try {
      setProgressLoading(true);
      const { data } = await axios.get('/admin/task-progress?limit=120', authHeader());
      setProgressFeed(data);
    } catch (err) {
      console.error('Failed to load task progress feed', err);
    } finally {
      setProgressLoading(false);
    }
  };

  /* ‑‑‑‑‑‑‑ إنشاء مهمة جديدة ‑‑‑‑‑‑‑ */
  const createTask = async (e) => {
    e.preventDefault();
    if (!taskForm.assignedTo) {
      setTaskError("يجب اختيار المستخدم الذي ستُسند إليه المهمة");
      return;
    }

    try {
      const collaboratorIds = Array.isArray(taskForm.collaborators)
        ? taskForm.collaborators.filter((id) => id && id !== taskForm.assignedTo)
        : [];

      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        assignedTo: taskForm.assignedTo,
        dueDate: taskForm.dueDate,
      };

      const detailPayload = Array.isArray(taskForm.details)
        ? taskForm.details
            .map((detail) => {
              const text = detail.text?.trim() || "";
              if (!text) return null;
              const cleaned = { text };
              const note = detail.note?.trim();
              if (note) cleaned.note = note;
              return cleaned;
            })
            .filter(Boolean)
        : [];

      if (detailPayload.length) {
        payload.details = detailPayload;
      }

      if (taskForm.type === "group") {
        payload.assignees = [taskForm.assignedTo, ...collaboratorIds];
      }

      await axios.post('/admin/tasks', payload, authHeader());
      setTaskForm({
        title: "",
        description: "",
        priority: 2,
        type: "individual",
        assignedTo: "",
        collaborators: [],
        dueDate: "",
        details: [createTaskDetailDraft()],
      });
      setTaskError("");
    setShowTaskForm(false);
      refreshData();
    } catch (err) {
      const details = err.response?.data?.details;
      const message =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        "تعذر إنشاء المهمة";
      setTaskError(details ? `${message} (${details})` : message);
    }
  };

  /* ‑‑‑‑‑‑‑ حذف مهمة ‑‑‑‑‑‑‑ */
  const deleteTask = async (id) => {
    if (!window.confirm("متأكد من حذف المهمة؟")) return;
    await axios.delete(`/admin/tasks/${id}`, authHeader());
    refreshData();
  };

  const openTimeline = async (taskOrId) => {
    const resolvedTask =
      typeof taskOrId === "string"
        ? tasks.find((t) => t._id === taskOrId) || { _id: taskOrId, title: "مهمة غير معروفة" }
        : taskOrId;

    setTimelineTask(resolvedTask);
    setTimelineEntries([]);
    setTimelineError("");
    try {
      setTimelineLoading(true);
      const { data } = await axios.get(`/admin/tasks/${resolvedTask._id}/progress`, authHeader());
      setTimelineEntries(data);
    } catch (err) {
      setTimelineError(err.response?.data?.message || "تعذر تحميل سجل المهمة");
    } finally {
      setTimelineLoading(false);
    }
  };

  const closeTimeline = () => {
    setTimelineTask(null);
    setTimelineEntries([]);
    setTimelineError("");
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

  const dismissActionFeedback = () => setActionFeedback(null);

  const toggleResponse = (id) => {
    setOpenResponse((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleReturnForm = (id) => {
    setOpenReturn((prev) => ({ ...prev, [id]: !prev[id] }));
    if (openReturn[id]) {
      setReturnNotes((prev) => ({ ...prev, [id]: "" }));
      setReturnFiles((prev) => ({ ...prev, [id]: [] }));
    }
  };

  const toggleAcceptForm = (id) => {
    setOpenAccept((prev) => ({ ...prev, [id]: !prev[id] }));
    if (openAccept[id]) {
      setAcceptNotes((prev) => ({ ...prev, [id]: "" }));
      setAcceptFiles((prev) => ({ ...prev, [id]: [] }));
    }
  };

  const handleRespond = async (event) => {
    const taskId = event.taskId?._id || event.taskId;
    const message = (responseNotes[event._id] || "").trim();
    if (!message) {
      setActionFeedback({ type: "error", message: "يرجى كتابة رسالة الرد قبل الإرسال." });
      return;
    }

    setActionLoading(`respond-${event._id}`);
    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('referenceId', event._id);
      (responseFiles[event._id] || []).forEach((file) => {
        formData.append('attachments', file);
      });

      await axios.post(`/admin/tasks/${taskId}/respond`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setActionFeedback({ type: "success", message: "تم إرسال الرد للعضو بنجاح." });
      setResponseNotes((prev) => ({ ...prev, [event._id]: "" }));
      setResponseFiles((prev) => ({ ...prev, [event._id]: [] }));
      setOpenResponse((prev) => ({ ...prev, [event._id]: false }));
      await refreshData();
      if (timelineTask && (timelineTask._id === taskId || timelineTask._id === event.taskId)) {
        await openTimeline(taskId);
      }
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: err.response?.data?.message || "تعذر إرسال الرد، يرجى المحاولة لاحقاً.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async (taskId, referenceId) => {
    const message = (acceptNotes[referenceId] || "").trim();

    setActionLoading(`accept-${referenceId}`);
    try {
      const formData = new FormData();
      if (message) {
        formData.append('message', message);
      }
      formData.append('referenceId', referenceId);
      (acceptFiles[referenceId] || []).forEach((file) => {
        formData.append('attachments', file);
      });

      await axios.post(`/admin/tasks/${taskId}/accept`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setActionFeedback({ type: "success", message: "تم قبول المهمة بنجاح." });
      setAcceptNotes((prev) => ({ ...prev, [referenceId]: "" }));
      setAcceptFiles((prev) => ({ ...prev, [referenceId]: [] }));
      setOpenAccept((prev) => ({ ...prev, [referenceId]: false }));
      await refreshData();
      if (timelineTask && timelineTask._id === taskId) {
        await openTimeline(taskId);
      }
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: err.response?.data?.message || "تعذر قبول المهمة، يرجى المحاولة لاحقاً.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturnTask = async (taskId, referenceId) => {
    const message = (returnNotes[referenceId] || "").trim();
    if (!message) {
      setActionFeedback({ type: "error", message: "يرجى كتابة ملاحظات توضيحية لإرجاع المهمة." });
      return;
    }

    setActionLoading(`return-${referenceId}`);
    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('referenceId', referenceId);
      (returnFiles[referenceId] || []).forEach((file) => {
        formData.append('attachments', file);
      });

      await axios.post(`/admin/tasks/${taskId}/return`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setActionFeedback({ type: "success", message: "تم إرجاع المهمة للمستخدم مع التوضيح المطلوب." });
      setReturnNotes((prev) => ({ ...prev, [referenceId]: "" }));
      setReturnFiles((prev) => ({ ...prev, [referenceId]: [] }));
      setOpenReturn((prev) => ({ ...prev, [referenceId]: false }));
      await refreshData();
      if (timelineTask && timelineTask._id === taskId) {
        await openTimeline(taskId);
      }
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: err.response?.data?.message || "تعذر إرجاع المهمة، يرجى المحاولة لاحقاً.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const refreshData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchTasks(),
        fetchUsers(),
        fetchReports(),
        fetchExtraReports(),
        fetchPersonalTasks(),
        fetchSharedPersonalLogs(),
        fetchTaskProgress(),
      ]);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      setIsManualRefreshing(true);
      await refreshData();
    } catch (err) {
      console.error('[admin] Manual dashboard refresh failed', err);
      setActionFeedback({
        type: "error",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "تعذر تحديث البيانات، يرجى المحاولة مجدداً.",
      });
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const requestEvents = progressFeed.filter((p) => p.type === "request");
  const completedEvents = progressFeed.filter((p) => p.type === "completed");
  const returnedEvents = progressFeed.filter((p) => p.type === "returned");

  const progressTypes = {
    started: { label: "بدء المهمة", className: "bg-brand-highlight/25 text-brand-primary" },
    request: { label: "طلب دعم / توضيح", className: "bg-brand-highlight/20 text-brand-primary" },
    completed: { label: "تقرير نهائي", className: "bg-brand-secondary/20 text-brand-secondary" },
    "admin-response": { label: "رد الإدمن", className: "bg-brand-primary/15 text-brand-primary" },
    returned: { label: "إرجاع المهمة", className: "bg-brand-accent/20 text-brand-ink" },
    "detail-update": { label: "تحديث تفصيلة", className: "bg-brand-muted/60 text-brand-primary" },
  };

  const renderAttachments = (attachments = []) => {
    if (!attachments?.length) return null;
    return (
      <ul className="mt-2 space-y-1 text-xs">
        {attachments.map((file) => (
          <li key={file.filename}>
            <a
              href={
                fileBaseUrl
                  ? `${fileBaseUrl}${file.url.startsWith("/") ? file.url : `/${file.url}`}`
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

  const taskMetrics = useMemo(() => {
    const pending = tasks.filter((task) => task.status === "pending").length;
    const inProgress = tasks.filter((task) => task.status === "in-progress").length;
    const completedCount = tasks.filter((task) => task.status === "completed").length;
    const returnedCount = tasks.filter((task) => task.status === "returned").length;
    const lateCount = tasks.filter((task) => task.status === "late").length;

    return {
      total: tasks.length,
      pending,
      inProgress,
      completed: completedCount,
      returned: returnedCount,
      late: lateCount,
    };
  }, [tasks]);

  const openRequestsCount = useMemo(() => {
    return requestEvents.filter((event) => {
      const hasResponse = progressFeed.some(
        (entry) =>
          entry.type === "admin-response" &&
          entry.metadata?.action === "response" &&
          entry.metadata?.referenceId === event._id
      );
      return !hasResponse;
    }).length;
  }, [requestEvents, progressFeed]);

  const recentActivities = useMemo(
    () => progressFeed.slice(0, 6),
    [progressFeed]
  );

  const userStats = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      const assigned = task.assignedTo?._id || task.assignedTo;
      if (!assigned) return;
      const key = assigned.toString();

      if (!map[key]) {
        map[key] = {
          total: 0,
          inProgress: 0,
          completed: 0,
          returned: 0,
          late: 0,
        };
      }

      map[key].total += 1;
      switch (task.status) {
        case "in-progress":
          map[key].inProgress += 1;
          break;
        case "completed":
          map[key].completed += 1;
          break;
        case "returned":
          map[key].returned += 1;
          break;
        case "late":
          map[key].late += 1;
          break;
        default:
          break;
      }
    });
    return map;
  }, [tasks]);

  const usersWithManyTasks = useMemo(
    () => users.filter((user) => (userStats[user._id]?.total || 0) > 2),
    [users, userStats]
  );

  const usersWithoutTasks = useMemo(
    () => users.filter((user) => !(userStats[user._id]?.total > 0)),
    [users, userStats]
  );

  const usersWithoutActiveTasks = useMemo(
    () =>
      users.filter((user) => {
        const stats = userStats[user._id];
        if (!stats) return false;
        return stats.inProgress === 0;
      }),
    [users, userStats]
  );

  const tabCounters = useMemo(
    () => ({
      overview: 0,
      tasks: taskMetrics.total,
      requests: openRequestsCount,
      users: users.length,
      reports: reports.length + extraReports.length + sharedPersonalLogs.length,
      analytics: taskMetrics.late,
    }),
    [
      taskMetrics.total,
      taskMetrics.late,
      openRequestsCount,
      users.length,
      reports.length,
      extraReports.length,
      sharedPersonalLogs.length,
    ]
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <OverviewTab
            taskMetrics={taskMetrics}
            openRequestsCount={openRequestsCount}
            recentActivities={recentActivities}
            tasks={tasks}
            users={users}
            reports={reports}
            extraReports={extraReports}
            personalTasks={personalTasks}
            personalLogs={sharedPersonalLogs}
            onOpenTimeline={openTimeline}
            progressTypes={progressTypes}
            personalReportReplies={personalReportReplies}
            onPersonalReportReplyChange={handlePersonalReportReplyChange}
            onPersonalReportReplyFiles={handlePersonalReportReplyFiles}
            onSubmitPersonalReportReply={submitPersonalReportResponse}
            personalReportSubmitting={personalReportSubmitting}
            expandedReports={expandedPersonalReports}
            onToggleReport={togglePersonalReportExpanded}
          />
        );
      case "tasks":
        return (
          <TasksTab
            tasks={tasks}
            users={users}
            showTaskForm={showTaskForm}
            setShowTaskForm={setShowTaskForm}
            taskForm={taskForm}
            setTaskForm={setTaskForm}
            taskError={taskError}
            createTask={createTask}
            deleteTask={deleteTask}
            requestEvents={requestEvents}
            progressFeed={progressFeed}
            openResponse={openResponse}
            toggleResponse={toggleResponse}
            responseNotes={responseNotes}
            setResponseNotes={setResponseNotes}
            responseFiles={responseFiles}
            setResponseFiles={setResponseFiles}
            handleRespond={handleRespond}
            actionLoading={actionLoading}
            openTimeline={openTimeline}
            completedEvents={completedEvents}
            openAccept={openAccept}
            toggleAcceptForm={toggleAcceptForm}
            acceptNotes={acceptNotes}
            setAcceptNotes={setAcceptNotes}
            acceptFiles={acceptFiles}
            setAcceptFiles={setAcceptFiles}
            handleAccept={handleAccept}
            openReturn={openReturn}
            toggleReturnForm={toggleReturnForm}
            returnNotes={returnNotes}
            setReturnNotes={setReturnNotes}
            returnFiles={returnFiles}
            setReturnFiles={setReturnFiles}
            handleReturnTask={handleReturnTask}
            renderAttachments={renderAttachments}
            returnedEvents={returnedEvents}
          />
        );
      case "requests":
        return (
          <RequestsTab
            requestEvents={requestEvents}
            progressFeed={progressFeed}
            openResponse={openResponse}
            toggleResponse={toggleResponse}
            responseNotes={responseNotes}
            setResponseNotes={setResponseNotes}
            responseFiles={responseFiles}
            setResponseFiles={setResponseFiles}
            handleRespond={handleRespond}
            actionLoading={actionLoading}
            onOpenTimeline={openTimeline}
            renderAttachments={renderAttachments}
          />
        );
      case "users":
        return (
          <UsersTab
            showUserForm={showUserForm}
            setShowUserForm={setShowUserForm}
            userForm={userForm}
            setUserForm={setUserForm}
            onCreateUser={createUser}
            users={users}
            onToggleUser={toggleUser}
            userStats={userStats}
            usersWithManyTasks={usersWithManyTasks}
            usersWithoutTasks={usersWithoutTasks}
            usersWithoutActiveTasks={usersWithoutActiveTasks}
          />
        );
      case "reports":
        return (
          <ReportsTab
            reports={reports}
            extraReports={extraReports}
            progressFeed={progressFeed}
            onOpenTimeline={openTimeline}
            renderAttachments={renderAttachments}
            progressTypes={progressTypes}
            personalReportReplies={personalReportReplies}
            onPersonalReportReplyChange={handlePersonalReportReplyChange}
            onPersonalReportReplyFiles={handlePersonalReportReplyFiles}
            onSubmitPersonalReportReply={submitPersonalReportResponse}
            personalReportSubmitting={personalReportSubmitting}
          expandedReports={expandedPersonalReports}
          onToggleReport={togglePersonalReportExpanded}
          />
        );
      case "analytics":
        return (
          <AnalyticsTab
            tasks={tasks}
            users={users}
            progressFeed={progressFeed}
            requestEvents={requestEvents}
            onOpenTimeline={openTimeline}
            taskMetrics={taskMetrics}
          />
        );
      default:
        return null;
    }
  };

  /* ‑‑‑‑‑‑‑ JSX ‑‑‑‑‑‑‑ */
  return (
    <>
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="rounded-3xl border border-brand-muted/60 bg-white/90 px-6 py-6 shadow-soft backdrop-blur">
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-brand-muted/40 bg-gradient-to-r from-brand-primary/10 via-white to-brand-soft/40 p-6">
            <div className="pointer-events-none absolute -left-12 top-1/2 hidden h-44 w-44 -translate-y-1/2 opacity-25 lg:block">
              <img
                src={santraLogo}
                alt="شعار Santra Task"
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
            </div>
            <div className="pointer-events-none absolute -bottom-12 right-6 h-36 w-36 opacity-10 sm:opacity-20">
              <img
                src={santraLogo}
                alt="زخرفة شعار Santra Task"
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
            </div>
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="font-display text-3xl font-semibold text-brand-ink">لوحة إدارة Santra Task</h1>
                <p className="mt-2 text-sm text-brand-ink/70">
                  نظرة شاملة على المهام الجماعية، المهام الشخصية المشتركة، والمحادثات المرتبطة بها.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-full bg-white/75 px-4 py-2 shadow-subtle">
                <img
                  src={santraLogo}
                  alt="شعار Santra Task"
                  className="h-12 w-auto drop-shadow-lg"
                />
                <span className="text-sm font-medium text-brand-primary">تجربة موحّدة للفريق والمستخدمين</span>
              </div>
            </div>
          </div>
        {actionFeedback && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm shadow-subtle ${
              actionFeedback.type === "success"
                ? "border-brand-secondary/40 bg-brand-secondary/10 text-brand-secondary"
                : "border-brand-accent/40 bg-brand-accent/10 text-brand-ink"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <span>{actionFeedback.message}</span>
              <button onClick={dismissActionFeedback} className="text-xs underline">
                إغلاق
              </button>
            </div>
          </div>
        )}

        {loading || progressLoading ? (
           <div className="mb-6 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-sm text-brand-primary">
             جاري تحديث البيانات...
        </div>
         ) : null}
 
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {PRIMARY_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const badge = tabCounters[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-brand-primary bg-brand-primary text-white shadow-soft"
                      : "border-brand-muted/70 bg-white/70 text-brand-ink/70 hover:text-brand-ink"
                  }`}
                >
                  <span>{tab.label}</span>
                  {badge ? (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={loading || isManualRefreshing || progressLoading}
            className="flex items-center gap-2 rounded-full border border-brand-primary px-4 py-2 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{loading || progressLoading ? "جاري التحديث..." : "تحديث البيانات"}</span>
            <span aria-hidden="true">⟳</span>
          </button>
        </div>

        {lastUpdated ? (
          <p className="mt-3 text-xs text-brand-ink/50">
            آخر تحديث: {lastUpdated.toLocaleString("ar-SA")}
          </p>
        ) : null}
 
        <div className="mt-6 space-y-6">
          {renderTabContent()}
        </div>
        </div>
      </div>

        {timelineTask && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-muted/60 bg-white/95 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between border-b border-brand-muted/60 px-6 py-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-brand-ink">
                    سجل المهمة: {timelineTask.title}
                  </h3>
                  <p className="text-xs text-brand-ink/60">
                    المُنفذ: {timelineTask.assignedTo?.fullName || timelineEntries[timelineEntries.length - 1]?.userId?.fullName || "غير محدد"}
                  </p>
                </div>
                <button
                  onClick={closeTimeline}
                  className="rounded-full border border-brand-muted/70 px-3 py-1 text-sm text-brand-ink/70 transition hover:bg-brand-soft"
                >
                  إغلاق
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
                {timelineLoading ? (
                  <p className="text-sm text-brand-ink/60">جاري تحميل السجل...</p>
                ) : timelineError ? (
                  <p className="text-sm text-brand-accent">{timelineError}</p>
                ) : timelineEntries.length === 0 ? (
                  <p className="text-sm text-brand-ink/60">لا يوجد سجلات متاحة لهذه المهمة حتى الآن.</p>
                ) : (
                  <ol className="space-y-4">
                    {[...timelineEntries].reverse().map((entry) => {
                      const type = progressTypes[entry.type] || progressTypes.started;
                      return (
                        <li key={entry._id} className="rounded-2xl border border-brand-muted/60 bg-brand-soft/80 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${type.className}`}>
                              {type.label}
                            </span>
                            <span className="text-xs text-brand-ink/50">
                              {new Date(entry.createdAt).toLocaleString("ar-SA")}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-brand-ink/80 whitespace-pre-wrap">{entry.message || "بدون تفاصيل إضافية."}</p>
                          <p className="mt-2 text-xs text-brand-ink/60">
                            المُستخدم: {entry.userId?.fullName || "غير معروف"} ({entry.userId?.username || "?"})
                          </p>
                          {renderAttachments(entry.attachments)}
                          {entry.metadata?.progress !== undefined && (
                            <p className="mt-1 text-xs text-brand-secondary">
                              نسبة الإنجاز: {entry.metadata.progress}%
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          </div>
        )}
    </>
  );
}

function OverviewTab({
  taskMetrics,
  openRequestsCount,
  recentActivities,
  tasks,
  users,
  reports,
  extraReports,
  personalTasks,
  personalLogs,
  onOpenTimeline,
  progressTypes,
  personalReportReplies,
  onPersonalReportReplyChange,
  onPersonalReportReplyFiles,
  onSubmitPersonalReportReply,
  personalReportSubmitting,
  expandedReports,
  onToggleReport,
}) {
  const activeUsers = users.filter((user) => user.isActive).length;
  const upcomingTasks = tasks
    .filter((task) => task.dueDate)
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
    .slice(0, 4);

  const highlightedReports = reports.slice(0, 4);
  const highlightedPersonalReports = extraReports.slice(0, 4);
  const highlightedPersonalTasks = (personalTasks || []).slice(0, 4);
  const highlightedPersonalLogs = (personalLogs || []).slice(0, 5);

  const metricCards = [
    { label: "إجمالي المهام", value: taskMetrics.total, tone: "primary" },
    { label: "قيد التنفيذ", value: taskMetrics.inProgress, tone: "secondary" },
    { label: "المهام المُعادة", value: taskMetrics.returned, tone: "accent" },
    { label: "أعضاء نشطون", value: activeUsers, tone: "muted" },
    { label: "طلبات تنتظر الرد", value: openRequestsCount, tone: "accent" },
    { label: "مهام متأخرة", value: taskMetrics.late, tone: "warning" },
  ];

  const toneStyles = {
    primary: "bg-brand-primary/15 text-brand-primary",
    secondary: "bg-brand-secondary/15 text-brand-secondary",
    accent: "bg-brand-accent/20 text-brand-ink",
    muted: "bg-brand-muted/60 text-brand-ink",
    warning: "bg-brand-accent/25 text-brand-ink",
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle ${toneStyles[card.tone]}`}
          >
            <p className="text-xs text-brand-ink/70">{card.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-brand-ink">المهام القادمة</h3>
            <span className="text-xs text-brand-ink/50">أقرب المواعيد النهائية</span>
          </header>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-brand-ink/60">لا توجد مهام محددة بتاريخ قريب.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingTasks.map((task) => (
                <li
                  key={task._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand-muted/60 bg-white/90 px-3 py-2"
                >
                <div>
                    <p className="font-medium text-brand-ink">{task.title}</p>
                    <p className="text-xs text-brand-ink/60">
                      المسؤول: {task.assignedTo?.fullName || "غير محدد"}
                    </p>
                </div>
                  <div className="text-right text-xs text-brand-ink/70">
                    <p>{new Date(task.dueDate).toLocaleDateString("ar-SA")}</p>
                    <p>{task.status === "completed" ? "مكتملة" : "قيد المتابعة"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-brand-ink">أحدث الأنشطة</h3>
            <span className="text-xs text-brand-ink/50">آخر 6 تحديثات</span>
          </header>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-brand-ink/60">لا توجد تحديثات حديثة.</p>
          ) : (
            <ul className="space-y-3">
              {recentActivities.map((event) => {
                const type = progressTypes[event.type] || progressTypes.started;
                return (
                  <li
                    key={event._id}
                    className="rounded-xl border border-brand-muted/60 bg-white/90 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-brand-ink">
                          {event.taskId?.title || "مهمة غير معروفة"}
                        </p>
                        <p className="text-xs text-brand-ink/50">
                          {event.userId?.fullName || "غير معروف"} · {new Date(event.createdAt).toLocaleString("ar-SA")}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${type.className}`}>
                        {type.label}
                      </span>
                    </div>
                    {event.message ? (
                      <p className="mt-2 text-xs text-brand-ink/70 whitespace-pre-wrap">{event.message}</p>
                    ) : null}
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => onOpenTimeline(event.taskId?._id || event.taskId)}
                        className="rounded-full border border-brand-primary px-3 py-1 text-xs text-brand-primary transition hover:bg-brand-primary/10"
                      >
                        عرض في السجل
                </button>
              </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-brand-ink">آخر التقارير النهائية</h3>
            <span className="text-xs text-brand-ink/50">قائمة مختصرة</span>
          </header>
          {highlightedReports.length === 0 ? (
            <p className="text-sm text-brand-ink/60">لا توجد تقارير نهائية حالياً.</p>
          ) : (
            <ul className="space-y-3">
              {highlightedReports.map((task) => (
                <li
                  key={task._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand-muted/60 bg-white/90 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-brand-ink">{task.title}</p>
                    <p className="text-xs text-brand-ink/60">
                      {task.assignedTo?.fullName || "غير معروف"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-brand-ink/60">
                    <p>{new Date(task.updatedAt).toLocaleDateString("ar-SA")}</p>
                    <button
                      onClick={() => onOpenTimeline(task._id)}
                      className="mt-1 rounded-full border border-brand-primary px-2 py-0.5 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                    >
                      السجل
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-brand-ink">تقارير المهام الشخصية</h3>
            <span className="text-xs text-brand-ink/50">أحدث المساهمات</span>
          </header>
          {highlightedPersonalReports.length === 0 ? (
            <p className="text-sm text-brand-ink/60">لا توجد تقارير شخصية مُرسلة.</p>
          ) : (
            <PersonalReportsSection
              reports={highlightedPersonalReports}
              enableActions={false}
              replyForms={personalReportReplies}
              onChangeReply={onPersonalReportReplyChange}
              onFilesChange={onPersonalReportReplyFiles}
              onSubmitReply={onSubmitPersonalReportReply}
              submittingMap={personalReportSubmitting}
              expandedReports={expandedReports}
              onToggleReport={onToggleReport}
            />
          )}
        </section>
          </div>
      {highlightedPersonalTasks.length > 0 ? (
        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-brand-ink">مهام شخصية تمت مشاركتها مع الإدارة</h3>
            <span className="text-xs text-brand-ink/50">عرض سريع</span>
          </header>
          <ul className="space-y-3">
            {highlightedPersonalTasks.map((task) => (
              <li
                key={task._id}
                className="rounded-xl border border-brand-muted/60 bg-white/90 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">{task.title}</p>
                    <p className="text-xs text-brand-ink/60">
                      {task.userId?.fullName || task.userId?.username || 'مستخدم مجهول'}
                      {task.sharedWith?.length
                        ? ` · مشارك مع ${task.sharedWith.length} عضو`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right text-xs text-brand-ink/60">
                    {task.dueDate ? (
                      <p>{new Date(task.dueDate).toLocaleDateString('ar-SA')}</p>
                    ) : null}
                    {task.reminderAt ? (
                      <p>تذكير: {new Date(task.reminderAt).toLocaleString('ar-SA')}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {highlightedPersonalLogs.length > 0 ? (
        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-brand-ink">أحدث التحديثات الشخصية المشتركة</h3>
            <span className="text-xs text-brand-ink/50">آخر ما شاركه الأعضاء</span>
          </header>
          <ul className="space-y-3">
            {highlightedPersonalLogs.map((log) => (
              <li
                key={log._id}
                className="rounded-xl border border-brand-muted/60 bg-white/90 px-3 py-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">
                      {log.personalTaskId?.title || 'مهمة شخصية'}
                    </p>
                    <p className="text-xs text-brand-ink/60">
                      {log.userId?.fullName || log.userId?.username || 'مستخدم مجهول'} ·{' '}
                      {PERSONAL_LOG_TYPE_LABELS[log.type] || 'تحديث'}
                    </p>
                    {log.description ? (
                      <p className="mt-1 max-h-12 overflow-hidden text-xs text-brand-ink/70">
                        {log.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-brand-ink/60">
                    <p>
                      {new Date(log.sharedAt || log.updatedAt || log.createdAt).toLocaleString(
                        'ar-SA'
                      )}
                    </p>
                    {log.durationMinutes ? (
                      <p>المدة: {formatMinutesLabel(log.durationMinutes)}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TasksTab(props) {
  const {
    tasks,
    users,
    showTaskForm,
    setShowTaskForm,
    taskForm,
    setTaskForm,
    taskError,
    createTask,
    deleteTask,
    requestEvents,
    progressFeed,
    openResponse,
    toggleResponse,
    responseNotes,
    setResponseNotes,
    responseFiles,
    setResponseFiles,
    handleRespond,
    actionLoading,
    openTimeline,
    completedEvents,
    openAccept,
    toggleAcceptForm,
    acceptNotes,
    setAcceptNotes,
    acceptFiles,
    setAcceptFiles,
    handleAccept,
    openReturn,
    toggleReturnForm,
    returnNotes,
    setReturnNotes,
    returnFiles,
    setReturnFiles,
    handleReturnTask,
    renderAttachments,
    returnedEvents,
  } = props;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <TasksPlannerSection
          showTaskForm={showTaskForm}
          setShowTaskForm={setShowTaskForm}
          taskForm={taskForm}
          setTaskForm={setTaskForm}
          taskError={taskError}
          users={users}
          tasks={tasks}
          onSubmit={createTask}
          onDelete={deleteTask}
          onOpenTimeline={openTimeline}
          renderStatusTag={(status) => {
            const tags = {
              pending: { label: "قيد الانتظار", className: "bg-brand-muted/70 text-brand-ink" },
              "in-progress": { label: "قيد التنفيذ", className: "bg-brand-highlight/25 text-brand-primary" },
              completed: { label: "مكتملة", className: "bg-brand-secondary/20 text-brand-secondary" },
              late: { label: "متأخرة", className: "bg-brand-accent/20 text-brand-ink" },
              returned: { label: "مُعادة", className: "bg-brand-accent/20 text-brand-ink" },
            };
            const tag = tags[status] || tags.pending;
            return (
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${tag.className}`}>
                {tag.label}
              </span>
            );
          }}
        />
      </section>

      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-brand-ink">لوحة حالة المهام</h3>
          <span className="text-xs text-brand-ink/50">عرض سريع للتقدم حسب الحالة</span>
        </div>
        <KanbanBoard tasks={tasks} onOpenTimeline={openTimeline} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-brand-ink">طلبات تحتاج لتفاعل</h3>
            <span className="text-xs text-brand-ink/50">استجب لطلبات الفريق</span>
          </div>
          <RequestsSection
            events={requestEvents}
            progressFeed={progressFeed}
            openResponse={openResponse}
            toggleResponse={toggleResponse}
            responseNotes={responseNotes}
            setResponseNotes={setResponseNotes}
            responseFiles={responseFiles}
            setResponseFiles={setResponseFiles}
            onRespond={handleRespond}
            actionLoading={actionLoading}
            onOpenTimeline={openTimeline}
            renderAttachments={renderAttachments}
          />
        </section>

        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-brand-ink">التقارير النهائية الواردة</h3>
            <span className="text-xs text-brand-ink/50">اقبل أو أرجع المهام المكتملة</span>
          </div>
          <CompletedReportsSection
            events={completedEvents}
            progressFeed={progressFeed}
            openAccept={openAccept}
            toggleAcceptForm={toggleAcceptForm}
            acceptNotes={acceptNotes}
            setAcceptNotes={setAcceptNotes}
            acceptFiles={acceptFiles}
            setAcceptFiles={setAcceptFiles}
            openReturn={openReturn}
            toggleReturnForm={toggleReturnForm}
            returnNotes={returnNotes}
            setReturnNotes={setReturnNotes}
            returnFiles={returnFiles}
            setReturnFiles={setReturnFiles}
            onAccept={handleAccept}
            onReturn={handleReturnTask}
            actionLoading={actionLoading}
            onOpenTimeline={openTimeline}
            renderAttachments={renderAttachments}
          />
        </section>
      </div>

      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-brand-ink">مهام بحاجة لاستكمال</h3>
          <span className="text-xs text-brand-ink/50">مهام أُعيدت للمستخدمين</span>
        </div>
        <ReturnedTasksSection
          events={returnedEvents}
          onOpenTimeline={openTimeline}
          renderAttachments={renderAttachments}
        />
      </section>
    </div>
  );
}

function UsersTab(props) {
  return (
    <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
      <UsersSection {...props} />
    </section>
  );
}

function ReportsTab({
  reports,
  extraReports,
  progressFeed,
  onOpenTimeline,
  renderAttachments,
  progressTypes,
  personalReportReplies,
  onPersonalReportReplyChange,
  onPersonalReportReplyFiles,
  onSubmitPersonalReportReply,
  personalReportSubmitting,
  expandedReports,
  onToggleReport,
}) {
  const latestReports = reports.slice(0, 10);
  const personalReports = extraReports.slice(0, 10);
  const timelineSnippets = progressFeed.slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-brand-ink">التقارير النهائية للمهام</h3>
          <span className="text-xs text-brand-ink/50">آخر التقارير المرسلة</span>
        </header>
        {latestReports.length === 0 ? (
          <p className="text-sm text-brand-ink/60">لا توجد تقارير مكتملة حتى الآن.</p>
        ) : (
          <ul className="space-y-3">
            {latestReports.map((task) => (
              <li
                key={task._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-brand-muted/60 bg-white/90 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-brand-ink">{task.title}</p>
                  <p className="text-xs text-brand-ink/60">
                    {task.assignedTo?.fullName || "غير محدد"}
                  </p>
                </div>
                <div className="text-right text-xs text-brand-ink/60">
                  <p>{new Date(task.updatedAt).toLocaleDateString("ar-SA")}</p>
          <button
                    onClick={() => onOpenTimeline(task._id)}
                    className="mt-1 rounded-full border border-brand-primary px-2 py-0.5 text-[11px] text-brand-primary hover:bg-brand-primary/10"
          >
                    السجل
          </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-brand-ink">تقارير المهام الشخصية</h3>
          <span className="text-xs text-brand-ink/50">نشاطات الأفراد</span>
        </header>
        {personalReports.length === 0 ? (
          <p className="text-sm text-brand-ink/60">لا توجد تقارير شخصية حديثة.</p>
        ) : (
          <PersonalReportsSection
            reports={personalReports}
            enableActions
            replyForms={personalReportReplies}
            onChangeReply={onPersonalReportReplyChange}
            onFilesChange={onPersonalReportReplyFiles}
            onSubmitReply={onSubmitPersonalReportReply}
            submittingMap={personalReportSubmitting}
            expandedReports={expandedReports}
            onToggleReport={onToggleReport}
          />
        )}
      </section>

      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-brand-ink">سجل الأنشطة</h3>
          <span className="text-xs text-brand-ink/50">نظرة على التقدم الأخير</span>
        </header>
        {timelineSnippets.length === 0 ? (
          <p className="text-sm text-brand-ink/60">لا يوجد نشاط حديث.</p>
        ) : (
          <ul className="space-y-3">
            {timelineSnippets.map((entry) => {
              const type = progressTypes[entry.type] || progressTypes.started;
              return (
                <li
                  key={entry._id}
                  className="rounded-xl border border-brand-muted/60 bg-white/90 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-brand-ink">
                        {entry.taskId?.title || "مهمة غير معروفة"}
                      </p>
                      <p className="text-xs text-brand-ink/50">
                        {entry.userId?.fullName || "غير معروف"} · {new Date(entry.createdAt).toLocaleString("ar-SA")}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${type.className}`}>
                      {type.label}
                    </span>
                  </div>
                  {entry.message ? (
                    <p className="mt-2 text-xs text-brand-ink/70 whitespace-pre-wrap">{entry.message}</p>
                  ) : null}
                  {renderAttachments(entry.attachments)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function TasksPlannerSection({
  showTaskForm,
  setShowTaskForm,
  taskForm,
  setTaskForm,
  taskError,
  users,
  tasks,
  onSubmit,
  onDelete,
  onOpenTimeline,
  renderStatusTag,
}) {
  const availableUsers = users.filter((user) => user.role !== "admin" && user.isActive);
  const isGroupTask = taskForm.type === "group";

  const toggleTaskType = (value) => {
    setTaskForm((prev) => ({
      ...prev,
      type: value,
      collaborators: value === "group" ? prev.collaborators : [],
    }));
  };

  const handleCollaboratorToggle = (userId, checked) => {
    setTaskForm((prev) => {
      const current = new Set(prev.collaborators || []);
      if (checked) {
        current.add(userId);
      } else {
        current.delete(userId);
      }
      return { ...prev, collaborators: Array.from(current) };
    });
  };

  const handleTaskDetailChange = (detailId, key, value) => {
    setTaskForm((prev) => {
      const details = Array.isArray(prev.details) ? prev.details : [];
      return {
        ...prev,
        details: details.map((detail) =>
          detail.id === detailId ? { ...detail, [key]: value } : detail
        ),
      };
    });
  };

  const handleAddTaskDetail = () => {
    setTaskForm((prev) => {
      const details = Array.isArray(prev.details) ? prev.details : [];
      return {
        ...prev,
        details: [...details, createTaskDetailDraft()],
      };
    });
  };

  const handleRemoveTaskDetail = (detailId) => {
    setTaskForm((prev) => {
      const details = Array.isArray(prev.details) ? prev.details : [];
      const filtered = details.filter((detail) => detail.id !== detailId);
      return {
        ...prev,
        details: filtered.length > 0 ? filtered : [createTaskDetailDraft()],
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-brand-ink">
            إدارة المهام
          </h3>
          <p className="text-xs text-brand-ink/60">إنشاء المهام ومراجعة حالتها الحالية.</p>
        </div>
        <button
          onClick={() => setShowTaskForm((prev) => !prev)}
          className="rounded-full bg-brand-secondary px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-secondary/90"
        >
          {showTaskForm ? "إخفاء النموذج" : "مهمة جديدة"}
        </button>
      </div>

          {showTaskForm && (
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-brand-muted/60 bg-white/90 p-4 shadow-subtle md:grid-cols-6"
        >
          <div className="md:col-span-6">
            <label className="mb-1 block text-xs font-medium text-brand-ink/70">نوع المهمة</label>
            <div className="flex flex-wrap gap-4 text-sm text-brand-ink/70">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="task-type"
                  value="individual"
                  checked={!isGroupTask}
                  onChange={() => toggleTaskType("individual")}
                  className="h-4 w-4 rounded border-brand-muted text-brand-primary focus:ring-brand-primary"
                />
                <span>مهمة فردية</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="task-type"
                  value="group"
                  checked={isGroupTask}
                  onChange={() => toggleTaskType("group")}
                  className="h-4 w-4 rounded border-brand-muted text-brand-primary focus:ring-brand-primary"
                />
                <span>مهمة جماعية</span>
              </label>
            </div>
          </div>
          <input
            value={taskForm.title}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="عنوان المهمة"
            className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
            required
          />
          <input
            value={taskForm.description}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="وصف مختصر"
            className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
          />
          <select
            value={taskForm.priority}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
            className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
          >
                <option value={1}>منخفض</option>
                <option value={2}>متوسط</option>
                <option value={3}>عالي</option>
              </select>
          <input
            type="date"
            value={taskForm.dueDate}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
            required
          />
          <select
            value={taskForm.assignedTo}
            onChange={(e) => {
              const value = e.target.value;
              setTaskForm((prev) => ({
                ...prev,
                assignedTo: value,
                collaborators: (prev.collaborators || []).filter((id) => id !== value),
              }));
            }}
            className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
            required
          >
            <option value="">اختر المسؤول</option>
            {availableUsers.map((user) => (
              <option key={user._id} value={user._id}>
                {user.fullName} ({user.username})
              </option>
            ))}
          </select>
          {isGroupTask && (
            <div className="md:col-span-6">
              <label className="mb-2 block text-xs font-medium text-brand-ink/70">
                اختر الأعضاء المشاركين
              </label>
              {!taskForm.assignedTo ? (
                <p className="rounded border border-dashed border-brand-muted/60 bg-brand-soft/80 px-3 py-2 text-xs text-brand-ink/60">
                  قم بتحديد المسؤول الرئيسي أولاً لعرض قائمة المشاركين المتاحين.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {availableUsers.map((user) => {
                     const isPrimary = user._id === taskForm.assignedTo;
                     if (isPrimary) {
                       return (
                         <label
                          key={user._id}
                          className="flex items-center gap-2 rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 text-xs text-brand-primary"
                         >
                          <input
                            type="checkbox"
                            checked
                            readOnly
                            className="h-4 w-4 rounded border-brand-primary/50 text-brand-primary focus:ring-brand-primary"
                          />
                          <span>{user.fullName} ({user.username}) · مسؤول رئيسي</span>
                        </label>
                      );
                    }
 
                    const checked = (taskForm.collaborators || []).includes(user._id);
                    return (
                      <label
                        key={user._id}
                        className="flex items-center gap-2 rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-xs text-brand-ink/80 transition hover:border-brand-primary/60 hover:bg-brand-soft"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-brand-muted text-brand-primary focus:ring-brand-primary"
                          checked={checked}
                          onChange={(e) => handleCollaboratorToggle(user._id, e.target.checked)}
                        />
                        <span>{user.fullName} ({user.username})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="md:col-span-6 rounded-2xl border border-brand-muted/60 bg-white/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-brand-ink">تفاصيل المهمة</p>
                <p className="text-xs text-brand-ink/60">
                  أضف خطوات دقيقة أو عناصر يجب على الفريق متابعتها أثناء تنفيذ المهمة.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTaskDetail}
                className="rounded-full border border-brand-primary px-3 py-1 text-xs text-brand-primary transition hover:bg-brand-primary/10"
              >
                + إضافة تفصيلة
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {(taskForm.details || []).map((detail, index) => (
                <div
                  key={detail.id}
                  className="rounded-xl border border-brand-muted/50 bg-brand-soft/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex-1 space-y-2">
                      <span className="block text-[11px] font-medium text-brand-ink/70">
                        تفصيلة #{index + 1}
                      </span>
                      <input
                        value={detail.text}
                        onChange={(e) => handleTaskDetailChange(detail.id, "text", e.target.value)}
                        className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        placeholder="مثال: تجهيز الشرائح الأولى للعرض"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveTaskDetail(detail.id)}
                      className="ml-2 rounded-full border border-brand-muted px-3 py-1 text-xs text-brand-ink/60 transition hover:bg-brand-muted/40"
                    >
                      حذف
                    </button>
                  </div>
                  <textarea
                    value={detail.note}
                    onChange={(e) => handleTaskDetailChange(detail.id, "note", e.target.value)}
                    className="mt-2 w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-xs text-brand-ink/70 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    placeholder="ملاحظات إضافية، مسؤول عن التفصيلة أو معايير النجاح (اختياري)"
                    rows={2}
                  />
                </div>
              ))}
              {(taskForm.details || []).length === 0 && (
                <p className="text-xs text-brand-ink/60">
                  أضف أول تفصيلة للمهمة لتوضيح المطلوب من الفريق.
                </p>
              )}
            </div>
          </div>
          <button
            type="submit"
            className="rounded-full bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
            disabled={availableUsers.length === 0}
          >
            إنشاء
          </button>
          {availableUsers.length === 0 && (
            <div className="md:col-span-6 rounded-xl border border-brand-accent/60 bg-brand-accent/15 px-3 py-2 text-xs text-brand-ink">
               لا يوجد مستخدمون نشطون متاحون. قم بتفعيل مستخدم أو إنشاء مستخدم جديد أولاً.
             </div>
          )}
            </form>
          )}

      {taskError && (
        <div className="rounded-xl border border-brand-accent/60 bg-brand-accent/15 px-3 py-2 text-sm text-brand-ink">
          {taskError}
        </div>
          )}

          <div className="grid gap-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-brand-ink/60">لا توجد مهام مسجلة بعد.</p>
        ) : (
          tasks.map((task) => (
            <article
              key={task._id}
              className="rounded-2xl border border-brand-muted/60 bg-white/95 p-4 shadow-subtle transition hover:shadow-soft"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-ink">{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-ink/60">
                    {renderStatusTag(task.status)}
                    <span>المسؤول: {task.assignedTo?.fullName || "غير محدد"}</span>
                    {task.dueDate && (
                      <span>
                        الموعد: {new Date(task.dueDate).toLocaleDateString("ar-SA")}
                      </span>
                    )}
                    {Array.isArray(task.assignees) && task.assignees.length > 1 && (() => {
                      const primaryId = task.assignedTo?._id;
                      const collaboratorNames = task.assignees
                        .filter((member) => member._id !== primaryId)
                        .map((member) => member.fullName || member.username || 'عضو مجهول')
                        .join('، ');
                      return collaboratorNames ? (
                        <span>مشاركون: {collaboratorNames}</span>
                      ) : null;
                    })()}
                </div>
              </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenTimeline(task)}
                    className="rounded-full border border-brand-primary px-3 py-1 text-xs text-brand-primary transition hover:bg-brand-primary/10"
                  >
                    السجل
                  </button>
                  <button
                    onClick={() => onDelete(task._id)}
                    className="rounded-full border border-brand-accent px-3 py-1 text-xs text-brand-ink transition hover:bg-brand-accent/20"
                  >
                    حذف
                  </button>
                </div>
              </div>
              {task.description && (
                <p className="mt-2 text-sm text-brand-ink/80 whitespace-pre-wrap">
                  {task.description}
                </p>
              )}
              {Array.isArray(task.details) && task.details.length > 0 && (
                <div className="mt-3 rounded-2xl border border-brand-muted/60 bg-white/90 p-3">
                  <p className="text-xs font-semibold text-brand-ink/70">
                    تفاصيل المهمة ({task.details.length})
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-brand-ink/80">
                    {task.details.map((detail) => (
                      <li
                        key={detail._id || detail.text}
                        className="flex flex-col rounded-xl border border-brand-muted/50 bg-brand-soft/40 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex-1">
                            <span
                              className={`inline-flex items-center gap-2 text-[13px] font-medium ${
                                detail.isCompleted
                                  ? 'text-brand-secondary'
                                  : 'text-brand-ink'
                              }`}
                            >
                              <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${
                                  detail.isCompleted
                                    ? 'bg-brand-secondary'
                                    : 'bg-brand-muted'
                                }`}
                              />
                              {detail.text}
                            </span>
                          </span>
                          {detail.isCompleted && (
                            <span className="rounded-full bg-brand-secondary/15 px-2 py-0.5 text-[10px] text-brand-secondary">
                              منتهية
                            </span>
                          )}
                        </div>
                        {detail.note ? (
                          <p className="mt-1 text-xs text-brand-ink/60 whitespace-pre-wrap">
                            {detail.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function RequestsSection({
  events,
  progressFeed,
  openResponse,
  toggleResponse,
  responseNotes,
  setResponseNotes,
  responseFiles,
  setResponseFiles,
  onRespond,
  actionLoading,
  onOpenTimeline,
  renderAttachments,
}) {
  if (!events.length) {
    return <p className="text-sm text-brand-ink/60">لا توجد طلبات حالياً.</p>;
  }

  return (
     <div className="space-y-3">
       {events.map((event) => {
         const taskId = event.taskId?._id || event.taskId;
         const hasResponse = progressFeed.some(
           (entry) =>
             entry.type === "admin-response" &&
             entry.metadata?.action === "response" &&
             entry.metadata?.referenceId === event._id
         );
 
         return (
           <article
             key={event._id}
             className="rounded-2xl border border-brand-highlight/50 bg-brand-highlight/10 p-4"
           >
             <div className="flex flex-wrap items-center justify-between gap-2">
               <div>
                 <p className="font-display text-base font-semibold text-brand-primary">
                   {event.taskId?.title || "مهمة غير معروفة"}
                 </p>
                 <p className="text-xs text-brand-ink/60">
                   من: {event.userId?.fullName || "مستخدم غير معروف"} · {" "}
                   {new Date(event.createdAt).toLocaleString("ar-SA")}
                 </p>
               </div>
               <div className="flex flex-wrap items-center gap-2">
                 {hasResponse && (
                   <span className="rounded-full bg-brand-secondary/15 px-2.5 py-1 text-xs font-medium text-brand-secondary">
                     تم الرد
                   </span>
                 )}
                 {taskId && (
                   <button
                     onClick={() => onOpenTimeline(taskId)}
                     className="rounded-full border border-brand-primary/50 px-3 py-1 text-xs text-brand-primary transition hover:bg-brand-primary/10"
                   >
                     عرض السجل
                   </button>
                 )}
                 <button
                   onClick={() => toggleResponse(event._id)}
                   className="rounded-full border border-brand-primary px-3 py-1 text-xs text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                   disabled={hasResponse}
                 >
                   رد الإدمن
                 </button>
               </div>
             </div>
             <p className="mt-2 text-sm text-brand-ink whitespace-pre-wrap">
               {event.message}
             </p>
             {renderAttachments(event.attachments)}
 
             {openResponse[event._id] && !hasResponse && (
               <div className="mt-3 rounded-2xl border border-brand-muted/60 bg-white/80 p-3 shadow-subtle">
                 <textarea
                   value={responseNotes[event._id] || ""}
                   onChange={(e) =>
                     setResponseNotes((prev) => ({ ...prev, [event._id]: e.target.value }))
                   }
                   className="w-full rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
                   rows={3}
                   placeholder="اكتب ردك للمستخدم..."
                 />
                 <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                   <div className="flex-1">
                     <label className="text-xs text-brand-ink/60">مرفقات (اختياري)</label>
                     <input
                       type="file"
                       multiple
                       onChange={(e) =>
                         setResponseFiles((prev) => ({
                           ...prev,
                           [event._id]: Array.from(e.target.files),
                         }))
                       }
                       className="mt-1 block w-full text-xs text-brand-primary file:mr-2 file:rounded-full file:border-0 file:bg-brand-primary file:px-3 file:py-1.5 file:text-white hover:file:bg-brand-primaryDark"
                     />
                     {(responseFiles[event._id] || []).length > 0 && (
                       <ul className="mt-1 space-y-1 text-[11px] text-brand-primary">
                         {responseFiles[event._id].map((file) => (
                           <li key={file.name}>{file.name}</li>
                         ))}
                       </ul>
                     )}
          </div>
                   <button
                     onClick={() => onRespond(event)}
                     className="rounded-full bg-brand-primary px-4 py-2 text-sm text-white shadow-soft transition hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
                     disabled={actionLoading === `respond-${event._id}`}
                   >
                     إرسال الرد
                   </button>
                 </div>
               </div>
             )}
           </article>
         );
       })}
     </div>
  );
}

function CompletedReportsSection({
  events,
  progressFeed,
  openAccept,
  toggleAcceptForm,
  acceptNotes,
  setAcceptNotes,
  acceptFiles,
  setAcceptFiles,
  openReturn,
  toggleReturnForm,
  returnNotes,
  setReturnNotes,
  returnFiles,
  setReturnFiles,
  onAccept,
  onReturn,
  actionLoading,
  onOpenTimeline,
  renderAttachments,
}) {
  if (!events.length) {
    return <p className="text-sm text-brand-ink/60">لا توجد تقارير نهائية حتى الآن.</p>;
  }

  const buildStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return (
          <span className="rounded-full bg-brand-secondary/15 px-2.5 py-1 text-xs font-medium text-brand-secondary">
            تم قبول المهمة
          </span>
        );
      case "returned":
        return (
          <span className="rounded-full bg-brand-accent/20 px-2.5 py-1 text-xs font-medium text-brand-ink">
            تمت إعادتها للمستخدم
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const taskId = event.taskId?._id || event.taskId;
        return (
          <article
            key={event._id}
            className="rounded-2xl border border-brand-secondary/40 bg-brand-secondary/10 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-base font-semibold text-brand-secondary">
                  {event.taskId?.title || "مهمة غير معروفة"}
                </p>
                <p className="text-xs text-brand-ink/70">
                  من: {event.userId?.fullName || "مستخدم غير معروف"} ·{" "}
                  {new Date(event.createdAt).toLocaleString("ar-SA")} · نسبة الإنجاز {event.metadata?.progress ?? 100}%
                </p>
                </div>
              <div className="flex flex-wrap items-center gap-2">
                {buildStatusBadge(event.taskId?.status)}
                {taskId && (
                  <button
                    onClick={() => onOpenTimeline(taskId)}
                    className="rounded-full border border-brand-secondary/60 px-3 py-1 text-xs text-brand-secondary transition hover:bg-brand-secondary/10"
                  >
                    عرض السجل
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-brand-ink whitespace-pre-wrap">{event.message}</p>
            {renderAttachments(event.attachments)}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => toggleAcceptForm(event._id)}
                className="rounded-full border border-brand-secondary px-3 py-1 text-xs text-brand-secondary transition hover:bg-brand-secondary/10"
              >
                اعتماد المهمة
              </button>
              <button
                onClick={() => toggleReturnForm(event._id)}
                className="rounded-full border border-brand-accent px-3 py-1 text-xs text-brand-ink transition hover:bg-brand-accent/20"
              >
                إعادة للمستخدم
              </button>
            </div>

            {openAccept[event._id] && (
              <div className="mt-3 rounded-2xl border border-brand-muted/60 bg-white/85 p-3 shadow-subtle">
                <textarea
                  value={acceptNotes[event._id] || ""}
                  onChange={(e) =>
                    setAcceptNotes((prev) => ({ ...prev, [event._id]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/30 focus:outline-none"
                  rows={3}
                  placeholder="ملاحظات الاعتماد (اختياري)"
                />
                <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-brand-ink/60">مرفقات (اختياري)</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) =>
                        setAcceptFiles((prev) => ({
                          ...prev,
                          [event._id]: Array.from(e.target.files),
                        }))
                      }
                      className="mt-1 block w-full text-xs text-brand-secondary file:mr-2 file:rounded-full file:border-0 file:bg-brand-secondary file:px-3 file:py-1.5 file:text-white hover:file:bg-brand-secondary/90"
                    />
                    {(acceptFiles[event._id] || []).length > 0 && (
                      <ul className="mt-1 space-y-1 text-[11px] text-brand-secondary">
                        {acceptFiles[event._id].map((file) => (
                          <li key={file.name}>{file.name}</li>
                        ))}
                      </ul>
                    )}
            </div>
                  <button
                    onClick={() => onAccept(taskId, event._id)}
                    className="rounded-full bg-brand-secondary px-4 py-2 text-sm text-white shadow-soft transition hover:bg-brand-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={actionLoading === `accept-${event._id}`}
                  >
                    تأكيد الاعتماد
                  </button>
                </div>
              </div>
            )}

            {openReturn[event._id] && (
              <div className="mt-3 rounded-2xl border border-brand-accent/50 bg-white/85 p-3 shadow-subtle">
                <textarea
                  value={returnNotes[event._id] || ""}
                  onChange={(e) =>
                    setReturnNotes((prev) => ({ ...prev, [event._id]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-brand-accent/60 p-2 text-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30 focus:outline-none"
                  rows={3}
                  placeholder="اشرح المطلوب استكماله من المستخدم..."
                />
                <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-brand-ink/60">مرفقات (اختياري)</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) =>
                        setReturnFiles((prev) => ({
                          ...prev,
                          [event._id]: Array.from(e.target.files),
                        }))
                      }
                      className="mt-1 block w-full text-xs text-brand-accent file:mr-2 file:rounded-full file:border-0 file:bg-brand-accent file:px-3 file:py-1.5 file:text-brand-ink hover:file:bg-brand-accent/90"
                    />
                    {(returnFiles[event._id] || []).length > 0 && (
                      <ul className="mt-1 space-y-1 text-[11px] text-brand-ink/70">
                        {returnFiles[event._id].map((file) => (
                          <li key={file.name}>{file.name}</li>
                        ))}
                      </ul>
        )}
      </div>
                  <button
                    onClick={() => onReturn(taskId, event._id)}
                    className="rounded-full bg-brand-accent px-4 py-2 text-sm text-brand-ink shadow-soft transition hover:bg-brand-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={actionLoading === `return-${event._id}`}
                  >
                    إرسال الملاحظات
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ReturnedTasksSection({ events, onOpenTimeline, renderAttachments }) {
  if (!events.length) {
    return <p className="text-sm text-brand-ink/60">لا توجد مهام مُعادة حالياً.</p>;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const taskId = event.taskId?._id || event.taskId;
        return (
          <article
            key={event._id}
            className="rounded-2xl border border-brand-accent/40 bg-brand-accent/15 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-base font-semibold text-brand-ink">
                  {event.taskId?.title || "مهمة غير معروفة"}
                </p>
                <p className="text-xs text-brand-ink/70">
                  أعيدت بتاريخ: {new Date(event.createdAt).toLocaleString("ar-SA")}
                </p>
              </div>
              {taskId && (
                <button
                  onClick={() => onOpenTimeline(taskId)}
                  className="rounded-full border border-brand-accent/60 px-3 py-1 text-xs text-brand-ink transition hover:bg-brand-accent/20"
                >
                  عرض السجل
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-brand-ink whitespace-pre-wrap">{event.message}</p>
            {renderAttachments(event.attachments)}
          </article>
        );
      })}
    </div>
  );
}

function PersonalReportsSection({
  reports,
  enableActions = false,
  replyForms = {},
  onChangeReply,
  onFilesChange,
  onSubmitReply,
  submittingMap = {},
  expandedReports = {},
  onToggleReport,
}) {
  if (!reports.length) {
    return <p className="text-sm text-brand-ink/60">لا توجد تقارير إضافية حالياً.</p>;
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const badge = REPORT_STATUS_BADGES[report.status] || REPORT_STATUS_BADGES.submitted;
        const conversations = Array.isArray(report.conversation)
          ? report.conversation
          : [];
        const expanded = expandedReports?.[report._id] ?? false;
        const shouldShowDetails =
          expanded || typeof onToggleReport !== 'function';
        const visibleConversations = shouldShowDetails ? conversations : [];
        const replyForm =
          replyForms[report._id] && enableActions
            ? replyForms[report._id]
            : buildAdminReportReplyForm();
        const canRespond =
          enableActions &&
          typeof onSubmitReply === 'function' &&
          typeof onChangeReply === 'function' &&
          typeof onFilesChange === 'function';

        return (
          <article
            key={report._id}
            className="space-y-3 rounded-2xl border border-brand-highlight/50 bg-brand-highlight/15 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold text-brand-primary">
                  {report.personalTaskId?.title || 'مهمة شخصية'}
                </p>
                <p className="text-xs text-brand-ink/70">
                  المرسل: {report.userId?.fullName || 'غير معروف'} · تم الإرسال{' '}
                  {formatDateTime(report.createdAt)}
                </p>
                {typeof report.completionPercentage === 'number' ? (
                  <p className="text-xs text-brand-secondary/80">
                    نسبة الإنجاز المعلنة: {report.completionPercentage}%
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
                {typeof onToggleReport === 'function' ? (
                  <button
                    type="button"
                    onClick={() => onToggleReport(report._id)}
                    className="rounded-full border border-brand-primary px-3 py-1 text-[11px] text-brand-primary hover:bg-brand-primary/10"
                  >
                    {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                  </button>
                ) : null}
              </div>
            </div>

            {shouldShowDetails && report.notes ? (
              <p className="text-sm text-brand-ink whitespace-pre-wrap">{report.notes}</p>
            ) : null}

            {shouldShowDetails && report.attachments?.length ? (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-brand-ink/70">مرفقات التقرير</p>
                <ul className="space-y-1 text-xs">
                  {report.attachments.map((file) => (
                    <li key={file.url}>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-primary hover:underline"
                      >
                        {file.originalName || file.filename}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {shouldShowDetails ? (
              <div className="space-y-2 rounded-xl border border-brand-muted/50 bg-white/90 p-3">
                <h5 className="text-xs font-semibold text-brand-ink/70">المحادثة</h5>
                {visibleConversations.length ? (
                  <ul className="space-y-2">
                    {visibleConversations.map((entry) => (
                      <li
                        key={entry._id}
                        className="rounded-lg border border-brand-muted/50 bg-white px-3 py-2 text-xs text-brand-ink/80"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-semibold">
                            {entry.authorRole === 'admin' ? 'الإدارة' : 'المستخدم'}
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
                  <p className="text-[11px] text-brand-ink/60">لا توجد رسائل إضافية بعد.</p>
                )}
              </div>
            ) : null}

            {shouldShowDetails && canRespond ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmitReply(report._id);
                }}
                className="space-y-2 rounded-xl border border-brand-muted/60 bg-white/95 p-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                    الرد على المستخدم
                    <textarea
                      value={replyForm.message}
                      onChange={(e) =>
                        onChangeReply(report._id, 'message', e.target.value)
                      }
                      rows={2}
                      className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-xs text-brand-ink/80 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="اشرح المطلوب أو اشكر المستخدم على الإكمال..."
                    />
                  </label>
                  <label className="space-y-1 text-[11px] font-medium text-brand-ink/70">
                    حالة التقرير
                    <select
                      value={replyForm.status}
                      onChange={(e) => onChangeReply(report._id, 'status', e.target.value)}
                      className="w-full rounded-xl border border-brand-muted/60 bg-white px-3 py-2 text-xs focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    >
                      {ADMIN_REPORT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-[11px] font-medium text-brand-ink/70">
                  مرفقات إضافية
                  <input
                    key={`admin-reply-files-${report._id}-${(replyForm.files || []).length}`}
                    type="file"
                    multiple
                    onChange={(e) => onFilesChange(report._id, e.target.files)}
                    className="mt-1 w-full rounded-xl border border-dashed border-brand-muted/60 bg-white px-3 py-2 text-xs text-brand-ink/60"
                  />
                  {replyForm.files?.length ? (
                    <span className="block text-[10px] text-brand-ink/50">
                      {replyForm.files.length} ملف/ملفات مرفقة
                    </span>
                  ) : null}
                </label>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={Boolean(submittingMap[report._id])}
                    className="rounded-full border border-brand-secondary px-3 py-1 text-xs text-brand-secondary hover:bg-brand-secondary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingMap[report._id] ? 'جارٍ الإرسال...' : 'إرسال الرد'}
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function UsersSection({
  showUserForm,
  setShowUserForm,
  userForm,
  setUserForm,
  onCreateUser,
  users,
  onToggleUser,
  userStats,
  usersWithManyTasks,
  usersWithoutTasks,
  usersWithoutActiveTasks,
}) {
  const summaryChips = [
    { label: "إجمالي المستخدمين", value: users.length, tone: "primary" },
    { label: "مهام كثيرة (>2)", value: usersWithManyTasks.length, tone: "accent" },
    { label: "بدون مهام", value: usersWithoutTasks.length, tone: "muted" },
    { label: "بدون مهام جارية", value: usersWithoutActiveTasks.length, tone: "warning" },
  ];

  const chipStyles = {
    primary: "bg-brand-primary/15 text-brand-primary",
    accent: "bg-brand-accent/20 text-brand-ink",
    muted: "bg-brand-muted/60 text-brand-ink",
    warning: "bg-brand-highlight/25 text-brand-primary",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-brand-ink">أعضاء الفريق</h3>
          <p className="text-xs text-brand-ink/60">إدارة الحسابات وتفعيلها أو تعطيلها.</p>
        </div>
        <button
          onClick={() => setShowUserForm((prev) => !prev)}
          className="rounded-full bg-brand-secondary px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-secondary/90"
        >
          {showUserForm ? "إخفاء النموذج" : "مستخدم جديد"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {summaryChips.map((chip) => (
          <span
            key={chip.label}
            className={`rounded-full border border-brand-muted/60 px-3 py-1 text-xs font-medium ${chipStyles[chip.tone]}`}
          >
            {chip.label}: {chip.value}
          </span>
        ))}
      </div>

      {showUserForm && (
         <form
           onSubmit={onCreateUser}
           className="grid grid-cols-1 gap-3 rounded-2xl border border-brand-muted/60 bg-white/90 p-4 shadow-subtle backdrop-blur md:grid-cols-5"
         >
           <input
             value={userForm.fullName}
             onChange={(e) => setUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
             placeholder="الاسم الكامل"
             className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
             required
           />
           <input
             value={userForm.username}
             onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
             placeholder="اسم المستخدم"
             className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
             required
           />
           <input
             type="password"
             value={userForm.password}
             onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
             placeholder="كلمة المرور"
             className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
             required
           />
           <select
             value={userForm.role}
             onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
             className="rounded-xl border border-brand-muted/70 p-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none"
           >
             <option value="user">مستخدم</option>
             <option value="admin">إدمن</option>
           </select>
           <button
             type="submit"
             className="rounded-full bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-primaryDark"
           >
             إنشاء
           </button>
         </form>
       )}
 
       <div className="space-y-3">
         {users.length === 0 ? (
          <p className="text-sm text-brand-ink/60">لم يتم إضافة مستخدمين بعد.</p>
         ) : (
           users.map((user) => (
             <article
               key={user._id}
               className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-muted/60 bg-white/90 p-3 shadow-subtle"
             >
               <div>
                 <p className="font-medium text-brand-ink">
                   {user.fullName} <span className="text-sm text-brand-ink/50">({user.username})</span>
                 </p>
                 <p className="text-xs text-brand-ink/60">
                   {user.role === "admin" ? "إدمن" : "مستخدم"}
                 </p>
                 {(() => {
                   const stats = userStats[user._id] || {
                     total: 0,
                     inProgress: 0,
                     completed: 0,
                   };
                   return (
                     <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-brand-ink/70">
                       <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-brand-primary">
                         إجمالي: {stats.total}
                       </span>
                       <span className="rounded-full bg-brand-highlight/20 px-2 py-0.5 text-brand-primary">
                         جاري: {stats.inProgress}
                       </span>
                       <span className="rounded-full bg-brand-secondary/20 px-2 py-0.5 text-brand-secondary">
                         مكتملة: {stats.completed}
                       </span>
                     </div>
                   );
                 })()}
                 {usersWithManyTasks.some((u) => u._id === user._id) ? (
                   <span className="mt-1 inline-block rounded-full bg-brand-accent/30 px-2 py-0.5 text-[11px] text-brand-ink">
                    عبء مرتفع (&gt;2 مهام)
                   </span>
                 ) : null}
                 {usersWithoutTasks.some((u) => u._id === user._id) ? (
                   <span className="mt-1 inline-block rounded-full bg-brand-muted/70 px-2 py-0.5 text-[11px] text-brand-ink">
                     بدون مهام حالياً
                   </span>
                 ) : null}
                 {(() => {
                   const stats = userStats[user._id];
                   if (!stats) return null;
                   if (stats.total > 0 && stats.inProgress === 0) {
                     return (
                       <span className="mt-1 inline-block rounded-full bg-brand-highlight/25 px-2 py-0.5 text-[11px] text-brand-primary">
                         لا توجد مهام قيد التنفيذ
                       </span>
                     );
                   }
                   return null;
                 })()}
               </div>
               <button
                 onClick={() => onToggleUser(user._id, user.isActive)}
                 className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                   user.isActive
                     ? "border border-brand-accent/60 bg-brand-accent/20 text-brand-ink"
                     : "border border-brand-secondary/60 bg-brand-secondary/15 text-brand-secondary"
                 }`}
               >
                 {user.isActive ? "تعطيل" : "تفعيل"}
               </button>
             </article>
           ))
         )}
       </div>
    </div>
  );
}

function RequestsTab({
  requestEvents = [],
  progressFeed = [],
  openResponse,
  toggleResponse,
  responseNotes,
  setResponseNotes,
  responseFiles,
  setResponseFiles,
  handleRespond,
  actionLoading,
  onOpenTimeline,
  renderAttachments,
}) {
  const formatDuration = (ms) => {
    if (ms == null || Number.isNaN(ms)) return "—";
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days} يوم`);
    if (hours) parts.push(`${hours} س`);
    if (minutes || parts.length === 0) parts.push(`${minutes} د`);
    return parts.join(" ");
  };

  const chipStyles = {
    primary: "bg-brand-primary/15 text-brand-primary",
    secondary: "bg-brand-secondary/20 text-brand-secondary",
    accent: "bg-brand-highlight/25 text-brand-primary",
    warning: "bg-brand-accent/20 text-brand-ink",
    muted: "bg-brand-muted/60 text-brand-ink",
  };

  const statusLabels = {
    open: "بانتظار الرد",
    responded: "تم الرد",
  };

  const statusBadgeStyles = {
    open: "bg-brand-accent/20 text-brand-ink",
    responded: "bg-brand-secondary/20 text-brand-secondary",
  };

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const responseMap = useMemo(() => {
    const map = new Map();
    progressFeed.forEach((entry) => {
      if (entry.type === "admin-response" && entry.metadata?.referenceId) {
        const key = entry.metadata.referenceId.toString();
        const list = map.get(key) || [];
        list.push(entry);
        map.set(key, list);
      }
    });
    return map;
  }, [progressFeed]);

  const details = useMemo(() => {
    return requestEvents
      .map((event) => {
        const id = event._id?.toString?.() || String(event._id);
        const responses = responseMap.get(id) || [];
        const sortedResponses = [...responses].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        const latestResponse = sortedResponses[sortedResponses.length - 1] || null;
        const status = latestResponse ? "responded" : "open";

        const createdAtDate = event.createdAt ? new Date(event.createdAt) : null;
        const createdAtValid =
          createdAtDate && !Number.isNaN(createdAtDate.getTime()) ? createdAtDate : null;

        let responseTimeMs = null;
        if (latestResponse && createdAtValid) {
          const responseDate = new Date(latestResponse.createdAt);
          if (!Number.isNaN(responseDate.getTime())) {
            responseTimeMs = responseDate.getTime() - createdAtValid.getTime();
          }
        }

        return {
          id,
          event,
          status,
          createdAt: createdAtValid,
          taskTitle: event.taskId?.title || "مهمة غير معروفة",
          userName:
            event.userId?.fullName ||
            event.userId?.username ||
            "مستخدم غير معروف",
          message: event.message || "",
          latestResponse,
          responseCount: responses.length,
          responseTimeMs,
        };
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      });
  }, [requestEvents, responseMap]);

  const summary = useMemo(() => {
    let open = 0;
    let responded = 0;
    let overdue = 0;
    let totalResponseMs = 0;
    let responseCount = 0;
    const now = Date.now();

    details.forEach((item) => {
      if (item.status === "open") {
        open += 1;
        if (
          item.createdAt &&
          now - item.createdAt.getTime() > 48 * 60 * 60 * 1000
        ) {
          overdue += 1;
        }
      } else {
        responded += 1;
      }

      if (item.responseTimeMs != null && item.responseTimeMs >= 0) {
        totalResponseMs += item.responseTimeMs;
        responseCount += 1;
      }
    });

    return {
      total: details.length,
      open,
      responded,
      overdue,
      avgResponseMs: responseCount ? totalResponseMs / responseCount : null,
    };
  }, [details]);

  const filteredDetails = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return details.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (term) {
        const haystack = `${item.taskTitle} ${item.userName} ${item.message}`.toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [details, statusFilter, searchTerm]);

  const filteredEvents = useMemo(
    () => filteredDetails.map((item) => item.event),
    [filteredDetails]
  );

  const summaryChips = [
    { label: "إجمالي الطلبات", value: summary.total, tone: "primary" },
    { label: "طلبات مفتوحة", value: summary.open, tone: "warning" },
    { label: "طلبات متجاوزة 48 ساعة", value: summary.overdue, tone: "accent" },
    { label: "طلبات مردود عليها", value: summary.responded, tone: "secondary" },
    {
      label: "متوسط زمن الرد",
      value: summary.avgResponseMs ? formatDuration(summary.avgResponseMs) : "—",
      tone: "muted",
    },
  ];

  const openOverdueThreshold = 48 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-brand-ink">إدارة الطلبات</h3>
            <p className="text-xs text-brand-ink/60">
              متابعة طلبات الدعم والتوضيح واتخاذ الإجراءات السريعة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full border border-brand-muted/60 bg-white/80 px-3 py-1 text-brand-ink/70 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
              <option value="all">كل الحالات</option>
              <option value="open">بانتظار الرد</option>
              <option value="responded">تم الرد</option>
            </select>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث باسم المهمة أو العضو..."
              className="rounded-full border border-brand-muted/60 bg-white/80 px-3 py-1 text-brand-ink/70 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>
        </header>

        <div className="flex flex-wrap gap-3">
          {summaryChips.map((chip) => (
            <span
              key={chip.label}
              className={`rounded-full border border-brand-muted/50 px-3 py-1 text-xs font-medium ${chipStyles[chip.tone]}`}
            >
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <header className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-lg text-brand-ink">نظرة سريعة</h4>
          <span className="text-xs text-brand-ink/50">
            ترتيب تنازلي بحسب تاريخ الطلب
          </span>
        </header>
        {filteredDetails.length === 0 ? (
          <p className="text-sm text-brand-ink/60">
            لا توجد طلبات مطابقة للمعايير المحددة حالياً.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-muted/50 text-right text-sm">
              <thead className="bg-brand-muted/40 text-[12px] text-brand-ink/70">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">المهمة</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">صاحب الطلب</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">تاريخ الطلب</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">الحالة</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">زمن الرد</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-muted/40 text-[13px] text-brand-ink/80">
                {filteredDetails.map((item) => {
                  const rowHighlight =
                    item.status === "open" &&
                    item.createdAt &&
                    Date.now() - item.createdAt.getTime() > openOverdueThreshold;

                  const timelineTaskId =
                    item.event.taskId?._id || item.event.taskId;

                  return (
                    <tr
                      key={item.id}
                      className={rowHighlight ? "bg-brand-accent/10" : "bg-transparent"}
                    >
                      <td className="max-w-[220px] px-3 py-2 align-top font-medium text-brand-ink">
                        <div className="line-clamp-2">{item.taskTitle}</div>
                      </td>
                      <td className="px-3 py-2 align-top">{item.userName}</td>
                      <td className="px-3 py-2 align-top text-xs text-brand-ink/60">
                        {item.createdAt
                          ? item.createdAt.toLocaleString("ar-SA")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusBadgeStyles[item.status]}`}
                        >
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-brand-ink/70">
                        {item.responseTimeMs != null
                          ? formatDuration(item.responseTimeMs)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {timelineTaskId ? (
                            <button
                              onClick={() => onOpenTimeline(timelineTaskId)}
                              className="rounded-full border border-brand-muted/60 px-2 py-0.5 text-brand-ink/70 hover:bg-brand-muted/20"
                            >
                              السجل
                            </button>
                          ) : null}
                          {item.status === "open" ? (
                            <button
                              onClick={() => toggleResponse(item.id)}
                              className="rounded-full border border-brand-primary/60 px-2 py-0.5 text-brand-primary hover:bg-brand-primary/10"
                            >
                              رد سريع
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 text-[11px] text-brand-secondary">
                              تمت المعالجة
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <header className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-lg text-brand-ink">تفاصيل الطلبات</h4>
          <span className="text-xs text-brand-ink/50">
            يمكنك الرد مباشرة من البطاقات التالية
          </span>
        </header>
        <RequestsSection
          events={filteredEvents}
          progressFeed={progressFeed}
          openResponse={openResponse}
          toggleResponse={toggleResponse}
          responseNotes={responseNotes}
          setResponseNotes={setResponseNotes}
          responseFiles={responseFiles}
          setResponseFiles={setResponseFiles}
          onRespond={handleRespond}
          actionLoading={actionLoading}
          onOpenTimeline={onOpenTimeline}
          renderAttachments={renderAttachments}
        />
      </section>
    </div>
  );
}

function AnalyticsTab({
  tasks = [],
  users = [],
  progressFeed = [],
  requestEvents = [],
  onOpenTimeline,
  taskMetrics,
}) {
  const clampPercent = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const formatPercent = (value) => `${clampPercent(value)}%`;
  const formatDuration = (ms) => {
    if (ms == null || Number.isNaN(ms)) return "—";
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}ي ${remainingHours}س`;
    }
    if (hours) return `${hours}س ${minutes}د`;
    return `${minutes}د`;
  };

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const defaultFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      from: toDateInputValue(defaultFrom),
      to: toDateInputValue(today),
    };
  });

  const fromBoundary = useMemo(() => {
    if (!dateRange.from) return null;
    const d = new Date(dateRange.from);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateRange.from]);

  const toBoundary = useMemo(() => {
    if (!dateRange.to) return null;
    const d = new Date(dateRange.to);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
  }, [dateRange.to]);

  const hasRangeFilter = Boolean(dateRange.from || dateRange.to);

  const withinRange = (value) => {
    if (!hasRangeFilter) return true;
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    if (fromBoundary && date < fromBoundary) return false;
    if (toBoundary && date > toBoundary) return false;
    return true;
  };

  const userById = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      const key = user._id?.toString?.() || String(user._id);
      map.set(key, user);
    });
    return map;
  }, [users]);

  const completionEvents = useMemo(
    () => progressFeed.filter((entry) => entry.type === "completed"),
    [progressFeed]
  );

  const completionEventsInRange = useMemo(() => {
    if (!hasRangeFilter) return completionEvents;
    return completionEvents.filter((event) => withinRange(event.createdAt));
  }, [completionEvents, hasRangeFilter, fromBoundary, toBoundary]);

  const completedTaskIdsInRange = useMemo(() => {
    const ids = new Set();
    completionEventsInRange.forEach((event) => {
      const taskId = event.taskId?._id || event.taskId;
      if (taskId) {
        ids.add(taskId.toString());
      }
    });
    return ids;
  }, [completionEventsInRange]);

  const responseMap = useMemo(() => {
    const map = new Map();
    progressFeed.forEach((entry) => {
      if (entry.type === "admin-response" && entry.metadata?.referenceId) {
        const key = entry.metadata.referenceId.toString();
        const list = map.get(key) || [];
        list.push(entry);
        map.set(key, list);
      }
    });
    return map;
  }, [progressFeed]);

  const requestsInRange = useMemo(
    () => requestEvents.filter((event) => withinRange(event.createdAt)),
    [requestEvents, hasRangeFilter, fromBoundary, toBoundary]
  );

  const requestAnalytics = useMemo(() => {
    let totalResponseMs = 0;
    let responseCount = 0;
    let open = 0;
    let responded = 0;
    const perUserOpen = new Map();

    requestsInRange.forEach((event) => {
      const key = event._id?.toString?.() || String(event._id);
      const responses = responseMap.get(key) || [];
      const hasResponse = responses.length > 0;
      if (hasResponse) {
        responded += 1;
        const firstResponse = [...responses].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        )[0];
        if (firstResponse && event.createdAt) {
          const start = new Date(event.createdAt);
          const end = new Date(firstResponse.createdAt);
          if (
            !Number.isNaN(start.getTime()) &&
            !Number.isNaN(end.getTime()) &&
            end >= start
          ) {
            totalResponseMs += end.getTime() - start.getTime();
            responseCount += 1;
          }
        }
      } else {
        open += 1;
      }

      const requesterId = event.userId?._id || event.userId;
      if (requesterId) {
        const requesterKey = requesterId.toString();
        const entry = perUserOpen.get(requesterKey) || { open: 0 };
        if (!hasResponse) {
          entry.open += 1;
        }
        perUserOpen.set(requesterKey, entry);
      }
    });

    return {
      total: requestsInRange.length,
      open,
      responded,
      avgResponseMs: responseCount ? totalResponseMs / responseCount : null,
      perUserOpen,
    };
  }, [requestsInRange, responseMap]);

  const userMetrics = useMemo(() => {
    const map = users.reduce((acc, user) => {
      const key = user._id?.toString?.() || String(user._id);
      acc[key] = {
        user,
        assigned: 0,
        completed: 0,
        inProgress: 0,
        late: 0,
        returned: 0,
        openRequests: requestAnalytics.perUserOpen.get(key)?.open || 0,
        completionRate: 0,
      };
      return acc;
    }, {});

    const now = new Date();

    tasks.forEach((task) => {
      const assignedId = task.assignedTo?._id || task.assignedTo;
      if (!assignedId) return;
      const key = assignedId.toString();
      const bucket = map[key];
      if (!bucket) return;

      const assignedTimestamp = task.createdAt || task.updatedAt || task.dueDate;
      if (hasRangeFilter && !withinRange(assignedTimestamp)) {
        return;
      }

      bucket.assigned += 1;

      if (task.status === "completed") {
        const shouldCountCompleted =
          !hasRangeFilter || completedTaskIdsInRange.has(task._id?.toString?.());
        if (shouldCountCompleted) {
          bucket.completed += 1;
        }
      } else if (task.status === "in-progress") {
        bucket.inProgress += 1;
      } else if (task.status === "returned") {
        bucket.returned += 1;
      }

      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      const isLate =
        task.status === "late" ||
        (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < now && task.status !== "completed");
      if (isLate) {
        bucket.late += 1;
      }
    });

    Object.values(map).forEach((bucket) => {
      bucket.completionRate = bucket.assigned
        ? Math.round((bucket.completed / bucket.assigned) * 100)
        : 0;
    });

    return map;
  }, [
    users,
    tasks,
    hasRangeFilter,
    completedTaskIdsInRange,
    requestAnalytics,
    fromBoundary,
    toBoundary,
  ]);

  const userMetricValues = useMemo(
    () => Object.values(userMetrics),
    [userMetrics]
  );

  const aggregate = useMemo(() => {
    const totalAssigned = userMetricValues.reduce((acc, item) => acc + item.assigned, 0);
    const totalCompleted = userMetricValues.reduce((acc, item) => acc + item.completed, 0);
    const totalLate = userMetricValues.reduce((acc, item) => acc + item.late, 0);
    const completionRate = totalAssigned
      ? Math.round((totalCompleted / totalAssigned) * 100)
      : 0;
    return { totalAssigned, totalCompleted, totalLate, completionRate };
  }, [userMetricValues]);

  const topPerformers = useMemo(() => {
    return userMetricValues
      .filter((item) => item.assigned > 0)
      .slice()
      .sort((a, b) => {
        if (b.completionRate !== a.completionRate) {
          return b.completionRate - a.completionRate;
        }
        return b.completed - a.completed;
      })
      .slice(0, 3);
  }, [userMetricValues]);

  const lowPerformers = useMemo(() => {
    return userMetricValues
      .filter((item) => item.assigned > 0)
      .slice()
      .sort((a, b) => {
        if (a.completionRate !== b.completionRate) {
          return a.completionRate - b.completionRate;
        }
        return a.completed - b.completed;
      })
      .slice(0, 3);
  }, [userMetricValues]);

  const usersWithOpenRequests = useMemo(() => {
    const entries = Array.from(requestAnalytics.perUserOpen.entries())
      .map(([userId, record]) => ({
        user: userById.get(userId),
        open: record.open,
      }))
      .filter((entry) => entry.user && entry.open > 0)
      .sort((a, b) => b.open - a.open)
      .slice(0, 3);
    return entries;
  }, [requestAnalytics, userById]);

  const lateTasksList = useMemo(() => {
    const now = new Date();
    return tasks
      .filter((task) => {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isLate =
          task.status === "late" ||
          (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < now && task.status !== "completed");
        if (!isLate) return false;
        if (!hasRangeFilter) return true;
        const referenceTimestamp = task.updatedAt || task.dueDate || task.createdAt;
        return withinRange(referenceTimestamp);
      })
      .sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dateA - dateB;
      })
      .slice(0, 6);
  }, [tasks, hasRangeFilter, fromBoundary, toBoundary]);

  const performanceTable = useMemo(() => {
    return userMetricValues
      .slice()
      .sort((a, b) => b.assigned - a.assigned);
  }, [userMetricValues]);

  const summaryCards = useMemo(() => [
    {
      label: "نسبة الإنجاز",
      value: formatPercent(aggregate.completionRate),
      tone: "secondary",
    },
    {
      label: "المهام الموكلة",
      value: aggregate.totalAssigned,
      tone: "primary",
    },
    {
      label: "المهام المكتملة",
      value: aggregate.totalCompleted,
      tone: "secondary",
    },
    {
      label: "المهام المتأخرة",
      value: aggregate.totalLate,
      tone: "warning",
    },
    {
      label: "طلبات مفتوحة",
      value: requestAnalytics.open,
      tone: "accent",
    },
    {
      label: "متوسط زمن الرد",
      value: requestAnalytics.avgResponseMs
        ? formatDuration(requestAnalytics.avgResponseMs)
        : "—",
      tone: "muted",
    },
  ], [aggregate, requestAnalytics]);

  const cardStyles = {
    primary: "bg-brand-primary/15 text-brand-primary",
    secondary: "bg-brand-secondary/20 text-brand-secondary",
    accent: "bg-brand-highlight/25 text-brand-primary",
    warning: "bg-brand-accent/20 text-brand-ink",
    muted: "bg-brand-muted/60 text-brand-ink",
  };

  const handleQuickRange = (days) => {
    if (!days) {
      setDateRange({ from: "", to: "" });
      return;
    }
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    setDateRange({
      from: toDateInputValue(from),
      to: toDateInputValue(to),
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-brand-ink">نطاق التحليل</h3>
            <p className="text-xs text-brand-ink/60">
              اختر الفترة الزمنية لمتابعة أداء الفريق.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => handleQuickRange(7)}
              className="rounded-full border border-brand-muted/60 px-3 py-1 text-brand-ink/70 hover:bg-brand-muted/20"
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => handleQuickRange(30)}
              className="rounded-full border border-brand-muted/60 px-3 py-1 text-brand-ink/70 hover:bg-brand-muted/20"
            >
              آخر 30 يوماً
            </button>
            <button
              onClick={() => handleQuickRange(90)}
              className="rounded-full border border-brand-muted/60 px-3 py-1 text-brand-ink/70 hover:bg-brand-muted/20"
            >
              آخر 90 يوماً
            </button>
            <button
              onClick={() => handleQuickRange(null)}
              className="rounded-full border border-brand-primary px-3 py-1 text-brand-primary hover:bg-brand-primary/10"
            >
              عرض الكل
            </button>
          </div>
        </header>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col text-xs text-brand-ink/60">
            من
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, from: e.target.value }))
              }
              className="mt-1 rounded-xl border border-brand-muted/60 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
          <label className="flex flex-col text-xs text-brand-ink/60">
            إلى
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, to: e.target.value }))
              }
              className="mt-1 rounded-xl border border-brand-muted/60 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border border-brand-muted/50 bg-white/90 p-4 shadow-subtle ${cardStyles[card.tone]}`}
            >
              <p className="text-xs text-brand-ink/70">{card.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h4 className="font-display text-lg text-brand-ink">أكثر المنجزين</h4>
            <span className="text-xs text-brand-ink/50">حسب نسبة الإنجاز</span>
          </header>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-brand-ink/60">لا توجد بيانات كافية للعرض.</p>
          ) : (
            <ul className="space-y-3">
              {topPerformers.map((metric) => (
                <li
                  key={metric.user._id}
                  className="rounded-xl border border-brand-muted/60 bg-white/90 p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-brand-ink">{metric.user.fullName}</p>
                      <p className="text-xs text-brand-ink/60">
                        {metric.completed} من {metric.assigned} مهمة
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-secondary">
                      {formatPercent(metric.completionRate)}
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-brand-muted/40">
                    <div
                      className="h-2 rounded-full bg-brand-secondary"
                      style={{ width: `${clampPercent(metric.completionRate)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h4 className="font-display text-lg text-brand-ink">أقل المنجزين</h4>
            <span className="text-xs text-brand-ink/50">لتركيز الدعم والمتابعة</span>
          </header>
          {lowPerformers.length === 0 ? (
            <p className="text-sm text-brand-ink/60">لا توجد بيانات كافية للعرض.</p>
          ) : (
            <ul className="space-y-3">
              {lowPerformers.map((metric) => (
                <li
                  key={metric.user._id}
                  className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-brand-ink">{metric.user.fullName}</p>
                      <p className="text-xs text-brand-ink/60">
                        {metric.completed} من {metric.assigned} مهمة
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-ink">
                      {formatPercent(metric.completionRate)}
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-brand-muted/30">
                    <div
                      className="h-2 rounded-full bg-brand-accent/60"
                      style={{ width: `${clampPercent(metric.completionRate)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h4 className="font-display text-lg text-brand-ink">مهام بحاجة لتدخل</h4>
            <span className="text-xs text-brand-ink/50">متأخرة أو عالية الخطورة</span>
          </header>
          {lateTasksList.length === 0 ? (
            <p className="text-sm text-brand-ink/60">لا توجد مهام متأخرة حالياً ضمن النطاق.</p>
          ) : (
            <ul className="space-y-3">
              {lateTasksList.map((task) => {
                const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                const timelineTaskId = task._id;
                return (
                  <li
                    key={task._id}
                    className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-brand-ink">{task.title}</p>
                        <p className="text-xs text-brand-ink/60">
                          المسؤول: {task.assignedTo?.fullName || "غير محدد"}
                        </p>
                      </div>
                      <div className="text-right text-xs text-brand-ink/60">
                        <p>
                          الموعد النهائي: {dueDate ? dueDate.toLocaleDateString("ar-SA") : "—"}
                        </p>
                        <p>الحالة: {task.status === "late" ? "متأخرة" : task.status === "returned" ? "مُعادة" : "قيد المتابعة"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {timelineTaskId ? (
                        <button
                          onClick={() => onOpenTimeline(timelineTaskId)}
                          className="rounded-full border border-brand-muted/60 px-3 py-1 text-brand-ink/70 hover:bg-brand-muted/20"
                        >
                          عرض السجل
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
          <header className="mb-3 flex items-center justify-between">
            <h4 className="font-display text-lg text-brand-ink">طلبات المتابعة</h4>
            <span className="text-xs text-brand-ink/50">أكثر الأعضاء احتياجاً للدعم</span>
          </header>
          {usersWithOpenRequests.length === 0 ? (
            <p className="text-sm text-brand-ink/60">لا توجد طلبات مفتوحة ضمن النطاق الزمني.</p>
          ) : (
            <ul className="space-y-3">
              {usersWithOpenRequests.map((entry) => (
                <li
                  key={entry.user._id}
                  className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-brand-ink">{entry.user.fullName}</p>
                      <p className="text-xs text-brand-ink/60">
                        {entry.user.role === "admin" ? "إداري" : "عضو فريق"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-primary">
                      {entry.open} طلب مفتوح
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-brand-muted/60 bg-white/95 p-5 shadow-subtle">
        <header className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-lg text-brand-ink">تحليل أداء تفصيلي</h4>
          <span className="text-xs text-brand-ink/50">نظرة شاملة على مؤشرات الفريق</span>
        </header>
        {performanceTable.length === 0 ? (
          <p className="text-sm text-brand-ink/60">لا توجد بيانات متاحة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-muted/50 text-right text-sm">
              <thead className="bg-brand-muted/40 text-[12px] text-brand-ink/70">
                <tr>
                  <th className="px-3 py-2 font-medium">المستخدم</th>
                  <th className="px-3 py-2 font-medium">المهام الموكلة</th>
                  <th className="px-3 py-2 font-medium">المهام المكتملة</th>
                  <th className="px-3 py-2 font-medium">نسبة الإنجاز</th>
                  <th className="px-3 py-2 font-medium">قيد التنفيذ</th>
                  <th className="px-3 py-2 font-medium">متأخرة</th>
                  <th className="px-3 py-2 font-medium">مُعادة</th>
                  <th className="px-3 py-2 font-medium">طلبات مفتوحة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-muted/40 text-[13px] text-brand-ink/80">
                {performanceTable.map((metric) => (
                  <tr key={metric.user._id}>
                    <td className="px-3 py-2 font-medium text-brand-ink">
                      {metric.user.fullName}
                    </td>
                    <td className="px-3 py-2">{metric.assigned}</td>
                    <td className="px-3 py-2">{metric.completed}</td>
                    <td className="px-3 py-2 text-brand-secondary">
                      {formatPercent(metric.completionRate)}
                    </td>
                    <td className="px-3 py-2">{metric.inProgress}</td>
                    <td className="px-3 py-2">{metric.late}</td>
                    <td className="px-3 py-2">{metric.returned}</td>
                    <td className="px-3 py-2">{metric.openRequests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function toDateInputValue(date) {
  if (!date || Number.isNaN(date.getTime?.() ?? date)) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}