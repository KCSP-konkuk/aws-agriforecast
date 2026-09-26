#!/usr/bin/env python3
"""홍고추 순별 가격 예측 파이프라인 (배치 실행)

모델 근거는 KCSP-konkuk/redpepper 의 METHOD.md 11절. 시험 2021~2025 MASE 0.659 / MAPE 16.1%.

  1. 농넷 순별 API 로 홍고추·풋고추·청피망 최근 9순 가격·평년·전년 (품목당 1회)
  2. 농넷 일별(garak.do) 로 예측 대상 순 직전 8거래일 홍고추 상 가격 (1회)
  3. 네이버 데이터랩 검색량 2016-01-01 ~ 어제 (1회)
  4. 과거분(레포 CSV, 2001~)과 결합 → 피쳐 → XGBoost 비율 타깃, 시드 12 평균
  5. redpepper_predictions upsert + 지난 순의 actual_price/error_pct 갱신

배추·양파 파이프라인과 다른 점 — 옮겨 쓸 때 여기서 틀리기 쉽다.
  - **가격을 직접 맞히지 않는다.** 타깃은 `대상 순 가격 ÷ 직전 순 가격` 이고 예측가 = 비율 × 직전 순 가격.
    홍고추는 해마다 가격대가 크게 달라 트리가 학습 범위 밖을 외삽하지 못하기 때문이다
  - **피쳐 목록이 고정이 아니다.** 학습 때마다 중요도 상위 K 개를 고른 뒤 시드 12 개를 평균한다
  - **DB 를 입력으로 쓰지 않는다.** 순 가격·평년은 농넷 순별 API, 막판 가격은 농넷 일별, 검색량은 데이터랩에서 직접 받는다
    - DB 일별 가격은 백엔드가 KST 11시에 전날분을 넣어, 06시 실행 때는 직전 순 마지막 날이 아직 없다
    - DB 검색량은 스케줄러가 하루씩 요청해 매일 그날 기준(최댓값 100)으로 정규화돼 있다. 모델은 2016~ 을
      **한 번에, 4개 키워드 묶음으로** 받은 값으로 학습했으므로 매 실행 같은 방식으로 다시 받는다
  - 평년 = 최근 5년 같은 순의 최고·최저를 뺀 3년 평균, 전년 = 36순 전 가격(농넷 값과 전 구간 일치 확인).
    다음 달 평년·전년(`ny_next`·`py_next`)은 API 가 주지 않아 이 정의로 계산한다
  - 예측 대상 순의 가격은 하나도 보지 않는다(순 시작 시점 1회 예측과 같은 정보). 순 중간 값으로 다시 맞히지 않는다

systemd 타이머로 매일 실행. 순이 바뀌면 예측 대상이 자동으로 다음 순이 된다.
"""
import logging
import os
import sys
import time
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests
import xgboost as xgb

import backtest

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
SECRET = '/opt/agri-forecast/application-secret.properties'
TABLE = 'redpepper_predictions'

# 농넷 품목코드 / 규격코드. 가격 단위는 원 / 10kg 상자, 상 등급
ITEMS = {'홍고추': ('24210', '10'), '풋고추': ('24201', '10'), '청피망': ('25101', '10')}
HIST_SOON = {'홍고추': 'hist_soon_redpepper.csv', '풋고추': 'hist_soon_greenpepper.csv',
             '청피망': 'hist_soon_bellpepper.csv'}
HIST_DAILY = 'hist_daily_redpepper.csv'
# 서버 누적 캐시 — hist_* 와 달리 배포가 덮어쓰지 않는다
CACHE_SOON = {k: v.replace('hist_', 'cache_') for k, v in HIST_SOON.items()}
CACHE_DAILY = 'cache_daily_redpepper.csv'
CACHE_ANCHOR = 'cache_daily_anchor_redpepper.csv'

NONGNET = 'https://www.nongnet.or.kr/front/M000000258/marketInfo/'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
DATALAB = 'https://openapi.naver.com/v1/datalab/search'
# 학습 데이터와 같은 요청이어야 정규화 기준이 같다 — 그룹 구성·시작일을 바꾸지 말 것
TREND_GROUPS = [('홍고추', ['홍고추', '붉은고추']), ('고추', ['고추']),
                ('고춧가루', ['고춧가루', '고추가루']), ('김장', ['김장'])]
