import { FREQ_LABEL, quantile } from '../../lib/series';
import { colorOf, valueText } from './format';

// 조건 요약 — "조건에 맞는 순 n개, 그때 지표마다 중앙값(전체 중앙값)". 사례 수를 늘 함께 보여 준다
export default function ConditionSummary({ lines, rows, match, freq }) {
  const inside = rows.filter((r) => match.has(r.key));
  const median = (list, id) => quantile(list.map((r) => r[id]), 0.5);
  return (
    <div className="rounded-lg bg-background-light p-3">
      <p className="text-sm text-text-main">
        조건에 맞는 {FREQ_LABEL[freq]} <b>{match.size.toLocaleString('ko-KR')}개</b>
        <span className="text-subtext-light"> / 전체 {rows.length.toLocaleString('ko-KR')}개</span>
        {match.size > 0 && ' — 그때 지표마다 중앙값이에요(괄호는 전체 기간 중앙값).'}
      </p>
      {match.size > 0 && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {lines.map((l) => (
            <div key={l.id} className="rounded-md bg-white px-3 py-2">
              <p className="flex items-center gap-1 truncate text-[11px] text-subtext-light">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(l.color) }} />
                {l.name}
              </p>
              <p className="text-base font-bold text-text-main">{valueText(l, median(inside, l.id))}</p>
              <p className="text-[11px] text-subtext-light">전체 {valueText(l, median(rows, l.id))}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-subtext-light">
        {match.size > 0 && match.size < 10 ? '사례가 10개보다 적어 우연일 수 있어요. ' : ''}
        조건과 함께 나타났다는 뜻일 뿐, 원인이라는 뜻은 아니에요.
      </p>
    </div>
  );
}
