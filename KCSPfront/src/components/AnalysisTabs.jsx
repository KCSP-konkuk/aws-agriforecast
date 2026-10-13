import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/analysis', label: '작업대', end: true },
  { to: '/analysis/summary', label: '오늘의 요약' },
];

// 분석 메뉴의 하위 탭 — 작업대(직접 골라 분석) · 오늘의 요약(배치가 매일 계산한 품목별 인사이트)
export default function AnalysisTabs() {
  return (
    <nav className="inline-flex rounded-lg bg-background-light p-1" aria-label="분석 하위 메뉴">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `flex h-8 items-center rounded-md px-4 text-sm font-semibold transition-colors ${
              isActive ? 'bg-white text-text-main ring-1 ring-border-light' : 'text-subtext-light hover:text-text-main'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
