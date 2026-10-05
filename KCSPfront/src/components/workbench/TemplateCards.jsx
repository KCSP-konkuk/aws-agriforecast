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
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
      {list.map((t) => (
        <div key={t.key} className="flex w-64 shrink-0 snap-start flex-col rounded-lg border border-gray-100 bg-white p-3 sm:w-auto">
          <p className="text-sm font-semibold text-text-main">{t.title}</p>
          <p className="text-[11px] font-semibold text-primary">{t.who}</p>
          <p className="mt-1 flex-1 text-xs text-subtext-light">{t.desc}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {t.chips.map((item) => (
              <button
                key={item ?? 'all'}
                type="button"
                onClick={() => onApply(t, item)}
                className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-text-main hover:border-primary hover:text-primary"
              >
                {item ?? '열기'}
              </button>
            ))}
            {t.rest.length > 0 && (
              <select
                aria-label={`${t.title} 다른 품목`}
                value=""
                onChange={(e) => e.target.value && onApply(t, e.target.value)}
                className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-subtext-light hover:border-primary"
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
        </div>
      ))}
    </div>
  );
}