TREND_START = '2016-01-01'
TREND_KW = '고춧가루'

# redpepper experiments/best_split.json 'S 선택' — 검증 2016~2020 에서 선택
K_TOP = 60
PARAMS = dict(max_depth=5, n_estimators=1200, learning_rate=0.08, subsample=0.8,
              colsample_bytree=0.9, min_child_weight=12, reg_lambda=1.0,
              objective='reg:absoluteerror')
SEEDS = 12
DLAST_MAX_GAP = 10   # 막판 가격: 순 시작일과 마지막 거래일 간격 상한(일)

REQ_GAP = 2.0          # 외부 요청 사이 최소 간격(초)
REQ_TRY = 3
REQ_TIMEOUT = 20

PS = ['상순', '중순', '하순']
PM = {p: i for i, p in enumerate(PS)}
KST = ZoneInfo('Asia/Seoul')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('pipeline_redpepper')


# ---------------------------------------------------------------- 순·날짜
def kst_today():
    """서버 TZ가 UTC라 date.today()는 KST 새벽 실행 시 하루 전을 가리킨다"""
    return datetime.now(KST).date()


def soon_of(d):
    return f'{d.year}{d.month:02d}' + PS[0 if d.day <= 10 else 1 if d.day <= 20 else 2]


def soon_start(code):
    return date(int(code[:4]), int(code[4:6]), {0: 1, 1: 11, 2: 21}[PM[code[6:]]])


def shift_soon(code, n):
    k = int(code[:4]) * 36 + (int(code[4:6]) - 1) * 3 + PM[code[6:]] + n
    return f'{k // 36}{k % 36 // 3 + 1:02d}{PS[k % 3]}'


def to_soon(dates):
    d = pd.to_datetime(dates)
    return d.dt.strftime('%Y%m') + d.dt.day.map(lambda x: '상순' if x <= 10 else '중순' if x <= 20 else '하순')


# ---------------------------------------------------------------- 외부 수집
class _Tables(HTMLParser):
    """garak.do 응답에서 표 셀 텍스트만 뽑는다(서버 venv 에 bs4 를 늘리지 않으려고)"""

    def __init__(self):
        super().__init__()
        self.tables, self._row, self._cell, self._depth = [], None, None, 0

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self._depth += 1
            if self._depth == 1:
                self.tables.append([])
        elif self._depth and tag == 'tr':
            self._row = []
        elif self._depth and tag in ('td', 'th') and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag == 'table' and self._depth:
            self._depth -= 1
        elif tag in ('td', 'th') and self._cell is not None:
            self._row.append(' '.join(''.join(self._cell).split()))
            self._cell = None
        elif tag == 'tr' and self._row is not None:
            if self._row and self._depth:
                self.tables[-1].append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


class Http:
    """요청 간격·재시도를 한곳에서 지킨다. 농넷은 과다 요청으로 차단된 적이 있다"""

    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9'})
        self.last = 0.0

    def call(self, method, url, **kw):
        err = None
        for i in range(REQ_TRY):
            time.sleep(max(0.0, REQ_GAP - (time.time() - self.last)))
            self.last = time.time()
            try:
                r = self.s.request(method, url, timeout=REQ_TIMEOUT, **kw)
                r.raise_for_status()
                return r
            except Exception as e:          # noqa: BLE001 — 재시도 후 마지막 예외를 올린다
                err = e
                log.warning('요청 실패 %d/%d %s: %s', i + 1, REQ_TRY, url.rsplit('/', 1)[-1], e)
                time.sleep(3)
        raise err


def nongnet_session(http):
    """세션 쿠키(SCOUTER·KHANUSER·JSESSIONID)가 있어야 조회가 된다"""
    http.s.headers['Referer'] = NONGNET + 'garak.do'
    http.call('GET', NONGNET + 'garak.do')


