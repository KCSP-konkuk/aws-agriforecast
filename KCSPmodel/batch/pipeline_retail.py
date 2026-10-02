#!/usr/bin/env python3
"""서울 전통시장 소매가 순별 예측 파이프라인 (배치 실행) — 붉은고추·양배추·양파·애호박·시금치·오이

모델 근거는 KCSP-konkuk/model-research(구 redpepper) 의 docs/RETAIL.md. 1순 뒤, 시험 2022~2025
  붉은고추 MASE 0.620 / MAPE 5.65% (5절), 양배추 0.663 / 4.54% (6절), 양파 0.684 / 1.67% (8절),
  애호박 0.639 / 6.31%, 시금치 0.591 / 6.43% (12절), 오이 0.676 / 6.70% (12.5절). 운영 모델 한눈에: 레포 docs/MODELS.md
  피쳐 구성은 다섯 품목이 같고(시금치만 달력 3개가 더 붙는다) 파라미터만 다르다. 오이만 소매 막판이 빠진다

  1. DB retail_market_price 에서 경동·복조리 일별 소매가 (백엔드 KamisRetailService 가 09:30·17:30 KST 수집)
  2. 가락 일별 가격 g
     - 붉은고추·양배추·양파: 농넷 가락 경매가(상) = 레포 hist_daily_*.csv + DB agri_price (백엔드가 11:00 KST 에 전날분)
       붉은고추 ← 홍고추 hist_daily_redpepper.csv(2001~), 양배추·양파 ← hist_daily_headcabbage.csv·hist_daily_onion.csv
       (2013-12~, 2018 이전은 농넷 백필)
     - 애호박·시금치·오이: KAMIS 16번 도매 '가락도매'(중도매인 판매가) = DB wholesale_market_price 만
       (백엔드 KamisWholesaleService 가 2014~ 적재, 09:30·17:30 KST 최근 14일). 농넷 백필 대신 쓴다(RETAIL.md 12.1)
  3. 순 단위 표 → 피쳐(소매 자기이력 + 가락 + 소매 막판, 품목별 GROUPS) → XGBoost 비율 타깃, 파라미터 5개 × 시드 12 평균
  4. retail_predictions upsert + 지난 순의 actual_price/error_pct 갱신

지켜야 할 것 — 실험(model-research experiments/retail/common.py·features.py)과 같게.
  - **목표 = 경동·복조리의 그날 값 평균(있는 곳만) → 순 평균.** 서울 평균(retail_price)이 아니다
  - 예측 대상 = 진행 중인 순 t. 소매·가락 모두 **순 t 시작일 전날까지**만 쓴다(대상 순 값은 하나도 안 본다)
  - 타깃은 `y[t] / y[t-1]`, 예측가 = 비율 × y[t-1]
  - 학습 표본은 2014-07 상순부터(복조리 조사 시작)
  - 피쳐 이름·계산을 바꾸면 테스트(tests/test_pipeline_retail.py)의 기준값부터 다시 맞출 것

systemd 타이머로 매일 12:10 KST 실행. 순 첫날에도 직전 순 마지막 날의 소매(당일 게시)·가락(11:00 수집)이 들어와 있다.
순 중간 실행도 입력이 같으므로 같은 예측을 다시 쓴다(늦게 올라온 직전 순 값이 있으면 그것만 반영된다).
"""
import logging
import os
import sys
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import xgboost as xgb

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
SECRET = '/opt/agri-forecast/application-secret.properties'
TABLE = 'retail_predictions'
MARKETS = ('경동', '복조리')
START = '201407상순'
KST = ZoneInfo('Asia/Seoul')

# 소매 품목 → 가락 경매가 일별 (레포 과거분 CSV, DB agri_price 품목명)
GARAK = {'붉은고추': ('hist_daily_redpepper.csv', '홍고추'),
         '양배추': ('hist_daily_headcabbage.csv', '양배추'),
         '양파': ('hist_daily_onion.csv', '양파')}
# g 를 KAMIS 도매(DB wholesale_market_price, 가락도매)로 쓰는 품목
KAMIS_G = ('애호박', '시금치', '오이')
WHOLESALE_MARKET = '가락도매'
ITEMS = (*GARAK, *KAMIS_G)

