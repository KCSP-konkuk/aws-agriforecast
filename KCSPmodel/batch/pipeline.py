#!/usr/bin/env python3
"""
배추 순별 가격 예측 파이프라인 (배치 실행)

  1. 기상청 ASOS API로 기상 데이터 증분 수집 → 순별 집계
  2. DB(agri_price/supply_data/search_trend)에서 2026년 이후 순별 집계
  3. 과거분(레포 CSV, 2018~2025)과 결합
  4. XGBoost 학습 후 '다음 1순' 예측
  5. cabbage_predictions 테이블에 upsert + 지난 순의 actual_price/error_pct 갱신

systemd 타이머로 매일 실행. 순이 바뀌면 예측 대상이 자동으로 다음 순이 된다.
"""
import os, sys, json, logging
from datetime import date, timedelta
import numpy as np
import pandas as pd
import pymysql
import requests
import xgboost as xgb

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
SECRET = '/opt/agri-forecast/application-secret.properties'
KMA_URL = 'https://apihub.kma.go.kr/api/typ01/url/kma_sfcdd.php'
STATIONS = {'haenam': 261, 'taebak': 216}
SOLAR_DONOR = {'haenam': 165, 'taebak': 100}   # 해남·태백은 일사 미관측
PM = {'상순': 0, '중순': 1, '하순': 2}
PS = ['상순', '중순', '하순']

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('pipeline')


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
    hostport, _, rest = after.partition('/')
    host = hostport.split(':')[0]
    name = rest.split('?')[0]
    return pymysql.connect(host=host, user=P['spring.datasource.username'],
                           password=P['spring.datasource.password'], database=name,
                           charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)


def per(day):
    return '상순' if day <= 10 else '중순' if day <= 20 else '하순'


def to_idx(y, m, p):
    return (y - 2017) * 36 + (m - 1) * 3 + p


def datestr(y, m, p):
    return f"{y}{m:02d}{PS[p]}"


def next_period(y, m, p):
    if p == 2:
        return (y + 1, 1, 0) if m == 12 else (y, m + 1, 0)
    return y, m, p + 1


def last_complete_period(today):
    """오늘이 속한 순의 '직전 순'까지가 완성된 구간"""
    y, m, p = today.year, today.month, PM[per(today.day)]
    if p == 0:
        return (y - 1, 12, 2) if m == 1 else (y, m - 1, 2)
    return y, m, p - 1


# ---------------------------------------------------------------- 기상
KMA_IDX = dict(WS=2, TA=10, TMAX=11, TMIN=13, TS=16, TG=17, HM=18, SI=35, RN=38)
KMA_MISS = {-9.0, -99.0, -999.0}


