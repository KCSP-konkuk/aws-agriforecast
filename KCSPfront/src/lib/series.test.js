import { describe, expect, it } from 'vitest';
import {
  align,
  allowedFreqs,
  bucketOf,
  convertLag,
  diffUnit,
  displayUnit,
  dropPartial,
  freeColor,
  keyOfStep,
  pearson,
  periodStart,
  prepare,
  rangeOf,
  readState,
  resample,
  shift,
  stepOf,
  toCsv,
  transform,
  writeState,
} from './series';

describe('주기 칸', () => {
  it('일·주·순·월 대표 날짜', () => {
    expect(bucketOf('2026-10-04', 'd')).toBe('2026-10-04');
    expect(bucketOf('2026-10-04', 'w')).toBe('2026-09-28'); // 일요일 → 그 주 월요일
    expect(bucketOf('2026-10-04', 's')).toBe('2026-10-01');
    expect(bucketOf('2026-10-15', 's')).toBe('2026-10-11');
    expect(bucketOf('2026-10-31', 's')).toBe('2026-10-21');
    expect(bucketOf('2026-10-31', 'm')).toBe('2026-10-01');
  });

  it('순번과 칸이 왕복한다', () => {
    for (const f of ['d', 'w', 's', 'm']) {
      for (const iso of ['2014-01-01', '2026-10-04', '2026-12-31']) {
        const key = bucketOf(iso, f);
        expect(keyOfStep(stepOf(key, f), f)).toBe(key);
      }
    }
    expect(keyOfStep(stepOf('2026-12-21', 's') + 1, 's')).toBe('2027-01-01');
  });

  it('가장 거친 원래 주기보다 촘촘하게는 못 고른다', () => {
    expect(allowedFreqs([{ freq: 'daily' }])).toEqual(['d', 'w', 's', 'm']);
    expect(allowedFreqs([{ freq: 'daily' }, { freq: 'soon' }])).toEqual(['s', 'm']);
    expect(allowedFreqs([{ freq: 'monthly' }, { freq: 'daily' }])).toEqual(['m']);
  });
});

describe('주기 맞추기·변환', () => {
  it('평균과 합계로 모은다', () => {
    const pts = [['2026-10-01', 10], ['2026-10-02', 20], ['2026-10-12', 5], ['2026-10-13', null]];
    expect(resample(pts, 's', 'mean')).toEqual([['2026-10-01', 15], ['2026-10-11', 5]]);
    expect(resample(pts, 'm', 'sum')).toEqual([['2026-10-01', 35]]);
  });

  it('합계 지표는 덜 찬 마지막 칸을 뺀다', () => {
    const daily = [['2026-09-29', 5], ['2026-09-30', 5], ['2026-10-01', 1], ['2026-10-02', 1]];
    const soon = resample(daily, 's', 'sum');
    expect(dropPartial(soon, daily, 's', 'sum', 'daily')).toEqual([['2026-09-21', 10]]);
    expect(dropPartial(soon, daily, 's', 'mean', 'daily')).toHaveLength(2);
    // 순 지표(값은 순 첫날): 하순까지 있으면 그 달은 찬 것
    const bySoon = [['2026-08-21', 3], ['2026-09-01', 1], ['2026-09-11', 1]];
    expect(dropPartial(resample(bySoon, 'm', 'sum'), bySoon, 'm', 'sum', 'soon')).toEqual([['2026-08-01', 3]]);
    const full = [...bySoon, ['2026-09-21', 1]];
    expect(dropPartial(resample(full, 'm', 'sum'), full, 'm', 'sum', 'soon')).toEqual([['2026-08-01', 3], ['2026-09-01', 3]]);
    expect(dropPartial(soon, daily, 's', 'sum', 'soon')).toBe(soon);
  });

  it('전년 대비는 1년 전 같은 칸과 비교한다', () => {
    const s = [['2025-03-01', 100], ['2026-03-01', 120]];
    const out = transform(s, 'yoy', 'm', '원');
    expect(out[0][1]).toBeNull();
    expect(out[1][1]).toBeCloseTo(20);
  });

  it('일별 전년 대비는 1년 전이 비면 가까운 날을 쓴다', () => {
    const s = [['2025-10-03', 100], ['2026-10-04', 110]]; // 2025-10-04 는 없음 → 하루 전
    expect(transform(s, 'yoy', 'd', '원')[1][1]).toBeCloseTo(10);
  });

  it('평년 대비는 지난 5년 같은 시기 평균(3년 이상), 기온은 차이', () => {
    const s = [2021, 2022, 2023, 2024, 2025].map((y) => [`${y}-07-01`, 100]).concat([['2026-07-01', 130]]);
    expect(transform(s, 'normal', 's', '원').at(-1)[1]).toBeCloseTo(30);
    expect(transform(s, 'normal', 's', '℃').at(-1)[1]).toBeCloseTo(30); // 130 - 100
    const short = [['2024-07-01', 100], ['2025-07-01', 100], ['2026-07-01', 130]];
    expect(transform(short, 'normal', 's', '원').at(-1)[1]).toBeNull();
  });

  it('강수는 평년이 0 에 가까워도 튀지 않게 차이(mm)로', () => {
    const rain = [2020, 2021, 2022, 2023].map((y) => [`${y}-02-01`, y === 2023 ? 60 : 2]);
    expect(transform(rain, 'normal', 's', 'mm (순 합계)')[3]).toEqual(['2023-02-01', 58]);
    expect(diffUnit('원/1kg')).toBeNull();
    expect(displayUnit('normal', 'mm (순 합계)')).toBe('평년 대비 mm');
    expect(displayUnit('yoy', '℃ (순 평균)')).toBe('전년 대비 ℃');
    expect(displayUnit('normal', '톤')).toBe('평년 대비 %');
  });

  it('이동평균은 칸이 이어질 때만', () => {
    const s = [['2026-01-01', 1], ['2026-01-11', 2], ['2026-01-21', 3], ['2026-03-01', 9]];
    expect(transform(s, 'ma3', 's', '원').map(([, v]) => v)).toEqual([null, null, 2, null]);
  });

  it('주기를 바꾸면 시차를 비슷한 날 수로 옮긴다', () => {
    expect(convertLag(14, 'd', 's')).toBe(1);
    expect(convertLag(-30, 'd', 'm')).toBe(-1);
    expect(convertLag(2, 's', 'd')).toBe(20);
    expect(convertLag(0, 'd', 'm')).toBe(0);
  });

  it('시차 +n 은 n칸 늦춰 그린다', () => {
    expect(shift([['2026-10-01', 5]], 2, 's')).toEqual([['2026-10-21', 5]]);
    expect(shift([['2026-10-01', 5]], -1, 'm')).toEqual([['2026-09-01', 5]]);
  });

  it('지수는 기간 안 첫 값을 100 으로', () => {
    const pts = [['2026-01-05', 200], ['2026-02-05', 250], ['2026-03-05', 300]];
    const out = prepare(pts, { f: 'm', agg: 'mean', kind: 'index', from: '2026-02-01' });
    expect(out).toEqual([['2026-02-01', 100], ['2026-03-01', 120]]);
  });
});

