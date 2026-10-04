#!/usr/bin/env python3
"""분석 작업대용 통합 시계열 적재 배치

흩어진 출처의 지표를 같은 모양(지표 · 날짜 · 값)으로 모아 series_value 에, 지표 설명은 series_catalog 에 쓴다.
백엔드 /api/series/* 가 그대로 읽고, 주기 맞추기 · 변환 · 시차는 화면이 계산한다.
설계: docs/superpowers/specs/2026-10-04-analysis-workbench-design.md 5절

지표 종류마다 읽기 함수 하나. 품목 · 지점 · 검색어는 원본 테이블과 레포 CSV 에서 찾는다 — 이 파일에 품목 이름은 없다.
  retail:{품목}          KAMIS 소매 서울 경동·복조리 평균 (retail_market_price)          일 · 평균
  wholesale:{품목}       KAMIS 도매 가락도매 (wholesale_market_price)                   일 · 평균
  auction:{품목}         가락시장 경매가 상 (agri_price + 레포 hist_daily_*.csv)          일 · 평균
  supply:{품목}          가락시장 반입량 (supply_data 일별 합 + hist_supply*.csv 순별)     순 · 합계
  station_temp|rain:{지점}  기상청 ASOS 관측소 일별 (station_weather_data)               일 · 평균|합계
  area_temp|rain:{지점}     산지 기상 순별 (weather_*.csv)                              순 · 평균|합계
  fx:usd · fx:cny        환율 (hist_exchange.csv 순 + exchange_rate_daily)              순 · 평균
  oil:diesel             경유 전국 평균 (oil_price)                                     일 · 평균
  cpi:{품목} · ppi:{품목}  KOSIS 품목별 물가지수 (cpi_data · ppi_data)                    월 · 평균
  search:{검색어}         네이버 검색량 (search_trend)                                   일 · 평균

지켜야 할 것
  - 순 주기 값은 그 순 첫날(1·11·21일), 월 값은 1일에 둔다
  - 지표마다 통째로 다시 쓴다(두 번 돌려도 같다). 원본이 비면 그 지표는 건너뛰고 기존 값을 둔다
  - 레포 과거분(CSV)과 DB 를 잇는 지표는 CSV 가 우선, DB 는 CSV 마지막 날 뒤만 (pipeline_retail.load_garak 과 같다)

systemd 타이머로 매일 12:50 KST (인사이트 12:40 뒤).
"""
import glob
import logging
import os
import sys
import time
from datetime import date

import numpy as np
import pandas as pd

import pipeline_retail as pr

CATALOG, VALUES = 'series_catalog', 'series_value'
CATEGORY_ORDER = ('가격', '수급', '기상', '거시', '관심도')
INSERT_CHUNK = 5000
# ASOS 지점 번호 → 이름 (백엔드 StationWeatherCollectService 의 수집 지점과 같다)
STATIONS = {165: '무안', 264: '창녕', 247: '함양', 184: '제주', 100: '평창', 188: '구좌',
            288: '밀양', 216: '태백', 261: '해남', 226: '괴산', 177: '홍성'}
AREA_FILES = {'haenam': '해남', 'taebak': '태백', 'miryang': '밀양'}   # weather_{키}.csv

log = logging.getLogger('pipeline_series')


# ---------------------------------------------------------------- 날짜 · Series 도우미
def soon_first_day(code):
    """'202609하순' → 2026-09-21"""
    return pr.soon_start(str(code))


def month_first_day(year, month):
    return date(int(year), int(month), 1)


def series_from(pairs):
    """[(날짜, 값)] → 날짜 오름차순 Series (같은 날은 평균, 값 없는 행은 뺀다)"""
    if not pairs:
        return pd.Series(dtype=float)
    s = pd.Series([float(v) if v is not None else np.nan for _, v in pairs],
                  index=[d if isinstance(d, date) else pd.Timestamp(d).date() for d, _ in pairs], dtype=float)
    s = s[np.isfinite(s.values)]
    return s.groupby(level=0).mean().sort_index()


