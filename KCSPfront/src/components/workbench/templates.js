// 시작 템플릿 — 지표 목록에서 조건에 맞는 지표를 찾아 작업대 상태를 만든다.
// 품목 이름을 코드에 두지 않는다: 목록의 item(작업대 품목 묶음)으로 짝짓는다
const find = (catalog, prefix, item) => catalog.find((c) => c.id.startsWith(`${prefix}:`) && (item == null || c.item === item));
const uniq = (list) => [...new Set(list)];
const pick = (id, kind, color) => ({ id, kind, lag: 0, color });
const retailItems = (catalog) => uniq(catalog.filter((c) => c.id.startsWith('retail:')).map((c) => c.item));
const wholesaleOf = (catalog, item) => find(catalog, 'auction', item) ?? find(catalog, 'wholesale', item);

export const TEMPLATES = [
  {
    key: 'transmission',
    title: '도매가 → 소매가',
    who: '소매상',
    desc: '경매·도매가가 며칠 뒤 소매가로 넘어오는지 같은 출발점(100)에서 겹쳐 봐요',
    items: (catalog) => retailItems(catalog).filter((item) => wholesaleOf(catalog, item)),
    build: (catalog, item) => ({
      series: [pick(`retail:${item}`, 'index', 0), pick(wholesaleOf(catalog, item).id, 'index', 1)],
      freq: 'd',
      period: '1y',
      chart: 'line',
    }),
  },
  {
    key: 'lead',
    title: '몇 순 뒤에 반영되나',
    who: '소매상 · 도매상',
    desc: '경매·도매가와 반입량이 몇 순 앞서 소매가와 함께 움직였는지 시차별 상관으로 봐요',
    items: (catalog) => retailItems(catalog).filter((item) => wholesaleOf(catalog, item)),
    build: (catalog, item) => {
      const supply = find(catalog, 'supply', item);
      return {
        series: [
          pick(`retail:${item}`, 'normal', 0),
          pick(wholesaleOf(catalog, item).id, 'normal', 1),
          ...(supply ? [pick(supply.id, 'normal', 2)] : []),
        ],
        freq: 's',
        period: 'all',
        chart: 'lag',
        x: 1,
        y: 0,
      };
    },
  },
  {
    key: 'supply',
    title: '반입량과 경매가',
    who: '도매상',
    desc: '물량이 평년보다 적거나 많을 때 경매가가 어땠는지 점으로 봐요',
    items: (catalog) =>
      uniq(catalog.filter((c) => c.id.startsWith('auction:')).map((c) => c.item)).filter((item) => find(catalog, 'supply', item)),
    build: (catalog, item) => ({
      series: [pick(find(catalog, 'supply', item).id, 'normal', 0), pick(find(catalog, 'auction', item).id, 'normal', 1)],
      freq: 's',
      period: 'all',
      chart: 'scatter',
      x: 0,
      y: 1,
    }),
  },
  {
    key: 'weather',
    title: '날씨와 가격',
    who: '도매상 · KAMIS 직원',
    desc: '산지 기온·강수가 평년과 다를 때 소매가 흐름을 함께 봐요',
    items: (catalog) => (find(catalog, 'area_temp') ? retailItems(catalog) : []),
    build: (catalog, item) => ({
      series: [
        pick(`retail:${item}`, 'normal', 0),
        pick(find(catalog, 'area_temp').id, 'normal', 1),
        ...(find(catalog, 'area_rain') ? [pick(find(catalog, 'area_rain').id, 'normal', 2)] : []),
      ],
      freq: 's',
      period: '5y',
      chart: 'line',
    }),
  },
  {
    key: 'situation',
    title: '상황 공간 3D',
    who: '모두',
    desc: '반입량·산지 기온·소매가가 평년과 얼마나 달랐는지 한 공간에 찍어 비슷했던 상황을 찾아봐요',
    items: (catalog) => (find(catalog, 'area_temp') ? retailItems(catalog).filter((item) => find(catalog, 'supply', item)) : []),
    build: (catalog, item) => ({
      series: [
        pick(find(catalog, 'supply', item).id, 'normal', 0),
        pick(find(catalog, 'area_temp').id, 'normal', 1),
        pick(`retail:${item}`, 'normal', 2),
      ],
      freq: 's',
      period: 'all',
      chart: 'scatter3d',
      x: 0,
      y: 1,
      z: 2,
      cz: 'season',
    }),
  },
  {
    key: 'terrain',
    title: '가격 지형도',
    who: '모두',
    desc: '해마다 같은 시기의 소매가를 지형처럼 펼쳐 계절성과 유난했던 해를 봐요',
    items: retailItems,
    build: (catalog, item) => ({ series: [pick(`retail:${item}`, 'raw', 0)], freq: 's', period: 'all', chart: 'terrain', y: 0 }),
  },
  {
    key: 'forecast',
    title: '예측은 얼마나 맞았나',
    who: '모두',
    desc: 'AI 예측가와 실제 가격을 순마다 겹쳐 보고, 크게 틀린 때 무슨 일이 있었는지 찾아봐요',
    // 소매 예측(forecast:) · 도매 예측(forecast_w:)이 있는 품목 — 도매 예측 품목은 가락 이름을 소매 이름으로 묶어 둔다
    items: (catalog) => uniq(catalog.filter((c) => /^forecast(_w)?:/.test(c.id)).map((c) => c.item)),
    build: (catalog, item) => {
      const series = [];
      const retail = find(catalog, 'forecast', item);
      if (retail && find(catalog, 'retail', item)) series.push(pick(`retail:${item}`, 'raw', 0), pick(retail.id, 'raw', 1));
      const wholesale = find(catalog, 'forecast_w', item);
      const actual = wholesale && find(catalog, 'auction', item);
      if (actual) series.push(pick(actual.id, 'raw', series.length), pick(wholesale.id, 'raw', series.length + 1));
      return { series, freq: 's', period: '1y', chart: 'line' };
    },
  },
  {
    key: 'compare',
    title: '품목끼리 비교',
    who: 'KAMIS 직원',
    desc: '여러 품목 소매가를 같은 출발점(100)에서 비교해요',
    items: (catalog) => (retailItems(catalog).length > 1 ? [null] : []),
    build: (catalog) => ({
      series: catalog
        .filter((c) => c.id.startsWith('retail:'))
        .slice(0, 8)
        .map((c, i) => pick(c.id, 'index', i)),
      freq: 's',
      period: '3y',
      chart: 'line',
    }),
  },
];

// 첫 화면: 첫 템플릿의 첫 품목 (목록이 비면 null)
export function defaultState(catalog) {
  for (const t of TEMPLATES) {
    const items = t.items(catalog);
    if (items.length) return t.build(catalog, items[0]);
  }
  return null;
}