# 품목별 model-research experiments/retail/best_{품목}5.json h=1 'top' — 검증 2017~2021 에서 고른 상위 5개. K=None 은 피쳐 전부
BASE_PARAMS = dict(objective='reg:absoluteerror')
MODELS_PEPPER = [
    (None, dict(max_depth=5, n_estimators=600, learning_rate=0.02, subsample=1.0, colsample_bytree=0.9,
                min_child_weight=3, reg_lambda=3.0)),
    (None, dict(max_depth=5, n_estimators=1000, learning_rate=0.05, subsample=1.0, colsample_bytree=0.5,
                min_child_weight=3, reg_lambda=1.0)),
    (15, dict(max_depth=5, n_estimators=1000, learning_rate=0.05, subsample=1.0, colsample_bytree=0.5,
              min_child_weight=3, reg_lambda=1.0)),
    (None, dict(max_depth=4, n_estimators=300, learning_rate=0.02, subsample=1.0, colsample_bytree=0.9,
                min_child_weight=1, reg_lambda=1.0)),
    (None, dict(max_depth=5, n_estimators=1000, learning_rate=0.08, subsample=0.8, colsample_bytree=0.9,
                min_child_weight=3, reg_lambda=3.0)),
]
MODELS_CABBAGE = [
    (15, dict(max_depth=4, n_estimators=300, learning_rate=0.02, subsample=1.0, colsample_bytree=0.9,
              min_child_weight=1, reg_lambda=1.0)),
    (15, dict(max_depth=2, n_estimators=300, learning_rate=0.03, subsample=0.8, colsample_bytree=0.9,
              min_child_weight=1, reg_lambda=1.0)),
    (15, dict(max_depth=2, n_estimators=300, learning_rate=0.03, subsample=1.0, colsample_bytree=0.5,
              min_child_weight=1, reg_lambda=0.5)),
    (None, dict(max_depth=3, n_estimators=1000, learning_rate=0.02, subsample=1.0, colsample_bytree=0.5,
                min_child_weight=1, reg_lambda=0.5)),
    (15, dict(max_depth=2, n_estimators=600, learning_rate=0.02, subsample=0.8, colsample_bytree=0.7,
              min_child_weight=1, reg_lambda=0.5)),
]
MODELS_ONION = [
    (15, dict(max_depth=4, n_estimators=300, learning_rate=0.02, subsample=1.0, colsample_bytree=0.9,
              min_child_weight=1, reg_lambda=1.0)),
    (None, dict(max_depth=2, n_estimators=300, learning_rate=0.03, subsample=1.0, colsample_bytree=0.5,
                min_child_weight=1, reg_lambda=0.5)),
    (15, dict(max_depth=2, n_estimators=300, learning_rate=0.03, subsample=1.0, colsample_bytree=0.5,
              min_child_weight=1, reg_lambda=0.5)),
    (15, dict(max_depth=2, n_estimators=300, learning_rate=0.03, subsample=0.8, colsample_bytree=0.9,
              min_child_weight=1, reg_lambda=1.0)),
    (15, dict(max_depth=5, n_estimators=1000, learning_rate=0.05, subsample=1.0, colsample_bytree=0.5,
              min_child_weight=3, reg_lambda=1.0)),
]
MODELS_ZUCCHINI = [
    (None, dict(max_depth=2, n_estimators=1000, learning_rate=0.05, subsample=0.8, colsample_bytree=0.5,
                min_child_weight=1, reg_lambda=0.5)),
    (None, dict(max_depth=2, n_estimators=1000, learning_rate=0.08, subsample=0.8, colsample_bytree=0.9,
                min_child_weight=1, reg_lambda=3.0)),
    (15, dict(max_depth=5, n_estimators=600, learning_rate=0.03, subsample=1.0, colsample_bytree=0.9,
              min_child_weight=3, reg_lambda=1.0)),
    (None, dict(max_depth=5, n_estimators=600, learning_rate=0.03, subsample=1.0, colsample_bytree=0.9,
                min_child_weight=3, reg_lambda=1.0)),
    (15, dict(max_depth=5, n_estimators=1000, learning_rate=0.08, subsample=0.8, colsample_bytree=0.9,
              min_child_weight=3, reg_lambda=3.0)),
]
MODELS_SPINACH = [
    (15, dict(max_depth=2, n_estimators=600, learning_rate=0.05, subsample=0.8, colsample_bytree=0.9,
              min_child_weight=1, reg_lambda=3.0)),
    (None, dict(max_depth=2, n_estimators=1000, learning_rate=0.05, subsample=0.8, colsample_bytree=0.5,
                min_child_weight=1, reg_lambda=0.5)),
    # 실험의 기본 파라미터(model-research experiments/retail/common.PARAMS) — best_시금치5.json 에 params {} 로 들어 있다
    (None, dict(max_depth=3, n_estimators=400, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
                min_child_weight=3, reg_lambda=1.0)),
    (None, dict(max_depth=5, n_estimators=1000, learning_rate=0.05, subsample=1.0, colsample_bytree=0.5,
                min_child_weight=3, reg_lambda=1.0)),
    (None, dict(max_depth=3, n_estimators=1000, learning_rate=0.03, subsample=0.6, colsample_bytree=0.9,
                min_child_weight=3, reg_lambda=3.0)),
]
MODELS_CUCUMBER = [
    (15, dict(max_depth=2, n_estimators=600, learning_rate=0.08, subsample=0.8, colsample_bytree=0.5,
              min_child_weight=6, reg_lambda=1.0)),
    (15, dict(max_depth=2, n_estimators=1000, learning_rate=0.05, subsample=0.8, colsample_bytree=0.5,
              min_child_weight=1, reg_lambda=0.5)),
    (None, dict(max_depth=5, n_estimators=1000, learning_rate=0.08, subsample=0.8, colsample_bytree=0.9,
                min_child_weight=3, reg_lambda=0.5)),
    (None, dict(max_depth=2, n_estimators=600, learning_rate=0.08, subsample=0.8, colsample_bytree=0.5,
                min_child_weight=6, reg_lambda=1.0)),
    (None, dict(max_depth=5, n_estimators=1000, learning_rate=0.03, subsample=0.6, colsample_bytree=0.7,
                min_child_weight=6, reg_lambda=0.5)),
]
MODELS = {'붉은고추': MODELS_PEPPER, '양배추': MODELS_CABBAGE, '양파': MODELS_ONION,
          '애호박': MODELS_ZUCCHINI, '시금치': MODELS_SPINACH, '오이': MODELS_CUCUMBER}