def to_soon(daily, how, complete_only=False):
    """일별 Series → 순 첫날 기준 Series (how: mean|sum).
    complete_only: 진행 중인 순은 뺀다 — 합계 지표는 순 중간 값이 실제보다 작게 찍힌다"""
    if daily.empty:
        return daily
    codes = pr.soon_codes(pd.to_datetime(list(daily.index)))
    s = daily.groupby(codes).agg(how)
    s.index = [soon_first_day(c) for c in s.index]
    s = s.sort_index()
    if complete_only:
        s = s[s.index < soon_first_day(pr.soon_code(pr.kst_today()))]
    return s


def join_history(history, recent):
    """레포 과거분이 우선, DB 는 과거분 마지막 날 뒤만"""
    history, recent = history.dropna(), recent.dropna()
    if history.empty:
        return recent.sort_index()
    if recent.empty:
        return history.sort_index()
    return pd.concat([history, recent[recent.index > history.index.max()]]).sort_index()


def make(series_id, name, category, source, unit, freq, agg, values, item=None):
    return dict(id=series_id, name=name, item=item, category=category, source=source, unit=unit,
                freq=freq, agg=agg, values=values)


def query(conn, sql, args=()):
    with conn.cursor() as cur:
        cur.execute(sql, args)
        return cur.fetchall()


def read_csv(path):
    return pd.read_csv(path, encoding='utf-8-sig')


# ---------------------------------------------------------------- 가격
def load_retail(conn):
    """KAMIS 소매 — 경동·복조리 그날 값 평균(있는 곳만). 단위는 retail_price 의 최근 단위"""
    marks = ','.join(['%s'] * len(pr.MARKETS))
    rows = query(conn, f"""SELECT item_name, price_date, AVG(price) FROM retail_market_price
                           WHERE market_name IN ({marks}) AND price > 0 GROUP BY item_name, price_date""",
                 tuple(pr.MARKETS))
    units = dict(query(conn, """SELECT r.ITEM_NAME, r.UNIT FROM retail_price r
                                JOIN (SELECT ITEM_NAME, MAX(PRICE_DATE) d FROM retail_price
                                      WHERE UNIT IS NOT NULL GROUP BY ITEM_NAME) m
                                  ON r.ITEM_NAME = m.ITEM_NAME AND r.PRICE_DATE = m.d"""))
    out = []
    for item in sorted({r[0] for r in rows}):
        unit = units.get(item)
        out.append(make(f'retail:{item}', f'{item} 소매가', '가격', 'KAMIS 소매 · 서울 경동·복조리 평균',
                        f'원/{unit}' if unit else '원', 'daily', 'mean',
                        series_from([(d, v) for i, d, v in rows if i == item]), item))
    return out


def load_wholesale(conn):
    rows = query(conn, """SELECT item_name, price_date, price FROM wholesale_market_price
                          WHERE market_name = %s AND price > 0""", (pr.WHOLESALE_MARKET,))
    return [make(f'wholesale:{item}', f'{item} 도매가', '가격', f'KAMIS 도매 · {pr.WHOLESALE_MARKET}(중도매인 판매가)',
                 '원 (KAMIS 도매 거래 단위)', 'daily', 'mean',
                 series_from([(d, v) for i, d, v in rows if i == item]), item)
            for item in sorted({r[0] for r in rows})]


def auction_units():
    """레포 hist_price*.csv 의 품목명 → 단위 (예: 10키로망대)"""
    units = {}
    for path in sorted(glob.glob(os.path.join(pr.DATA, 'hist_price*.csv'))):
        h = read_csv(path)
        if {'품목명', '단위'} <= set(h.columns) and len(h):
            for item, unit in h[['품목명', '단위']].dropna().drop_duplicates('품목명').values:
                units.setdefault(item, unit)
    return units


