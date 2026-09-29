"""pipeline_retail 검사 — 외부 요청·DB 없이 돈다(레포 가락 과거분 CSV + 결정적 가짜 소매).

지키려는 것
  - 예측 대상 순과 그 뒤의 값(소매·가락)이 표·피쳐에 새지 않는다
  - 목표는 경동·복조리의 그날 평균(있는 곳만) → 순 평균이다
  - 피쳐 목록이 실험(redpepper experiments/retail features.py: 소매+가락+소매막판)과 같다 — 바꾸면 이 테스트부터 고칠 것
  - 모델 설정이 redpepper best_pepper5.json h=1 상위 5개와 같다
"""
import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pipeline_retail as pr  # noqa: E402

TARGET = '202609하순'

EXPECTED_COLUMNS = (
    ['r_chg1', 'r_chg2', 'r_chg3', 'r_chg6', 'r_yoy', 'r_vs_ny', 'r_ny_next', 'r_mkt_gap', 'r_same', 'r_still3']
    + ['g_chg1', 'g_up1', 'g_dn1', 'g_chg2', 'g_chg3', 'g_last_vs_mean', 'g_last3_vs_mean', 'g_yoy',
       'margin', 'margin_dev36', 'margin_dev6', 'gap3']
    + ['r_last_vs_mean', 'r_last3_vs_mean'])


def fake_retail(end='2026-09-28'):
    """2014-01~ 평일 경동·복조리 가짜 소매(원/100g). 복조리는 2014-07~, 가끔 빠진다"""
    days = pd.bdate_range('2014-01-02', end)
    rows = []
    for i, d in enumerate(days):
        base = 1000 + 300 * np.sin(i / 40) + (i % 7) * 3
        rows.append((d.date(), '경동', int(round(base))))
        if d >= pd.Timestamp('2014-07-01') and i % 11:
            rows.append((d.date(), '복조리', int(round(base * 1.05))))
    return pd.DataFrame(rows, columns=['date', 'market', 'price'])


@pytest.fixture(scope='module')
def garak():
    h = pd.read_csv(os.path.join(pr.DATA, 'hist_daily_redpepper.csv'), parse_dates=['date'])
    return h.set_index('date')['상'].dropna()


@pytest.fixture(scope='module')
def built(garak):
    df = pr.build_frame(fake_retail(), garak, TARGET)
    return df, pr.features(df)


def test_순_코드와_인덱스가_왕복된다():
    for c in ('201407상순', '202609하순', '202612하순', '202701상순'):
        assert pr.code_of(pr.soon_index(c)) == c
    assert pr.soon_code(pd.Timestamp('2026-09-21').date()) == '202609하순'


def test_표는_2014_07_상순부터_대상_순까지(built):
    df, _ = built
    assert df.soon.iloc[0] == '201407상순'
    assert df.soon.iloc[-1] == TARGET
    assert df.index.is_monotonic_increasing and (np.diff(df.index) == 1).all()


def test_대상_순_값은_표에_없다(built):
    df, _ = built
    last = df.iloc[-1]
    assert np.isnan(last.y) and np.isnan(last.g) and np.isnan(last.r_last)
    assert not np.isnan(df.y.iloc[-2])


def test_목표는_있는_판매처만_평균한_일별의_순평균():
    r = pd.DataFrame([('2026-09-01', '경동', 1000), ('2026-09-01', '복조리', 1100),
                      ('2026-09-02', '경동', 1300)], columns=['date', 'market', 'price'])
    g = pd.Series([50000.0, 51000.0], index=pd.to_datetime(['2026-09-01', '2026-09-02']))
    df = pr.build_frame(r, g, '202609중순')
    row = df[df.soon == '202609상순'].iloc[0]
    assert row.y == pytest.approx((1050 + 1300) / 2)
    assert row.r_last == 1300


def test_피쳐_목록이_실험과_같다(built):
    _, X = built
    assert list(X.columns) == EXPECTED_COLUMNS