# 피쳐 그룹 — best_{품목}5.json 의 groups, 이 순서대로 이어 붙인다. 없으면 DEFAULT_GROUPS
DEFAULT_GROUPS = ('retail', 'garak', 'rlast')
GROUPS = {'시금치': ('retail', 'garak', 'rlast', 'cal'),
          '오이': ('retail', 'garak')}      # 소매 막판도 검증에서 안 붙었다(-0.006 < 기준 0.012)
SEEDS = 12
MIN_TRAIN = 300       # 학습 행이 이보다 적으면(소매 적재 전) 예측하지 않는다
REQUIRED = ['r_chg1', 'g_chg1', 'r_last_vs_mean', 'margin']   # 그 품목 피쳐에 있는 것만 본다

PS = ['상순', '중순', '하순']
PM = {p: i for i, p in enumerate(PS)}

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('pipeline_retail')


# ---------------------------------------------------------------- 순
def kst_today():
    """서버 TZ가 UTC라 date.today()는 KST 새벽 실행 시 하루 전을 가리킨다"""
    return datetime.now(KST).date()


def soon_code(d):
    return f'{d.year}{d.month:02d}' + PS[0 if d.day <= 10 else 1 if d.day <= 20 else 2]


def soon_codes(index):
    d = pd.DatetimeIndex(index)
    return np.array([f'{y}{m:02d}{PS[0 if x <= 10 else 1 if x <= 20 else 2]}' for y, m, x in zip(d.year, d.month, d.day)])


def soon_start(code):
    return date(int(code[:4]), int(code[4:6]), {0: 1, 1: 11, 2: 21}[PM[code[6:]]])


def soon_index(code):
    return int(code[:4]) * 36 + (int(code[4:6]) - 1) * 3 + PM[code[6:]]


def code_of(k):
    return f'{k // 36}{k % 36 // 3 + 1:02d}{PS[k % 3]}'


