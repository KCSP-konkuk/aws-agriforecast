#!/usr/bin/env python3
"""양파 순별 가격 예측 파이프라인 (배치 실행)

  1. 기상청 ASOS API로 기상 데이터 증분 수집 → 순별 집계
  2. DB(agri_price/supply_data/exchange_rate_daily/cpi_data/ppi_data)에서 2026년 이후 순별 집계
  3. 과거분(레포 CSV, 2018~)과 결합
  4. XGBoost 학습 후 '다음 1순' 예측
  5. onion_predictions 테이블에 upsert + 지난 순의 actual_price/error_pct 갱신

배추(pipeline.py)와 다른 점 — 옮겨 쓸 때 여기서 틀리기 쉽다.
  - **기상 집계가 전 컬럼 평균이다.** 배추는 강수량만 합계인데, 원본 창녕 일별 데이터를
    순별로 접어 `날씨데이터_순별.csv` 와 대조한 결과 양파는 강수량도 평균이었다.
  - 기상 지점이 하나다(계절 전환 없음). 배추는 7~9월만 태백으로 갈아탄다.
  - 평균기온·일조시간을 쓴다. 배추 피쳐에는 없어 pipeline.py 는 아예 받지 않는다.
  - 검색량을 쓰지 않는다. 대신 환율과 물가지수(CPI/PPI)를 쓴다.
  - 평년(`p_vs_py`)이 필수다. 배추 v2 는 평년을 안 써서 농넷 없이도 돌았다.
  - 유가는 쓰지 않는다. v5 원본은 `oil_ma3`·`oil_chg` 를 골랐으나, 빼는 쪽이 2025
    홀드아웃에서 더 좋았다(R² 0.8372→0.8376, MAPE 7.8%→7.6%).

systemd 타이머로 매일 실행. 순이 바뀌면 예측 대상이 자동으로 다음 순이 된다.
"""
import logging
import os
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import pymysql
import requests
import xgboost as xgb

import backtest

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
SECRET = '/opt/agri-forecast/application-secret.properties'
KMA_URL = 'https://apihub.kma.go.kr/api/typ01/url/kma_sfcdd.php'

ITEM = '양파'
STATION = 288          # 밀양 — 원본 기준지 창녕군 대지면에 가장 가까운 ASOS 상시 지점
SOLAR_DONOR = 264      # 거창 — 일사는 전 구간 이쪽 값을 쓴다(밀양 관측은 2025-05 부터뿐)
WEATHER_CSV = 'weather_miryang.csv'
PM = {'상순': 0, '중순': 1, '하순': 2}
PS = ['상순', '중순', '하순']
# 0-based. pipeline.py 의 KMA_IDX 에 TA(평균기온)·SS(일조시간)를 더한 것
KMA_IDX = dict(TA=10, TMAX=11, TMIN=13, HM=18, SS=32, SI=35, RN=38)
KMA_MISS = {-9.0, -99.0, -999.0}

WCOLS_RAW = ['평균 기온(°C)', '최고 기온(°C)', '최저 기온(°C)', '전년 기온(°C)',
             '평균 강수량(mm)', '전년 강수량(mm)', '평균 일조시간(hr)', '전년 일조시간(hr)',
             '평균 일사량(MJ/㎡)', '전년 일사량(MJ/㎡)', '평균 습도(%)', '전년 습도(%)']
ECOLS = ['원/달러', '달러_등락률(%)', '원/위안', '위안_등락률(%)']
TARGET = '평균가격'

