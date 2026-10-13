import { Link } from 'react-router-dom';

// 홈 첫 화면 — 무엇을 하는 곳인지 한 줄, 버튼 둘, 범위 칩. 칩 숫자는 지표 목록에서 센다(못 받으면 숨긴다)
export default function HomeHero({ catalog }) {
  const retail = catalog.filter((c) => c.id.startsWith('retail:'));
  const since = retail
    .map((c) => c.firstDate?.slice(0, 4))
    .filter(Boolean)
    .sort()[0];
  const chips = [
    retail.length > 0 && `품목 ${new Set(retail.map((c) => c.item)).size}개`,
    catalog.length > 0 && `지표 ${catalog.length}개`,
    since && `${since}년부터`,
    catalog.length > 0 && '매일 갱신',
  ].filter(Boolean);

  return (
    <section className="space-y-3 pt-2">
      <p className="text-sm font-bold text-primary">농산물 데이터 분석 작업대</p>
      <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.025em] text-text-main break-keep sm:text-4xl lg:text-[2.6rem]">
        농산물 가격이 움직이는 이유를
        <br className="hidden sm:block" /> 겹쳐 보세요
      </h1>
      <p className="text-base text-subtext-light break-keep">KAMIS 시세 · 가락시장 반입량 · 날씨 · 환율을 한 화면에서</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <Link to="/analysis" className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-bold text-white hover:bg-primary-hover">
          작업대 열기
        </Link>
        <a href="#market" className="inline-flex h-10 items-center rounded-lg border border-primary/30 bg-white px-5 text-sm font-bold text-primary hover:border-primary">
          오늘의 시장
        </a>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li key={c} className="rounded-full border border-border-light bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-subtext-light">
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
