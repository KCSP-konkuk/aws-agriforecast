"""pipeline_series 검사 — 외부 요청·DB 없이 돈다(가짜 연결 + 레포 CSV).

지키려는 것
  - 지표 종류마다 날짜 규칙(일 · 순 첫날 · 월 1일)과 집계(평균 · 합계)
  - 레포 과거분이 우선이고 DB 는 그 뒤만 잇는다
  - 저장은 지표마다 지우고 다시 넣어서 두 번 돌려도 같다, 빈 지표는 건너뛴다
  - 한 출처가 실패해도 나머지는 적재하고, 실패는 종료 코드로 알린다
  - 파일에 품목 이름이 없다(품목은 원본에서 찾는다)
"""
import os
import sys
from datetime import date

import pandas as pd
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import backtest  # noqa: E402
import pipeline_retail as pr  # noqa: E402
import pipeline_series as ps  # noqa: E402

ITEM = pr.ITEMS[0]


class FakeCursor:
    def __init__(self, conn):
        self.conn, self.rows = conn, []

    def execute(self, sql, args=()):
        sql = ' '.join(sql.split())
        self.conn.log.append(('execute', sql, tuple(args)))
        self.rows = self.conn.answer(sql)

    def executemany(self, sql, rows):
        self.conn.log.append(('executemany', ' '.join(sql.split()), [tuple(r) for r in rows]))

    def fetchall(self):
        return self.rows

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeConn:
    """SQL 의 'FROM 테이블' 로 미리 정한 행을 돌려준다"""

    def __init__(self, answers=None):
        self.answers, self.log, self.commits = answers or {}, [], 0

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.commits += 1

    def answer(self, sql):
        for table, rows in self.answers.items():
            if f'FROM {table} ' in sql + ' ' or f'FROM {table} r' in sql:
                return rows
        return []


def by_id(series):
    return {s['id']: s for s in series}


def test_소매는_판매처_평균을_일별로_단위는_최근_단위():
    conn = FakeConn({'retail_market_price': [(ITEM, date(2026, 9, 1), 1050.0), (ITEM, date(2026, 9, 2), 1300.0)],
                     'retail_price': [(ITEM, '1kg')]})
    s = by_id(ps.load_retail(conn))[f'retail:{ITEM}']
    assert s['unit'] == '원/1kg' and s['freq'] == 'daily' and s['agg'] == 'mean' and s['item'] == ITEM
    assert list(s['values'].values) == [1050.0, 1300.0]
    assert s['values'].index[0] == date(2026, 9, 1)


def test_도매는_품목마다_서울_도매시장_하나에_단위는_최근_단위(monkeypatch):
    monkeypatch.setattr(ps, 'wholesale_units', lambda conn: {'가상곡물': '20kg'})
    conn = FakeConn({'wholesale_market_price': [
        (ITEM, pr.WHOLESALE_MARKET, date(2026, 9, 1), 15500), (ITEM, pr.WHOLESALE_MARKET, date(2026, 9, 2), 16700),
        ('가상곡물', '양곡도매', date(2026, 9, 1), 59000), ('가상곡물', '양곡도매', date(2026, 9, 2), 59400),
        ('가상곡물', '다른시장', date(2026, 9, 2), 1)]})
    got = by_id(ps.load_wholesale(conn))
    assert got[f'wholesale:{ITEM}']['source'] == f'KAMIS 도매 · {pr.WHOLESALE_MARKET}(중도매인 판매가)'
    assert got[f'wholesale:{ITEM}']['unit'] == '원 (KAMIS 도매 거래 단위)'   # 단위를 아직 모르면
    grain = got['wholesale:가상곡물']
    assert grain['source'] == 'KAMIS 도매 · 양곡도매' and grain['unit'] == '원/20kg' and grain['item'] == '가상곡물'
    assert list(grain['values'].values) == [59000.0, 59400.0]   # 행이 적은 시장은 섞지 않는다


def test_도매_단위는_열이_없으면_비운다():
    assert ps.wholesale_units(FakeConn({'information_schema.columns': [(0,)]})) == {}
    conn = FakeConn({'information_schema.columns': [(1,)], 'wholesale_market_price': [(ITEM, '20개')]})
    assert ps.wholesale_units(conn) == {ITEM: '20개'}


def test_경매가는_레포_과거분_뒤로_DB를_잇는다():
    csv_name, item = next(iter(pr.GARAK.values()))
    hist = pd.read_csv(os.path.join(pr.DATA, csv_name), parse_dates=['date']).dropna(subset=['상'])
    last = hist['date'].max().date()
    overlap = hist['date'].iloc[-5].date()
    after = (pd.Timestamp(last) + pd.Timedelta(days=3)).date()
    conn = FakeConn({'agri_price': [(item, overlap.year, overlap.month, overlap.day, 1.0),
                                    (item, after.year, after.month, after.day, 77777.0)]})
    s = by_id(ps.load_auction(conn))[f'auction:{item}']
    assert s['values'][overlap] == pytest.approx(float(hist.set_index('date')['상'][pd.Timestamp(overlap)]))
    assert s['values'].index[-1] == after and s['values'].iloc[-1] == 77777.0
    assert s['unit'].startswith('원/')       # hist_price*.csv 의 단위


