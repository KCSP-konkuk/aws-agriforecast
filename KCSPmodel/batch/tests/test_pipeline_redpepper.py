"""pipeline_redpepper 검사 — 외부 요청·DB 없이 돈다(레포 과거분 CSV + 가짜 응답).

지키려는 것
  - 평년·전년 정의가 농넷 값과 맞는다(다음 달 평년을 이 정의로 계산하므로)
  - 예측 대상 순과 그 뒤의 값이 피쳐에 새지 않는다
  - 피쳐 목록이 실험(redpepper METHOD 11.5)과 같다 — 바꾸면 이 테스트부터 고칠 것
  - 캐시·빈 구간 보충이 요청을 최소로 한다(농넷은 과다 요청으로 차단된 적이 있다)
"""
import os
import sys
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pipeline_redpepper as pl  # noqa: E402

TARGET = '202609하순'

# redpepper experiments select_tune_test.py 'S 선택' 구성(price·cross·trend·dlast)의 열 순서
EXPECTED_COLUMNS = (
    ['plag1', 'plag2', 'plag3', 'plag4', 'plag6', 'plag9', 'plag12', 'plag36', 'pma2', 'pma3', 'pma6', 'pma12',
     'pmom1', 'pmom3', 'pstd3', 'pstd6', 'pmin6', 'pmax6', 'ny', 'py', 'lag_vs_ny', 'p_vs_ny', 'ny_ratio',
     'py_ratio', 'pyoy', 'ny_next', 'py_next', 'ny_next_ratio', 'msin', 'mcos', 'ksin', 'kcos', 'pidx', 'month']
    + [f'{nm}_{s}' for nm in ('풋고추', '청피망')
       for s in ('l1', 'l2', 'l3', 'l6', 'ma3', 'mom1', 'mom3', 'vs_ny', 'ratio', 'ny_dir', 'yoy')]
    + [f'sr_고춧가루_{s}' for s in ('l1', 'l2', 'l3', 'l6', 'l12', 'ma3', 'mom', 'yoy')]
    + ['d_last1_vs_p1'])


def fake_trend(end=date(2026, 9, 22)):
    """데이터랩 형태의 결정적 가짜 검색량(2016~). 값 자체보다 형태·기간이 중요하다"""
    days = pd.date_range('2016-01-01', end)
    rows = []
    for kw, base in (('홍고추', 3), ('고추', 20), ('고춧가루', 8), ('김장', 1)):
        v = base + 2 * np.sin(np.arange(len(days)) / 30)
        rows += [(kw, d.strftime('%Y-%m-%d'), float(x)) for d, x in zip(days, v)]
    return pd.DataFrame(rows, columns=['kw', 'period', 'ratio'])


@pytest.fixture(scope='module')
def hist():
    soon, daily, anchors, hist_end = pl.load_hist()
    return soon, daily


@pytest.fixture(scope='module')
def built(hist):
    soon, daily = hist
    df = pl.assemble(soon, daily, TARGET)
    X = pl.features(df, {k: soon[k] for k in ('풋고추', '청피망')}, fake_trend(), daily)
    return df, X


# ---------------------------------------------------------------- 정의
def test_평년은_5년중_최고최저를_뺀_3년평균이다(hist):
    h = hist[0]['홍고추']
    p = pd.to_numeric(h.val).tolist()
    calc = pd.Series([pl.olympic_avg(p, i) for i in range(len(p))])
    ok = calc.notna() & h.yearAvg.notna().values
    assert ok.sum() > 700
    assert np.allclose(calc[ok], h.yearAvg.values[ok], atol=1)


def test_전년은_36순_전_가격이다(hist):
    h = hist[0]['홍고추']
    p = pd.to_numeric(h.val)
    ok = p.shift(36).notna() & h.bfYear.notna()
    assert ok.sum() > 800
    assert np.allclose(p.shift(36)[ok], h.bfYear[ok], atol=1)


def test_순_계산():
    assert pl.soon_of(date(2026, 9, 10)) == '202609상순'
    assert pl.soon_of(date(2026, 9, 11)) == '202609중순'
    assert pl.soon_of(date(2026, 2, 28)) == '202602하순'
    assert pl.shift_soon('202612하순', 1) == '202701상순'
    assert pl.shift_soon('202701상순', -1) == '202612하순'
    assert pl.soon_start('202609하순') == date(2026, 9, 21)


# ---------------------------------------------------------------- 피쳐
def test_피쳐_목록이_실험과_같다(built):
    assert list(built[1].columns) == EXPECTED_COLUMNS


def test_대상순_가격은_비우고_다음달_평년을_채운다(built):
    df, _ = built
    t = df.index[df.DATE == TARGET][0]
    assert pd.isna(df.price[t]) and df.price[t - 1] > 0
    nxt = df[df.DATE > TARGET]
    assert list(nxt.DATE) == ['202610상순', '202610중순', '202610하순']
    assert nxt.ny.notna().all() and nxt.py.notna().all() and nxt.price.isna().all()