# ---------------------------------------------------------------- 순 단위 표
def build_frame(retail, garak, target):
    """retail: DataFrame(date, market, price) 경동·복조리 일별 / garak: Series(date → 상 가격)
    target 순 시작일 전날까지만 쓴다. 반환: 순 정수 인덱스(연*36+…), START ~ target 까지(target 행의 y 는 NaN)"""
    t0 = pd.Timestamp(soon_start(target))
    r = retail[pd.to_datetime(retail.date) < t0].pivot_table(index='date', columns='market', values='price')
    r.index = pd.to_datetime(r.index)
    r = r.reindex(columns=list(MARKETS)).sort_index()
    r['avg'] = r[list(MARKETS)].mean(axis=1)
    r['soon'] = soon_codes(r.index)
    rs = r.groupby('soon').agg(y=('avg', 'mean'), 경동=('경동', 'mean'), 복조리=('복조리', 'mean'))
    m = r[list(MARKETS)]
    same = (m.diff() == 0).where(m.notna() & m.shift().notna())
    rs['r_same'] = same.mean(axis=1).groupby(r['soon']).mean()
    rs['r_last'] = r.groupby('soon')['avg'].last()
    rs['r_last3'] = r.groupby('soon')['avg'].apply(lambda s: s.dropna().tail(3).mean())

    g = garak[garak.index < t0].dropna().sort_index().to_frame('g')
    g['soon'] = soon_codes(g.index)
    gs = g.groupby('soon').g.agg(g='mean', g_last='last')
    gs['g_last3'] = g.groupby('soon').g.apply(lambda s: s.tail(3).mean())

    df = rs.join(gs, how='left')
    k = np.array([soon_index(c) for c in df.index])
    df.index = k
    lo, hi = soon_index(START), soon_index(target)
    df = df.reindex(range(lo, hi + 1))
    df['soon'] = [code_of(i) for i in df.index]
    df['year'] = df.index // 36
    df['month'] = (df.index % 36) // 3 + 1
    df['pidx'] = df.index % 3
    return df


# ---------------------------------------------------------------- 피쳐 (model-research experiments/retail/features.py 와 같다)
def f_retail(df, lags=(1, 2, 3, 6)):
    y1 = df.y.shift(1)
    f = pd.DataFrame(index=df.index)
    for k in lags:
        f[f'r_chg{k}'] = y1 / df.y.shift(1 + k)
    f['r_yoy'] = y1 / df.y.shift(1 + 36)
    ny = pd.concat([df.y.shift(1 + 36 * j) for j in range(1, 6)], axis=1).mean(axis=1, skipna=True)
    f['r_vs_ny'] = y1 / ny
    ny_t = pd.concat([df.y.shift(36 * j) for j in range(1, 6)], axis=1).mean(axis=1, skipna=True)
    f['r_ny_next'] = ny_t / y1
    f['r_mkt_gap'] = (df.경동 / df.복조리).shift(1)
    f['r_same'] = df.r_same.shift(1)
    moved = ((df.y / df.y.shift(1) - 1).abs() > 0.02).astype(float).shift(1)
    f['r_still3'] = 3 - moved.rolling(3).sum()
    return f


def f_garak(df, lags=(1, 2, 3)):
    g1 = df.g.shift(1)
    f = pd.DataFrame(index=df.index)
    for k in lags:
        c = g1 / df.g.shift(1 + k) - 1
        f[f'g_chg{k}'] = c
        if k == 1:
            f['g_up1'] = c.clip(lower=0)
            f['g_dn1'] = c.clip(upper=0)
    f['g_last_vs_mean'] = (df.g_last / df.g).shift(1)
    f['g_last3_vs_mean'] = (df.g_last3 / df.g).shift(1)
    f['g_yoy'] = g1 / df.g.shift(1 + 36)
    margin = df.y / df.g
    m1 = margin.shift(1)
    f['margin'] = m1
    f['margin_dev36'] = m1 / m1.rolling(36, min_periods=18).mean()
    f['margin_dev6'] = m1 / m1.rolling(6, min_periods=3).mean()
    f['gap3'] = (g1 / df.g.shift(4)) / (df.y.shift(1) / df.y.shift(4))
    return f


def f_retail_last(df):
    f = pd.DataFrame(index=df.index)
    f['r_last_vs_mean'] = (df.r_last / df.y).shift(1)
    f['r_last3_vs_mean'] = (df.r_last3 / df.y).shift(1)
    return f


def f_calendar(df):
    f = pd.DataFrame(index=df.index)
    f['month'] = df.month
    f['pidx'] = df.pidx
    f['soon36'] = (df.month - 1) * 3 + df.pidx
    return f


