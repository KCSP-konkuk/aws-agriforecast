import { Link } from 'react-router-dom';

// 홈 첫 화면 — 무엇을 하는 곳인지 한 줄, 버튼 둘, 범위 한 줄. 숫자는 지표 목록에서 센다(못 받으면 숨긴다)
export default function HomeHero({ catalog }) {
  const retail = catalog.filter((c) => c.id.startsWith('retail:'));
  const since = retail
    .map((c) => c.firstDate?.slice(0, 4))
    .filter(Boolean)
    .sort()[0];
  const facts = [
    retail.length > 0 && `품목 ${new Set(retail.map((c) => c.item)).size}개`,
    catalog.length > 0 && `지표 ${catalog.length}개`,
    since && `${since}년부터`,
    catalog.length > 0 && '매일 갱신',
  ].filter(Boolean);

  return (
    <section className="pt-4">
      <h1 className="text-[32px] font-bold leading-[1.25] tracking-[-0.03em] text-text-main sm:text-[40px]">
        농산물 가격이 움직이는 이유를
        <br className="hidden sm:block" /> 겹쳐 보세요
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed text-subtext-light">KAMIS 시세 · 가락시장 반입량 · 날씨 · 환율을 한 화면에서</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/analysis" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover">
          작업대 열기
        </Link>
        <a href="#market" className="inline-flex h-11 items-center rounded-lg bg-background-light px-5 text-[15px] font-semibold text-text-main transition-colors hover:bg-border-light">
          오늘의 시장 보기
        </a>
      </div>
      {facts.length > 0 && (
        <p className="mt-5 text-sm tabular-nums text-subtext-light">
          {facts.map((f, i) => (
            <span key={f}>
              {i > 0 && <span className="mx-2 text-border-light">|</span>}
              {f}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
