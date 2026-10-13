"""home_highlights 검사 — DB 없이 가짜 지표로 질문 고르기 · 숫자 · 링크 · 시장 칸을 본다

지키려는 것
  - 질문마다 규칙으로 가장 뚜렷한 품목을 고르고, 약한 관계는 빼고 보여 주지 않는다
  - 시차는 같은 순보다 뚜렷하게(|r| 0.05) 나을 때만 '며칠 뒤'라고 말한다
  - 작업대 링크는 프론트 writeState 와 같은 모양이다
  - 결과는 NaN 없이 JSON 으로 쓸 수 있다, 파일에 품목 이름이 없다
"""
import json
import os
import sys
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import home_highlights as hh  # noqa: E402
import pipeline_retail as pr  # noqa: E402

TODAY = date(2026, 10, 13)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(pr, 'kst_today', lambda: TODAY)


def soons(start=date(2016, 1, 1), end=date(2026, 9, 21)):
    out, d = [], start
    while d <= end:
        out.append(d)
        d = date(d.year, d.month, 11) if d.day == 1 else date(d.year, d.month, 21) if d.day == 11 else \
            (date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1))
    return out


def make(sid, item, values, freq='soon', agg='mean', unit='원/1kg', source='src'):
    idx = list(values.index) if isinstance(values, pd.Series) else soons()[:len(values)]
    v = values if isinstance(values, pd.Series) else pd.Series(values, index=idx, dtype=float)
    return dict(id=sid, name=f'{item} {sid.split(":")[0]}', item=item, category='가격', source=source, unit=unit,
                freq=freq, agg=agg, values=v)


def seasonal(n, amp=0.3, seed=0, trend=0.0):
    rng = np.random.default_rng(seed)
    t = np.arange(n)
    return 1000 * (1 + amp * np.sin(2 * np.pi * t / 36)) * (1 + trend) ** (t / 36) * np.exp(np.cumsum(rng.normal(0, 0.04, n)) * 0.3)


def lagged_pair(item, k, seed=1):
    """경매가가 k순 앞서 움직이고 소매가가 따라가는 짝 (순마다 독립인 출렁임이라 시차가 또렷하다)"""
    n = len(soons())
    rng = np.random.default_rng(seed)
    t = np.arange(n + k)
    base = 1000 * (1 + 0.2 * np.sin(2 * np.pi * t / 36)) * np.exp(rng.normal(0, 0.15, n + k))
    auction = make(f'auction:{item}', item, base[k:])
    retail = make(f'retail:{item}', item, base[:n] * 1.6)
    return retail, auction


def test_받침에_맞는_조사():
    assert hh.josa('배추', '은', '는') == '배추는'
    assert hh.josa('애호박', '은', '는') == '애호박은'
    assert hh.josa('ABC', '은', '는') == 'ABC는'


def test_시차는_같은_순보다_뚜렷이_나을_때만_고른다():
    r1, a1 = lagged_pair('가', 1, seed=3)
    r0, a0 = lagged_pair('나', 0, seed=4)
    by_id = {s['id']: s for s in (r1, a1, r0, a0)}
    q = hh.q_lag(by_id)
    assert q['item'] == '가' and q['chart']['best'] == 1
    assert '10일(1순) 뒤' in q['answer'] and q['answer'].startswith('가는 경매가가')
    assert q['link'].startswith('s=retail:') and '&t=yoy,yoy&' in q['link'] and q['link'].endswith('&c=lag&x=1&y=0')
    assert hh.q_lag({s['id']: s for s in (r0, a0)}) is None      # 같은 순 관계뿐이면 질문을 뺀다


def test_반입량_관계가_약하면_질문을_빼고_강한_품목을_고른다():
    n = len(soons())
    rng = np.random.default_rng(7)
    supply = 500 * np.exp(rng.normal(0, 0.25, n))
    strong_price = 1000 * (supply / 500) ** -1.2 * np.exp(rng.normal(0, 0.05, n))
    weak_price = 1000 * np.exp(rng.normal(0, 0.25, n))
    series = [make('supply:가', '가', supply, agg='sum', unit='톤'), make('wholesale:가', '가', strong_price),
              make('retail:가', '가', strong_price * 1.5),
              make('supply:나', '나', supply[::-1].copy(), agg='sum', unit='톤'), make('wholesale:나', '나', weak_price)]
    by_id = {s['id']: s for s in series}
    q = hh.q_supply(by_id)
    assert q['item'] == '가' and q['chart']['low']['n'] >= hh.MIN_GROUP
    assert '높았어요(중앙값)' in q['answer'] and '도매가는' in q['answer']
    c = hh.q_condition(by_id)
    assert c['item'] == '가' and c['link'].endswith('&q=supply:%EA%B0%80,,-15')
    assert len(c['chart']['lines'][0]) == 3
    assert hh.q_supply({k: v for k, v in by_id.items() if k.endswith(':나')}) is None


