import { quantile } from '../../lib/series';
import { colorOf, nice, num } from './format';

// 숫자 칸 — 입력 중에는 건드리지 않고, 칸을 벗어나거나 Enter 일 때 반영(비우면 그쪽은 열림)
function Bound({ label, value, placeholder, onCommit }) {
  const commit = (e) => {
    const raw = e.target.value.trim();
    const v = raw === '' ? null : Number(raw);
    if (raw !== '' && !Number.isFinite(v)) return;
    if (v !== value) onCommit(v);
  };
  return (
    <input
      type="number"
      step="any"
      defaultValue={value ?? ''}
      placeholder={placeholder}
      aria-label={label}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-24 h-8 rounded-md border border-border-light bg-white px-2 text-[13px] text-text-main"
    />
  );
}

// 조건 걸기 — 지표별 범위(화면에 보이는 값 기준). 맞는 칸은 모든 차트에서 강조되고 표·CSV 는 그 칸만 남는다
export default function FilterBar({ lines, rows, conditions, match, onChange }) {
  const free = lines.filter((l) => !conditions.some((c) => c.id === l.id));
  const add = (id) => {
    // 처음 값은 상위 25% 경계 — 바로 효과가 보이게
    onChange([...conditions, { id, min: nice(quantile(rows.map((r) => r[id]), 0.75)), max: null }]);
  };
  const set = (id, patch) =>
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)).filter((c) => c.min != null || c.max != null));

  return (
    <div className="space-y-2 rounded-xl bg-background-light p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold text-text-main">조건 걸기</span>
        {match && (
          <span className="text-xs text-subtext-light">
            맞는 칸 {match.size.toLocaleString('ko-KR')}개 / {rows.length.toLocaleString('ko-KR')}개
          </span>
        )}
        {conditions.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-subtext-light hover:text-text-main hover:underline">
            모두 지우기
          </button>
        )}
        {free.length > 0 && (
          <select
            id="condition-add"
            aria-label="조건을 추가할 지표"
            value=""
            onChange={(e) => e.target.value && add(e.target.value)}
            className="ml-auto h-8 rounded-md border border-border-light bg-white px-2 text-[13px] text-text-main"
          >
            <option value="">+ 조건 추가</option>
            {free.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {conditions.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-subtext-light">
          원하는 값의 범위를 정하면 해당 시점만 강조해요. 표와 CSV에도 같은 조건이 적용돼요.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {conditions.map((c) => {
            const line = lines.find((l) => l.id === c.id);
            if (!line) return null;
            const values = rows.map((r) => r[c.id]).filter(Number.isFinite);
            const [lo, hi] = values.length ? [Math.min(...values), Math.max(...values)] : [null, null];
            return (
              <li key={`${c.id}|${c.min}|${c.max}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf(line.color) }} />
                <span className="text-text-main">{line.name}</span>
                <span className="text-xs text-subtext-light">{line.unitLabel}</span>
                <Bound label={`${line.name} 최소`} value={c.min} placeholder={lo == null ? '최소' : `최소 ${num(lo)}`} onCommit={(v) => set(c.id, { min: v })} />
                <span className="text-subtext-light">~</span>
                <Bound label={`${line.name} 최대`} value={c.max} placeholder={hi == null ? '최대' : `최대 ${num(hi)}`} onCommit={(v) => set(c.id, { max: v })} />
                <button
                  type="button"
                  onClick={() => onChange(conditions.filter((k) => k.id !== c.id))}
                  className="text-subtext-light hover:text-text-main"
                  aria-label={`${line.name} 조건 지우기`}
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