def fetch_soon(http, item, day):
    """day 가 속한 순까지 최근 9순. 진행 중인 순의 가격은 부분값이라 호출한 쪽에서 버린다"""
    cd, spec = ITEMS[item]
    p = {'soonDataType': 'price', 'searchSoonGrade': '1', 'searchSoonGradeNm': '상', 'searchUnitCd': '1',
         'searchDate': day.strftime('%Y년 %m월 %d일'), 'searchSymbol1': 'garak',
         'searchSymbol2': cd, 'searchSymbol3': spec}
    r = http.call('GET', NONGNET + 'getGarakSoonList.do', params=p,
                  headers={'X-Requested-With': 'XMLHttpRequest'})
    rows = [dict(DATE=f"{x['year']}{int(x['month']):02d}{x['soonName']}",
                 val=x.get('selectSoon'), yearAvg=x.get('yearAvg'), bfYear=x.get('bfYear'))
            for x in r.json().get('datalist', [])]
    if not rows:
        raise RuntimeError(f'농넷 순별 응답이 비었다: {item}')
    return pd.DataFrame(rows)


def fetch_daily(http, day):
    """day 포함 최근 8거래일 홍고추 가격(특·상·보통·하). 행에 연도가 없어 조회일 기준으로 붙인다"""
    d = day.strftime('%Y년 %m월 %d일')
    cd, spec = ITEMS['홍고추']
    form = {'searchSymbol1': 'garak', 'searchName1': '가락', 'menuType': 'garak',
            'searchDate': d, 'bestDate': d, 'searchName2': '홍고추', 'searchSymbol2': cd,
            'searchScd': cd, 'searchName3': '10키로상자', 'searchSymbol3': spec, 'searchTrd': spec}
    r = http.call('POST', NONGNET + 'garak.do', data=form)
    p = _Tables(); p.feed(r.text)
    t = p.tables[0] if p.tables else []
    out = []
    if t and t[0] and t[0][0] == '날짜':
        head = t[0]
        for row in t[1:]:
            if '/' not in row[0]:
                continue
            m, dd = map(int, row[0].split('/'))
            y = day.year if (m, dd) <= (day.month, day.day) else day.year - 1
            rec = {'date': date(y, m, dd)}
            for g, v in zip(head[1:], row[1:]):
                try:
                    x = float(v.replace(',', ''))
                    rec[g] = x if x > 0 else np.nan
                except ValueError:
                    rec[g] = np.nan
            out.append(rec)
    return pd.DataFrame(out)


def fetch_trend(http, props, end):
    body = {'startDate': TREND_START, 'endDate': end.isoformat(), 'timeUnit': 'date',
            'keywordGroups': [{'groupName': n, 'keywords': k} for n, k in TREND_GROUPS]}
    r = http.call('POST', DATALAB, json=body,
                  headers={'X-Naver-Client-Id': props['naver.datalab.client-id'],
                           'X-Naver-Client-Secret': props['naver.datalab.client-secret'],
                           'Content-Type': 'application/json'})
    rows = [(g['title'], x['period'], x['ratio']) for g in r.json()['results'] for x in g['data']]
    return pd.DataFrame(rows, columns=['kw', 'period', 'ratio'])


# ---------------------------------------------------------------- 입력 조립
def olympic_avg(p, i):
    """평년: 최근 5년 같은 순(36·72·…·180순 전) 중 최고·최저를 뺀 3년 평균"""
    v = [p[i - 36 * k] for k in range(1, 6) if i - 36 * k >= 0 and pd.notna(p[i - 36 * k])]
    return (sum(v) - max(v) - min(v)) / 3 if len(v) == 5 else np.nan


def assemble(soon, daily, target):
    """soon: {품목: DATE·val·yearAvg·bfYear}, daily: date·상. target 까지의 홍고추 행 + 다음 달 3순.
    target 과 그 뒤 행의 가격은 비운다. 다음 달 평년·전년은 정의대로 계산해 채운다"""
    rp = soon['홍고추'].copy()
    rp = rp[rp.DATE <= target].set_index('DATE')
    # 대상 순 행은 보통 API 가 준다(평년·전년 포함). 없으면 만들어 정의로 채운다
    for c in [target] + [shift_soon(target, n) for n in range(1, 4)]:
        if c not in rp.index:
            rp.loc[c] = [np.nan, np.nan, np.nan]
    rp = rp.sort_index().reset_index()
    rp.loc[rp.DATE >= target, 'val'] = np.nan
    p = pd.to_numeric(rp.val, errors='coerce').tolist()
    for i in rp.index[rp.DATE >= target]:
        if pd.isna(rp.loc[i, 'yearAvg']):
            rp.loc[i, 'yearAvg'] = olympic_avg(p, i)
        if pd.isna(rp.loc[i, 'bfYear']):
            rp.loc[i, 'bfYear'] = p[i - 36] if i >= 36 else np.nan
    df = rp.rename(columns={'val': 'price', 'yearAvg': 'ny', 'bfYear': 'py'})[['DATE', 'price', 'ny', 'py']]
    for c in ('price', 'ny', 'py'):
        df[c] = pd.to_numeric(df[c], errors='coerce')
    df['year'] = df.DATE.str[:4].astype(int)
    df['month'] = df.DATE.str[4:6].astype(int)
    df['pidx'] = df.DATE.str[6:].map(PM)
    df['start'] = pd.to_datetime([soon_start(c) for c in df.DATE])
    return df.reset_index(drop=True)


