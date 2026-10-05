import { MAX_SERIES, staleDays, TRANSFORMS } from '../../lib/series';
import { colorOf, LAG_OPTIONS, lagLabel, todayIso } from './format';
import { StaleBadge } from './SeriesPicker';

// 고른 지표 — 색, 변환, 시차, 지우기
export default function SelectedSeries({ series, catById, freq, onChange, onRemove }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-text-main">고른 지표</h3>
        <span className="text-xs text-subtext-light">
          {series.length}/{MAX_SERIES}
        </span>
      </div>
      {series.length === 0 ? (
        <p className="mt-3 text-sm text-subtext-light">아래 목록에서 지표를 눌러 더하세요.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {series.map((s) => {
            const c = catById[s.id];
            return (
              <li key={s.id} className="rounded-lg border border-gray-100 p-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(s.color) }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-main">{c?.name ?? s.id}</p>
                    <p className="text-[11px] text-subtext-light truncate">{c ? `${c.source} · ${c.unit ?? ''}` : '목록에 없는 지표'}</p>
                    {c?.lastDate && (
                      <p className="flex items-center gap-1 text-[11px] text-subtext-light">
                        마지막 값 {c.lastDate.slice(2).replaceAll('-', '.')}
                        {staleDays(c, todayIso()) != null && <StaleBadge days={staleDays(c, todayIso())} />}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(s.id)}
                    className="text-subtext-light hover:text-text-main"
                    aria-label={`${c?.name ?? s.id} 지우기`}
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-subtext-light">
                    변환
                    <select
                      id={`kind-${s.id}`}
                      value={s.kind}
                      onChange={(e) => onChange(s.id, { kind: e.target.value })}
                      className="mt-0.5 w-full rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-text-main"
                    >
                      {Object.entries(TRANSFORMS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-subtext-light">
                    시차 (늦춰 보기)
                    <select
                      id={`lag-${s.id}`}
                      value={s.lag}
                      onChange={(e) => onChange(s.id, { lag: Number(e.target.value) })}
                      className="mt-0.5 w-full rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-text-main"
                    >
                      {[...new Set([...LAG_OPTIONS[freq], s.lag])].sort((a, b) => a - b).map((v) => (
                        <option key={v} value={v}>
                          {lagLabel(v, freq)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