def auction_history():
    """레포 일별 경매가 과거분: pipeline_retail.GARAK 의 (CSV, 가락 품목명) 짝 → {품목: Series}"""
    out = {}
    for csv_name, item in pr.GARAK.values():
        path = os.path.join(pr.DATA, csv_name)
        if os.path.exists(path):
            h = read_csv(path)
            if {'date', '상'} <= set(h.columns):
                out[item] = series_from(list(zip(pd.to_datetime(h['date']).dt.date, h['상'])))
    return out


def load_auction(conn):
    rows = query(conn, "SELECT item_name, year, month, day, avg_price FROM agri_price WHERE avg_price > 0")
    history, units = auction_history(), auction_units()
    out = []
    for item in sorted({r[0] for r in rows} | set(history)):
        recent = series_from([(date(int(y), int(m), int(d)), v) for i, y, m, d, v in rows if i == item])
        unit = units.get(item)
        out.append(make(f'auction:{item}', f'{item} 경매가', '가격', '가락시장 경매가 · 상 등급(농넷)',
                        f'원/{unit}' if unit else '원', 'daily', 'mean',
                        join_history(history.get(item, pd.Series(dtype=float)), recent), item))
    return out


# ---------------------------------------------------------------- 수급
def supply_history():
    """레포 hist_supply*.csv (파일 안 품목명) → {품목: 순 Series}"""
    out = {}
    for path in sorted(glob.glob(os.path.join(pr.DATA, 'hist_supply*.csv'))):
        h = read_csv(path)
        if not {'DATE', '품목명', '총반입량'} <= set(h.columns):
            continue
        for item, g in h.groupby('품목명'):
            out.setdefault(item, series_from(list(zip([soon_first_day(c) for c in g['DATE']], g['총반입량']))))
    return out


def load_supply(conn):
    rows = query(conn, "SELECT ITEM_NAME, YEAR, MONTH, DAY, TOTAL_SUPPLY FROM supply_data WHERE TOTAL_SUPPLY IS NOT NULL")
    history = supply_history()
    out = []
    for item in sorted({r[0] for r in rows} | set(history)):
        daily = series_from([(date(int(y), int(m), int(d)), v) for i, y, m, d, v in rows if i == item])
        out.append(make(f'supply:{item}', f'{item} 반입량', '수급', '가락시장 반입량(서울시농수산식품공사)', '톤',
                        'soon', 'sum',
                        join_history(history.get(item, pd.Series(dtype=float)), to_soon(daily, 'sum', complete_only=True)),
                        item))
    return out


# ---------------------------------------------------------------- 기상
def load_station_weather(conn):
    rows = query(conn, """SELECT STATION_CODE, OBSERVATION_DATE, AVG_TEMP, RAINFALL FROM station_weather_data""")
    out = []
    for code in sorted({int(r[0]) for r in rows}):
        name = STATIONS.get(code, f'관측소 {code}')
        mine = [r for r in rows if int(r[0]) == code]
        out.append(make(f'station_temp:{code}', f'{name} 기온', '기상', f'기상청 ASOS {name}({code})', '℃',
                        'daily', 'mean', series_from([(d, t) for _, d, t, _ in mine])))
        out.append(make(f'station_rain:{code}', f'{name} 강수량', '기상', f'기상청 ASOS {name}({code})', 'mm',
                        'daily', 'sum', series_from([(d, r) for _, d, _, r in mine])))
    return out


