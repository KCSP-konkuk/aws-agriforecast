import { useMemo } from 'react';
import { LAG_SCAN, lagCorrelation } from '../../lib/series';
import { colorOf, heatColor, lagLabel } from './format';

const MIN_N = 10; // 사례가 이보다 적은 칸은 비운다

// 시차 상관 — 다른 지표를 몇 칸 늦췄을 때 기준 지표와 가장 강하게 함께 움직였나.
// prepared 는 시차를 빼고(0) 변환·기간만 맞춘 값. 기준 지표는 base(고른 지표 순번)
export default function LagView({ lines, prepared, base, freq, conditioned, onBase }) {
  const lags = LAG_SCAN[freq];
  const baseLine = lines[base] ?? lines[0];
  const table = useMemo(() => {
    if (!baseLine) return [];
    return lines
      .filter((l) => l.id !== baseLine.id)
      .map((l) => {
        const cells = lagCorrelation(prepared[baseLine.id] ?? [], prepared[l.id] ?? [], lags, freq).map((c) =>
          c.n >= MIN_N ? c : { ...c, r: null },
        );
        const best = cells.reduce((a, c) => (c.r != null && (a == null || Math.abs(c.r) > Math.abs(a.r)) ? c : a), null);
        return { line: l, cells, best };
      });
  }, [lines, baseLine, prepared, lags, freq]);

  if (lines.length < 2) {
    return <p className="py-16 text-center text-sm text-subtext-light">시차 상관은 지표가 2개 이상 있어야 볼 수 있어요.</p>;
  }
  const levels = lines.some((l) => l.kind === 'raw' || l.kind === 'index' || l.kind === 'ma3');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-subtext-light" data-export="skip">
          기준 지표
          <select
            id="lag-base"
            value={lines.indexOf(baseLine)}
            onChange={(e) => onBase(Number(e.target.value))}
            className="max-w-[220px] rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-text-main"
          >
            {lines.map((l, i) => (
              <option key={l.id} value={i}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-subtext-light">칸마다 다른 지표를 그만큼 늦춘 값과 기준 지표의 상관이에요. 빨강은 같은 방향, 파랑은 반대 방향.</p>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[2px] text-[11px]" style={{ gridTemplateColumns: `minmax(110px,160px) repeat(${lags.length}, minmax(0,1fr))` }}>
          <div className="px-1 py-1 text-subtext-light">늦춘 만큼 →</div>
          {lags.map((k) => (
            <div key={k} className="py-1 text-center text-subtext-light">
              {k ? lagLabel(k, freq) : '0'}
            </div>
          ))}
          {table.map(({ line, cells, best }) => (
            <div key={line.id} className="contents">
              <div className="flex items-center gap-1 truncate px-1 text-text-main" title={line.name}>
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(line.color) }} />
                <span className="truncate">{line.name}</span>
              </div>
              {cells.map((c) => (
                <div
                  key={c.lag}
                  title={c.r == null ? `사례 ${c.n}개 — 너무 적어요` : `${lagLabel(c.lag, freq)} · r = ${c.r.toFixed(2)} · 사례 ${c.n}개`}
                  className={`flex h-8 items-center justify-center rounded-sm tabular-nums ${best && c.lag === best.lag ? 'ring-2 ring-text-main ring-inset' : ''} ${
                    c.r != null && Math.abs(c.r) > 0.6 ? 'text-white' : 'text-text-main'
                  }`}
                  style={{ background: heatColor(c.r, { min: -1, max: 1, diverging: true }) }}
                >
                  {c.r == null ? '' : c.r.toFixed(2)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <ul className="space-y-1 text-sm text-text-main">
        {table.map(({ line, best }) =>
          best ? (
            <li key={line.id}>
              <b>{line.name}</b> — {best.lag ? `${lagLabel(best.lag, freq)} 늦췄을 때` : '같은 칸에서'} 가장 강해요
              <span className="text-subtext-light">
                {' '}
                (r = {best.r.toFixed(2)}, 사례 {best.n.toLocaleString('ko-KR')}개)
              </span>
            </li>
          ) : (
            <li key={line.id} className="text-subtext-light">
              {line.name} — 기준 지표와 함께 있는 칸이 적어 계산하지 않았어요
            </li>
          ),
        )}
      </ul>
      <div className="space-y-0.5 text-xs text-subtext-light">
        {levels && <p>원값·지수·이동평균은 계절과 추세 때문에 상관이 부풀 수 있어요. 평년 대비나 전년 대비로 바꿔 보면 더 정확해요.</p>}
        {conditioned && <p>조건은 이 차트에 쓰지 않아요(시차를 보려면 이어진 칸이 필요해요).</p>}
        <p>함께 움직였다는 뜻일 뿐, 원인이라는 뜻은 아니에요. 테두리 칸이 지표마다 가장 강한 시차예요.</p>
      </div>
    </div>
  );
}