# v5 의 CV 탐색을 이 구성(밀양 기상 · 유가 제외 · API 평년)으로 다시 돌려 고른 40개.
# 하이퍼파라미터도 같은 탐색의 최적값이다. 기상 지점이 바뀌면 둘 다 다시 뽑아야 한다.
SELECTED = ['ppi_l1', 'ppi_x_gap', 'cpi_ppi_ratio', 'plag1', 'plag1_x_gap', 'pma3', 'ps_ratio',
            'ppi_l6', 'pysin', 'usd_ma6', '평균 기온(°C)_l6', 'usd_l6', '최저 기온(°C)_l3',
            'cny_l3', '최저 기온(°C)_l6', 'usd_ma3', 'msin', 'pma12', 'usd_l3',
            '최저 기온(°C)_l9', 'temp_range_l3', '최고 기온(°C)_l1', 'usd_l1', 'sma6', 'pmom3',
            'pma6', 'pyoy', 'p_vs_py', '최고 기온(°C)_l6', 'p_vs_jn', '최고 기온(°C)_l9',
            'cpi_l1', '평균 기온(°C)_l9', 'cpi_l3', 'ppi_l3', '평균 일조시간(hr)_l1', 'cny_l6',
            'schg', '평균 습도(%)_l6', '평균 습도(%)_l9']
PARAMS = dict(n_estimators=300, max_depth=2, learning_rate=0.03, subsample=0.9,
              colsample_bytree=0.8, random_state=42, verbosity=0)
WEIGHT_JAN_APR = 1.5   # 보릿고개 구간 가중 — v5 와 동일

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('pipeline_onion')


def props():
    d = {}
    with open(SECRET) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                d[k.strip()] = v.strip()
    return d


P = props()


def db():
    url = P['spring.datasource.url']              # jdbc:mysql://host:port/db?params
    after = url.split('//', 1)[1]
    hostport, _, rest = after.partition('/')      # split('/')[-1] 은 Asia/Seoul 에 걸린다
    host = hostport.split(':')[0]
    name = rest.split('?')[0]
    return pymysql.connect(host=host, user=P['spring.datasource.username'],
                           password=P['spring.datasource.password'], database=name,
                           charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)


def per(day):
    return '상순' if day <= 10 else '중순' if day <= 20 else '하순'


def to_idx(y, m, p):
    return (y - 2017) * 36 + (m - 1) * 3 + p + 1


def datestr(y, m, p):
    return f'{y}{m:02d}{PS[p]}'


def next_period(y, m, p):
    if p < 2:
        return y, m, p + 1
    if m < 12:
        return y, m + 1, 0
    return y + 1, 1, 0


KST = ZoneInfo('Asia/Seoul')


def kst_today():
    """서버 TZ가 UTC라 date.today()는 KST 새벽 실행 시 하루 전을 가리킨다.
    순(旬) 판정·기상 수집 범위는 모두 한국 날짜 기준이어야 한다."""
    return datetime.now(KST).date()


def last_complete_period(today):
    """오늘이 속한 순은 아직 진행 중이므로 그 직전 순이 마지막 완성순"""
    y, m, d = today.year, today.month, today.day
    p = PM[per(d)]
    if p > 0:
        return y, m, p - 1
    if m > 1:
        return y, m - 1, 2
    return y - 1, 12, 2


# ---------------------------------------------------------------- 기상
def fetch_kma(start, end, stn):
    rows = []
    d = start
    key = P['weather.auth-key']
    while d <= end:
        try:
            r = requests.get(KMA_URL, params={'tm': d.strftime('%Y%m%d'), 'stn': str(stn),
                                              'disp': 0, 'help': 0, 'authKey': key}, timeout=40)
            for line in r.text.splitlines():
                if line.startswith('#') or not line.strip():
                    continue
                f = line.split()
                if len(f) < 40:
                    continue

                def g(k):
                    try:
                        v = float(f[KMA_IDX[k]])
                    except (ValueError, IndexError):
                        return np.nan
                    return np.nan if v in KMA_MISS else v
                rows.append(dict(tm=f[0], stn=int(f[1]), TA=g('TA'), TMAX=g('TMAX'),
                                 TMIN=g('TMIN'), HM=g('HM'), SS=g('SS'), SI=g('SI'), RN=g('RN')))
        except Exception as e:
            log.warning('기상 조회 실패 %s: %s', d, e)
        d += timedelta(days=1)
    return pd.DataFrame(rows)