def load_area_weather():
    """산지 기상 순별 CSV — 관측소마다 열 이름이 달라 기온은 평균(또는 최저·최고 평균), 강수는 있는 열 그대로"""
    out = []
    for path in sorted(glob.glob(os.path.join(pr.DATA, 'weather_*.csv'))):
        w = read_csv(path)
        if 'DATE' not in w.columns:
            continue
        key = os.path.basename(path)[len('weather_'):-len('.csv')]
        name = AREA_FILES.get(key, key)
        days = [soon_first_day(c) for c in w['DATE']]
        temp = next((w[c] for c in w.columns if c.startswith('평균 기온')), None)
        if temp is None and {'평균_최저기온', '평균_최고기온'} <= set(w.columns):
            temp = (w['평균_최저기온'] + w['평균_최고기온']) / 2
        if temp is not None:
            out.append(make(f'area_temp:{key}', f'{name} 산지 기온', '기상', f'산지 기상 {name} (순별, 도매 예측 입력)',
                            '℃ (순 평균)', 'soon', 'mean', series_from(list(zip(days, temp)))))
        if '총_강수량' in w.columns:
            out.append(make(f'area_rain:{key}', f'{name} 산지 강수량', '기상', f'산지 기상 {name} (순별, 도매 예측 입력)',
                            'mm (순 합계)', 'soon', 'sum', series_from(list(zip(days, w['총_강수량'])))))
        elif '평균 강수량(mm)' in w.columns:
            out.append(make(f'area_rain:{key}', f'{name} 산지 강수량', '기상', f'산지 기상 {name} (순별, 도매 예측 입력)',
                            'mm (순 일평균)', 'soon', 'mean', series_from(list(zip(days, w['평균 강수량(mm)'])))))
    return out


# ---------------------------------------------------------------- 거시 · 관심도
def load_fx(conn):
    path = os.path.join(pr.DATA, 'hist_exchange.csv')
    h = read_csv(path) if os.path.exists(path) else pd.DataFrame()
    rows = query(conn, "SELECT BASE_DATE, USD_KRW, CNY_KRW FROM exchange_rate_daily")
    out = []
    for key, col, label, idx in (('usd', '원/달러', '원/달러 환율', 1), ('cny', '원/위안', '원/위안 환율', 2)):
        hist = (series_from(list(zip([soon_first_day(c) for c in h['DATE']], h[col])))
                if col in h.columns else pd.Series(dtype=float))
        recent = to_soon(series_from([(r[0], r[idx]) for r in rows]), 'mean')
        out.append(make(f'fx:{key}', label, '거시', '한국수출입은행 매매기준율', col, 'soon', 'mean',
                        join_history(hist, recent)))
    return out


def load_oil(conn):
    rows = query(conn, "SELECT PRICE_DATE, AVG_PRICE FROM oil_price WHERE AVG_PRICE IS NOT NULL")
    return [make('oil:diesel', '경유 가격', '거시', '오피넷 자동차용 경유 전국 평균', '원/L', 'daily', 'mean',
                 series_from([(d, v) for d, v in rows]))]


def load_price_index(conn, table, column, prefix, label, source):
    rows = query(conn, f"SELECT ITEM_NAME, YEAR, MONTH, {column} FROM {table} WHERE {column} IS NOT NULL")
    return [make(f'{prefix}:{item}', f'{item} {label}', '거시', source, '지수', 'monthly', 'mean',
                 series_from([(month_first_day(y, m), v) for i, y, m, v in rows if i == item]), item)
            for item in sorted({r[0] for r in rows})]


def load_search(conn):
    rows = query(conn, "SELECT KEYWORD, PERIOD, RATIO FROM search_trend")
    return [make(f'search:{kw}', f"'{kw}' 검색량", '관심도', '네이버 데이터랩 검색어 트렌드', '상대값 (기간 최댓값 100)',
                 'daily', 'mean', series_from([(d, v) for k, d, v in rows if k == kw]))
            for kw in sorted({r[0] for r in rows})]


LOADERS = [
    ('KAMIS 소매', load_retail),
    ('KAMIS 도매', load_wholesale),
    ('가락 경매가', load_auction),
    ('가락 반입량', load_supply),
    ('관측소 기상', load_station_weather),
    ('산지 기상', lambda conn: load_area_weather()),
    ('환율', load_fx),
    ('유가', load_oil),
    ('소비자물가', lambda conn: load_price_index(conn, 'cpi_data', 'CPI', 'cpi', '소비자물가지수', 'KOSIS 소비자물가지수(품목별)')),
    ('생산자물가', lambda conn: load_price_index(conn, 'ppi_data', 'PPI', 'ppi', '생산자물가지수', 'KOSIS 생산자물가지수(품목별)')),
    ('검색량', load_search),
]