def test_반입량은_끝난_순만_순_첫날에_합계로(monkeypatch):
    monkeypatch.setattr(pr, 'kst_today', lambda: date(2026, 9, 25))
    rows = [('가상품목', 2026, 8, 21, 1.0), ('가상품목', 2026, 8, 22, 2.0), ('가상품목', 2026, 8, 31, 3.0),
            ('가상품목', 2026, 9, 21, 9.0)]                    # 9월 하순은 진행 중 → 뺀다
    s = by_id(ps.load_supply(FakeConn({'supply_data': rows})))['supply:가상품목']
    assert s['freq'] == 'soon' and s['agg'] == 'sum' and s['unit'] == '톤'
    assert dict(s['values']) == {date(2026, 8, 21): 6.0}


def test_반입량_레포_과거분은_파일_안_품목명으로_찾는다():
    history = ps.supply_history()
    assert history and all(d.day in (1, 11, 21) for s in history.values() for d in s.index)


def test_관측소_기상은_지점_이름과_일별_평균_합계():
    rows = [(261, date(2026, 9, 1), 20.0, 5.0), (261, date(2026, 9, 2), 22.0, 0.0), (999, date(2026, 9, 1), 10.0, 1.0)]
    got = by_id(ps.load_station_weather(FakeConn({'station_weather_data': rows})))
    assert got['station_temp:261']['name'] == '해남 기온' and got['station_temp:261']['agg'] == 'mean'
    assert got['station_rain:261']['agg'] == 'sum' and list(got['station_rain:261']['values']) == [5.0, 0.0]
    assert got['station_temp:999']['name'] == '관측소 999 기온'


def test_산지_기상은_레포_CSV에서_순_첫날로():
    got = by_id(ps.load_area_weather())
    assert {'area_temp:haenam', 'area_rain:haenam', 'area_rain:miryang'} <= set(got)
    assert got['area_rain:haenam']['agg'] == 'sum' and got['area_rain:miryang']['agg'] == 'mean'
    assert all(d.day in (1, 11, 21) for d in got['area_temp:haenam']['values'].index)


def test_환율은_레포_순_뒤로_DB_순평균을_잇는다():
    rows = [(date(2026, 3, 2), 1400.0, 190.0), (date(2026, 3, 3), 1410.0, 191.0)]
    got = by_id(ps.load_fx(FakeConn({'exchange_rate_daily': rows})))
    usd = got['fx:usd']['values']
    assert usd.index[0] == date(2018, 1, 1) and usd[date(2026, 3, 1)] == pytest.approx(1405.0)
    assert got['fx:cny']['values'][date(2026, 3, 1)] == pytest.approx(190.5)


def test_물가지수는_월_1일():
    got = by_id(ps.load_price_index(FakeConn({'cpi_data': [(ITEM, 2026, 3, 101.2)]}),
                                    'cpi_data', 'CPI', 'cpi', '소비자물가지수', 'KOSIS'))
    s = got[f'cpi:{ITEM}']
    assert s['freq'] == 'monthly' and dict(s['values']) == {date(2026, 3, 1): 101.2}


def test_검색량과_유가는_일별():
    conn = FakeConn({'search_trend': [(ITEM, date(2026, 9, 1), 55.0)], 'oil_price': [(date(2026, 9, 1), 1650.0)]})
    assert by_id(ps.load_search(conn))[f'search:{ITEM}']['freq'] == 'daily'
    assert by_id(ps.load_oil(conn))['oil:diesel']['values'][date(2026, 9, 1)] == 1650.0


EXISTS = {'information_schema.tables': [(1,)]}


def test_소매_예측은_순_첫날에_예측가와_오차():
    conn = FakeConn({**EXISTS, pr.TABLE: [(ITEM, '202609중순', 1500.0, 4.2), (ITEM, '202609하순', 1600.0, None)],
                     'retail_price': [(ITEM, '1kg')]})
    got = by_id(ps.load_retail_forecast(conn))
    f, e = got[f'forecast:{ITEM}'], got[f'forecast_error:{ITEM}']
    assert f['category'] == '예측' and f['freq'] == 'soon' and f['unit'] == '원/1kg' and f['item'] == ITEM
    assert dict(f['values']) == {date(2026, 9, 11): 1500.0, date(2026, 9, 21): 1600.0}
    assert dict(e['values']) == {date(2026, 9, 11): 4.2} and e['unit'] == '%'      # 실제가 아직 없는 순은 오차 없음


