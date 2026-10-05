import { useMemo } from 'react';
import { FREQ_LABEL, seasonName } from '../../lib/series';
import PlotlyChart from './PlotlyChart';
import { keyLabel, MUTED, num, sceneAxis, SEASON_COLORS } from './format';

const YEAR_SCALE = [
  [0, 'rgb(191,216,176)'],
  [1, 'rgb(30,74,16)'],
];
const DIVERGING = [
  [0, '#337AB7'],
  [0.5, '#F1F5F9'],
  [1, '#D9534F'],
];
const SEQUENTIAL = [
  [0, '#F0F5F0'],
  [1, '#2C5E1A'],
];
const relative = (line) => line.kind === 'yoy' || line.kind === 'normal';

function marker3d(name, pts, marker) {
  return {
    type: 'scatter3d',
    mode: 'markers',
    name,
    x: pts.map((p) => p.x),
    y: pts.map((p) => p.y),
    z: pts.map((p) => p.z),
    text: pts.map((p) => p.text),
    hovertemplate: '%{text}<extra></extra>',
    marker: { size: 3.5, opacity: 0.9, ...marker },
  };
}

function Pick({ id, label, value, options, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-subtext-light">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[200px] rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-text-main"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

// 3D 산점도(상황 공간) — 지표 셋이 함께 만든 상황을 점 하나로. 색은 계절·연도·네 번째 지표
export default function Scatter3DView({ rows, lines, x, y, z, cz, freq, match, onAxes }) {
  const [xl, yl, zl] = [lines[x], lines[y], lines[z]];
  const colorLine = /^\d$/.test(cz) ? lines[Number(cz)] ?? null : null;
  const mode = cz === 'year' ? 'year' : colorLine ? 'line' : 'season'; // 없는 지표를 가리키면 계절로
  const ready = lines.length >= 3 && xl && yl && zl;

  const points = useMemo(() => {
    if (!ready) return [];
    return rows
      .filter((r) => [xl, yl, zl].every((l) => Number.isFinite(r[l.id])) && (!colorLine || Number.isFinite(r[colorLine.id])))
      .map((r) => ({
        key: r.key,
        x: r[xl.id],
        y: r[yl.id],
        z: r[zl.id],
        c: colorLine ? r[colorLine.id] : null,
        text: [
          `<b>${keyLabel(r.key, freq)}</b>`,
          ...[xl, yl, zl, ...(colorLine ? [colorLine] : [])].map((l) => `${l.name}: ${num(r[l.id])}`),
        ].join('<br>'),
      }));
  }, [ready, rows, xl, yl, zl, colorLine, freq]);

  const { data, layout } = useMemo(() => {
    const inside = match ? points.filter((p) => match.has(p.key)) : points;
    const outside = match ? points.filter((p) => !match.has(p.key)) : [];
    const traces = [];
    if (outside.length) traces.push(marker3d('조건 밖', outside, { color: MUTED, opacity: 0.35, size: 3 }));
    if (mode === 'season') {
      for (const season of Object.keys(SEASON_COLORS)) {
        const pts = inside.filter((p) => seasonName(p.key) === season);
        if (pts.length) traces.push(marker3d(season, pts, { color: SEASON_COLORS[season] }));
      }
    } else if (inside.length) {
      const byYear = mode === 'year';
      const diverging = !byYear && relative(colorLine);
      traces.push(
        marker3d(byYear ? '연도' : colorLine.name, inside, {
          color: byYear ? inside.map((p) => Number(p.key.slice(0, 4))) : inside.map((p) => p.c),
          colorscale: byYear ? YEAR_SCALE : diverging ? DIVERGING : SEQUENTIAL,
          ...(diverging ? { cmid: 0 } : {}),
          showscale: true,
          colorbar: { title: { text: byYear ? '연도' : colorLine.unitLabel, font: { size: 11 } }, thickness: 12, len: 0.6 },
        }),
      );
    }
    const latest = points[points.length - 1];
    if (latest) {
      traces.push(
        marker3d(`가장 최근 (${keyLabel(latest.key, freq)})`, [latest], {
          color: '#FFFFFF',
          size: 7,
          symbol: 'diamond',
          line: { color: '#333333', width: 2 },
        }),
      );
    }
    return {
      data: traces,
      layout: {
        uirevision: ready ? `${xl.id}|${yl.id}|${zl.id}` : 'none',
        showlegend: true,
        legend: { orientation: 'h', x: 0, y: 1.02, font: { size: 11 } },
        scene: {
          xaxis: sceneAxis(ready ? `${xl.name} (${xl.unitLabel})` : ''),
          yaxis: sceneAxis(ready ? `${yl.name} (${yl.unitLabel})` : ''),
          zaxis: sceneAxis(ready ? `${zl.name} (${zl.unitLabel})` : ''),
          aspectmode: 'cube',
          camera: { eye: { x: 1.2, y: 1.2, z: 0.75 } },
        },
      },
    };
  }, [points, match, mode, colorLine, freq, ready, xl, yl, zl]);

  if (lines.length < 3) {
    return <p className="py-16 text-center text-sm text-subtext-light">3D 산점도는 지표가 3개 이상 있어야 그릴 수 있어요.</p>;
  }

  const axisOptions = lines.map((l, i) => [String(i), `${l.name} · ${l.unitLabel}`]);
  const colorOptions = [['season', '계절'], ['year', '연도'], ...lines.map((l, i) => [String(i), l.name])];
  // 같은 지표를 두 축에 고르면 서로 바꾼다
  const setAxis = (axis, v) => {
    const next = { x, y, z };
    const other = Object.keys(next).find((k) => k !== axis && next[k] === v);
    if (other) next[other] = next[axis];
    next[axis] = v;
    onAxes(next);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3" data-export="skip">
        <Pick id="cube-x" label="X" value={String(x)} options={axisOptions} onChange={(v) => setAxis('x', Number(v))} />
        <Pick id="cube-y" label="Y" value={String(y)} options={axisOptions} onChange={(v) => setAxis('y', Number(v))} />
        <Pick id="cube-z" label="Z" value={String(z)} options={axisOptions} onChange={(v) => setAxis('z', Number(v))} />
        <Pick id="cube-color" label="색" value={mode === 'line' ? cz : mode} options={colorOptions} onChange={(v) => onAxes({ cz: v })} />
      </div>
      {points.length < 3 ? (
        <p className="py-16 text-center text-sm text-subtext-light">세 지표가 함께 있는 칸이 적어 점을 찍을 수 없어요.</p>
      ) : (
        <>
          <PlotlyChart data={data} layout={layout} height={520} label={`${xl.name}, ${yl.name}, ${zl.name} 3D 산점도`} />
          <p className="mt-2 text-xs text-subtext-light">
            점 {points.length.toLocaleString('ko-KR')}개({FREQ_LABEL[freq]}) · 끌어서 돌려 보세요(확대는 오른쪽 위 버튼) · 마름모가 가장 최근 칸 · 카메라 아이콘으로 PNG 저장
          </p>
        </>
      )}
    </div>
  );
}