def aggregate_weather(daily):
    """전 컬럼 평균. 강수량도 평균이다 — 배추와 다른 지점."""
    d = daily.copy()
    d['RN'] = d.RN.fillna(0)          # 결측은 무강수
    d['Year'] = d.tm.str[:4].astype(int)
    d['Month'] = d.tm.str[4:6].astype(int)
    d['P'] = d.tm.str[6:8].astype(int).map(per)
    g = d.groupby(['Year', 'Month', 'P'], as_index=False).agg(**{
        '평균 기온(°C)': ('TA', 'mean'), '최고 기온(°C)': ('TMAX', 'mean'),
        '최저 기온(°C)': ('TMIN', 'mean'), '평균 강수량(mm)': ('RN', 'mean'),
        '평균 일조시간(hr)': ('SS', 'mean'), '평균 일사량(MJ/㎡)': ('SI', 'mean'),
        '평균 습도(%)': ('HM', 'mean')})
    g['DATE'] = [datestr(r.Year, r.Month, PM[r.P]) for r in g.itertuples()]
    g['k'] = [to_idx(r.Year, r.Month, PM[r.P]) for r in g.itertuples()]
    return g.sort_values('k').reset_index(drop=True)


def update_weather():
    """기존 CSV 뒤로 부족한 구간만 API로 받아 이어붙임. 전년 컬럼은 36순 전 값."""
    path = os.path.join(DATA, WEATHER_CSV)
    cur = pd.read_csv(path, encoding='utf-8-sig')
    cur.columns = [c.strip() for c in cur.columns]
    have_max = str(cur.DATE.astype(str).max())
    # 마지막 보유 순은 진행 중이었을 수 있으므로 그 달부터 다시 받아 덮어씀
    start = date(int(have_max[:4]), int(have_max[4:6]), 1)
    daily = fetch_kma(start, kst_today() - timedelta(days=1), f'{STATION}:{SOLAR_DONOR}')
    if daily.empty:
        log.warning('기상 신규 데이터 없음 — 기존 CSV 사용')
        merged = cur
    else:
        new = aggregate_weather(daily[daily.stn == STATION])
        don = aggregate_weather(daily[daily.stn == SOLAR_DONOR])[['DATE', '평균 일사량(MJ/㎡)']] \
            .rename(columns={'평균 일사량(MJ/㎡)': 'si_d'})
        new = new.merge(don, on='DATE', how='left')
        # 일사는 결측만 메우는 게 아니라 **항상** 거창 값으로 덮는다. fillna 로 두면 밀양에
        # 관측이 생긴 2025-05 를 기점으로 한 컬럼 안에서 관측지가 갈린다.
        new['평균 일사량(MJ/㎡)'] = new['si_d']
        new = new.drop(columns=['si_d'])
        keep = cur[cur.DATE.astype(str) < new.DATE.astype(str).min()]
        merged = pd.concat([keep, new[['DATE'] + [c for c in new.columns
                                                  if c in WCOLS_RAW]]], ignore_index=True)
        merged['k'] = [to_idx(int(str(d)[:4]), int(str(d)[4:6]), PM[str(d)[6:]])
                       for d in merged.DATE]
        merged = merged.sort_values('k').drop(columns=['k']).reset_index(drop=True)
        for src, dst in [('평균 기온(°C)', '전년 기온(°C)'),
                         ('평균 강수량(mm)', '전년 강수량(mm)'),
                         ('평균 일조시간(hr)', '전년 일조시간(hr)'),
                         ('평균 일사량(MJ/㎡)', '전년 일사량(MJ/㎡)'),
                         ('평균 습도(%)', '전년 습도(%)')]:
            merged[dst] = merged[src].shift(36)
        merged = merged[['DATE'] + WCOLS_RAW].round(3)
        merged.to_csv(path, index=False, encoding='utf-8-sig')
        log.info('기상 갱신 → %s (%d행)', merged.DATE.astype(str).max(), len(merged))
    merged['idx'] = [to_idx(int(str(d)[:4]), int(str(d)[4:6]), PM[str(d)[6:]])
                     for d in merged.DATE]
    return merged


