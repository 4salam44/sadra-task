import { useMemo } from "react";

const columns = [
  { key: "pending", title: "قيد الانتظار", tone: "border-gray-200 bg-gray-50" },
  { key: "in-progress", title: "قيد التنفيذ", tone: "border-blue-200 bg-blue-50" },
  { key: "returned", title: "مُعادة", tone: "border-amber-200 bg-amber-50" },
  { key: "completed", title: "مكتملة", tone: "border-green-200 bg-green-50" },
];

const stateLabels = {
  pending: "قيد الانتظار",
  "in-progress": "قيد التنفيذ",
  returned: "مُعادة",
  completed: "مكتملة",
  late: "متأخرة",
};

export default function KanbanBoard({ tasks = [], onOpenTimeline }) {
  const groupedTasks = useMemo(() => {
    const defaultState = columns.reduce((acc, col) => ({ ...acc, [col.key]: [] }), {});
    return tasks.reduce((acc, task) => {
      const key = columns.some((col) => col.key === task.status)
        ? task.status
        : "pending";
      acc[key] = acc[key] ? [...acc[key], task] : [task];
      return acc;
    }, defaultState);
  }, [tasks]);

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <section
            key={column.key}
            className={`flex h-full flex-col rounded-lg border ${column.tone} p-4`}
          >
            <header className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">{column.title}</h4>
              <span className="rounded bg-white px-2 py-0.5 text-xs text-gray-500 shadow">
                {groupedTasks[column.key]?.length || 0}
              </span>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {groupedTasks[column.key]?.length ? (
                groupedTasks[column.key].map((task) => (
                  <article
                    key={task._id}
                    className="rounded border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md"
                  >
                    <h5 className="text-sm font-semibold text-gray-800">{task.title}</h5>
                    <p className="text-xs text-gray-500">
                      المسؤول: {task.assignedTo?.fullName || "غير محدد"}
                    </p>
                    {task.dueDate && (
                      <p className="text-xs text-gray-500">
                        الموعد: {new Date(task.dueDate).toLocaleDateString("ar-SA")}
                      </p>
                    )}
                    {task.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-gray-600">
                        {task.description}
                      </p>
                    )}
                    {renderCollaborators(task)}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-600">
                        {stateLabels[task.status] ?? task.status}
                      </span>
                      <button
                        onClick={() => onOpenTimeline?.(task)}
                        className="rounded border border-blue-200 px-2 py-1 text-[10px] text-blue-600 hover:bg-blue-50"
                      >
                        عرض السجل
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-xs text-gray-400">لا توجد مهام في هذا العمود.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function renderCollaborators(task) {
  const primaryId = task.assignedTo?._id;
  const collaborators = Array.isArray(task.assignees)
    ? task.assignees.filter((member) => member._id !== primaryId)
    : [];

  if (!collaborators.length) {
    return null;
  }

  const names = collaborators
    .map((member) => member.fullName || member.username || 'عضو مجهول')
    .join('، ');
  return names ? (
    <p className="mt-1 text-[11px] text-gray-500">مشاركون آخرون: {names}</p>
  ) : null;
}

