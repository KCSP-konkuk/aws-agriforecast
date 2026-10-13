import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeChart from './HomeCharts';

// 홈 · 이런 질문에 답해요 — 질문을 고르면 실제 데이터로 그린 차트와 답 한 문장. 누르면 작업대가 같은 설정으로 열린다.
// 질문 · 답 · 품목은 배치(home_highlights)가 매일 고른다(화면에 품목 이름 없음)
export default function AskPanel({ questions }) {
  const [active, setActive] = useState(questions[0]?.key);
  const tabs = useRef([]);
  const current = questions.find((q) => q.key === active) ?? questions[0];
  if (!current) return null;

  const move = (e, i) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let j = null;
    if (keys[e.key]) j = (i + keys[e.key] + questions.length) % questions.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = questions.length - 1;
    if (j == null) return;
    e.preventDefault();
    setActive(questions[j].key);
    tabs.current[j]?.focus();
  };

  return (
    <section aria-labelledby="ask-title" className="space-y-3">
      <h2 id="ask-title" className="text-lg font-bold text-text-main">
        이런 질문에 답해요
      </h2>
      <div className="grid gap-4 lg:grid-cols-[minmax(240px,30%)_minmax(0,1fr)]">
        <div role="tablist" aria-label="질문 고르기" aria-orientation="vertical" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {questions.map((q, i) => {
            const on = q.key === current.key;
            return (
              <button
                key={q.key}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`ask-tab-${q.key}`}
                aria-selected={on}
                aria-controls={`ask-panel-${q.key}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(q.key)}
                onKeyDown={(e) => move(e, i)}
                className={`flex w-64 shrink-0 snap-start flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 text-left transition lg:w-auto ${
                  on ? 'border-primary bg-primary text-white' : 'border-border-light bg-white text-text-main hover:border-primary/40'
                }`}
              >
                <span className="text-sm font-bold leading-snug break-keep">{q.question}</span>
                <span className={`text-[11px] font-semibold ${on ? 'text-white/75' : 'text-subtext-light'}`}>{q.who}</span>
              </button>
            );
          })}
        </div>
        <div id={`ask-panel-${current.key}`} role="tabpanel" aria-labelledby={`ask-tab-${current.key}`} className="min-w-0 space-y-2 rounded-xl border border-border-light bg-white p-4">
          <HomeChart chart={current.chart} />
          <p className="text-base font-bold leading-relaxed text-text-main break-keep">{current.answer}</p>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
            <span className="text-subtext-light">{current.meta}</span>
            <Link to={`/analysis?${current.link}`} className="font-bold text-primary hover:underline">
              작업대에서 열기 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