def fetch_kma(start, end, stns):
    """일별 관측 조회 (stn은 콜론 구분)"""
    rows = []
    d = start
    key = P['weather.auth-key']
    while d <= end:
        try:
            r = requests.get(KMA_URL, params={'tm': d.strftime('%Y%m%d'), 'stn': stns,
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
                rows.append(dict(tm=f[0], stn=int(f[1]), WS=g('WS'), TMAX=g('TMAX'), TMIN=g('TMIN'),
                                 TS=g('TS'), TG=g('TG'), HM=g('HM'), SI=g('SI'), RN=g('RN')))
        except Exception as e:
            log.warning('기상 조회 실패 %s: %s', d, e)
        d += timedelta(days=1)
    return pd.DataFrame(rows)


def aggregate_weather(daily, stn):
    d = daily[daily.stn == stn].copy()
    if d.empty:
        return pd.DataFrame()
    d['RN'] = d.RN.fillna(0)
    d['Year'] = d.tm.str[:4].astype(int)
    d['Month'] = d.tm.str[4:6].astype(int)
    d['PeriodStr'] = d.tm.str[6:8].astype(int).map(per)
    g = d.groupby(['Year', 'Month', 'PeriodStr'], as_index=False).agg(
        평균_최저기온=('TMIN', 'mean'), 평균_최고기온=('TMAX', 'mean'), 총_강수량=('RN', 'sum'),
        평균_풍속=('WS', 'mean'), 평균_상대습도=('HM', 'mean'), 평균_일사량=('SI', 'mean'),
        평균_지면온도=('TS', 'mean'), 평균_최저초상온도=('TG', 'mean'))
    g['DATE'] = [datestr(r.Year, r.Month, PM[r.PeriodStr]) for r in g.itertuples()]
    g = g.rename(columns={'PeriodStr': 'Period'})
    return g[['DATE', 'Year', 'Month', 'Period', '평균_최저기온', '평균_최고기온', '총_강수량',
              '평균_풍속', '평균_상대습도', '평균_일사량', '평균_지면온도', '평균_최저초상온도']].round(2)


def update_weather(last_needed):
    """기존 CSV 뒤로 부족한 구간만 API로 받아 이어붙임"""
    out = {}
    for name, stn in STATIONS.items():
        path = os.path.join(DATA, f'weather_{name}.csv')
        cur = pd.read_csv(path, encoding='utf-8-sig')
        cur.columns = [c.strip() for c in cur.columns]
        have_max = cur.DATE.astype(str).max()
        # 마지막 보유 순은 진행 중이었을 수 있으므로 그 달부터 항상 다시 받아 덮어씀
        y, m = int(have_max[:4]), int(have_max[4:6])
        start = date(y, m, 1)
        daily = fetch_kma(start, date.today() - timedelta(days=1),
                          f'{stn}:{SOLAR_DONOR[name]}')
        if daily.empty:
            log.warning('기상[%s] 신규 데이터 없음', name)
            out[name] = cur
            continue
        new = aggregate_weather(daily, stn)
        don = aggregate_weather(daily, SOLAR_DONOR[name])[['DATE', '평균_일사량']] \
            .rename(columns={'평균_일사량': 'si_d'})
        new = new.merge(don, on='DATE', how='left')
        new['평균_일사량'] = new['평균_일사량'].fillna(new['si_d'])
        new = new.drop(columns=['si_d'])
        merged = pd.concat([cur[cur.DATE.astype(str) < new.DATE.min()], new], ignore_index=True)
        merged['k'] = [to_idx(int(str(d)[:4]), int(str(d)[4:6]), PM[str(d)[6:]]) for d in merged.DATE]
        merged = merged.sort_values('k').drop(columns=['k']).reset_index(drop=True)
        merged.to_csv(path, index=False, encoding='utf-8-sig')
        log.info('기상[%s] 갱신 → %s (%d행)', name, merged.DATE.astype(str).max(), len(merged))
        out[name] = merged
    return out


# ---------------------------------------------------------------- DB 집계
def build_from_db(conn, last_idx):
    with conn.cursor() as cur:
        cur.execute("SELECT year y, month m, day d, avg_price v FROM agri_price WHERE item_name='배추'")
        price = pd.DataFrame(cur.fetchall())
        cur.execute("SELECT year y, month m, day d, total_supply v FROM supply_data WHERE item_name='배추'")
        supply = pd.DataFrame(cur.fetchall())
        cur.execute("SELECT period, ratio FROM search_trend WHERE keyword='배추'")
        search = pd.DataFrame(cur.fetchall())

    def agg(df, how):
        df = df.copy()
        df['PeriodStr'] = df.d.map(per)
        g = df.groupby(['y', 'm', 'PeriodStr'], as_index=False).v.agg(how)
        g['k'] = [to_idx(r.y, r.m, PM[r.PeriodStr]) for r in g.itertuples()]
        g['DATE'] = [datestr(r.y, r.m, PM[r.PeriodStr]) for r in g.itertuples()]
        return g[g.k <= last_idx].sort_values('k')

    p = agg(price, 'mean')
    s = agg(supply, 'sum')
    search['period'] = pd.to_datetime(search.period)
    search['y'] = search.period.dt.year
    search['m'] = search.period.dt.month
    search['d'] = search.period.dt.day
    t = agg(search.rename(columns={'ratio': 'v'}), 'mean')
    return p, s, t


# ---------------------------------------------------------------- 피쳐
WEATHER_COLS = ['평균_최저기온', '평균_최고기온', '총_강수량', '평균_풍속',
                '평균_상대습도', '평균_일사량', '평균_지면온도', '평균_최저초상온도']
TARGET = '평균가격'

SELECTED = ['pma3', 'pmom3', 'plag1', '평균_최저초상온도_l3', 'piy', 'pycos', '평균_최저기온_l3',
            'pysin', 'msin', '평균_최고기온_l3', 'summer', '평균_지면온도_l3', '평균_최저기온_l9',
            '평균_지면온도_l6', 'pma6', 'plag4', 'sma3', 'plag9', 'plag2', 'heavy_rain_l3',
            'plag3', 'pyoy', 'srlag12', '평균_최고기온_l1', 'pstd6', 'ps_ratio', 'heavy_rain_l6',
            '평균_일사량_l9', '평균_최저초상온도_l9', '총_강수량_l3', 'plag36', '평균_최고기온_l6']


def build_features(df):
    """배추가격_최종모델_v2.py의 피쳐 엔지니어링과 동일 (후보 77개)"""
    for lag in [1, 2, 3, 4, 5, 6, 9, 12, 18, 36]:
        df[f'plag{lag}'] = df[TARGET].shift(lag)
    for w in [3, 6, 12]:
        df[f'pma{w}'] = df[TARGET].shift(1).rolling(w).mean()
    for w in [3, 6]:
        df[f'pstd{w}'] = df[TARGET].shift(1).rolling(w).std()
    df['pmom3'] = df['plag1'] - df['plag4']
    df['pyoy'] = df[TARGET].shift(1) / df[TARGET].shift(37) - 1
    df['p_vs_py'] = df['plag1'] / df['평년'].replace(0, np.nan)
    df['p_vs_jn'] = df['plag1'] / df['전년'].replace(0, np.nan)

    for lag in [1, 2, 3]:
        df[f'slag{lag}'] = df['총반입량'].shift(lag)
    df['sma3'] = df['총반입량'].shift(1).rolling(3).mean()
    df['sma6'] = df['총반입량'].shift(1).rolling(6).mean()
    df['schg'] = df['총반입량'].shift(1).pct_change()
    df['svma'] = df['slag1'] / df['sma6'].replace(0, np.nan)
    df['ps_ratio'] = df['plag1'] / df['slag1'].replace(0, np.nan)

    for lag in [1, 3, 6, 12, 18]:
        df[f'srlag{lag}'] = df['평균_검색량'].shift(lag)
    df['srma3'] = df['평균_검색량'].shift(1).rolling(3).mean()

    for c in WEATHER_COLS:
        for lag in [1, 3, 6, 9]:
            df[f'{c}_l{lag}'] = df[c].shift(lag)

    df['temp_range_l3'] = df['평균_최고기온'].shift(3) - df['평균_최저기온'].shift(3)
    df['heat_stress'] = (df['평균_최고기온'].shift(3) > 30).astype(int)
    df['cold_stress'] = (df['평균_최저기온'].shift(3) < -5).astype(int)
    df['heavy_rain_l3'] = (df['총_강수량'].shift(3) > 100).astype(int)
    df['heavy_rain_l6'] = (df['총_강수량'].shift(6) > 100).astype(int)

    df['msin'] = np.sin(2 * np.pi * df['Month'] / 12)
    df['mcos'] = np.cos(2 * np.pi * df['Month'] / 12)
    df['piy'] = (df['Month'] - 1) * 3 + df['Period']
    df['pysin'] = np.sin(2 * np.pi * df['piy'] / 36)
    df['pycos'] = np.cos(2 * np.pi * df['piy'] / 36)
    df['kimchi'] = ((df['Month'] >= 10) & (df['Month'] <= 12)).astype(int)
    df['summer'] = ((df['Month'] >= 7) & (df['Month'] <= 9)).astype(int)
    return df


def clean(df):
    """v2와 동일: 후보 피쳐 전체가 유효해지는 지점부터 사용 후 보간"""
    exclude = ({'idx', 'Year', 'Month', 'Period', 'PeriodStr', 'DATE',
                TARGET, '전년', '평년', '총반입량', '평균_검색량'} | set(WEATHER_COLS))
    all_features = [c for c in df.columns if c not in exclude and not df[c].isna().all()]
    first_valid = df[all_features].dropna().index.min()
    out = df.loc[first_valid:].copy().reset_index(drop=True)
    out[all_features] = out[all_features].ffill().fillna(0).replace([np.inf, -np.inf], 0)
    log.info('후보 피쳐 %d개 / 유효 시작 %s', len(all_features), out.DATE.iloc[0])
    return out


def main():
    today = date.today()
    ly, lm, lp = last_complete_period(today)
    last_idx = to_idx(ly, lm, lp)
    ny, nm, np_ = next_period(ly, lm, lp)
    target_date = datestr(ny, nm, np_)
    log.info('완성된 마지막 순 %s / 예측 대상 %s', datestr(ly, lm, lp), target_date)

    weather = update_weather(datestr(ly, lm, lp))
    conn = db()
    try:
        p_db, s_db, t_db = build_from_db(conn, last_idx)

        hp = pd.read_csv(os.path.join(DATA, 'hist_price.csv'), encoding='utf-8-sig')
        hs = pd.read_csv(os.path.join(DATA, 'hist_supply.csv'), encoding='utf-8-sig')
        for d in (hp, hs):
            d.columns = [c.strip() for c in d.columns]

        price = pd.concat([hp[['DATE', TARGET, '전년', '평년']],
                           pd.DataFrame({'DATE': p_db.DATE, TARGET: p_db.v,
                                         '전년': np.nan, '평년': np.nan})], ignore_index=True)
        price = price.drop_duplicates('DATE', keep='first')
        supply = pd.concat([hs[['DATE', '총반입량']],
                            pd.DataFrame({'DATE': s_db.DATE, '총반입량': s_db.v})], ignore_index=True)
        supply = supply.drop_duplicates('DATE', keep='first')
        search = pd.DataFrame({'DATE': t_db.DATE, '평균_검색량': t_db.v})

        # 예측 대상 행 추가
        price = pd.concat([price, pd.DataFrame([{'DATE': target_date, TARGET: np.nan,
                                                 '전년': np.nan, '평년': np.nan}])], ignore_index=True)

        def meta(d):
            d = d.copy()
            s = d.DATE.astype(str)
            d['Year'] = s.str[:4].astype(int)
            d['Month'] = s.str[4:6].astype(int)
            d['Period'] = s.str[6:].map(PM)
            d['idx'] = [to_idx(r.Year, r.Month, r.Period) for r in d.itertuples()]
            return d.sort_values('idx').reset_index(drop=True)

        price, supply, search = meta(price), meta(supply), meta(search)
        price['전년'] = price['전년'].fillna(price[TARGET].shift(36))

        # 기상: 7~9월 태백, 그 외 해남
        wh, wt = meta(weather['haenam']), meta(weather['taebak'])
        wh = wh.set_index('idx'); wt = wt.set_index('idx')
        rows = []
        for i in sorted(set(wh.index) | set(wt.index)):
            h = wh.loc[i] if i in wh.index else None
            t = wt.loc[i] if i in wt.index else None
            mth = h['Month'] if h is not None else t['Month']
            src = t if (mth in (7, 8, 9) and t is not None) else (h if h is not None else t)
            rows.append({'idx': i, **{c: src[c] for c in WEATHER_COLS}})
        wx = pd.DataFrame(rows)

        df = price[['idx', 'Year', 'Month', 'Period', 'DATE', TARGET, '전년', '평년']]
        df = df.merge(wx, on='idx', how='left')
        df = df.merge(supply[['idx', '총반입량']], on='idx', how='left')
        df = df.merge(search[['idx', '평균_검색량']], on='idx', how='left')
        df = df.sort_values('idx').reset_index(drop=True)
        log.info('병합 %d행 (%s ~ %s)', len(df), df.DATE.iloc[0], df.DATE.iloc[-1])

        df = clean(build_features(df))

        train = df[(df.DATE != target_date) & df[TARGET].notna()]
        test = df[df.DATE == target_date]
        if test.empty:
            log.error('예측 대상 행 없음'); return 1
        log.info('학습 %d행 (%s ~ %s)', len(train), train.DATE.iloc[0], train.DATE.iloc[-1])

        model = xgb.XGBRegressor(n_estimators=500, max_depth=3, learning_rate=0.05,
                                 subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0)
        model.fit(train[SELECTED].values, train[TARGET].values)
        pred = float(model.predict(test[SELECTED].values)[0])
        log.info('예측 %s = %.0f원', target_date, pred)

        with conn.cursor() as cur:
            cur.execute("""INSERT INTO cabbage_predictions (target_date, predicted_price)
                           VALUES (%s, %s)
                           ON DUPLICATE KEY UPDATE predicted_price=VALUES(predicted_price)""",
                        (target_date, round(pred, 2)))
            # 지난 예측의 실제값 채우기
            actual = df[df[TARGET].notna()][['DATE', TARGET]]
            for d, v in zip(actual['DATE'], actual[TARGET]):
                cur.execute("""UPDATE cabbage_predictions
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
