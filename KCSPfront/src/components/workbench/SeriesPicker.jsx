import { useMemo, useState } from 'react';
import { FREQ_LABEL, MAX_SERIES, staleDays } from '../../lib/series';
import { coverage, todayIso } from './format';

const NATIVE = { daily: 'd', soon: 's', monthly: 'm' };

// 원본 갱신이 늦어진 지표 표시
export function StaleBadge({ days }) {
  return (
    <span className="shrink-0 rounded bg-accent/25 px-1 text-[10px] font-semibold text-text-main" title={`마지막 값이 ${days}일 전이에요 — 원본 갱신이 늦어지고 있어요`}>
      멈춤
    </span>
  );
}
const CATEGORY_ICON = { 가격: 'payments', 수급: 'local_shipping', 기상: 'partly_cloudy_day', 거시: 'currency_exchange', 관심도: 'search' };

// 데이터 고르기 — 분류·검색으로 지표를 찾고 눌러서 더한다 (목록은 API 에서)
export default function SeriesPicker({ catalog, selectedIds, onAdd }) {
  const today = todayIso();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({ 가격: true });
  const full = selectedIds.length >= MAX_SERIES;

  const groups = useMemo(() => {
    const q = query.trim();
    const hit = (c) => !q || [c.name, c.item, c.source, c.id].some((v) => v && v.includes(q));
    const out = new Map();
    for (const c of catalog) {
      if (!hit(c)) continue;
      if (!out.has(c.category)) out.set(c.category, []);
      out.get(c.category).push(c);
    }
    return [...out.entries()];
  }, [catalog, query]);

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-text-main">데이터 고르기</h3>
        <span className="text-xs text-subtext-light">{catalog.length}개 지표</span>
      </div>
      <label className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-primary">
        <span className="material-symbols-outlined text-lg text-subtext-light">search</span>
        <input
          id="series-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="품목·지표·출처 검색"
          className="w-full text-sm outline-none"
        />
      </label>
      {full && <p className="mt-2 text-xs text-subtext-light">한 번에 {MAX_SERIES}개까지 고를 수 있어요. 지표를 지우면 더 고를 수 있어요.</p>}
      <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {groups.length === 0 && <p className="text-sm text-subtext-light py-4 text-center">찾는 지표가 없어요.</p>}
        {groups.map(([category, list]) => {
          const isOpen = query.trim() !== '' || Boolean(open[category]);
          return (
            <div key={category} className="border-b border-gray-100 pb-2">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [category]: !o[category] }))}
                className="flex w-full items-center gap-2 py-1.5 text-sm font-semibold text-text-main"
                aria-expanded={isOpen}
              >
                <span className="material-symbols-outlined text-lg text-primary">{CATEGORY_ICON[category] ?? 'dataset'}</span>
                {category}
                <span className="text-xs font-normal text-subtext-light">{list.length}</span>
                <span className="material-symbols-outlined ml-auto text-lg text-subtext-light">{isOpen ? 'expand_less' : 'expand_more'}</span>
              </button>
              {isOpen && (
                <ul className="space-y-1">
                  {list.map((c) => {
                    const picked = selectedIds.includes(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          disabled={picked || full}
                          onClick={() => onAdd(c.id)}
                          className={`w-full rounded-lg px-2 py-1.5 text-left transition ${
                            picked ? 'bg-primary-light text-primary' : full ? 'opacity-50' : 'hover:bg-background-light'
                          }`}
                        >
                          <span className="flex items-center gap-1 text-sm text-text-main">
                            {c.name}
                            {picked && <span className="material-symbols-outlined text-base text-primary">check</span>}
                          </span>
                          <span className="block text-[11px] text-subtext-light truncate">{c.source}</span>
                          <span className="flex items-center gap-1 text-[11px] text-subtext-light">
                            <span className="truncate">
                              {FREQ_LABEL[NATIVE[c.freq]] ?? ''}별 · {coverage(c)} · {c.unit}
                            </span>
                            {staleDays(c, today) != null && <StaleBadge days={staleDays(c, today)} />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