# ---------------------------------------------------------------- 피쳐 (redpepper experiments 와 동일해야 한다)
def f_price(df):
    f = pd.DataFrame(index=df.index); p = df.price
    for l in (1, 2, 3, 4, 6, 9, 12, 36): f[f'plag{l}'] = p.shift(l)
    for w in (2, 3, 6, 12): f[f'pma{w}'] = p.shift(1).rolling(w).mean()
    f['pmom1'] = p.shift(1) / p.shift(2) - 1; f['pmom3'] = p.shift(1) / p.shift(4) - 1
    f['pstd3'] = p.shift(1).rolling(3).std(); f['pstd6'] = p.shift(1).rolling(6).std()
    f['pmin6'] = p.shift(1).rolling(6).min(); f['pmax6'] = p.shift(1).rolling(6).max()
    f['ny'] = df.ny; f['py'] = df.py
    f['lag_vs_ny'] = p.shift(1) / df.ny; f['p_vs_ny'] = p.shift(1) / df.ny.shift(1)
    f['ny_ratio'] = df.ny / df.ny.shift(1); f['py_ratio'] = df.py / df.py.shift(1)
    f['pyoy'] = p.shift(1) / p.shift(37)
    nx = df.year * 12 + df.month + 1
    nym = df.assign(ym=df.year * 12 + df.month).groupby('ym').ny.mean()
    pym = df.assign(ym=df.year * 12 + df.month).groupby('ym').py.mean()
    f['ny_next'] = nx.map(nym).values; f['py_next'] = nx.map(pym).values
    f['ny_next_ratio'] = f['ny_next'] / p.shift(1)
    f['msin'] = np.sin(2 * np.pi * df.month / 12); f['mcos'] = np.cos(2 * np.pi * df.month / 12)
    kk = (df.month - 1) * 3 + df.pidx
    f['ksin'] = np.sin(2 * np.pi * kk / 36); f['kcos'] = np.cos(2 * np.pi * kk / 36)
    f['pidx'] = df.pidx; f['month'] = df.month
    return f


def f_cross(df, cross, lags=(1, 2, 3, 6)):
    f = pd.DataFrame(index=df.index)
    for nm in ('풋고추', '청피망'):
        m = df[['DATE']].merge(cross[nm], on='DATE', how='left')
        v = pd.to_numeric(m.val, errors='coerce'); ya = pd.to_numeric(m.yearAvg, errors='coerce')
        by = pd.to_numeric(m.bfYear, errors='coerce')
        for l in lags: f[f'{nm}_l{l}'] = v.shift(l)
        f[f'{nm}_ma3'] = v.shift(1).rolling(3).mean()
        f[f'{nm}_mom1'] = v.shift(1) / v.shift(2) - 1; f[f'{nm}_mom3'] = v.shift(1) / v.shift(4) - 1
        f[f'{nm}_vs_ny'] = v.shift(1) / ya.shift(1); f[f'{nm}_ratio'] = df.price.shift(1) / v.shift(1)
        f[f'{nm}_ny_dir'] = ya / ya.shift(1); f[f'{nm}_yoy'] = v.shift(1) / by.shift(1)
    return f


def f_trend(df, trend, kws=(TREND_KW,), lags=(1, 2, 3, 6, 12)):
    t = trend.copy(); t['DATE'] = to_soon(t.period)
    piv = t.pivot_table(index='DATE', columns='kw', values='ratio', aggfunc='mean').reset_index()
    m = df[['DATE']].merge(piv, on='DATE', how='left'); f = pd.DataFrame(index=df.index)
    for kw in kws:
        v = pd.to_numeric(m[kw], errors='coerce')
        for l in lags: f[f'sr_{kw}_l{l}'] = v.shift(l)
        f[f'sr_{kw}_ma3'] = v.shift(1).rolling(3).mean()
        f[f'sr_{kw}_mom'] = v.shift(1) / v.shift(2) - 1
        f[f'sr_{kw}_yoy'] = v.shift(1) / v.shift(37)
    return f