# ---------------------------------------------------------------- 쓰기
def catalog_row(s, order):
    v = s['values']
    return (s['id'], s['name'], s['item'], s['category'], s['source'], s['unit'], s['freq'], s['agg'],
            v.index.min(), v.index.max(), int(len(v)), order)


def ensure_tables(cur):
    cur.execute(f"""CREATE TABLE IF NOT EXISTS {CATALOG} (
                       series_id VARCHAR(80) NOT NULL PRIMARY KEY,
                       name VARCHAR(100) NOT NULL,
                       item VARCHAR(30),
                       category VARCHAR(20) NOT NULL,
                       source VARCHAR(100) NOT NULL,
                       unit VARCHAR(40),
                       freq VARCHAR(10) NOT NULL,
                       agg VARCHAR(10) NOT NULL,
                       first_date DATE, last_date DATE, n_points INT, sort_order INT,
                       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)""")
    cur.execute(f"""CREATE TABLE IF NOT EXISTS {VALUES} (
                       series_id VARCHAR(80) NOT NULL,
                       obs_date DATE NOT NULL,
                       value DOUBLE NOT NULL,
                       PRIMARY KEY (series_id, obs_date))""")


def save(conn, series):
    """지표마다 값을 통째로 바꾸고 목록 행을 갱신한다. 빈 지표는 건너뛴다(기존 값 유지)"""
    series = [s for s in series if len(s['values'])]
    order = {c: i for i, c in enumerate(CATEGORY_ORDER)}
    series.sort(key=lambda s: (order.get(s['category'], 99), s['item'] or '', s['id']))
    with conn.cursor() as cur:
        ensure_tables(cur)
    conn.commit()
    for n, s in enumerate(series):
        rows = [(s['id'], d, float(v)) for d, v in s['values'].items()]
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {VALUES} WHERE series_id = %s", (s['id'],))
            for i in range(0, len(rows), INSERT_CHUNK):
                cur.executemany(f"INSERT INTO {VALUES} (series_id, obs_date, value) VALUES (%s, %s, %s)",
                                rows[i:i + INSERT_CHUNK])
            cur.execute(f"""INSERT INTO {CATALOG} (series_id, name, item, category, source, unit, freq, agg,
                                                   first_date, last_date, n_points, sort_order)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE name=VALUES(name), item=VALUES(item), category=VALUES(category),
                              source=VALUES(source), unit=VALUES(unit), freq=VALUES(freq), agg=VALUES(agg),
                              first_date=VALUES(first_date), last_date=VALUES(last_date),
                              n_points=VALUES(n_points), sort_order=VALUES(sort_order)""",
                        catalog_row(s, n))
        conn.commit()
    return len(series)


def collect(conn):
    """모든 읽기 함수를 돌린다. 반환: (지표 목록, 실패한 출처 이름들)"""
    series, failed = [], []
    for name, fn in LOADERS:
        try:
            got = fn(conn)
            empty = [s['id'] for s in got if not len(s['values'])]
            log.info('%s: 지표 %d개 (빈 지표 %d)', name, len(got), len(empty))
            series += got
        except Exception:   # noqa: BLE001 — 한 출처가 실패해도 나머지는 적재한다
            log.exception('%s 읽기 실패', name)
            failed.append(name)
    return series, failed


def main():
    t = time.time()
    conn = pr.db(pr.props())
    try:
        series, failed = collect(conn)
        n = save(conn, series)
    finally:
        conn.close()
    log.info('적재 지표 %d개, 실패 출처 %s, %.0fs', n, failed or '없음', time.time() - t)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
