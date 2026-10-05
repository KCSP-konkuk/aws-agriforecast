import { Link } from 'react-router-dom';

// 대시보드 카드 틀 — 제목·설명·본문. actions: 이 카드를 작업대에서 더 파 볼 수 있는 링크 [{ to, label }]
export default function DashboardCard({ icon, title, subtitle, actions = [], children, className = '' }) {
  return (
    <section className={`rounded-xl p-4 sm:p-5 bg-white border border-gray-200 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-text-main">
            {icon && <span className="material-symbols-outlined text-primary text-xl">{icon}</span>}
            {title}
          </h3>
          {subtitle && <p className="text-xs text-subtext-light mt-1">{subtitle}</p>}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-light"
              >
                <span className="material-symbols-outlined text-sm">construction</span>
                {a.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
