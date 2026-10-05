import { Link } from 'react-router-dom';
import WorkbenchPreview from './WorkbenchPreview';

// 홈 첫 화면 — 서비스 정체성 한 문장, 작업대 · 오늘의 요약 바로가기, 숫자 몇 개, 작업대 미리보기
// 숫자는 지표 목록에서 센다(목록을 못 받으면 숨긴다)
export default function HomeHero({ catalog }) {
  const retailSince = catalog
    .filter((c) => c.id.startsWith('retail:') && c.firstDate)
    .map((c) => c.firstDate.slice(0, 4))
    .sort()[0];
  const stats = [
    catalog.length > 0 && ['모은 지표', `${catalog.length}개`],
    catalog.length > 0 && ['분류', '가격·수급·기상·거시·관심도'],
    retailSince && ['KAMIS 일별 소매가', `${retailSince}년부터`],
  ].filter(Boolean);

  return (
    <section className="rounded-2xl border border-primary/15 bg-primary-light px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-primary">농산물 데이터 분석 작업대</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-[-0.033em] text-text-main sm:text-4xl lg:text-5xl">
            흩어진 농산물 데이터를
            <br />
            한곳에서
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-text-main/80">
            KAMIS 시세에 가락시장 경매가·반입량, 산지 날씨, 환율·물가·검색량까지. 날짜를 맞춰 겹쳐 보고, 관계를 찾고, 표로 가져가세요.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/analysis"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <span className="material-symbols-outlined text-lg">construction</span>
              분석 작업대 열기
            </Link>
            <Link
              to="/analysis/summary"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary"
            >
              <span className="material-symbols-outlined text-lg">summarize</span>
              오늘의 요약 보기
            </Link>
          </div>
          {stats.length > 0 && (
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-subtext-light">{label}</dt>
                  <dd className="text-lg font-bold text-text-main">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {catalog.length > 0 && <WorkbenchPreview catalog={catalog} />}
      </div>
    </section>
  );
}