def test_대상순과_그_뒤_값이_피쳐에_새지_않는다(hist):
    soon, daily = hist
    base = pl.assemble(soon, daily, TARGET)
    X0 = pl.features(base, {k: soon[k] for k in ('풋고추', '청피망')}, fake_trend(), daily)

    # 대상 순 이후의 가격·일별·검색량·교차품목을 전부 엉뚱한 값으로 바꾼다
    s2 = {k: v.copy() for k, v in soon.items()}
    for v in s2.values():
        v.loc[v.DATE >= TARGET, 'val'] = 9_999_999
    s2['홍고추'] = pd.concat([s2['홍고추'], pd.DataFrame(
        [{'DATE': TARGET, 'val': 9_999_999, 'yearAvg': base.ny.iloc[-4], 'bfYear': base.py.iloc[-4]}])])
    d2 = pd.concat([daily, pd.DataFrame([{'date': pl.soon_start(TARGET) + timedelta(days=i), '상': 9_999_999}
                                         for i in range(5)])], ignore_index=True)
    tr = fake_trend(date(2026, 9, 30))
    tr.loc[tr.period >= '2026-09-21', 'ratio'] = 9_999
    df2 = pl.assemble(s2, d2, TARGET)
    X2 = pl.features(df2, {k: s2[k] for k in ('풋고추', '청피망')}, tr, d2)

    t = base.index[base.DATE == TARGET][0]
    a, b = X0.loc[t], X2.loc[t]
    same = (a == b) | (a.isna() & b.isna())
    assert same.all(), list(a.index[~same])


def test_막판가격은_순_시작_전날까지의_마지막_거래일이다():
    df = pd.DataFrame({'DATE': ['202609중순', '202609하순'], 'price': [100.0, np.nan],
                       'start': pd.to_datetime(['2026-09-11', '2026-09-21'])})
    daily = pd.DataFrame({'date': [date(2026, 9, 19), date(2026, 9, 21), date(2026, 9, 22)],
                          '상': [120.0, 999.0, 999.0]})             # 9/20 은 일요일(휴장)
    f = pl.f_dlast(df, daily)
    assert f.d_last1_vs_p1.iloc[1] == pytest.approx(1.2)          # 9/19 ÷ 직전 순 100


# ---------------------------------------------------------------- 수집 흐름
class _Cur:
    def __init__(self, log): self.log = log
    def execute(self, q, a=None): self.log.append((' '.join(q.split()), a))
    def __enter__(self): return self
    def __exit__(self, *x): pass


class _Conn:
    def __init__(self): self.sql = []
    def cursor(self): return _Cur(self.sql)
    def commit(self): pass
    def close(self): pass


@pytest.fixture
def sandbox(tmp_path, monkeypatch):
    """과거분을 202606중순 / 2026-06-20 에서 끊은 데이터 폴더 + 가짜 외부 응답"""
    src = pl.DATA
    full = {nm: pd.read_csv(os.path.join(src, fn)).astype({'DATE': str}) for nm, fn in pl.HIST_SOON.items()}
    fulld = pd.read_csv(os.path.join(src, pl.HIST_DAILY), parse_dates=['date'])
    for nm, fn in pl.HIST_SOON.items():
        full[nm][full[nm].DATE <= '202606중순'].to_csv(tmp_path / fn, index=False)
    fulld[fulld.date <= '2026-06-20'].to_csv(tmp_path / pl.HIST_DAILY, index=False)

    calls, conn = [], _Conn()

    def fake_soon(http, item, day):
        calls.append(('soon', item, day))
        f = full[item]
        # 진행 중인 순(= day 가 속한 순)은 부분값처럼 흉내 낸다
        out = f[f.DATE <= pl.soon_of(day)].tail(9)[['DATE', 'val', 'yearAvg', 'bfYear']].copy()
        if pl.soon_of(day) not in set(out.DATE):
            prev = out.iloc[-1]
            out = pd.concat([out.iloc[1:], pd.DataFrame([{'DATE': pl.soon_of(day), 'val': 1.0,
                                                          'yearAvg': prev.yearAvg, 'bfYear': prev.bfYear}])])
        return out.reset_index(drop=True)

    def fake_daily(http, day):
        calls.append(('daily', day))
        d = fulld[fulld.date.dt.date <= day].tail(8).copy()
        d['date'] = d.date.dt.date
        return d

    def fake_trend_call(http, props, end):
        calls.append(('trend', end))
        return fake_trend(end)

    monkeypatch.setattr(pl, 'DATA', str(tmp_path))
    monkeypatch.setattr(pl, 'fetch_soon', fake_soon)
    monkeypatch.setattr(pl, 'fetch_daily', fake_daily)
    monkeypatch.setattr(pl, 'fetch_trend', fake_trend_call)
    monkeypatch.setattr(pl, 'nongnet_session', lambda http: None)
    monkeypatch.setattr(pl, 'props', lambda: {})
    monkeypatch.setattr(pl, 'db', lambda P: conn)
    monkeypatch.setattr(pl, 'SEEDS', 2)
    monkeypatch.setattr(pl, 'PARAMS', {**pl.PARAMS, 'n_estimators': 30})   # 흐름 검사라 학습은 가볍게
    return tmp_path, calls, conn


