import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/analysis', label: '작업대', icon: 'construction', end: true },
  { to: '/analysis/summary', label: '오늘의 요약', icon: 'summarize' },
];

// 분석 메뉴의 하위 탭 — 작업대(직접 골라 분석) · 오늘의 요약(배치가 매일 계산한 품목별 인사이트)
export default function AnalysisTabs() {
  return (
    <nav className="flex gap-1 border-b border-gray-200" aria-label="분석 하위 메뉴">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              isActive ? 'border-primary text-primary' : 'border-transparent text-subtext-light hover:text-text-main'
            }`
          }
        >
          <span className="material-symbols-outlined text-lg">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