# ---------------------------------------------------------------- DB 집계
def build_from_db(conn, last_idx):
    with conn.cursor() as cur:
        cur.execute("SELECT year y, month m, day d, avg_price v FROM agri_price "
                    "WHERE item_name=%s", (ITEM,))
        price = pd.DataFrame(cur.fetchall())
        cur.execute("SELECT year y, month m, day d, total_supply v FROM supply_data "
                    "WHERE item_name=%s", (ITEM,))
        supply = pd.DataFrame(cur.fetchall())
        cur.execute("SELECT BASE_DATE bd, USD_KRW usd, CNY_KRW cny FROM exchange_rate_daily "
                    "ORDER BY BASE_DATE")
        fx = pd.DataFrame(cur.fetchall())
        cur.execute("SELECT YEAR y, MONTH m, CPI v FROM cpi_data WHERE ITEM_NAME=%s", (ITEM,))
        cpi = pd.DataFrame(cur.fetchall())
        cur.execute("SELECT YEAR y, MONTH m, PPI v FROM ppi_data WHERE ITEM_NAME=%s", (ITEM,))
        ppi = pd.DataFrame(cur.fetchall())

    def agg(df, how):
        if df.empty:
            return pd.DataFrame(columns=['idx', 'DATE', 'v'])
        df = df.copy()
        df['P'] = df.d.map(per)
        g = df.groupby(['y', 'm', 'P'], as_index=False).v.agg(how)
        g['idx'] = [to_idx(r.y, r.m, PM[r.P]) for r in g.itertuples()]
        g['DATE'] = [datestr(r.y, r.m, PM[r.P]) for r in g.itertuples()]
        return g[g.idx <= last_idx].sort_values('idx')[['idx', 'DATE', 'v']]

    p = agg(price, 'mean')      # 가격은 순내 일별 평균
    s = agg(supply, 'sum')      # 반입량은 순내 합계

    # 환율: 순내 평균. 등락률은 일별 전일대비(%)의 순내 평균 — 원본 CSV 와 오차 0으로 일치.
    if fx.empty:
        e = pd.DataFrame(columns=['idx', 'DATE'] + ECOLS)
    else:
        fx['bd'] = pd.to_datetime(fx.bd)
        fx = fx.sort_values('bd')
        fx['달러_등락률(%)'] = fx.usd.pct_change() * 100
        fx['위안_등락률(%)'] = fx.cny.pct_change() * 100
        fx['y'], fx['m'], fx['d'] = fx.bd.dt.year, fx.bd.dt.month, fx.bd.dt.day
        fx['P'] = fx.d.map(per)
        e = fx.groupby(['y', 'm', 'P'], as_index=False).agg(
            **{'원/달러': ('usd', 'mean'), '원/위안': ('cny', 'mean'),
               '달러_등락률(%)': ('달러_등락률(%)', 'mean'),
               '위안_등락률(%)': ('위안_등락률(%)', 'mean')})
        e['idx'] = [to_idx(r.y, r.m, PM[r.P]) for r in e.itertuples()]
        e['DATE'] = [datestr(r.y, r.m, PM[r.P]) for r in e.itertuples()]
        e = e[e.idx <= last_idx].sort_values('idx')[['idx', 'DATE'] + ECOLS]

    # 물가지수는 월별 → 그 달의 세 순에 같은 값을 편다
    def monthly(df, col):
        if df.empty:
            return pd.DataFrame(columns=['idx', col])
        rows = []
        for r in df.itertuples():
            for p_ in range(3):
                rows.append({'idx': to_idx(r.y, r.m, p_), col: r.v})
        out = pd.DataFrame(rows)
        return out[out.idx <= last_idx].sort_values('idx')

    return p, s, e, monthly(cpi, 'CPI'), monthly(ppi, 'PPI')


