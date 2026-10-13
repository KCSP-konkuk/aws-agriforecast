import { Link } from 'react-router-dom';

// 대시보드 카드 틀 — 제목·설명·본문. actions: 이 카드를 작업대에서 더 파 볼 수 있는 링크 [{ to, label }]
export default function DashboardCard({ title, subtitle, actions = [], children, className = '' }) {
  return (
    <section className={`border-t border-line pt-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-[-0.02em] text-text-main">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] text-subtext-light">{subtitle}</p>}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {actions.map((a) => (
              <Link key={a.to} to={a.to} className="text-[13px] font-semibold text-primary hover:underline">
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
