import { FREQ_LABEL } from '../../lib/series';
import { PERIODS } from './format';

const CHARTS = [
  ['line', '시계열', 'show_chart'],
  ['scatter', '산점도', 'scatter_plot'],
];

function Segmented({ label, options, value, onChange, disabled = () => false, disabledTitle }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-xs text-subtext-light">{label}</span>
      <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
        {options.map(([key, text, icon]) => {
          const off = disabled(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={value === key}
              disabled={off}
              title={off ? disabledTitle : undefined}
              onClick={() => onChange(key)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                value === key ? 'bg-primary text-white' : off ? 'text-gray-300 cursor-not-allowed' : 'text-text-main hover:bg-background-light'
              }`}
            >
              {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 차트 종류 · 주기 · 기간. 주기는 고른 지표 중 가장 거친 주기보다 촘촘하게는 못 고른다
export default function Controls({ chart, freq, allowed, period, from, to, bounds, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="차트" options={CHARTS} value={chart} onChange={(c) => onChange({ chart: c })} />
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="주기"
            options={Object.entries(FREQ_LABEL)}
            value={freq}
            disabled={(f) => !allowed.includes(f)}
            disabledTitle="고른 지표 중 가장 거친 주기보다 촘촘하게는 볼 수 없어요"
            onChange={(f) => onChange({ freq: f })}
          />
          <Segmented
            label="기간"
            options={PERIODS}
            value={period}
            onChange={(p) => onChange(p === 'custom' ? { period: p, from: from ?? bounds.from, to: to ?? bounds.to } : { period: p })}
          />
        </div>
      </div>
      {period === 'custom' && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-subtext-light">
          <input
            id="range-from"
            type="date"
            value={from ?? ''}
            min={bounds.min ?? undefined}
            max={to ?? bounds.max ?? undefined}
            onChange={(e) => onChange({ from: e.target.value || null })}
            className="rounded border border-gray-200 px-2 py-1 text-xs text-text-main"
            aria-label="시작일"
          />
          ~
          <input
            id="range-to"
            type="date"
            value={to ?? ''}
            min={from ?? bounds.min ?? undefined}
            max={bounds.max ?? undefined}
            onChange={(e) => onChange({ to: e.target.value || null })}
            className="rounded border border-gray-200 px-2 py-1 text-xs text-text-main"
            aria-label="종료일"
          />
        </div>
      )}
    </div>
  );
}