def test_도매_예측은_운영_예측이_백테스트를_덮고_그_전은_백테스트로(monkeypatch):
    monkeypatch.setattr(backtest, 'MODELS', {'가상품목': 'fake'})
    conn = FakeConn({**EXISTS,
                     'fake_backtest': [('202601상순', 900.0, 10.0), ('202601중순', 950.0, 5.0)],
                     'fake_predictions': [('202601중순', 1000.0, 2.0), ('202601하순', 1100.0, None)]})
    got = by_id(ps.load_wholesale_forecast(conn))
    f = got['forecast_w:가상품목']
    assert dict(f['values']) == {date(2026, 1, 1): 900.0, date(2026, 1, 11): 1000.0, date(2026, 1, 21): 1100.0}
    assert dict(got['forecast_w_error:가상품목']['values']) == {date(2026, 1, 1): 10.0, date(2026, 1, 11): 2.0}
    assert f['item'] == ps.crop_of('가상품목')


def test_예측_테이블이_없으면_건너뛴다(monkeypatch):
    monkeypatch.setattr(backtest, 'MODELS', {'가상품목': 'fake'})
    conn = FakeConn({'information_schema.tables': [(0,)], pr.TABLE: [(ITEM, '202609중순', 1500.0, 4.2)]})
    assert ps.load_retail_forecast(conn) == [] and ps.load_wholesale_forecast(conn) == []


def test_도매_예측_모델_목록의_가락_품목은_예측_지표_묶음과_맞는다():
    # 가락 품목명을 소매 이름으로 묶는 규칙(crop_of)이 도매 예측에도 같이 쓰인다
    for garak in backtest.MODELS:
        assert isinstance(ps.crop_of(garak), str) and ps.crop_of(garak)


def sample_series():
    return [ps.make('retail:가', '가 소매가', '가격', 'src', '원/1kg', 'daily', 'mean',
                    pd.Series([1.0, 2.0], index=[date(2026, 9, 1), date(2026, 9, 2)]), '가'),
            ps.make('fx:usd', '원/달러 환율', '거시', 'src', '원/달러', 'soon', 'mean',
                    pd.Series([1400.0], index=[date(2026, 9, 1)])),
            ps.make('search:빈', '빈 검색량', '관심도', 'src', '상대값', 'daily', 'mean', pd.Series(dtype=float))]


def test_저장은_지표마다_지우고_다시_넣고_두_번_돌려도_같다():
    a, b = FakeConn(), FakeConn()
    assert ps.save(a, sample_series()) == 2          # 빈 지표는 건너뛴다
    ps.save(b, sample_series())
    assert a.log == b.log
    writes = [(kind, sql.split()[0]) for kind, sql, _ in a.log if 'series_value' in sql and not sql.startswith('CREATE')]
    assert writes == [('execute', 'DELETE'), ('executemany', 'INSERT')] * 2
    inserted = [rows for kind, sql, rows in a.log if kind == 'executemany']
    assert inserted[0] == [('retail:가', date(2026, 9, 1), 1.0), ('retail:가', date(2026, 9, 2), 2.0)]
    catalog = [args for kind, sql, args in a.log if sql.startswith('INSERT INTO series_catalog')]
    assert catalog[0][0] == 'retail:가' and catalog[0][8:11] == (date(2026, 9, 1), date(2026, 9, 2), 2)
    assert not any('search:빈' in str(entry) for entry in a.log)


def test_한_출처가_실패해도_나머지는_적재한다(monkeypatch):
    def broken(conn):
        raise RuntimeError('테이블 없음')
    monkeypatch.setattr(ps, 'LOADERS', [('고장', broken), ('유가', ps.load_oil)])
    series, failed = ps.collect(FakeConn({'oil_price': [(date(2026, 9, 1), 1650.0)]}))
    assert failed == ['고장'] and [s['id'] for s in series] == ['oil:diesel']


def test_가락_품목은_소매_이름으로_묶는다():
    for retail, (_, garak) in pr.GARAK.items():
        assert ps.crop_of(garak) == retail
    assert ps.crop_of('목록에_없는_품목') == '목록에_없는_품목'
    retail, (csv_name, garak) = next(iter(pr.GARAK.items()))
    s = by_id(ps.load_auction(FakeConn()))[f'auction:{garak}']
    assert s['item'] == retail and s['name'] == f'{garak} 경매가'


def test_파일에_품목_이름이_없다():
    src = open(os.path.join(os.path.dirname(HERE), 'pipeline_series.py'), encoding='utf-8').read()
    assert [name for name in pr.ITEMS if name in src] == []