def f_dlast(df, daily):
    """직전 순 마지막 거래일 상 가격 ÷ 직전 순 평균. 순 시작일 전날까지의 거래일만 쓴다"""
    d = daily.dropna(subset=['상']).sort_values('date')
    dd = pd.to_datetime(d.date).values; v = d['상'].values
    idx = np.searchsorted(dd, df.start.values, side='left') - 1
    ok = idx >= 0
    last = np.where(ok, v[np.clip(idx, 0, None)], np.nan)
    # 일별 조회가 계속 실패하면 몇 달 전 값을 집어 올 수 있다. 명절 휴장도 5일을 넘지 않았으므로
    # (2001~2026 거래일 간격 최대 6일) 순 시작보다 DLAST_MAX_GAP 일 넘게 전이면 결측으로 둔다
    gap = (df.start.values - dd[np.clip(idx, 0, None)]).astype('timedelta64[D]').astype(float)
    last = np.where(ok & (gap <= DLAST_MAX_GAP), last, np.nan)
    return pd.DataFrame({'d_last1_vs_p1': last / df.price.shift(1)}, index=df.index)


def features(df, cross, trend, daily):
    X = pd.concat([f_price(df), f_cross(df, cross), f_trend(df, trend), f_dlast(df, daily)], axis=1)
    return X.replace([np.inf, -np.inf], np.nan)


# ---------------------------------------------------------------- 모델
def fit_predict(df, X, train, test, params=None, k=None, seeds=None):
    """비율 타깃. train 행으로 상위 k 피쳐를 고른 뒤 시드 평균. 반환: test 행 예측가"""
    params = PARAMS if params is None else params
    k = K_TOP if k is None else k
    seeds = SEEDS if seeds is None else seeds
    A = df.price.shift(1); cols = list(X.columns)
    t = (df.price / A)[train]; ok = (t.notna() & np.isfinite(t)).values
    m0 = xgb.XGBRegressor(**params, random_state=0).fit(X.loc[train, cols][ok], t[ok])
    sel = list(pd.Series(m0.feature_importances_, index=cols).sort_values(ascending=False).index[:k])
    r = np.mean([xgb.XGBRegressor(**params, random_state=s).fit(X.loc[train, sel][ok], t[ok])
                 .predict(X.loc[test, sel]) for s in range(seeds)], axis=0)
    return r * A[test].values, sel


# ---------------------------------------------------------------- 실행
def props():
    d = {}
    with open(SECRET) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                d[k.strip()] = v.strip()
    return d


def db(P):
    import pymysql
    url = P['spring.datasource.url']              # jdbc:mysql://host:port/db?params
    after = url.split('//', 1)[1]
    hostport, _, rest = after.partition('/')      # split('/')[-1] 은 Asia/Seoul 에 걸린다
    return pymysql.connect(host=hostport.split(':')[0], user=P['spring.datasource.username'],
                           password=P['spring.datasource.password'], database=rest.split('?')[0],
                           charset='utf8mb4')


def load_hist():
    """레포 과거분(배포 때 교체)과 서버 캐시(실행마다 누적, 배포가 덮지 않음)를 합친다"""
    soon = {}
    for nm, fn in HIST_SOON.items():
        parts = [pd.read_csv(os.path.join(DATA, fn))]
        c = os.path.join(DATA, CACHE_SOON[nm])
        if os.path.exists(c):
            parts.append(pd.read_csv(c))
        h = pd.concat(parts, ignore_index=True)
        h['DATE'] = h.DATE.astype(str)
        soon[nm] = h[['DATE', 'val', 'yearAvg', 'bfYear']].drop_duplicates('DATE', keep='last')
    parts = [pd.read_csv(os.path.join(DATA, HIST_DAILY), parse_dates=['date'])]
    hist_end = parts[0].date.max().date()
    c = os.path.join(DATA, CACHE_DAILY)
    if os.path.exists(c):
        parts.append(pd.read_csv(c, parse_dates=['date']))
    daily = pd.concat(parts, ignore_index=True)
    daily['date'] = daily.date.dt.date
    anchors = set()                                # 일별 조회를 이미 한 날(창의 끝)
    a = os.path.join(DATA, CACHE_ANCHOR)
    if os.path.exists(a):
        # 조회할 창이 없던 날엔 헤더만 저장된다 — 빈 열은 날짜로 파싱되지 않으므로 직접 변환한다
        anchors = {d.date() for d in pd.to_datetime(pd.read_csv(a)['anchor'])}
    return soon, daily.drop_duplicates('date', keep='last'), anchors, hist_end


