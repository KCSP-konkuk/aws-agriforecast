import { diffUnit } from '../../lib/series';
import { colorOf, keyLabel, num, signed } from './format';

// 지표 하나의 기간 마지막 값을 변환에 맞는 말로
function phrase(line, series) {
  const [, last] = series[series.length - 1];
  const first = series[0][1];
  const tail = diffUnit(line.unit) ?? '%';
  if (line.kind === 'index') return [num(last), `시작보다 ${signed(last - 100)}%`];
  if (line.kind === 'yoy') return [`${signed(last)}${tail}`, '1년 전 같은 때보다'];
  if (line.kind === 'normal') return [`${signed(last)}${tail}`, '평년 같은 때보다'];
  return [`${num(last)} ${line.unit ?? ''}`, first ? `기간 처음보다 ${signed((last / first - 1) * 100)}%` : ''];
}

// 한 줄 해석 — 고른 지표마다 기간 마지막 칸의 값
export default function Readout({ lines, prepared, freq }) {
  const items = lines.filter((l) => prepared[l.id]?.length);
  if (!items.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((l) => {
        const series = prepared[l.id];
        const [value, note] = phrase(l, series);
        return (
          <div key={l.id} className="min-w-0">
            <dt className="flex items-center gap-1.5 truncate text-xs text-subtext-light">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(l.color) }} />
              {l.name} · {keyLabel(series[series.length - 1][0], freq)}
            </dt>
            <dd className="text-base font-bold text-text-main">{value}</dd>
            {note && <dd className="text-xs text-subtext-light">{note}</dd>}
          </div>
        );
      })}
    </dl>
  );
}