def test_대상_순을_바꿔도_그_전_행의_피쳐는_같다(garak):
    """대상 순 이후 값이 새면 대상 순을 늦출 때 앞 행이 바뀐다"""
    r = fake_retail()
    a = pr.features(pr.build_frame(r, garak, '202608상순'))
    b = pr.features(pr.build_frame(r, garak, TARGET))
    common = a.index[a.index < pr.soon_index('202608상순')]
    pd.testing.assert_frame_equal(a.loc[common], b.loc[common])


def test_대상_행의_필수_피쳐가_있다(built):
    _, X = built
    k = pr.soon_index(TARGET)
    assert not X.loc[k, pr.REQUIRED].isna().any()


def test_모델_설정은_검증에서_고른_상위_5개():
    assert set(pr.MODELS) == set(pr.ITEMS) == {'붉은고추', '양배추', '양파'} and pr.SEEDS == 12
    assert [k for k, _ in pr.MODELS['붉은고추']] == [None, None, 15, None, None]
    assert [k for k, _ in pr.MODELS['양배추']] == [15, 15, 15, None, 15]
    assert [k for k, _ in pr.MODELS['양파']] == [15, None, 15, 15, 15]
    assert pr.BASE_PARAMS['objective'] == 'reg:absoluteerror'


def test_예측은_비율_곱하기_직전_순(built):
    df, X = built
    k = pr.soon_index(TARGET)
    light = [(None, dict(max_depth=2, n_estimators=20, learning_rate=0.1))]
    pred, n = pr.fit_predict(df, X, k, light, seeds=1)
    assert n == int(((df.y / df.y.shift(1)).notna() & (df.index < k)).sum())
    assert 0.5 < pred / df.y[k - 1] < 2.0


def test_직전_순_소매가_없으면_건너뛴다(garak):
    """첫 적재 도중(2014~ 연도 순)엔 최근 순이 비어 있다 — 예측을 쓰지 않고 None"""
    r = fake_retail(end='2025-12-31')

    class Conn:
        pass
    pr_load = (pr.load_retail, pr.load_garak)
    pr.load_retail = lambda conn, item: r
    pr.load_garak = lambda conn, csv, it: garak
    try:
        assert pr.run_item(Conn(), '붉은고추', TARGET) is None
    finally:
        pr.load_retail, pr.load_garak = pr_load


def test_품목마다_가락_과거분_파일이_있다():
    for item, (csv_name, _) in pr.ITEMS.items():
        h = pd.read_csv(os.path.join(pr.DATA, csv_name), parse_dates=['date'])
        assert '상' in h.columns and h.date.min() <= pd.Timestamp('2014-01-10'), item


def test_DB_접속은_거부되면_재시도한다(monkeypatch):
    """MySQL 재시작(자동 업데이트) 중 접속 거부 → 두 번 실패 후 붙으면 그 연결을 돌려준다. 끝내 실패하면 예외"""
    import pymysql
    calls = []

    def fake_connect(**kw):
        calls.append(kw)
        if len(calls) < 3:
            raise pymysql.err.OperationalError(2003, "Can't connect to MySQL server")
        return 'conn'
    monkeypatch.setattr(pymysql, 'connect', fake_connect)
    monkeypatch.setattr(pr, 'DB_WAIT', 0)
    P = {'spring.datasource.url': 'jdbc:mysql://localhost:3306/agriforecast?serverTimezone=Asia/Seoul',
         'spring.datasource.username': 'u', 'spring.datasource.password': 'p'}
    assert pr.db(P) == 'conn' and len(calls) == 3
    assert calls[0]['database'] == 'agriforecast' and calls[0]['host'] == 'localhost'

    calls.clear()
    monkeypatch.setattr(pr, 'DB_TRY', 2)
    with pytest.raises(pymysql.err.OperationalError):
        pr.db(P)
    assert len(calls) == 2