def fill_soon(http, nm, have, target, today):
    """오늘 1회 + 캐시에 빈 완료 순이 있으면 그 구간만 추가 조회(1회 9순)"""
    got = [fetch_soon(http, nm, today)]
    known = set(have.DATE) | set(got[0].DATE)
    last_hist = max(d for d in have.DATE if d < target)
    gap = []
    c = shift_soon(last_hist, 1)
    while c < target:
        if c not in known:
            gap.append(c)
        c = shift_soon(c, 1)
    while gap:
        g = fetch_soon(http, nm, soon_start(gap[-1]) + timedelta(days=1))
        got.append(g); known |= set(g.DATE)
        gap = [c for c in gap if c not in known]
    out = pd.concat([have] + got, ignore_index=True).drop_duplicates('DATE', keep='last')
    return out.sort_values('DATE').reset_index(drop=True), len(got)


def fill_daily(http, daily, anchors, hist_end, df, target, today):
    """각 순의 막판 가격에는 '순 시작 전날까지 8거래일' 창이 필요하다.
    레포 과거분(hist_end 까지)이 덮는 창과 이미 확정 조회한 창(anchors)은 건너뛰고 나머지만 조회한다.
    새벽 실행이라 창 끝날(= 어제) 값이 아직 덜 올라왔을 수 있다 → 창 끝보다 이틀 이상 지나서 받은 창만
    확정으로 치고, 그 전에 받은 창은 다음 실행에서 한 번 더 받아 덮는다"""
    ends = {s.date() - timedelta(days=1) for c, s in zip(df.DATE, df.start) if c <= target}
    need = sorted(d for d in ends if d > hist_end and d not in anchors)
    got = [fetch_daily(http, d) for d in need]
    if got:
        daily = pd.concat([daily] + got, ignore_index=True).drop_duplicates('date', keep='last')
    done = {d for d in need if (today - d).days >= 2}
    return daily, anchors | done, len(need)


def save_cache(soon, daily, anchors, target):
    """완료 순·확정 일별만 남긴다(진행 중인 순의 부분 가격은 저장하지 않는다)"""
    for nm, fn in CACHE_SOON.items():
        s = soon[nm][soon[nm].DATE < target]
        s.to_csv(os.path.join(DATA, fn), index=False)
    daily.sort_values('date').to_csv(os.path.join(DATA, CACHE_DAILY), index=False)
    pd.DataFrame({'anchor': sorted(anchors)}).to_csv(os.path.join(DATA, CACHE_ANCHOR), index=False)


REQUIRED = ['plag1', 'd_last1_vs_p1', 'ny', 'py', f'sr_{TREND_KW}_l1', '풋고추_l1', '청피망_l1']


def backtest_rows(df, X, fit=None):
    """2026년 완료 순마다 직전 순까지만 학습해 예측. 필수 피쳐가 빈 순은 매일 예측처럼 건너뛴다.
    fit 은 테스트에서 가벼운 설정을 넣기 위한 것"""
    fit = fit or fit_predict
    rows = []
    for t in backtest.targets(df.DATE, df.price.notna()):
        ti = df.index[df.DATE == t][0]
        miss = [c for c in REQUIRED if pd.isna(X.loc[ti, c])]
        if miss:
            log.warning('백테스트 %s 건너뜀: 필수 피쳐 결측 %s', t, miss)
            continue
        train = df.price.notna() & df.price.shift(1).notna() & (df.index < ti)
        pred, _ = fit(df, X, train, df.index == ti)
        rows.append(backtest.row(t, pred[0], df.price[ti], df.DATE[train].iloc[-1]))
        log.info('백테스트 %s 예측 %.0f / 실제 %.0f (%.1f%%)', t, rows[-1]['predicted_price'],
                 rows[-1]['actual_price'], rows[-1]['error_pct'])
    return rows


