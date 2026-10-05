import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FREQ_LABEL } from '../../lib/series';
import { MUTED, nice, num, yearColor } from './format';

const H = 380;
const PAD = { top: 52, bottom: 30, side: 44 };
const BOTTOM = H - PAD.bottom;

function useWidth(ref) {
  const [width, setWidth] = useState(800);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

// 선 수천 개는 끌기(브러시) 중에 다시 그리지 않는다
const Lines = memo(function Lines({ paths }) {
  return (
    <g fill="none">
      {paths.map((p) => (
        <path key={p.key} d={p.d} stroke={p.color} strokeWidth={p.on ? 1.2 : 1} strokeOpacity={p.on ? 0.7 : 0.35} />
      ))}
    </g>
  );
});

// 평행 좌표(이종 변수 탐색기) — 고른 지표마다 세로축 하나, 칸 하나가 선 하나.
// 축을 위아래로 끌면 그 범위가 조건이 되고(모든 차트·표에 함께 적용), 축을 한 번 누르면 그 축 조건을 지운다
export default function ParallelView({ rows, lines, conditions, match, freq, onCondition }) {
  const box = useRef(null);
  const width = useWidth(box);
  const [drag, setDrag] = useState(null); // { i, y0, y1 }

  const complete = useMemo(() => rows.filter((r) => lines.every((l) => Number.isFinite(r[l.id]))), [rows, lines]);
  const dims = useMemo(
    () =>
      lines.map((l) => {
        const vals = complete.map((r) => r[l.id]);
        let [lo, hi] = [Math.min(...vals), Math.max(...vals)];
        if (!(hi > lo)) [lo, hi] = [lo - 1, hi + 1];
        return { line: l, lo, hi };
      }),
    [lines, complete],
  );
  const step = lines.length > 1 ? (width - PAD.side * 2) / (lines.length - 1) : 0;
  const xOf = (i) => PAD.side + i * step;
  const yOf = (i, v) => PAD.top + (1 - (v - dims[i].lo) / (dims[i].hi - dims[i].lo)) * (BOTTOM - PAD.top);
  const vOf = (i, py) => dims[i].lo + (1 - (py - PAD.top) / (BOTTOM - PAD.top)) * (dims[i].hi - dims[i].lo);

  const paths = useMemo(() => {
    if (lines.length < 2 || !complete.length) return [];
    const years = complete.map((r) => Number(r.key.slice(0, 4)));
    const [y0, y1] = [Math.min(...years), Math.max(...years)];
    const out = complete.map((r, n) => {
      const on = !match || match.has(r.key);
      const d = dims.map((dim, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(i, r[dim.line.id]).toFixed(1)}`).join('');
      return { key: r.key, d, on, color: on ? yearColor(years[n], y0, y1) : MUTED };
    });
    return [...out.filter((p) => !p.on), ...out.filter((p) => p.on)]; // 조건에 맞는 선을 위에
    // xOf·yOf 는 width·dims 로 정해진다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, dims, match, width, lines.length]);

  // 폭을 재는 상자는 늘 그려 둔다(안내 문구일 때도) — 데이터가 생긴 뒤에도 폭을 따라가게
  if (lines.length < 2 || complete.length < 3) {
    return (
      <div ref={box}>
        <p className="py-16 text-center text-sm text-subtext-light">
          {lines.length < 2 ? '평행 좌표는 지표가 2개 이상 있어야 그릴 수 있어요.' : '모든 지표가 함께 있는 칸이 적어요. 기간을 넓히거나 지표를 줄여 보세요.'}
        </p>
      </div>
    );
  }

  const clampY = (py) => Math.min(Math.max(py, PAD.top), BOTTOM);
  const pointerY = (e) => clampY(e.clientY - e.currentTarget.ownerSVGElement.getBoundingClientRect().top);
  const start = (e, i) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const py = pointerY(e);
    setDrag({ i, y0: py, y1: py });
  };
  const move = (e) => drag && setDrag({ ...drag, y1: pointerY(e) });
  const end = () => {
    if (!drag) return;
    const { i, y0, y1 } = drag;
    setDrag(null);
    const id = dims[i].line.id;
    if (Math.abs(y1 - y0) < 4) return onCondition(id, null); // 누르기만 하면 지운다
    const [top, bottom] = [Math.min(y0, y1), Math.max(y0, y1)];
    // 축 끝까지 끌었으면 그쪽은 열어 둔다
    onCondition(id, { min: bottom >= BOTTOM - 2 ? null : nice(vOf(i, bottom)), max: top <= PAD.top + 2 ? null : nice(vOf(i, top)) });
  };
  const maxChars = Math.max(4, Math.floor(step / 12));
  const cut = (text) => (text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text);

  return (
    <div ref={box}>
      <svg width={width} height={H} className="select-none" role="img" aria-label={`평행 좌표: ${lines.map((l) => l.name).join(', ')}`}>
        <Lines paths={paths} />
        {dims.map((dim, i) => {
          const x = xOf(i);
          const c = conditions.find((k) => k.id === dim.line.id);
          const live = drag?.i === i ? [Math.min(drag.y0, drag.y1), Math.max(drag.y0, drag.y1)] : null;
          const band = live ?? (c ? [c.max == null ? PAD.top : clampY(yOf(i, c.max)), c.min == null ? BOTTOM : clampY(yOf(i, c.min))] : null);
          return (
            <g key={dim.line.id}>
              <text x={x} y={16} textAnchor="middle" className="fill-text-main text-[11px] font-semibold">
                {cut(dim.line.name)}
              </text>
              <text x={x} y={30} textAnchor="middle" className="fill-subtext-light text-[10px]">
                {cut(dim.line.unitLabel)}
              </text>
              <line x1={x} x2={x} y1={PAD.top} y2={BOTTOM} stroke="#64748B" strokeWidth={1} />
              <text x={x} y={PAD.top - 6} textAnchor="middle" className="fill-subtext-light text-[10px]">
                {num(dim.hi)}
              </text>
              <text x={x} y={BOTTOM + 16} textAnchor="middle" className="fill-subtext-light text-[10px]">
                {num(dim.lo)}
              </text>
              {band && (
                <rect x={x - 7} y={band[0]} width={14} height={Math.max(2, band[1] - band[0])} rx={3} fill="#2C5E1A" fillOpacity={0.22} stroke="#2C5E1A" />
              )}
              <rect
                x={x - 16}
                y={PAD.top}
                width={32}
                height={BOTTOM - PAD.top}
                fill="transparent"
                className="cursor-ns-resize"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => start(e, i)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={() => setDrag(null)}
              />
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-subtext-light" data-export="skip">
        선 {complete.length.toLocaleString('ko-KR')}개({FREQ_LABEL[freq]}, 모든 지표가 있는 칸) · 색은 연도(옅을수록 예전) · 축을 위아래로 끌면 조건, 한 번 누르면 그 축 조건을 지워요
      </p>
    </div>
  );
}
