import { useMemo } from 'react';

// 홈 · 모으는 데이터와 작업대에서 하는 것 — 지표 목록(catalog)을 분류별로 세고 출처를 묶는다. 숫자는 목록에서 센다
const ORDER = ['가격', '수급', '기상', '거시', '관심도', '예측'];
const TOOLS = [
  ['시계열', '주기 · 단위를 맞춰 겹쳐 보기'],
  ['산점도 · 3D 산점도', '두세 지표의 관계와 비슷했던 상황'],
  ['시차 상관', '몇 순 앞서 함께 움직였는지'],
  ['지형도', '해마다 같은 시기의 높낮이'],
  ['평행 좌표 · 조건', '조건에 맞는 때만 골라 보기'],
  ['표 · CSV · 링크', '그대로 가져가고 공유하기'],
];

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
    <section aria-labelledby="map-title" className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div>
        <h2 id="map-title" className="text-xl font-bold tracking-[-0.02em] text-text-main">
          모으는 데이터 <span className="tabular-nums text-primary">{catalog.length}</span>개
        </h2>
        <table className="mt-3 w-full text-[15px]">
          <tbody>
            {groups.map((g) => (
              <tr key={g.name} className="border-b border-line last:border-0">
                <th scope="row" className="w-20 py-3 text-left font-semibold text-text-main">
                  {g.name}
                </th>
                <td className="w-14 py-3 text-right font-semibold tabular-nums text-text-main">{g.count}</td>
                <td className="py-3 pl-4 text-sm text-subtext-light">{g.from}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-[-0.02em] text-text-main">작업대에서 하는 것</h2>
        <ul className="mt-3">
          {TOOLS.map(([name, what]) => (
            <li key={name} className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[15px] last:border-0">
              <span className="font-semibold text-text-main">{name}</span>
              <span className="text-right text-sm text-subtext-light">{what}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
