import { useMemo } from 'react';

// 홈 · 데이터가 한곳에 모여요 — 지표 목록(catalog)을 분류별로 세고 출처를 묶어 보여 준다. 숫자는 목록에서 센다
const ORDER = ['가격', '수급', '기상', '거시', '관심도', '예측'];
const OUTPUTS = ['시계열', '산점도', '시차 상관', '지형도', '3D 산점도', '평행 좌표'];

// 출처 이름을 짧게: 'KAMIS 소매 · 서울 경동·복조리 평균' → 'KAMIS 소매', '기상청 ASOS 무안(165)' → '기상청 ASOS',
// 'AgriForecast 도매 예측(…)' → '도매 예측', '한국수출입은행 매매기준율' → '한국수출입은행'
const TWO_WORDS = ['KAMIS', '가락시장', '네이버', '기상청', '산지'];
function sourceName(source) {
  const words = source.split('(')[0].split(' · ')[0].trim().split(/\s+/);
  if (words[0] === 'AgriForecast') return words.slice(1, 3).join(' ');
  return TWO_WORDS.includes(words[0]) ? words.slice(0, 2).join(' ') : words[0];
}

export default function DataMap({ catalog }) {
  const groups = useMemo(() => {
    const by = new Map();
    for (const c of catalog) {
      const g = by.get(c.category) ?? { count: 0, sources: new Set() };
      g.count += 1;
      g.sources.add(sourceName(c.source));
      by.set(c.category, g);
    }
    return ORDER.filter((k) => by.has(k)).map((k) => {
      const names = [...by.get(k).sources];
      return { name: k === '예측' ? 'AI 예측' : k, count: by.get(k).count, from: names.slice(0, 3).join(' · ') + (names.length > 3 ? ' 외' : '') };
    });
  }, [catalog]);

  if (!groups.length) return null;
  return (
    <section aria-labelledby="map-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="map-title" className="text-lg font-bold text-text-main">
          데이터가 한곳에 모여요
        </h2>
        <span className="text-xs font-semibold text-subtext-light">출처 {groups.length}갈래 · 매일 갱신</span>
      </div>
      <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1.3fr)_32px_minmax(0,1fr)_32px_minmax(0,1fr)]">
        <ul className="grid gap-1.5">
          {groups.map((g) => (
            <li key={g.name} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2 rounded-lg border border-border-light bg-white px-3 py-1.5">
              <span className="row-span-2 text-right text-lg font-semibold tabular-nums text-primary">{g.count}</span>
              <span className="text-sm font-bold text-text-main">{g.name}</span>
              <span className="truncate text-[11px] text-subtext-light">{g.from}</span>
            </li>
          ))}
        </ul>
        <span aria-hidden="true" className="mx-auto h-5 w-0.5 bg-border-light md:h-0.5 md:w-full" />
        <div className="rounded-xl bg-primary px-4 py-5 text-center text-white">
          <p className="text-3xl font-semibold tabular-nums">{catalog.length}</p>
          <p className="mt-1 text-base font-bold">작업대 한 화면</p>
          <p className="mt-1 text-xs text-white/75 break-keep">날짜 · 주기 · 단위를 맞춰 겹쳐 보기</p>
        </div>
        <span aria-hidden="true" className="mx-auto h-5 w-0.5 bg-border-light md:h-0.5 md:w-full" />
        <ul className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
          {OUTPUTS.map((o) => (
            <li key={o} className="rounded-lg bg-primary-light px-3 py-1.5 text-sm font-bold text-primary">
              {o}
            </li>
          ))}
          <li className="col-span-2 rounded-lg border border-dashed border-primary/30 px-3 py-1.5 text-sm font-semibold text-primary md:col-span-1">표 · CSV · 링크 공유</li>
        </ul>
      </div>
    </section>
  );
}
