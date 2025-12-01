export default function DashboardLayout({
  title,
  description,
  lastUpdated,
  onRefresh,
  modules = [],
  moduleState = {},
  onToggleModule,
  onResetModules,
  refreshing = false,
  children,
}) {
  const enabledModules = modules.filter(
    (module) => moduleState[module.id] !== false && module.element
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-64">
        <div className="rounded-2xl border border-brand-muted/60 bg-white/90 p-6 shadow-subtle backdrop-blur">
          <h2 className="font-display text-base font-semibold text-brand-ink">
            تخصيص العرض
          </h2>
          <p className="mt-1 text-xs text-brand-ink/60">
            اختر البطاقات التي ترغب في ظهورها ضمن لوحة التحكم.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-brand-ink/80">
            {modules.map((module) => (
              <li
                key={module.id}
                className="flex items-start gap-2 rounded-xl border border-transparent px-3 py-2 transition hover:border-brand-muted/80 hover:bg-brand-soft/60"
              >
                <input
                  id={`toggle-${module.id}`}
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-brand-muted text-brand-primary focus:ring-brand-primary"
                  checked={moduleState[module.id] !== false}
                  onChange={() => onToggleModule?.(module.id)}
                />
                <label
                  htmlFor={`toggle-${module.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <p className="font-medium text-brand-ink">{module.title}</p>
                  {module.description ? (
                    <p className="text-xs text-brand-ink/60">{module.description}</p>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <button
              onClick={onResetModules}
              className="rounded-full border border-brand-muted/70 px-4 py-1.5 text-brand-ink transition hover:bg-brand-soft"
            >
              إعادة الافتراضي
            </button>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="rounded-full bg-brand-primary px-4 py-1.5 text-white shadow-soft transition hover:bg-brand-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? "جاري التحديث..." : "تحديث البيانات"}
              </button>
            )}
          </div>
        </div>
      </aside>

      <section className="flex-1 space-y-6">
        <header className="rounded-2xl border border-brand-muted/60 bg-white/95 px-6 py-5 shadow-soft backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-brand-ink">
                {title}
              </h1>
              {description ? (
                <p className="text-sm text-brand-ink/60">{description}</p>
              ) : null}
            </div>
            <div className="text-right text-xs text-brand-ink/60">
              {lastUpdated ? (
                <>
                  <p>آخر تحديث</p>
                  <p className="font-medium text-brand-ink">
                    {lastUpdated.toLocaleString("ar-SA")}
                  </p>
                </>
              ) : (
                <p>لم يتم التحديث بعد</p>
              )}
            </div>
          </div>
        </header>

        <div className="grid auto-rows-min gap-4 md:grid-cols-2">
          {enabledModules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-muted bg-white/70 p-8 text-center text-sm text-brand-ink/60 md:col-span-2">
              لا توجد وحدات فعّالة. قم بتفعيل بعض العناصر من القائمة الجانبية.
            </div>
          ) : (
            enabledModules.map((module) => (
              <section
                key={module.id}
                className={`rounded-2xl border border-brand-muted/70 bg-white/95 p-5 shadow-subtle backdrop-blur ${
                  module.size === "full" ? "md:col-span-2" : ""
                }`}
              >
                {module.element}
              </section>
            ))
          )}
        </div>
        {children}
      </section>
    </div>
  );
}

