import { useMemo } from 'react';
import { rankItems, TEMPLATES } from './templates';

// 칩으로 보일 품목 수 — 지표가 많은 품목부터. 나머지는 고르기 상자에 가나다 순으로
const CHIPS = 5;

// 시작 템플릿 카드들 — 품목 칩을 누르면 onApply(템플릿, 품목). 품목은 지표 목록에서 찾는다
// 좁은 화면은 옆으로 넘기는 띠, 넓은 화면은 격자 (작업대 · 홈 공통)
export default function TemplateCards({ catalog, onApply }) {
  const list = useMemo(
    () =>
      TEMPLATES.map((t) => {
        const options = t.items(catalog);
        const chips = rankItems(catalog, options).slice(0, CHIPS);
        return { ...t, chips, rest: options.filter((item) => !chips.includes(item)) };
      }).filter((t) => t.chips.length),
    [catalog],
  );
  if (!list.length) return null;
  return (
    <ul className="grid gap-x-10 sm:grid-cols-2">
      {list.map((t) => (
        <li key={t.key} className="flex flex-col gap-2 border-b border-line py-3.5">
          <div>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[15px] font-semibold text-text-main">{t.title}</span>
              <span className="text-xs text-subtext-light">{t.who}</span>
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-subtext-light">{t.desc}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {t.chips.map((item) => (
              <button
                key={item ?? 'all'}
                type="button"
                onClick={() => onApply(t, item)}
                className="h-8 rounded-md bg-background-light px-2.5 text-[13px] font-medium text-text-main transition-colors hover:bg-primary-light hover:text-primary"
              >
                {item ?? '열기'}
              </button>
            ))}
            {t.rest.length > 0 && (
              <select
                aria-label={`${t.title} 다른 품목`}
                value=""
                onChange={(e) => e.target.value && onApply(t, e.target.value)}
                className="h-8 rounded-md border border-border-light bg-white px-2 text-[13px] text-subtext-light hover:border-subtext-light/50"
              >
                <option value="">+{t.rest.length}개 품목</option>
                {t.rest.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