FEATURE_FNS = {'retail': f_retail, 'garak': f_garak, 'rlast': f_retail_last, 'cal': f_calendar}


def features(df, groups=DEFAULT_GROUPS):
    """groups: GROUPS[품목]. 열 순서가 실험과 같아야 colsample·상위 K 선택이 같아진다"""
    parts = [FEATURE_FNS[g](df) for g in groups]
    return pd.concat(parts, axis=1).astype(float).replace([np.inf, -np.inf], np.nan)


# ---------------------------------------------------------------- 모델
def fit_predict(df, X, target_k, models, seeds=None):
    """목표 순 행(target_k)보다 앞선, 비율을 아는 행으로 학습. models: MODELS[품목]. 반환: (예측가, 학습 행 수)"""
    seeds = SEEDS if seeds is None else seeds
    anchor = df.y.shift(1)
    ratio = df.y / anchor
    train = ratio.notna() & np.isfinite(ratio) & (df.index < target_k)
    preds = []
    for k, p in models:
        params = dict(BASE_PARAMS, **p)
        cols = list(X.columns)
        if k and k < len(cols):
            m0 = xgb.XGBRegressor(**params, random_state=0).fit(X.loc[train, cols], ratio[train])
            cols = list(pd.Series(m0.feature_importances_, index=cols).nlargest(k).index)
        xt = X.loc[[target_k], cols]
        preds += [xgb.XGBRegressor(**params, random_state=s).fit(X.loc[train, cols], ratio[train]).predict(xt)[0]
                  for s in range(seeds)]
    return float(np.mean(preds) * anchor[target_k]), int(train.sum())


# ---------------------------------------------------------------- 입출력
def props():
    d = {}
    with open(SECRET) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                d[k.strip()] = v.strip()
    return d


DB_TRY, DB_WAIT = 3, 30   # DB 접속 재시도 횟수 · 간격(초)


def db(P):
    import pymysql
    url = P['spring.datasource.url']              # jdbc:mysql://host:port/db?params
    after = url.split('//', 1)[1]
    hostport, _, rest = after.partition('/')      # split('/')[-1] 은 Asia/Seoul 에 걸린다
    kw = dict(host=hostport.split(':')[0], user=P['spring.datasource.username'],
              password=P['spring.datasource.password'], database=rest.split('?')[0], charset='utf8mb4')
    # MySQL 이 잠깐 재시작되는 동안(Ubuntu 자동 업데이트가 라이브러리를 올리면 재시작된다 —
    # 2026-09-29 06:09 UTC 약 8초) 접속이 거부된다 → DB_WAIT 초 간격으로 DB_TRY 번까지
    for attempt in range(1, DB_TRY + 1):
        try:
            return pymysql.connect(**kw)
        except pymysql.err.OperationalError as e:
            if attempt == DB_TRY:
                raise
            log.warning('DB 접속 실패 %d/%d (%s) — %d초 뒤 재시도', attempt, DB_TRY, e.args[0], DB_WAIT)
            time.sleep(DB_WAIT)


def load_retail(conn, item):
    with conn.cursor() as cur:
        cur.execute("""SELECT price_date, market_name, price FROM retail_market_price
                       WHERE item_name = %s AND market_name IN (%s, %s)""", (item, *MARKETS))
        rows = cur.fetchall()
    return pd.DataFrame(rows, columns=['date', 'market', 'price'])


def load_garak(conn, csv_name, garak_item):
    """레포 과거분(배포 때 교체) 뒤로 DB 일별을 잇는다. 겹치는 날은 레포 값"""
    h = pd.read_csv(os.path.join(DATA, csv_name), parse_dates=['date']).set_index('date')['상'].dropna()
    with conn.cursor() as cur:
        cur.execute("""SELECT year, month, day, avg_price FROM agri_price
                       WHERE item_name = %s AND avg_price > 0""", (garak_item,))
        rows = cur.fetchall()
    d = pd.Series({pd.Timestamp(int(y), int(m), int(dd)): float(v) for y, m, dd, v in rows}, dtype=float)
    d = d[d.index > h.index.max()]
    return pd.concat([h, d]).sort_index()


