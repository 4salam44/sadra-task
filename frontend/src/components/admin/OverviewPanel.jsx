import { useMemo } from "react";

const stateLabels = {
  pending: "قيد الانتظار",
  "in-progress": "قيد التنفيذ",
  completed: "مكتملة",
  returned: "مُعادة",
  late: "متأخرة",
};

const toneMap = {
  pending: "bg-gray-100 text-gray-700",
  "in-progress": "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  returned: "bg-amber-100 text-amber-700",
  late: "bg-red-100 text-red-700",
};

export default function OverviewPanel({
  tasks = [],
  requestEvents = [],
  completedEvents = [],
  returnedEvents = [],
  progressFeed = [],
  reportsCount = 0,
  onRefresh,
}) {
  const stats = useMemo(() => {
    const counts = Object.entries(stateLabels).map(([state, title]) => ({
      key: state,
      title,
      value: tasks.filter((task) => task.status === state).length,
    }));

    return {
      counts,
      totalAttachments: progressFeed.reduce(
        (total, entry) => total + (entry.attachments?.length || 0),
        0
      ),
      activeRequests: requestEvents.filter((event) => {
        const hasResponse = progressFeed.some(
          (p) =>
            p.type === "admin-response" &&
            p.metadata?.action === "response" &&
            p.metadata?.referenceId === event._id
        );
        return !hasResponse;
      }).length,
      averageCompletion: (() => {
        const values = completedEvents
          .map((event) => event.metadata?.progress ?? 100)
          .filter((n) => typeof n === "number");
        if (!values.length) return 0;
        return Math.round(values.reduce((acc, n) => acc + n, 0) / values.length);
      })(),
      totalReports: reportsCount,
    };
  }, [tasks, requestEvents, completedEvents, progressFeed, reportsCount]);

  const latestEvents = useMemo(
    () =>
      progressFeed
        .slice(0, 6)
        .map((event) => ({
          id: event._id,
          taskTitle: event.taskId?.title ?? "مهمة غير معروفة",
          user: event.userId?.fullName ?? "مستخدم غير معروف",
          type: event.type,
          createdAt: new Date(event.createdAt).toLocaleString("ar-SA"),
        })),
    [progressFeed]
  );

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">حالة المهام الحالية</h3>
            <p className="text-xs text-gray-500">
              نظرة سريعة على توزيع المهام حسب الحالة.
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
          >
            تحديث البيانات
          </button>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.counts.map((item) => (
            <div
              key={item.key}
              className="rounded border border-gray-200 bg-white p-3"
            >
              <p className="text-xs text-gray-500">{stateLabels[item.key]}</p>
              <p className="mt-2 text-2xl font-bold text-gray-800">{item.value}</p>
              <span
                className={`mt-2 inline-block rounded px-2 py-1 text-[11px] font-medium ${toneMap[item.key]}`}
              >
                {toneMap[item.key] ? stateLabels[item.key] : item.key}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">طلبات بحاجة إلى رد</p>
            <p className="mt-2 text-xl font-semibold text-purple-600">
              {stats.activeRequests}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">مرفقات مُرسلة مؤخراً</p>
            <p className="mt-2 text-xl font-semibold text-blue-600">
              {stats.totalAttachments}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">متوسط الإنجاز للتقارير الأخيرة</p>
            <p className="mt-2 text-xl font-semibold text-green-600">
              {stats.averageCompletion}%
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">إجمالي التقارير المسندة</p>
            <p className="mt-2 text-xl font-semibold text-gray-700">
              {stats.totalReports}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800">آخر التحديثات</h3>
          <p className="text-xs text-gray-500">
            أحدث الأنشطة التي قام بها أعضاء الفريق (آخر 6 أحداث).
          </p>
        </header>

        {latestEvents.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد تحديثات بعد.</p>
        ) : (
          <ul className="space-y-3 text-sm text-gray-700">
            {latestEvents.map((event) => (
              <li key={event.id} className="rounded border border-gray-100 bg-gray-50 p-3">
                <p className="font-semibold text-gray-800">{event.taskTitle}</p>
                <p className="text-xs text-gray-500">
                  {event.user} · {event.createdAt}
                </p>
                <span className="mt-2 inline-block rounded bg-gray-200 px-2 py-1 text-[10px] font-medium text-gray-600">
                  {event.type}
                </span>
              </li>
            ))}
          </ul>
        )}

        {returnedEvents.length > 0 && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800">
              مهام بانتظار استكمال المستخدمين:
            </p>
            <p className="text-xs text-amber-700">
              هناك {returnedEvents.length} مهمة تمت إعادتها للمستخدمين لاستكمال المتطلبات.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

