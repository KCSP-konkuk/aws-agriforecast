import { FREQ_LABEL } from '../../lib/series';
import { CHARTS, PERIODS } from './format';

function Segmented({ label, options, value, onChange, disabled = () => false, disabledTitle }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <span className="shrink-0 whitespace-nowrap text-[13px] text-subtext-light">{label}</span>
      <div className="flex flex-wrap rounded-lg bg-background-light p-0.5">
        {options.map(([key, text]) => {
          const off = disabled(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={value === key}
              disabled={off}
              title={off ? disabledTitle : undefined}
              onClick={() => onChange(key)}
              className={`flex h-7 items-center rounded-md px-2.5 text-[13px] transition-colors ${
                value === key
                  ? 'bg-white font-semibold text-text-main ring-1 ring-border-light'
                  : off
                    ? 'cursor-not-allowed text-subtext-light/40'
                    : 'font-medium text-subtext-light hover:text-text-main'
              }`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 차트 종류 · 주기 · 기간. 주기는 고른 지표 중 가장 거친 주기보다 촘촘하게는 못 고른다
export default function Controls({ chart, freq, allowed, period, from, to, bounds, onChange, onExport, exporting, onSave }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Segmented label="차트" options={CHARTS} value={chart} onChange={(c) => onChange({ chart: c })} />
        <div className="flex flex-wrap gap-1.5">
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="flex h-8 items-center rounded-lg bg-background-light px-3 text-[13px] font-semibold text-text-main hover:bg-border-light"
            title="지금 화면을 이름·메모와 함께 내 분석에 저장해요(로그인)"
          >
            분석 저장
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="flex h-8 items-center rounded-lg bg-background-light px-3 text-[13px] font-semibold text-text-main hover:bg-border-light disabled:opacity-60"
            title="지금 차트를 제목·출처와 함께 PNG 로 저장해요"
          >
            {exporting ? '저장 중…' : '이미지 저장'}
          </button>
        )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
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
            className="h-8 rounded-md border border-border-light bg-white px-2 text-[13px] text-text-main"
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
            className="h-8 rounded-md border border-border-light bg-white px-2 text-[13px] text-text-main"
            aria-label="종료일"
          />
        </div>
      )}
    </div>
  );
}