# ---------------------------------------------------------------- 피쳐
def build_features(df):
    """v5 와 동일한 파생. 유가 계열만 뺐다."""
    for lag in [1, 2, 3, 4, 5, 6, 9, 12, 18, 36]:
        df[f'plag{lag}'] = df[TARGET].shift(lag)
    for w in [3, 6, 12]:
        df[f'pma{w}'] = df[TARGET].shift(1).rolling(w).mean()
    for w in [3, 6]:
        df[f'pstd{w}'] = df[TARGET].shift(1).rolling(w).std()
    df['pmom3'] = df['plag1'] - df['plag4']
    df['pmom6'] = df['plag1'] - df['plag6']
    df['pyoy'] = df[TARGET].shift(1) / df[TARGET].shift(37) - 1
    df['p_vs_py'] = df['plag1'] / df['평년'].replace(0, np.nan)
    df['p_vs_jn'] = df['plag1'] / df['전년'].replace(0, np.nan)
    df['p_ratio_12'] = df['plag1'] / df['plag12'].replace(0, np.nan)

    for lag in [1, 2, 3]:
        df[f'slag{lag}'] = df['총반입량'].shift(lag)
    df['sma3'] = df['총반입량'].shift(1).rolling(3).mean()
    df['sma6'] = df['총반입량'].shift(1).rolling(6).mean()
    df['schg'] = df['총반입량'].shift(1).pct_change()
    df['svma'] = df['slag1'] / df['sma6'].replace(0, np.nan)
    df['ps_ratio'] = df['plag1'] / df['slag1'].replace(0, np.nan)

    for lag in [1, 3, 6]:
        df[f'usd_l{lag}'] = df['원/달러'].shift(lag)
        df[f'cny_l{lag}'] = df['원/위안'].shift(lag)
        df[f'usd_chg_l{lag}'] = df['달러_등락률(%)'].shift(lag)
        df[f'cny_chg_l{lag}'] = df['위안_등락률(%)'].shift(lag)
    df['usd_ma3'] = df['원/달러'].shift(1).rolling(3).mean()
    df['usd_ma6'] = df['원/달러'].shift(1).rolling(6).mean()
    df['cny_ma3'] = df['원/위안'].shift(1).rolling(3).mean()

    for lag in [1, 3, 6]:
        df[f'cpi_l{lag}'] = df['CPI'].shift(lag)
        df[f'ppi_l{lag}'] = df['PPI'].shift(lag)
    df['cpi_chg'] = df['CPI'].shift(1).pct_change()
    df['ppi_chg'] = df['PPI'].shift(1).pct_change()
    df['cpi_ppi_ratio'] = df['CPI'].shift(1) / df['PPI'].shift(1).replace(0, np.nan)

    curr_wcols = [c for c in WCOLS_RAW if '전년' not in c]
    for c in curr_wcols:
        for lag in [1, 3, 6, 9]:
            df[f'{c}_l{lag}'] = df[c].shift(lag)
    for curr, prev in [('평균 기온(°C)', '전년 기온(°C)'), ('평균 강수량(mm)', '전년 강수량(mm)'),
                       ('평균 일사량(MJ/㎡)', '전년 일사량(MJ/㎡)'), ('평균 습도(%)', '전년 습도(%)')]:
        safe = curr.split('(')[0].strip().replace(' ', '_')
        df[f'{safe}_전년차'] = df[curr] - df[prev]
        df[f'{safe}_전년차_l3'] = df[f'{safe}_전년차'].shift(3)
    df['temp_range_l3'] = df['최고 기온(°C)'].shift(3) - df['최저 기온(°C)'].shift(3)
    df['heat_stress'] = (df['최고 기온(°C)'].shift(3) > 30).astype(int)
    df['cold_stress'] = (df['최저 기온(°C)'].shift(3) < -5).astype(int)
    df['heavy_rain_l3'] = (df['평균 강수량(mm)'].shift(3) > 10).astype(int)
    df['heavy_rain_l6'] = (df['평균 강수량(mm)'].shift(6) > 10).astype(int)
    df['drought_l3'] = (df['평균 강수량(mm)'].shift(3) < 0.5).astype(int)

    df['msin'] = np.sin(2 * np.pi * df['Month'] / 12)
    df['mcos'] = np.cos(2 * np.pi * df['Month'] / 12)
    df['piy'] = (df['Month'] - 1) * 3 + df['Period'] + 1
    df['pysin'] = np.sin(2 * np.pi * df['piy'] / 36)
    df['pycos'] = np.cos(2 * np.pi * df['piy'] / 36)
    df['harvest'] = ((df['Month'] >= 4) & (df['Month'] <= 6)).astype(int)
    df['storage'] = ((df['Month'] >= 7) | (df['Month'] <= 3)).astype(int)
    df['winter'] = ((df['Month'] >= 12) | (df['Month'] <= 2)).astype(int)
    df['supply_gap'] = ((df['Month'] >= 1) & (df['Month'] <= 3)).astype(int)
    df['plag1_x_gap'] = df['plag1'] * df['supply_gap']
    df['ppi_x_gap'] = df['PPI'].shift(1) * df['supply_gap']
    df['pmom3_x_winter'] = df['pmom3'] * df['winter']
    df['s_drop3'] = (df['slag1'] / df['sma3'].replace(0, np.nan)) - 1
    df['s_yoy'] = df['총반입량'].shift(1) / df['총반입량'].shift(37).replace(0, np.nan)
    df['p_accel'] = df['pmom3'] - df['pmom3'].shift(1)
    return df


