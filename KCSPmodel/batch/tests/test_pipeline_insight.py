"""pipeline_insight 검사 — 외부 요청·DB 없이 돈다(레포 CSV + 결정적 가짜 소매, 작은 모델).

지키려는 것
  - 요인 기여도는 기준값 + 기여도 합 = 예측 비율 (묶음 합산이 맞으려면 이게 맞아야 한다)
  - 모든 피쳐가 묶음에 들어간다 — 소매 피쳐가 바뀌면 이 테스트가 먼저 알려 준다
  - 화면 문구(방향·세기·결론)와 품목 무관성(파일에 품목 이름이 없다)
  - 결과가 JSON 으로 저장되고, 같은 입력이면 두 번 돌려도 같다
"""
import json
import os
import sys
from datetime import date

import numpy as np
import pandas as pd
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import pipeline_insight as pi  # noqa: E402
import pipeline_retail as pr  # noqa: E402
from test_pipeline_retail import fake_retail  # noqa: E402

TARGET = '202610상순'
TODAY = date(2026, 10, 3)
SMALL = [(None, dict(max_depth=3, n_estimators=60, learning_rate=0.1))]
ITEM = pr.ITEMS[0]


@pytest.fixture(scope='module')
def garak():
    h = pd.read_csv(os.path.join(pr.DATA, 'hist_daily_onion.csv'), parse_dates=['date'])
    return h.set_index('date')['상'].dropna()


@pytest.fixture(scope='module')
def extras():
    fx = pd.read_csv(os.path.join(pr.DATA, 'hist_exchange.csv'), encoding='utf-8-sig')
    sup = pd.read_csv(os.path.join(pr.DATA, 'hist_supply_onion.csv'), encoding='utf-8-sig')
    return dict(fx=pd.Series(fx['원/달러'].astype(float).values, index=pi.code_index(fx['DATE'])).sort_index(),
                oil=pd.Series(dtype=float),
                supply=pd.Series(sup['총반입량'].astype(float).values, index=pi.code_index(sup['DATE'])).sort_index(),
                search=pd.Series(dtype=float), weather=pi.load_weather())


@pytest.fixture(scope='module')
def payload(garak, extras):
    return pi.build_insight(ITEM, fake_retail(), garak, TARGET, extras, prediction=None, unit='1kg',
                            today=TODAY, models=SMALL, seeds=1)


def test_모든_피쳐가_묶음에_들어간다(garak):
    df = pr.build_frame(fake_retail(), garak, TARGET)
    for item in pr.ITEMS:
        X = pr.features(df, pr.GROUPS.get(item, pr.DEFAULT_GROUPS))
        assert [c for c in X.columns if pi.family_of(c) == 'other'] == [], item


def test_기여도_합은_예측_비율(garak):
    df = pr.build_frame(fake_retail(), garak, TARGET)
    X = pr.features(df)
    tk = pr.soon_index(TARGET)
    pred, base, contrib, n = pi.fit_explain(df, X, tk, SMALL, seeds=2)
    assert base + contrib.sum() == pytest.approx(pred, abs=1e-4)
    assert n > pr.MIN_TRAIN


def test_요인_방향과_세기():
    contrib = pd.Series({'r_chg1': 0.04, 'g_chg1': -0.015, 'margin': 0.001, 'r_last_vs_mean': -0.0005})
    out = pi.summarize_factors(contrib, 1000.0, pd.Series(dtype=float), ITEM)
    by = {f['key']: f for f in out}
    assert by['retail']['direction'] == 'up' and by['retail']['strength'] == '크게'
    assert by['wholesale']['direction'] == 'down' and by['wholesale']['strength'] == '보통'
    assert by['margin']['negligible'] and not by['margin']['top']
    assert [f['key'] for f in out if f['top']] == ['retail', 'wholesale']
    assert by['retail']['amount'] == pytest.approx(40.0)


def test_결론_문장():
    factors = [dict(label='소매가 흐름', direction='up'), dict(label='유통 마진', direction='down')]
    assert '비슷할' in pi.headline(ITEM, TARGET, 1003, 1000, factors, 'x')['text']
    assert '조금 오를' in pi.headline(ITEM, TARGET, 1020, 1000, factors, 'x')['text']
    h = pi.headline(ITEM, TARGET, 950, 1000, factors, 'x')
    assert '눈에 띄게 내릴' in h['text'] and h['reason'].startswith('유통 마진이')
    assert '크게 내릴' in pi.headline(ITEM, TARGET, 900, 1000, factors, 'x')['text']


def test_조사():
    assert pi.josa('경매가', '이', '가') == '경매가가'
    assert pi.josa('유통 마진', '이', '가') == '유통 마진이'
    assert pi.josa('도매가(KAMIS)', '이', '가') == '도매가(KAMIS)가'