def main():
    today = kst_today()
    target = soon_of(today)                      # 진행 중인 순 = 예측 대상
    t0 = soon_start(target)
    log.info('예측 대상 %s (순 시작 %s), 직전 순까지의 정보만 사용', target, t0)

    P = props()
    hist_soon, hist_daily, anchors, hist_end = load_hist()
    http = Http()
    nongnet_session(http)
    soon, calls = {}, 0
    for nm in ITEMS:
        soon[nm], n = fill_soon(http, nm, hist_soon[nm], target, today); calls += n
    df0 = assemble(soon, hist_daily, target)
    daily, anchors, n = fill_daily(http, hist_daily, anchors, hist_end, df0, target, today); calls += n
    trend = fetch_trend(http, P, today - timedelta(days=1)); calls += 1
    save_cache(soon, daily, anchors, target)
    log.info('수집 %d회: 순별 %s / 일별 ~%s / 검색량 %d행(~%s)', calls,
             {k: v.DATE[v.DATE < target].iloc[-1] for k, v in soon.items()}, max(daily.date),
             len(trend), trend.period.max())

    df = assemble(soon, daily, target)
    X = features(df, {k: soon[k] for k in ('풋고추', '청피망')}, trend, daily)
    if backtest.requested():
        rows = backtest_rows(df, X)
        conn = db(P)
        try:
            backtest.save(conn, 'redpepper_backtest', rows)
        finally:
            conn.close()
        log.info('백테스트 %d순 저장, MAPE %s%%', len(rows), backtest.mape(rows))
        return 0

    ti = df.index[df.DATE == target]
    if len(ti) != 1:
        log.error('예측 대상 행 없음'); return 1
    ti = ti[0]
    miss = [c for c in REQUIRED if pd.isna(X.loc[ti, c])]
    if miss:
        log.error('예측 대상 행에 필수 피쳐 결측: %s — 쓰지 않고 종료', miss); return 1
    # 평년 정의 점검: API 가 준 대상 순 평년과 계산값이 같아야 다음 달 값도 믿을 수 있다
    calc = olympic_avg(df.price.tolist(), ti)
    if pd.notna(calc) and abs(calc - df.ny[ti]) > 1:
        log.warning('평년 정의 불일치: API %.0f vs 계산 %.0f', df.ny[ti], calc)

    train = df.price.notna() & df.price.shift(1).notna() & (df.index < ti)
    test = df.index == ti
    t_start = time.time()
    pred, sel = fit_predict(df, X, train, test)
    pred = float(pred[0])
    log.info('학습 %d행(%s ~ %s), 피쳐 %d→%d, %.0fs', int(train.sum()), df.DATE[train].iloc[0],
             df.DATE[train].iloc[-1], X.shape[1], len(sel), time.time() - t_start)
    log.info('예측 %s = %.0f원/10kg (직전 순 %.0f원, 비율 %.3f)', target, pred, df.price[ti - 1],
             pred / df.price[ti - 1])

    conn = db(P)
    try:
        with conn.cursor() as cur:
            cur.execute(f"""CREATE TABLE IF NOT EXISTS {TABLE} (
                               target_date VARCHAR(16) PRIMARY KEY,
                               predicted_price DOUBLE,
                               actual_price DOUBLE,
                               error_pct DOUBLE,
                               updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)""")
            cur.execute(f"""INSERT INTO {TABLE} (target_date, predicted_price) VALUES (%s, %s)
                            ON DUPLICATE KEY UPDATE predicted_price=VALUES(predicted_price)""",
                        (target, round(pred, 2)))
            # 실제가: 최근 3순은 매번 덮는다(순 첫날 새벽엔 직전 순 값이 덜 올라왔을 수 있다), 그 전은 비어 있을 때만
            recent = shift_soon(target, -3)
            for d, v in zip(df.DATE[df.price.notna()], df.price[df.price.notna()]):
                cur.execute(f"""UPDATE {TABLE}
                                SET actual_price=%s,
                                    error_pct=ROUND(ABS(predicted_price-%s)/NULLIF(%s,0)*100, 2)
                                WHERE target_date=%s AND (actual_price IS NULL OR target_date >= %s)""",
                            (float(v), float(v), float(v), str(d), recent))
        conn.commit()
        log.info('DB 반영 완료')
        return 0
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