def clean(df):
    """v5 와 동일: 선택 피쳐가 모두 유효해지는 지점부터 사용 후 보간"""
    first = df[SELECTED].dropna().index.min()
    if first is np.nan or pd.isna(first):
        raise RuntimeError('선택 피쳐가 전부 유효한 행이 없다')
    out = df.loc[first:].copy()
    out[SELECTED] = out[SELECTED].ffill().fillna(0).replace([np.inf, -np.inf], 0)
    return out


# ---------------------------------------------------------------- main
def fit_predict(train, test):
    """매일 예측과 백테스트가 같은 설정을 쓰도록 한 곳에 둔다"""
    w = np.where(train['Month'].values <= 4, WEIGHT_JAN_APR, 1.0)
    model = xgb.XGBRegressor(**PARAMS)
    model.fit(train[SELECTED].values, train[TARGET].values, sample_weight=w)
    return float(model.predict(test[SELECTED].values)[0])


def run_backtest(conn, df):
    """2026년 완료 순마다 직전 순까지만 학습해 예측 → onion_backtest. 피쳐가 빈 순은 매일 예측처럼 건너뛴다"""
    rows = []
    for t in backtest.targets(df.DATE, df[TARGET].notna()):
        ti = df.index[df.DATE == t][0]
        test = df.loc[[ti]]
        if test[SELECTED].isna().any(axis=None):
            log.warning('백테스트 %s 건너뜀: 결측 피쳐 %s', t, [c for c in SELECTED if test[c].isna().any()])
            continue
        train = df[(df.index < ti) & df[TARGET].notna()]
        rows.append(backtest.row(t, fit_predict(train, test), df.loc[ti, TARGET], train.DATE.iloc[-1]))
        log.info('백테스트 %s 예측 %.0f / 실제 %.0f (%.1f%%)', t, rows[-1]['predicted_price'],
                 rows[-1]['actual_price'], rows[-1]['error_pct'])
    backtest.save(conn, 'onion_backtest', rows)
    log.info('백테스트 %d순 저장, MAPE %s%%', len(rows), backtest.mape(rows))
    return 0


