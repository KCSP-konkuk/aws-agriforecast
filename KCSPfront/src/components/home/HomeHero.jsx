import { Link } from 'react-router-dom';
import Icon from '../Icon';

export default function HomeHero({ catalog }) {
  const retail = catalog.filter((c) => c.id.startsWith('retail:'));
  const since = retail.map((c) => c.firstDate?.slice(0, 4)).filter(Boolean).sort()[0];
  return (
    <section className="grid gap-10 border-b border-text-main pb-10 pt-8 sm:pb-12 sm:pt-12 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-20">
      <div>
        <p className="text-sm font-medium text-subtext-light">농산물 가격 · 수급 · 전망</p>
        <h1 className="mt-5 text-[42px] font-medium leading-[1.15] tracking-[-0.055em] sm:text-[64px] xl:text-[76px]">시장의 흐름을,<br />숫자의 근거까지.</h1>
        <Link to="/analysis" className="mt-8 inline-flex min-h-11 items-center gap-8 border-b border-text-main pb-2 text-[15px] font-medium hover:text-primary">데이터 직접 비교하기<Icon className="size-5" /></Link>
      </div>
      <div className="max-w-md lg:pb-1">
        <p className="text-[17px] leading-relaxed text-subtext-light">오늘의 시세는 얼마인지,<br />가격은 왜 움직이는지.<br />도매와 소매, 반입량과 날씨를 함께 봅니다.</p>
        {catalog.length > 0 && (
          <dl className="mt-8 flex gap-8 border-t border-border-light pt-5 sm:gap-10">
            <div><dt className="text-xs text-subtext-light">품목</dt><dd className="mt-1 text-2xl tabular-nums">{new Set(retail.map((c) => c.item)).size}<span className="ml-1 text-xs">개</span></dd></div>
            <div><dt className="text-xs text-subtext-light">데이터 지표</dt><dd className="mt-1 text-2xl tabular-nums">{catalog.length}<span className="ml-1 text-xs">개</span></dd></div>
            {since && <div><dt className="text-xs text-subtext-light">기록 시작</dt><dd className="mt-1 text-2xl tabular-nums">{since}<span className="ml-1 text-xs">년</span></dd></div>}
          </dl>
        )}
      </div>
    </section>
  );
}
