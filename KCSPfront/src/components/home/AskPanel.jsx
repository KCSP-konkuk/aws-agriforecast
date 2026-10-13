import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeChart from './HomeCharts';

// 홈 · 가격을 움직이는 것들 — 질문을 고르면 실제 데이터로 그린 차트와 답 한 문장. 누르면 작업대가 같은 설정으로 열린다.
// 질문 · 답 · 품목은 배치(home_highlights)가 매일 고른다(화면에 품목 이름 없음)
export default function AskPanel({ questions }) {
  const [active, setActive] = useState(questions[0]?.key);
  const tabs = useRef([]);
  const current = questions.find((q) => q.key === active) ?? questions[0];
  if (!current) return null;

  const move = (e, i) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    let j = null;
    if (step) j = (i + step + questions.length) % questions.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = questions.length - 1;
    if (j == null) return;
    e.preventDefault();
    setActive(questions[j].key);
    tabs.current[j]?.focus();
  };

  return (
    <section aria-labelledby="ask-title">
      <h2 id="ask-title" className="section-title">
        가격을 움직이는 것들
      </h2>
      <p className="mt-2 text-sm text-subtext-light">질문을 고르면 실제 데이터로 답을 보여드려요.</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(240px,30%)_minmax(0,1fr)] lg:gap-6">
        <div role="tablist" aria-label="질문 고르기" aria-orientation="vertical" className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
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
                className={`flex w-64 shrink-0 snap-start flex-col gap-0.5 rounded-none border-b border-line px-3 py-4 text-left transition-colors lg:w-auto ${
                  on ? 'bg-background-light' : 'bg-white hover:bg-background-light/60'
                }`}
              >
                <span className={`text-[15px] leading-snug ${on ? 'font-semibold text-text-main' : 'font-medium text-subtext-light'}`}>{q.question}</span>
                <span className="text-xs text-subtext-light">{q.who}</span>
              </button>
            );
          })}
        </div>
        <div id={`ask-panel-${current.key}`} role="tabpanel" aria-labelledby={`ask-tab-${current.key}`} className="min-w-0 border-t border-border-light bg-white px-1 pb-5 pt-5 sm:px-4">
          <HomeChart chart={current.chart} />
          <p className="mt-2 text-[17px] font-semibold leading-relaxed text-text-main">{current.answer}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px]">
            <span className="text-subtext-light">{current.meta}</span>
            <Link to={`/analysis?${current.link}`} className="font-semibold text-primary hover:underline">
              작업대에서 열기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
