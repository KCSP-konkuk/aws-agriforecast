// 대시보드 카드 틀 — 제목·설명·본문
export default function DashboardCard({ icon, title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-xl p-4 sm:p-5 bg-white border border-gray-200 ${className}`}>
      <div className="mb-4">
        <h3 className="flex items-center gap-2 font-bold text-text-main">
          {icon && <span className="material-symbols-outlined text-primary text-xl">{icon}</span>}
          {title}
        </h3>
        {subtitle && <p className="text-xs text-subtext-light mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