def test_수치_문구():
    assert pi.delta_text(0.004) == '거의 그대로'
    assert pi.delta_text(-0.05) == '−5%'
    assert pi.rain_text(2.1) == '평년의 3.1배'
    assert pi.rain_text(-0.99) == '거의 없음'


def test_결과는_JSON이고_두_번_돌려도_같다(payload, garak, extras):
    assert payload is not None
    json.dumps(payload, ensure_ascii=False, allow_nan=False)
    again = pi.build_insight(ITEM, fake_retail(), garak, TARGET, extras, prediction=None, unit='1kg',
                             today=TODAY, models=SMALL, seeds=1)
    payload, again = dict(payload), dict(again)
    payload.pop('generatedAt'), again.pop('generatedAt')
    assert payload == again


def test_운영_예측이_있으면_그_값을_쓴다(garak, extras):
    p = pi.build_insight(ITEM, fake_retail(), garak, TARGET, extras, prediction=1234.0, today=TODAY,
                         models=SMALL, seeds=1)
    assert p['headline']['predicted'] == 1234.0 and p['headline']['source'] == 'retail_model'


def test_비슷했던_과거는_1년_이전_같은_계절(payload):
    tk = pr.soon_index(TARGET)
    assert payload['analogs']['items']
    for a in payload['analogs']['items']:
        t = pr.soon_index(a['soon'])
        gap = abs(t % 36 - tk % 36)
        assert t <= tk - 36 and min(gap, 36 - gap) <= 3
        assert a['path'][0] == 0


def test_사건은_시간순이고_개수_제한(payload):
    ev = payload['timeline']['events']
    assert len(ev) <= pi.MAX_EVENTS
    assert [e['soon'] for e in ev] == sorted(e['soon'] for e in ev)
    assert all(e['title'] and e['text'] for e in ev)
    assert len(payload['timeline']['series']) == pi.TIMELINE_SOONS    # 최근 2년 = 대상 순 직전까지 72순


def test_상황판_점수는_0에서_100(payload):
    axes = payload['board']['axes']
    assert axes and all(0 <= a['score'] <= 100 for a in axes)
    assert {'소매가 수준', '유통 마진'} <= {a['label'] for a in axes}


def test_과거가_짧은_지표는_빠진다(garak):
    df = pr.build_frame(fake_retail(), garak, TARGET)
    tk = pr.soon_index(TARGET)
    short = pd.Series(np.arange(50, dtype=float) + 100, index=range(tk - 50, tk))
    ind = pi.build_indicators(df, dict(supply=short, search=pd.Series(dtype=float), fx=pd.Series(dtype=float),
                                       oil=pd.Series(dtype=float), weather=[]), ITEM)
    assert 'supply' not in ind and 'retail_level' in ind


def test_직전_순_도매가가_없으면_건너뛴다(garak, extras):
    cut = garak[garak.index < pd.Timestamp('2026-09-01')]
    assert pi.build_insight(ITEM, fake_retail(), cut, TARGET, extras, today=TODAY, models=SMALL, seeds=1) is None


def test_달력은_36칸이고_평균이_0_근처(garak):
    df = pr.build_frame(fake_retail(), garak, TARGET)
    cal, change = pi.calendar(df, pr.soon_index(TARGET))
    assert len(cal) == 36 and abs(np.nanmean(cal)) < 0.05 and np.isfinite(change)


def test_강수_비율은_건기에_튀지_않는다():
    idx = list(range(pr.soon_index('201801상순'), pr.soon_index('202612하순') + 1))
    rain = pd.Series([0.1 if i % 36 < 3 else 50.0 for i in idx], index=idx, dtype=float)
    rain.iloc[-5] = 5.0      # 건기 순에 평년(0.1)의 50배
    _, r = pi.weather_anomalies([('가상', pd.Series(10.0, index=idx), rain)])
    assert r.max() < 1.0


def test_예측_기록은_평균_오차와_방향_적중():
    y = pd.Series({pr.soon_index('202609상순'): 1000.0, pr.soon_index('202609중순'): 1100.0})
    df = pd.DataFrame({'y': y})
    rows = [('202609하순', 1150.0, 1050.0),    # 직전 1100 → 예측 +4.5% · 실제 −4.5% → 틀림, 오차 9.5%
            ('202609중순', 1080.0, 1100.0)]    # 직전 1000 → 예측 +8% · 실제 +10% → 맞음, 오차 1.8%
    t = pi.track_record(rows, df)
    assert t['n'] == 2 and t['hits'] == 1 and t['judged'] == 2
    assert t['mape'] == pytest.approx(5.7, abs=0.05) and t['since'] == '9월 중순'
    assert pi.track_record([], df) is None
    assert pi.direction_of(0.005) == 'flat' and pi.direction_of(-0.02) == 'down'


def test_파일에_품목_이름이_없다():
    src = open(os.path.join(os.path.dirname(HERE), 'pipeline_insight.py'), encoding='utf-8').read()
    assert [name for name in pr.ITEMS if name in src] == []