def _kinds(calls):
    return pd.Series([c[0] for c in calls]).value_counts().to_dict()


def test_빈구간만_채우고_두번째_실행은_추가조회가_없다(sandbox, monkeypatch):
    tmp, calls, conn = sandbox
    monkeypatch.setattr(pl, 'kst_today', lambda: date(2026, 9, 23))

    assert pl.main() == 0
    first = _kinds(calls)
    assert first['soon'] == 6                    # 품목당 오늘 1회 + 빈 구간 1회
    assert first['daily'] == 9                   # 과거분 이후 순마다 1회
    assert first['trend'] == 1
    assert (tmp / 'cache_soon_redpepper.csv').exists()

    calls.clear(); conn.sql.clear()
    assert pl.main() == 0
    assert _kinds(calls) == {'soon': 3, 'trend': 1}

    ins = [a for q, a in conn.sql if q.startswith('INSERT')]
    assert len(ins) == 1 and ins[0][0] == TARGET and ins[0][1] > 0
    cache = pd.read_csv(tmp / 'cache_soon_redpepper.csv')
    assert cache.DATE.max() < TARGET               # 진행 중인 순의 부분값은 저장하지 않는다


def test_순_첫날_받은_일별창은_다음날_다시_받는다(sandbox, monkeypatch):
    tmp, calls, conn = sandbox
    monkeypatch.setattr(pl, 'kst_today', lambda: date(2026, 9, 21))
    assert pl.main() == 0
    calls.clear()
    assert pl.main() == 0
    assert [str(c[1]) for c in calls if c[0] == 'daily'] == ['2026-09-20']


def test_필수_피쳐가_비면_쓰지_않고_실패한다(sandbox, monkeypatch):
    tmp, calls, conn = sandbox
    monkeypatch.setattr(pl, 'kst_today', lambda: date(2026, 9, 23))
    monkeypatch.setattr(pl, 'fetch_daily', lambda http, day: pd.DataFrame(columns=['date', '상']))
    # 과거분(~6/20) 이후 일별 창을 하나도 못 받으면 대상 순의 막판 가격이 비어야 한다
    assert pl.main() == 1
    assert not [q for q, a in conn.sql if q.startswith('INSERT')]


def test_빈구간이_없는_날을_연달아_실행해도_된다(tmp_path, monkeypatch):
    """운영 첫날 사고(2026-09-23): 조회할 일별 창이 없으면 앵커 캐시가 헤더만 저장되고,
    다음 실행이 그 빈 파일을 날짜로 읽다가 죽었다"""
    import shutil
    for fn in list(pl.HIST_SOON.values()) + [pl.HIST_DAILY]:
        shutil.copy(os.path.join(pl.DATA, fn), tmp_path)
    full = {nm: pd.read_csv(os.path.join(pl.DATA, fn)).astype({'DATE': str}) for nm, fn in pl.HIST_SOON.items()}
    conn = _Conn()
    monkeypatch.setattr(pl, 'DATA', str(tmp_path))
    monkeypatch.setattr(pl, 'fetch_soon', lambda http, item, day: full[item].tail(9)[['DATE', 'val', 'yearAvg', 'bfYear']])
    monkeypatch.setattr(pl, 'fetch_daily', lambda http, day: pytest.fail('과거분이 덮으므로 일별 조회가 없어야 한다'))
    monkeypatch.setattr(pl, 'fetch_trend', lambda http, props, end: fake_trend(end))
    monkeypatch.setattr(pl, 'nongnet_session', lambda http: None)
    monkeypatch.setattr(pl, 'props', lambda: {})
    monkeypatch.setattr(pl, 'db', lambda P: conn)
    monkeypatch.setattr(pl, 'kst_today', lambda: date(2026, 9, 23))
    monkeypatch.setattr(pl, 'SEEDS', 2)
    monkeypatch.setattr(pl, 'PARAMS', {**pl.PARAMS, 'n_estimators': 30})

    assert pl.main() == 0
    assert pd.read_csv(tmp_path / pl.CACHE_ANCHOR).empty      # 헤더만 있는 파일이 생긴다
    assert pl.main() == 0                                     # 이 두 번째 실행이 운영에서 죽었다