def load_wholesale(conn, item):
    """KAMIS 도매 가락도매 일별. 백엔드 첫 적재 전이면 빈 Series"""
    with conn.cursor() as cur:
        cur.execute("""SELECT price_date, price FROM wholesale_market_price
                       WHERE item_name = %s AND market_name = %s""", (item, WHOLESALE_MARKET))
        rows = cur.fetchall()
    return pd.Series({pd.Timestamp(d): float(v) for d, v in rows}, dtype=float).sort_index()


def load_g(conn, item):
    if item in KAMIS_G:
        return load_wholesale(conn, item)
    return load_garak(conn, *GARAK[item])


def save(conn, item, target, pred, df):
    with conn.cursor() as cur:
        cur.execute(f"""CREATE TABLE IF NOT EXISTS {TABLE} (
                           item_name VARCHAR(20) NOT NULL,
                           target_date VARCHAR(16) NOT NULL,
                           predicted_price DOUBLE,
                           actual_price DOUBLE,
                           error_pct DOUBLE,
                           updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                           PRIMARY KEY (item_name, target_date))""")
        cur.execute(f"""INSERT INTO {TABLE} (item_name, target_date, predicted_price) VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE predicted_price=VALUES(predicted_price)""",
                    (item, target, round(pred, 2)))
        # 실제가: 최근 3순은 매번 덮는다(늦게 올라온 조사일), 그 전은 비어 있을 때만
        recent = code_of(soon_index(target) - 3)
        known = df[df.y.notna()]
        for code, v in zip(known.soon, known.y):
            cur.execute(f"""UPDATE {TABLE}
                            SET actual_price=%s,
                                error_pct=ROUND(ABS(predicted_price-%s)/NULLIF(%s,0)*100, 2)
                            WHERE item_name=%s AND target_date=%s AND (actual_price IS NULL OR target_date >= %s)""",
                        (float(v), float(v), float(v), item, code, recent))
    conn.commit()


def run_item(conn, item, target):
    retail = load_retail(conn, item)
    garak = load_g(conn, item)
    df = build_frame(retail, garak, target)
    X = features(df, GROUPS.get(item, DEFAULT_GROUPS))
    tk = soon_index(target)
    n_train = int((df.y / df.y.shift(1)).notna().sum())
    if n_train < MIN_TRAIN:
        log.warning('%s: 학습 가능한 순 %d개 < %d — 소매 적재 전으로 보고 건너뜀', item, n_train, MIN_TRAIN)
        return None
    if pd.isna(df.y[tk - 1]):
        # 첫 적재가 도는 중(연도 순으로 쌓인다)이거나 직전 순 조사가 아직 없다 — 틀린 예측을 쓰느니 건너뛴다
        log.warning('%s: 직전 순 %s 소매가 아직 없음(최근 %s) — 건너뜀', item, code_of(tk - 1),
                    df.soon[df.y.notna()].iloc[-1] if df.y.notna().any() else '-')
        return None
    if item in KAMIS_G and pd.isna(df.g[tk - 1]):
        # KAMIS 도매 첫 적재가 소매 적재 뒤에 돈다(연도 순) — 끝나기 전 실행이면 건너뛴다
        log.warning('%s: 직전 순 %s KAMIS 도매가 아직 없음 — 건너뜀', item, code_of(tk - 1))
        return None
    miss = [c for c in REQUIRED if c in X.columns and pd.isna(X.loc[tk, c])]
    if miss:
        log.error('%s: 예측 대상 행에 필수 피쳐 결측 %s — 쓰지 않음', item, miss)
        return False
    t = time.time()
    pred, n = fit_predict(df, X, tk, MODELS[item])
    prev = df.y[tk - 1]
    log.info('%s %s 예측 %.0f원 (직전 순 %.0f원, 비율 %.3f) — 학습 %d순 %s~, %.0fs',
             item, target, pred, prev, pred / prev, n, df.soon.iloc[0], time.time() - t)
    save(conn, item, target, pred, df)
    return True


def main():
    target = soon_code(kst_today())
    log.info('예측 대상 %s (순 시작 %s), 시작일 전날까지의 정보만 사용', target, soon_start(target))
    conn = db(props())
    try:
        results = {item: run_item(conn, item, target) for item in ITEMS}
    finally:
        conn.close()
    log.info('결과 %s', results)
    return 1 if any(r is False for r in results.values()) else 0


if __name__ == '__main__':
    sys.exit(main())
