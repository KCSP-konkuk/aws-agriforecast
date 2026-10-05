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