def test_계절은_고점_저점_비가_가장_큰_품목():
    n = len(soons())
    series = [make('retail:가', '가', seasonal(n, amp=0.5, seed=1)), make('retail:나', '나', seasonal(n, amp=0.1, seed=2))]
    q = hh.q_season({s['id']: s for s in series})
    assert q['item'] == '가' and len(q['chart']['rows'][0]) == 36
    assert '그해 평균의' in q['answer'] and q['link'].endswith('&c=terrain&x=0&y=0')


def test_예측은_오차_기록이_가장_긴_지표_10퍼센트_안_비율():
    idx = soons(date(2026, 1, 1), date(2026, 9, 21))
    err_long = pd.Series([5, 8, 12, 3, 20, 7, 9, 15], index=idx[:8], dtype=float)
    err_short = pd.Series([1, 2], index=idx[:2], dtype=float)
    series = [make('forecast_w_error:가경매', '가', err_long, unit='%'), make('forecast_w:가경매', '가', err_long * 100 + 9000),
              make('auction:가경매', '가', err_long * 100 + 9100),
              make('forecast_error:나', '나', err_short, unit='%'), make('forecast:나', '나', err_short + 1000),
              make('retail:나', '나', err_short + 1000)]
    q = hh.q_forecast({s['id']: s for s in series})
    assert q['answer'].startswith('가경매 도매 예측은 올해 8개 순 중 62%를 10% 안으로')
    assert q['item'] == '가'


def test_시장_칸은_인사이트와_도매_예측에서_지난_순_예측은_뺀다():
    idx = soons(date(2026, 1, 1), date(2026, 10, 11))
    auction = make('auction:가경매', '가', pd.Series(np.linspace(10000, 12000, len(idx)), index=idx), unit='원/10키로망대')
    fresh = make('forecast_w:가경매', '가', pd.Series([11000.0], index=[date(2026, 10, 11)]))
    stale = make('forecast_w:나경매', '나', pd.Series([9000.0], index=[date(2026, 10, 1)]))
    retail = make('retail:다', '다', pd.Series(np.linspace(900, 1000, len(idx)), index=idx))
    insights = {'다': {'targetLabel': '10월 중순', 'unit': '1kg',
                      'headline': {'predicted': 1020.4, 'changePct': 0.0213, 'direction': 'up',
                                   'reason': '도매가 흐름이 가격을 올리는 쪽으로 가장 크게 작용하고 있어요'}}}
    tiles = hh.market({s['id']: s for s in (auction, fresh, stale, retail,
                                           make('auction:나경매', '나', auction['values']))}, insights)
    assert [(t['kind'], t['item']) for t in tiles] == [('retail', '다'), ('wholesale', '가경매')]
    r, w = tiles
    assert r['reason'] == '도매가 흐름' and r['reasonDirection'] == 'up' and r['changePct'] == 2.1 and len(r['spark']) == 12
    assert w['target'] == '10월 중순' and w['unit'] == '10kg망대' and w['direction'] == 'down'


def test_결과는_NaN_없이_JSON_으로_쓸_수_있다():
    r1, a1 = lagged_pair('가', 1, seed=3)
    payload = hh.build([r1, a1], {}, '2026-10-13T12:51:00+09:00')
    text = json.dumps(payload, ensure_ascii=False, allow_nan=False)
    assert json.loads(text)['questions'][0]['key'] in ('overlay', 'lag')


def test_파일에_품목_이름이_없다():
    src = open(os.path.join(os.path.dirname(HERE), 'home_highlights.py'), encoding='utf-8').read()
    assert [name for name in pr.ITEMS if name in src] == []
