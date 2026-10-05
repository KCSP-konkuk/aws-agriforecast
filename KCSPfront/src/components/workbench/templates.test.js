import { describe, expect, it } from 'vitest';
import { defaultState, TEMPLATES } from './templates';

const entry = (id, item) => ({ id, item, name: id });
const catalog = [
  entry('retail:가', '가'),
  entry('auction:나경매', '가'), // 가락 이름이 달라도 작업대 품목 묶음(item)은 소매 이름
  entry('forecast:가', '가'),
  entry('forecast_w:나경매', '가'),
  entry('retail:다', '다'),
  entry('auction:다', '다'),
  entry('supply:다', '다'),
];
const tpl = (key) => TEMPLATES.find((t) => t.key === key);

describe('시작 템플릿', () => {
  it('예측은 얼마나 맞았나: 소매·도매 예측을 같은 품목 묶음으로 짝짓는다', () => {
    const t = tpl('forecast');
    expect(t.items(catalog)).toEqual(['가']);
    const built = t.build(catalog, '가');
    expect(built.series.map((s) => s.id)).toEqual(['retail:가', 'forecast:가', 'auction:나경매', 'forecast_w:나경매']);
    expect(built.series.map((s) => s.color)).toEqual([0, 1, 2, 3]);
    expect(built).toMatchObject({ freq: 's', chart: 'line' });
  });

  it('도매가 → 소매가는 경매가가 있는 품목만, 첫 화면은 첫 템플릿의 첫 품목', () => {
    expect(tpl('transmission').items(catalog)).toEqual(['가', '다']);
    expect(defaultState(catalog).series.map((s) => s.id)).toEqual(['retail:가', 'auction:나경매']);
  });

  it('반입량 템플릿은 반입량이 있는 품목만', () => {
    expect(tpl('supply').items(catalog)).toEqual(['다']);
  });
});
