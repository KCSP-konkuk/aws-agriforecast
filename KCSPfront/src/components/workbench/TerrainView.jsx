import { useMemo, useState } from 'react';
import { prepare, seasonGrid } from '../../lib/series';
import PlotlyChart, { sceneAxis } from './PlotlyChart';
import { heatColor, num, signed } from './format';

const SOON = ['상', '중', '하'];
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
const colLabel = (i, f) => (f === 'm' ? MONTHS[i] : `${MONTHS[Math.floor(i / 3)]} ${SOON[i % 3]}`);
const DIVERGING = [
  [0, '#337AB7'],
  [0.5, '#F1F5F9'],
  [1, '#D9534F'],
];
const SEQUENTIAL = [
  [0, '#F0F5F0'],
  [1, '#2C5E1A'],
];

// 가격 지형도 — 해(행) × 한 해 안 시기(열)에 값을 펼쳐 계절성과 유난했던 해를 본다.
// 기간과 상관없이 모든 해를 쓴다. 일·주 주기에서는 순으로 묶는다. 지수는 원값으로 본다(해마다 시작이 달라서)
export default function TerrainView({ lines, store, catById, base, freq, onBase }) {
  const [mode, setMode] = useState('3d');
  const line = lines[base] ?? lines[0];
  const entry = line ? catById[line.id] : null;
  const points = line ? store[line.id] : null;
  const f = freq === 'm' ? 'm' : 's';
  const kind = line?.kind === 'index' ? 'raw' : line?.kind;
  const diverging = kind === 'yoy' || kind === 'normal';
  const unit = diverging ? line.unitLabel : entry?.unit ?? '';

  const grid = useMemo(() => {
    if (!points || !entry) return null;
    return seasonGrid(prepare(points, { f, agg: entry.agg, unit: entry.unit, native: entry.freq, kind }), f);
  }, [points, entry, f, kind]);

  const stats = useMemo(() => {
    if (!grid?.years.length) return null;
    const values = grid.z.flat().filter(Number.isFinite);
    const [min, max] = [Math.min(...values), Math.max(...values)];
    // 열(시기)마다 해 평균 → 가장 높은·낮은 시기, 가장 크게 벗어난 칸
    const colMeans = Array.from({ length: grid.cols }, (_, c) => {
      const vs = grid.z.map((row) => row[c]).filter(Number.isFinite);
      return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
    });
    const valid = colMeans.map((v, c) => [v, c]).filter(([v]) => v != null);
    const peak = valid.reduce((a, b) => (b[0] > a[0] ? b : a));
    const trough = valid.reduce((a, b) => (b[0] < a[0] ? b : a));
    let extreme = null;
    grid.z.forEach((row, yi) =>
      row.forEach((v, c) => {
        if (Number.isFinite(v) && (!extreme || Math.abs(v) > Math.abs(extreme.v))) extreme = { v, year: grid.years[yi], c };
      }),
    );
    let last = null;
    grid.z.forEach((row, yi) => row.forEach((v, c) => Number.isFinite(v) && (last = { year: grid.years[yi], c })));
    return { min, max, peak: peak[1], trough: trough[1], extreme, last };
  }, [grid]);

  const plot = useMemo(() => {
    if (!grid || !stats || mode !== '3d') return null;
    const x = Array.from({ length: grid.cols }, (_, i) => i);
    const tickStep = f === 'm' ? 1 : 3;
    return {
      data: [
        {
          type: 'surface',
          x,
          y: grid.years,
          z: grid.z,
          customdata: grid.years.map(() => x.map((i) => colLabel(i, f))),
          hovertemplate: `%{y}년 %{customdata}<br>%{z:,.1f} ${unit}<extra></extra>`,
          colorscale: diverging ? DIVERGING : SEQUENTIAL,
          ...(diverging ? { cmid: 0 } : {}),
          colorbar: { title: { text: unit, font: { size: 11 } }, thickness: 12, len: 0.6 },
          contours: { z: { show: false } },
        },
      ],
      layout: {
        uirevision: `${line.id}|${f}|${kind}`,
        scene: {
          xaxis: sceneAxis('한 해 중 시기', { tickvals: x.filter((i) => i % tickStep === 0), ticktext: MONTHS }),
          yaxis: sceneAxis('연도', { dtick: 1 }),
          zaxis: sceneAxis(unit),
          aspectratio: { x: 2, y: 1.3, z: 0.7 },
          camera: { eye: { x: -1.1, y: -1.5, z: 0.85 } },
        },
      },
    };
  }, [grid, stats, mode, f, unit, diverging, line, kind]);

  if (!line) return <p className="py-16 text-center text-sm text-subtext-light">지형도로 볼 지표를 골라 주세요.</p>;

  const value = (v) => (diverging ? `${signed(v)}${unit.endsWith('℃') ? '℃' : unit.endsWith('mm') ? 'mm' : '%'}` : `${num(v)} ${unit}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-subtext-light">
          지표
          <select
            id="terrain-series"
            value={lines.indexOf(line)}
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
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="보기">
          {[
            ['3d', '3D'],
            ['flat', '평면'],
          ].map(([k, text]) => (
            <button
              key={k}
              type="button"
              aria-pressed={mode === k}
              onClick={() => setMode(k)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${mode === k ? 'bg-primary text-white' : 'text-text-main hover:bg-background-light'}`}
            >
              {text}
            </button>
          ))}
        </div>
        <span className="text-xs text-subtext-light">{unit}</span>
      </div>

      {!grid ? (
        <p className="py-16 text-center text-sm text-subtext-light">데이터를 불러오는 중이에요</p>
      ) : !stats ? (
        <p className="py-16 text-center text-sm text-subtext-light">
          {diverging ? '평년·전년과 비교할 만큼 쌓인 해가 아직 없어요. 원값으로 바꿔 보세요.' : '그릴 값이 없어요.'}
        </p>
      ) : mode === '3d' ? (
        <PlotlyChart data={plot.data} layout={plot.layout} height={480} label={`${line.name} 가격 지형도`} />
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[640px] gap-[2px] text-[10px]"
            style={{ gridTemplateColumns: `44px repeat(${grid.cols}, minmax(0,1fr))` }}
          >
            <div />
            {Array.from({ length: grid.cols }, (_, i) => (
              <div key={i} className="text-center text-subtext-light">
                {f === 'm' || i % 3 === 0 ? MONTHS[f === 'm' ? i : i / 3] : ''}
              </div>
            ))}
            {[...grid.years].reverse().map((year) => {
              const row = grid.z[grid.years.indexOf(year)];
              return (
                <div key={year} className="contents">
                  <div className="pr-1 text-right text-subtext-light">{year}</div>
                  {row.map((v, c) => (
                    <div
                      key={c}
                      title={`${year}년 ${colLabel(c, f)} · ${v == null ? '값 없음' : value(v)}`}
                      className={`h-5 rounded-sm ${stats.last.year === year && stats.last.c === c ? 'ring-2 ring-text-main ring-offset-1' : ''}`}
                      style={{ background: heatColor(v, { min: stats.min, max: stats.max, diverging }) }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats && (
        <div className="space-y-0.5 text-sm text-text-main">
          {diverging ? (
            <p>
              가장 크게 벗어난 때는 <b>{stats.extreme.year}년 {colLabel(stats.extreme.c, f)}</b>({value(stats.extreme.v)})예요.
            </p>
          ) : (
            <p>
              해마다 평균으로 보면 <b>{colLabel(stats.peak, f)}</b>에 가장 높고 <b>{colLabel(stats.trough, f)}</b>에 가장 낮아요.
            </p>
          )}
          <p className="text-xs text-subtext-light">
            {grid.years[0]}~{grid.years[grid.years.length - 1]}년, 기간 선택과 상관없이 모든 해를 보여요 · 조건은 이 차트에 쓰지 않아요
            {mode === 'flat' ? ' · 테두리 칸이 가장 최근' : ' · 끌어서 돌려 보세요'}
          </p>
        </div>
      )}
    </div>
  );
}