def main():
    ly, lm, lp = last_complete_period(kst_today())
    last_idx = to_idx(ly, lm, lp)
    ny, nm, np_ = next_period(ly, lm, lp)
    target_date = datestr(ny, nm, np_)
    log.info('완성된 마지막 순 %s / 예측 대상 %s', datestr(ly, lm, lp), target_date)

    weather = update_weather()
    conn = db()
    try:
        p_db, s_db, e_db, cpi_db, ppi_db = build_from_db(conn, last_idx)

        hp = pd.read_csv(os.path.join(DATA, 'hist_price_onion.csv'), encoding='utf-8-sig')
        hs = pd.read_csv(os.path.join(DATA, 'hist_supply_onion.csv'), encoding='utf-8-sig')
        he = pd.read_csv(os.path.join(DATA, 'hist_exchange.csv'), encoding='utf-8-sig')
        for d in (hp, hs, he):
            d.columns = [c.strip() for c in d.columns]

        price = pd.concat([hp[['DATE', TARGET, '전년', '평년']],
                           pd.DataFrame({'DATE': p_db.DATE, TARGET: p_db.v,
                                         '전년': np.nan, '평년': np.nan})], ignore_index=True)
        price = price.drop_duplicates('DATE', keep='first')
        supply = pd.concat([hs[['DATE', '총반입량']],
                            pd.DataFrame({'DATE': s_db.DATE, '총반입량': s_db.v})],
                           ignore_index=True).drop_duplicates('DATE', keep='first')
        exch = pd.concat([he[['DATE'] + ECOLS], e_db[['DATE'] + ECOLS]],
                         ignore_index=True).drop_duplicates('DATE', keep='first')

        # 예측 대상 행 추가
        price = pd.concat([price, pd.DataFrame([{'DATE': target_date, TARGET: np.nan,
                                                 '전년': np.nan, '평년': np.nan}])],
                          ignore_index=True)

        def meta(d):
            d = d.copy()
            s = d.DATE.astype(str)
            d['Year'] = s.str[:4].astype(int)
            d['Month'] = s.str[4:6].astype(int)
            d['Period'] = s.str[6:].map(PM)
            d['idx'] = [to_idx(r.Year, r.Month, r.Period) for r in d.itertuples()]
            return d.sort_values('idx').reset_index(drop=True)

        price, supply, exch = meta(price), meta(supply), meta(exch)
        # 전년은 36순 전 값과 일치한다(농넷 값과 대조 확인). 평년은 근사가 불가능해
        # 과거분 CSV 에만 있고, 그래서 신규 순은 농넷 수집으로 채워야 한다.
        price['전년'] = price['전년'].fillna(price[TARGET].shift(36))

        df = price[['idx', 'Year', 'Month', 'Period', 'DATE', TARGET, '전년', '평년']]
        df = df.merge(weather[['idx'] + WCOLS_RAW], on='idx', how='left')
        df = df.merge(supply[['idx', '총반입량']], on='idx', how='left')
        df = df.merge(exch[['idx'] + ECOLS], on='idx', how='left')
        df = df.merge(cpi_db, on='idx', how='left')
        df = df.merge(ppi_db, on='idx', how='left')
        df = df.sort_values('idx').reset_index(drop=True)
        # 물가지수는 발표가 한두 달 늦는다 — 마지막 값으로 끌어 쓴다
        df[['CPI', 'PPI']] = df[['CPI', 'PPI']].ffill()
        log.info('병합 %d행 (%s ~ %s)', len(df), df.DATE.iloc[0], df.DATE.iloc[-1])

        df = clean(build_features(df))
        if backtest.requested():
            return run_backtest(conn, df)

        train = df[(df.DATE != target_date) & df[TARGET].notna()]
        test = df[df.DATE == target_date]
        if test.empty:
            log.error('예측 대상 행 없음'); return 1
        if test[SELECTED].isna().any(axis=None):
            log.error('예측 대상 행에 결측 피쳐가 있다: %s',
                      [c for c in SELECTED if test[c].isna().any()])
            return 1
        log.info('학습 %d행 (%s ~ %s)', len(train), train.DATE.iloc[0], train.DATE.iloc[-1])

        pred = fit_predict(train, test)
        log.info('예측 %s = %.0f원', target_date, pred)

        with conn.cursor() as cur:
            cur.execute("""INSERT INTO onion_predictions (target_date, predicted_price)
                           VALUES (%s, %s)
                           ON DUPLICATE KEY UPDATE predicted_price=VALUES(predicted_price)""",
                        (target_date, round(pred, 2)))
            actual = df[df[TARGET].notna()][['DATE', TARGET]]
            for d, v in zip(actual['DATE'], actual[TARGET]):
                cur.execute("""UPDATE onion_predictions
                               SET actual_price=%s,
                                   error_pct=ROUND(ABS(predicted_price-%s)/NULLIF(%s,0)*100, 2)
                               WHERE target_date=%s AND actual_price IS NULL""",
                            (float(v), float(v), float(v), str(d)))
        conn.commit()
        log.info('DB 반영 완료')
        return 0
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