describe('정렬·상관·기간', () => {
  it('지표별 칸을 하나의 표로', () => {
    const rows = align({ a: [['2026-01-01', 1], ['2026-01-11', 2]], b: [['2026-01-11', 9]] });
    expect(rows).toEqual([{ key: '2026-01-01', a: 1 }, { key: '2026-01-11', a: 2, b: 9 }]);
  });

  it('상관계수와 사례 수', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8]).r).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2]).r).toBeCloseTo(-1);
    expect(pearson([1, 2, null], [1, 2, 3])).toEqual({ r: null, n: 2 });
  });

  it('기간 단축키는 데이터 마지막 날 기준', () => {
    expect(periodStart('3y', '2026-09-30')).toBe('2023-09-30');
    expect(periodStart('all', '2026-09-30')).toBeNull();
  });

  it('직접 고른 기간은 그대로, 칸 기준으로 맞춘다', () => {
    expect(rangeOf({ period: 'custom', from: '2024-06-15', to: '2024-08-31' }, 's', '2026-09-30')).toEqual({
      from: '2024-06-11',
      to: '2024-08-21',
    });
    expect(rangeOf({ period: '1y' }, 'm', '2026-09-30')).toEqual({ from: '2025-09-01', to: null });
  });
});

describe('내보내기·링크', () => {
  it('CSV 는 BOM, 지표 설명, 빈 줄, 표 순서', () => {
    const csv = toCsv({
      title: '분석 작업대',
      columns: [{ id: 'a', name: '가, 소매가', source: 'KAMIS', unit: '원/1kg', transform: '원값', lag: 0 }],
      rows: [{ key: '2026-10-01', a: 1234.5678 }],
    });
    expect(csv.startsWith('\uFEFF분석 작업대\n')).toBe(true);
    expect(csv).toContain('"가, 소매가",KAMIS,원/1kg,원값,0');
    expect(csv).toContain('\n\n날짜,"가, 소매가"\n2026-10-01,1234.568\n');
  });

  it('상태가 주소로 왕복한다', () => {
    const state = {
      series: [
        { id: 'retail:가', kind: 'index', lag: 0, color: 0 },
        { id: 'auction:가', kind: 'index', lag: 14, color: 3 },
      ],
      freq: 'd',
      period: '1y',
      from: null,
      to: null,
      chart: 'scatter',
      x: 1,
      y: 0,
    };
    expect(readState(writeState(state))).toEqual(state);
    const custom = { ...state, period: 'custom', from: '2024-01-01', to: '2024-12-31', chart: 'line', x: 0, y: 1 };
    expect(readState(writeState(custom))).toEqual(custom);
    expect(readState(new URLSearchParams('p=custom&from=2024-1-1')).from).toBeNull();
  });

  it('새 지표는 비어 있는 첫 색', () => {
    expect(freeColor([{ color: 0 }, { color: 2 }])).toBe(1);
  });
});
