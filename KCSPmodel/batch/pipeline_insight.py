#!/usr/bin/env python3
"""대시보드 가격 인사이트 배치 — 소매 예측 품목마다 사용자용 요약을 만든다

대시보드 탭에 보이는 여섯 가지를 계산해 item_insight(품목당 JSON 1행)에 쓴다. 화면은 쉬운 문장과 그림만 보여 주고,
기여도 같은 숫자는 순위·방향·세기를 정하는 재료로만 쓴다.
  1. 한 줄 결론 — 운영 소매 예측(retail_predictions) + 가장 크게 작용한 요인
  2. 가격을 움직이는 요인 — 소매 예측 모델과 같은 피쳐·설정으로 다시 학습해 요인별 기여도를 묶음으로 합산
     (소매가 흐름 · 도매가 흐름 · 유통 마진 · 최근 조사 가격 · 계절 흐름) → 방향, 세기(크게/보통/조금), 근거 문장
  3. 지금 상황판 — 지표마다 과거 대비 위치(0~100, 50 이 보통) + 가격이 크게 오르기 직전의 평균 모양
  4. 무슨 일이 있었나 — 최근 2년 순 추이 + 자동 감지 사건(급등·급락, 도매 급변, 반입량·환율·기상 이상)과 그 뒤 반응
  5. 비슷했던 과거 — 같은 계절(±3순)에서 지표가 가장 비슷했던 순 3곳과 그 뒤 가격
  6. 앞으로의 흐름 — 도매가 변화가 소매가에 반영되는 평균 일수, 1년 가격 달력(평년 기준)

품목 목록은 pipeline_retail.ITEMS 를 그대로 쓴다 — 소매 예측에 품목이 늘면 대시보드도 다음 실행부터 따라온다.
이 파일에 품목 이름은 없다. 문구 틀·사건 기준은 지표 묶음 기준이고, 사건 기준은 품목마다 자기 과거 분포(분위수)로 정한다.

지켜야 할 것
  - 요인 기여도는 운영 예측과 같은 정보만 쓴다: 대상 순 시작일 전날까지 (pipeline_retail.build_frame 그대로)
  - 상황판·비슷했던 과거도 같은 기준(대상 순 직전까지)으로 맞춘다. 사건 타임라인만 그 순의 실제 값을 쓴다
  - 과거가 3년(MIN_HIST 순)보다 짧은 지표는 쓰지 않는다 — 평년·분위수가 흔들린다

systemd 타이머로 매일 12:40 KST (소매 예측 12:10 뒤).
"""
import glob
import json
import logging
import os
import sys
import time
from datetime import datetime

import numpy as np
import pandas as pd
import xgboost as xgb

import pipeline_retail as pr

TABLE = 'item_insight'
EXPLAIN_SEEDS = 2          # 운영(시드 12)과 같은 설정, 시드만 줄여 요인 비중을 본다
MIN_HIST = 108             # 상황판·사건·유사도 지표에 필요한 과거 순 수 (3년)
STRENGTH = ((0.03, '크게'), (0.01, '보통'))   # 직전 순 가격 대비 요인 금액 비율. 그 아래는 '조금'
NEGLIGIBLE = 0.002         # 직전 순 가격의 0.2% 미만인 요인은 화면 목록에서 뺀다
STALE_SOONS = 3            # 자료가 늦게 들어오는 지표: 최근 3순 안의 마지막 값을 '지금'으로 쓴다
TIMELINE_SOONS = 72        # 무슨 일이 있었나: 최근 2년
MAX_EVENTS = 10
ANALOGS = 3
LAG_DAYS = 28
FLAT = 0.005              # ±0.5% 안의 변화는 '거의 그대로'

log = logging.getLogger('pipeline_insight')


# ---------------------------------------------------------------- 문구 도우미
def josa(word, with_final, without_final):
    """받침 있으면 with_final, 없으면 without_final. 괄호·영문으로 끝나면 받침 없음으로 본다"""
    ch = word.rstrip(')')[-1:] if word else ''
    if ch and '가' <= ch <= '힣':
        return word + (with_final if (ord(ch) - 0xAC00) % 28 else without_final)
    return word + without_final


def pct_text(v, digits=0):
    return f'{abs(v) * 100:.{digits}f}%'


def delta_text(v):
    """±n% — 반올림해 0 이면 '거의 그대로'"""
    if not np.isfinite(v):
        return '-'
    n = round(abs(v) * 100)
    return '거의 그대로' if n == 0 else f"{'+' if v > 0 else '−'}{n}%"


def rain_text(v):
    """강수 편차(비율): 두 배 이상이면 '평년의 n배', 거의 안 왔으면 '거의 없음'"""
    if v >= 1:
        return f'평년의 {1 + v:.1f}배'
    return '거의 없음' if v <= -0.95 else delta_text(v)


def soon_label(code):
    """'202609하순' → '9월 하순'"""
    return f'{int(code[4:6])}월 {code[6:]}'


def soon_label_full(code):
    return f'{code[:4]}년 {soon_label(code)}'


def clean(o):
    """JSON 직렬화용: numpy 타입 → 파이썬, NaN·inf → None"""
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (float, np.floating)):
        return None if not np.isfinite(o) else round(float(o), 6)
    return o


# ---------------------------------------------------------------- 요인 묶음
FAMILIES = ('retail', 'wholesale', 'margin', 'rlast', 'season')


def family_of(col):
    """피쳐 이름 → 묶음. 이름 규칙만 본다(품목과 무관)"""
    if col == 'r_ny_next' or col in ('month', 'pidx', 'soon36'):
        return 'season'
    if col.startswith('r_last'):
        return 'rlast'
    if col.startswith('margin') or col == 'gap3':
        return 'margin'
    if col.startswith('g_'):
        return 'wholesale'
    if col.startswith('r_'):
        return 'retail'
    return 'other'


def wholesale_name(item):
    """도매 자리에 무엇이 들어가는지는 pipeline_retail 이 정한다(가락 경매가 / KAMIS 도매)"""
    return '도매가' if item in pr.KAMIS_G else '경매가'


def wholesale_source(item):
    return 'KAMIS 도매(가락도매)' if item in pr.KAMIS_G else '가락시장 경매가(농넷)'


def family_label(fam, item):
    return {'retail': '소매가 흐름', 'wholesale': f'{wholesale_name(item)} 흐름', 'margin': '유통 마진',
            'rlast': '최근 조사 가격', 'season': '계절 흐름'}.get(fam, '기타')


# ---------------------------------------------------------------- 요인 기여도 (운영 소매 예측과 같은 설정)
def fit_explain(df, X, target_k, models, seeds=EXPLAIN_SEEDS):
    """pipeline_retail.fit_predict 와 같은 학습(설정·상위 K 선택)에 기여도(pred_contribs)를 더한다.
    반환: (예측 비율, 기준값, 피쳐별 기여도 Series — 비율 단위, 학습 행 수). 기준값 + 기여도 합 = 예측 비율"""
    anchor = df.y.shift(1)
    ratio = df.y / anchor
    train = ratio.notna() & np.isfinite(ratio) & (df.index < target_k)
    contrib = pd.Series(0.0, index=X.columns)
    base, preds, n = 0.0, [], 0
    for k, p in models:
        params = dict(pr.BASE_PARAMS, **p)
        cols = list(X.columns)
        if k and k < len(cols):
            m0 = xgb.XGBRegressor(**params, random_state=0).fit(X.loc[train, cols], ratio[train])
            cols = list(pd.Series(m0.feature_importances_, index=cols).nlargest(k).index)
        xt = xgb.DMatrix(X.loc[[target_k], cols])
        for s in range(seeds):
            m = xgb.XGBRegressor(**params, random_state=s).fit(X.loc[train, cols], ratio[train])
            c = m.get_booster().predict(xt, pred_contribs=True)[0]    # 피쳐별 + 마지막 칸이 기준값
            contrib[cols] += c[:-1]
            base += float(c[-1])
            preds.append(float(c.sum()))
            n += 1
    return float(np.mean(preds)), base / n, contrib / n, int(train.sum())


def strength_of(share):
    for cut, word in STRENGTH:
        if abs(share) >= cut:
            return word
    return '조금'


def _num(row, col):
    v = row.get(col, np.nan) if hasattr(row, 'get') else np.nan
    return float(v) if v is not None and np.isfinite(v) else np.nan


def evidence(fam, row, item, season_change=np.nan):
    """묶음별 근거 문장 — 대상 순 행의 피쳐 값(직전 순까지의 정보)으로 만든다"""
    if fam == 'retail':
        v = _num(row, 'r_vs_ny')
        if np.isfinite(v):
            return f"지난 순 소매가가 평년보다 {pct_text(v - 1)} {'높았어요' if v >= 1 else '낮았어요'}"
        v = _num(row, 'r_chg1')
        if np.isfinite(v):
            return f"지난 순 소매가가 그 전 순보다 {pct_text(v - 1)} {'올랐어요' if v >= 1 else '내렸어요'}"
    if fam == 'wholesale':
        v = _num(row, 'g_chg1')
        if np.isfinite(v):
            return f"{josa(wholesale_name(item), '이', '가')} 지난 순에 {pct_text(v)} {'올랐어요' if v >= 0 else '내렸어요'}"
    if fam == 'margin':
        v = _num(row, 'margin_dev36')
        if np.isfinite(v):
            return f"소매가와 {wholesale_name(item)}의 차이가 평소보다 {pct_text(v - 1)} {'커요' if v >= 1 else '작아요'}"
    if fam == 'rlast':
        v = _num(row, 'r_last_vs_mean')
        if np.isfinite(v):
            return f"지난 순 마지막 조사일 가격이 그 순 평균보다 {pct_text(v - 1)} {'높았어요' if v >= 1 else '낮았어요'}"
    if fam == 'season':
        v = _num(row, 'r_ny_next')
        if np.isfinite(v):
            return f"이번 순의 평년 가격이 지난 순 가격보다 {pct_text(v - 1)} {'높아요' if v >= 1 else '낮아요'}"
        if np.isfinite(season_change):
            return f"보통 이맘때는 가격이 {pct_text(season_change)} {'오르는' if season_change >= 0 else '내리는'} 시기예요"
    return ''


def summarize_factors(contrib, anchor, row, item, season_change=np.nan):
    """피쳐 기여도(비율 단위) → 묶음별 금액·방향·세기·근거. 큰 순서대로"""
    fam = contrib.groupby([family_of(c) for c in contrib.index]).sum()
    out = []
    for f, v in fam.items():
        if f == 'other' or not np.isfinite(v):
            continue
        amount = float(v) * anchor
        out.append(dict(key=f, label=family_label(f, item), direction='up' if amount >= 0 else 'down',
                        strength=strength_of(float(v)), amount=round(amount, 1),
                        negligible=abs(float(v)) < NEGLIGIBLE, evidence=evidence(f, row, item, season_change)))
    out.sort(key=lambda d: -abs(d['amount']))
    shown = 0
    for d in out:
        d['top'] = not d['negligible'] and shown < 3
        shown += d['top']
    return out


# ---------------------------------------------------------------- 이종 데이터 → 순 단위 Series (index = pr.soon_index)
STATION_NAMES = {'haenam': '해남', 'taebak': '태백', 'miryang': '밀양'}


def code_index(codes):
    return [pr.soon_index(str(c)) for c in codes]


def daily_to_soon(dates, values, how='mean'):
    s = pd.Series(np.asarray(values, dtype=float), index=pd.to_datetime(list(dates)))
    s = s[np.isfinite(s.values)]
    if s.empty:
        return pd.Series(dtype=float)
    return s.groupby([pr.soon_index(c) for c in pr.soon_codes(s.index)]).agg(how)


def merge_parts(parts):
    """앞 조각(레포 과거분)이 우선, 뒤 조각(DB)은 앞 조각 마지막 순 뒤만 잇는다"""
    out = pd.Series(dtype=float)
    for p in parts:
        p = p.dropna().sort_index()
        if p.empty:
            continue
        out = p if out.empty else pd.concat([out, p[p.index > out.index.max()]])
    return out.sort_index()


def query(conn, sql, args=()):
    with conn.cursor() as cur:
        cur.execute(sql, args)
        return cur.fetchall()


def safe(fn, *args):
    """지표 하나가 실패해도(테이블 없음 등) 나머지는 만든다"""
    try:
        return fn(*args)
    except Exception as e:      # noqa: BLE001
        log.warning('%s 건너뜀: %s', fn.__name__, e)
        return pd.Series(dtype=float)


def load_fx(conn):
    """원/달러 순 평균: 레포 hist_exchange.csv(2018~, 순) 뒤로 DB exchange_rate_daily"""
    parts = []
    path = os.path.join(pr.DATA, 'hist_exchange.csv')
    if os.path.exists(path):
        h = pd.read_csv(path, encoding='utf-8-sig')
        parts.append(pd.Series(h['원/달러'].astype(float).values, index=code_index(h['DATE'])))
    rows = query(conn, "SELECT BASE_DATE, USD_KRW FROM exchange_rate_daily WHERE USD_KRW IS NOT NULL")
    if rows:
        parts.append(daily_to_soon([r[0] for r in rows], [r[1] for r in rows]))
    return merge_parts(parts)


def load_oil(conn):
    """경유 전국 평균 순 평균 (DB oil_price, 백엔드가 매일 수집)"""
    rows = query(conn, "SELECT PRICE_DATE, AVG_PRICE FROM oil_price WHERE AVG_PRICE IS NOT NULL")
    return daily_to_soon([r[0] for r in rows], [r[1] for r in rows]) if rows else pd.Series(dtype=float)


def load_supply(conn, names):
    """가락 반입량 순 합계: 레포 hist_supply*.csv(파일 안 품목명으로 찾는다) 뒤로 DB supply_data 일별 합"""
    parts = []
    for path in sorted(glob.glob(os.path.join(pr.DATA, 'hist_supply*.csv'))):
        h = pd.read_csv(path, encoding='utf-8-sig')
        if '품목명' not in h.columns or '총반입량' not in h.columns:
            continue
        h = h[h['품목명'].isin(names)]
        if len(h):
            parts.append(pd.Series(h['총반입량'].astype(float).values, index=code_index(h['DATE'])))
            break
    marks = ','.join(['%s'] * len(names))
    rows = query(conn, f"""SELECT YEAR, MONTH, DAY, TOTAL_SUPPLY FROM supply_data
                           WHERE ITEM_NAME IN ({marks}) AND TOTAL_SUPPLY IS NOT NULL""", tuple(names))
    if rows:
        dates = [pd.Timestamp(int(y), int(m), int(d)) for y, m, d, _ in rows]
        parts.append(daily_to_soon(dates, [r[3] for r in rows], how='sum'))
    return merge_parts(parts)


def load_search(conn, names):
    """네이버 검색량 순 평균 (DB search_trend — 백엔드가 매일 2016~ 을 한 번에 다시 받는다)"""
    for name in names:
        rows = query(conn, "SELECT PERIOD, RATIO FROM search_trend WHERE KEYWORD=%s", (name,))
        if rows:
            return daily_to_soon([r[0] for r in rows], [r[1] for r in rows])
    return pd.Series(dtype=float)


def load_weather():
    """산지 기상: weather_*.csv(순별, 서버에선 도매 파이프라인이 매일 갱신) 관측소별 기온·강수량.
    반환: ([(이름, 기온 Series, 강수 Series)], ...) — 관측소마다 열 이름·단위가 달라 편차는 관측소별로 구한다"""
    out = []
    for path in sorted(glob.glob(os.path.join(pr.DATA, 'weather_*.csv'))):
        w = pd.read_csv(path, encoding='utf-8-sig')
        if 'DATE' not in w.columns:
            continue
        temp = next((w[c] for c in w.columns if c.startswith('평균 기온')), None)
        if temp is None and {'평균_최저기온', '평균_최고기온'} <= set(w.columns):
            temp = (w['평균_최저기온'] + w['평균_최고기온']) / 2
        rain = next((w[c] for c in ('총_강수량', '평균 강수량(mm)') if c in w.columns), None)
        if temp is None or rain is None:
            continue
        idx = code_index(w['DATE'])
        key = os.path.basename(path)[len('weather_'):-len('.csv')]
        out.append((STATION_NAMES.get(key, key), pd.Series(temp.astype(float).values, index=idx).sort_index(),
                    pd.Series(rain.astype(float).values, index=idx).sort_index()))
    return out


def names_for(item):
    """반입량·검색량 이름 후보: 품목명, 가락 품목명(pipeline_retail.GARAK)"""
    names = [item]
    if item in pr.GARAK:
        names.append(pr.GARAK[item][1])
    return list(dict.fromkeys(names))


def load_extras(conn, item):
    return dict(fx=safe(load_fx, conn), oil=safe(load_oil, conn), supply=safe(load_supply, conn, names_for(item)),
                search=safe(load_search, conn, names_for(item)), weather=load_weather())


# ---------------------------------------------------------------- 지표 (평년·전년 대비)
def full_range(s):
    return s.reindex(range(int(s.index.min()), int(s.index.max()) + 1)) if len(s) else s


def normal_of(s):
    """같은 순의 지난 5년 평균(3년 이상 있을 때)"""
    if s.empty:
        return s
    f = full_range(s)
    lag = pd.concat([f.shift(36 * j) for j in range(1, 6)], axis=1)
    return lag.mean(axis=1, skipna=True).where(lag.notna().sum(axis=1) >= 3)


def yoy(s):
    if s.empty:
        return s
    f = full_range(s)
    return f / f.shift(36) - 1


def weather_anomalies(stations):
    """관측소별 평년 편차를 구해 평균: 기온은 ℃ 차, 강수는 비율"""
    if not stations:
        return pd.Series(dtype=float), pd.Series(dtype=float)
    t = pd.concat([full_range(ts) - normal_of(ts) for _, ts, _ in stations], axis=1).mean(axis=1)
    # 건기엔 평년 강수가 0 에 가까워 비율이 수십 배로 튄다 → 분모는 그 관측소 순 강수의 중앙값 이상으로
    r = pd.concat([full_range(rs) / normal_of(rs).clip(lower=max(float(rs.median()), 1e-6)) - 1
                   for _, _, rs in stations], axis=1).mean(axis=1)
    return t, r


def build_indicators(df, extras, item):
    """지표마다 raw(그 순 실제 값)와 asof(대상 순 행 기준 = 직전 순 값). 과거가 짧은 지표는 뺀다"""
    idx = df.index
    wn = wholesale_name(item)
    y, g = df.y, df.g
    margin = y / g
    temp, rain = weather_anomalies(extras.get('weather') or [])
    places = '·'.join(n for n, _, _ in (extras.get('weather') or []))
    spec = [
        ('retail_level', '소매가 수준', '평년 대비', 'pct', y / normal_of(y) - 1),
        ('wholesale', f'{wn} 흐름', '지난 순 대비', 'pct', g / g.shift(1) - 1),
        ('margin', '유통 마진', '평소 대비', 'pct', margin / margin.rolling(36, min_periods=18).mean() - 1),
        ('volatility', '가격 출렁임', '최근 6순', 'level', np.log(y / y.shift(1)).rolling(6, min_periods=4).std()),
        ('supply', '반입량', '평년 대비', 'pct', extras['supply'] / normal_of(extras['supply']) - 1
         if len(extras.get('supply', [])) else pd.Series(dtype=float)),
        ('search', '검색 관심도', '평년 대비', 'pct', extras['search'] / normal_of(extras['search']) - 1
         if len(extras.get('search', [])) else pd.Series(dtype=float)),
        ('fx', '환율', '1년 전 대비', 'pct', yoy(extras.get('fx', pd.Series(dtype=float)))),
        ('oil', '유가', '1년 전 대비', 'pct', yoy(extras.get('oil', pd.Series(dtype=float)))),
        ('temp', '산지 기온', f'평년 대비 ({places})', 'temp', temp),
        ('rain', '산지 강수', f'평년 대비 ({places})', 'rain', rain),
    ]
    out = {}
    for key, label, basis, kind, raw in spec:
        raw = pd.Series(raw, dtype=float).replace([np.inf, -np.inf], np.nan).reindex(idx)
        asof = raw.shift(1)
        if asof[idx < idx.max()].notna().sum() < MIN_HIST:
            continue
        out[key] = dict(label=label, basis=basis, kind=kind, raw=raw, asof=asof)
    return out


def value_text(kind, v):
    if not np.isfinite(v):
        return '-'
    if kind == 'temp':
        return f"{'+' if v >= 0 else '−'}{abs(v):.1f}℃"
    if kind == 'level':
        return ''
    if kind == 'rain':
        return rain_text(v)
    return delta_text(v)


def percentile(hist, v):
    h = hist.dropna().values
    return float((h <= v).mean() * 100) if len(h) and np.isfinite(v) else np.nan


def latest(asof, tk):
    """대상 순 행 값. 없으면 최근 STALE_SOONS 순 안의 마지막 값 → (행, 값)"""
    for t in range(tk, tk - STALE_SOONS, -1):
        v = asof.get(t, np.nan)
        if np.isfinite(v):
            return t, float(v)
    return None, np.nan


def board(df, ind, tk):
    """지금 상황판: 지표마다 과거 대비 위치(0~100) + 가격이 크게 오르기 직전의 평균 모양"""
    hist_mask = df.index < tk
    change = df.y / df.y.shift(1) - 1           # 그 순의 소매가 변화 (asof 지표와 같은 행)
    surge_rows = change[hist_mask].dropna()
    surge_rows = surge_rows[surge_rows >= surge_rows.quantile(0.8)].index if len(surge_rows) else []
    axes = []
    for key, d in ind.items():
        hist = d['asof'][hist_mask]
        t_cur, cur = latest(d['asof'], tk)
        if t_cur is None:
            continue
        score = percentile(hist, cur)
        surge = float(np.nanmean([percentile(hist, d['asof'][t]) for t in surge_rows])) if len(surge_rows) else np.nan
        level = '높음' if score >= 80 else '낮음' if score <= 20 else '보통'
        axes.append(dict(key=key, label=d['label'], basis=d['basis'], score=round(score, 1),
                         surge=round(surge, 1) if np.isfinite(surge) else None,
                         level=level, valueText=value_text(d['kind'], cur),
                         asOf=soon_label(pr.code_of(t_cur - 1))))
    sims = [1 - abs(a['score'] - a['surge']) / 100 for a in axes if a['surge'] is not None]
    similarity = float(np.mean(sims)) if sims else None
    unusual = [a for a in axes if a['level'] != '보통']
    if unusual:
        note = ', '.join(f"{a['label']} {a['level']}" for a in sorted(unusual, key=lambda a: -abs(a['score'] - 50))[:3])
    else:
        note = '눈에 띄게 평소와 다른 지표가 없어요'
    return dict(axes=axes, similarity=similarity, note=note)


# ---------------------------------------------------------------- 무슨 일이 있었나
def _runs(ts):
    """연속된 순 묶음 → 각 묶음의 대표(첫 순)·끝"""
    out, start, prev = [], None, None
    for t in sorted(ts):
        if start is None:
            start = prev = t
        elif t == prev + 1:
            prev = t
        else:
            out.append((start, prev))
            start = prev = t
    if start is not None:
        out.append((start, prev))
    return out


def timeline(df, ind, item, tk):
    lo, hi = tk - TIMELINE_SOONS, tk - 1
    hist = df.index < tk
    wn = wholesale_name(item)
    series = [dict(soon=pr.code_of(t), label=f"{str(t // 36)[2:]}.{t % 36 // 3 + 1} {pr.PS[t % 3][0]}",
                   retail=df.y.get(t, np.nan), wholesale=df.g.get(t, np.nan)) for t in range(lo, hi + 1)]
    change = df.y / df.y.shift(1) - 1
    gchange = df.g / df.g.shift(1) - 1
    rules = [  # (지표 raw, 아래 분위수, 위 분위수, 최소 크기, 종류, 위 제목, 아래 제목, 문장 틀)
        (change, 0.05, 0.95, 0.05, 'price', '소매가 급등', '소매가 급락',
         lambda v: f"소매가가 한 순 만에 {pct_text(v)} {'올랐어요' if v >= 0 else '내렸어요'}"),
        (gchange, 0.05, 0.95, 0.08, 'wholesale', f'{wn} 급등', f'{wn} 급락',
         lambda v: f"{josa(wn, '이', '가')} 한 순 만에 {pct_text(v)} {'올랐어요' if v >= 0 else '내렸어요'}"),
    ]
    if 'supply' in ind:
        rules.append((ind['supply']['raw'], 0.10, 0.90, 0.10, 'supply', '반입량 급증', '반입량 급감',
                      lambda v: f"반입량이 평년보다 {pct_text(v)} {'많았어요' if v >= 0 else '적었어요'}"))
    if 'temp' in ind:
        rules.append((ind['temp']['raw'], 0.05, 0.95, 1.0, 'weather', '산지 고온', '산지 저온',
                      lambda v: f"산지 기온이 평년보다 {abs(v):.1f}℃ {'높았어요' if v >= 0 else '낮았어요'}"))
    if 'rain' in ind:
        rules.append((ind['rain']['raw'], None, 0.95, 0.5, 'weather', '산지 많은 비', None,
                      lambda v: (f"산지에 비가 평년의 {1 + v:.1f}배 왔어요" if v >= 1
                                 else f"산지에 비가 평년보다 {pct_text(v)} 많이 왔어요")))
    if 'fx' in ind:
        rules.append((ind['fx']['raw'], None, 0.95, 0.05, 'fx', '환율 급등', None,
                      lambda v: f"환율이 1년 전보다 {pct_text(v)} 올랐어요"))
    events = []
    for raw, qlo, qhi, minsize, kind, title_hi, title_lo, text in rules:
        h = raw[hist].dropna()
        if len(h) < MIN_HIST:
            continue
        med, spread = h.median(), (h.quantile(0.75) - h.quantile(0.25)) or 1.0
        for side, q, title in (('hi', qhi, title_hi), ('lo', qlo, title_lo)):
            if q is None or title is None:
                continue
            cut = h.quantile(q)
            hit = [t for t in range(lo, hi + 1) if np.isfinite(raw.get(t, np.nan))
                   and (raw[t] >= max(cut, med + minsize) if side == 'hi' else raw[t] <= min(cut, med - minsize))]
            for a, b in _runs(hit):
                t = max(range(a, b + 1), key=lambda k: abs(raw[k] - med))
                after = df.y.get(t + 2, np.nan) / df.y.get(t, np.nan) - 1 if t + 2 <= hi else np.nan
                events.append(dict(soon=pr.code_of(t), label=soon_label_full(pr.code_of(t)), kind=kind, title=title,
                                   text=text(raw[t]), span=b - a + 1, severity=abs(raw[t] - med) / spread,
                                   after=after if np.isfinite(after) else None,
                                   afterText=f"그 뒤 두 순 동안 소매가 {delta_text(after)}" if np.isfinite(after) else ''))
    events = sorted(sorted(events, key=lambda e: -e['severity'])[:MAX_EVENTS], key=lambda e: e['soon'])
    return dict(series=series, events=events)


# ---------------------------------------------------------------- 비슷했던 과거
def analogs(df, ind, tk, item):
    hist = df.index < tk
    now = {k: latest(d['asof'], tk)[1] for k, d in ind.items()}
    keys = [k for k, v in now.items() if np.isfinite(v)]
    if len(keys) < 3:
        return dict(items=[], summary='')
    mu = {k: ind[k]['asof'][hist].mean() for k in keys}
    sd = {k: ind[k]['asof'][hist].std() or 1.0 for k in keys}
    Z = pd.DataFrame({k: (ind[k]['asof'] - mu[k]) / sd[k] for k in keys})
    cur = pd.Series({k: (now[k] - mu[k]) / sd[k] for k in keys})
    cand = []
    for t in df.index:
        gap = abs(t % 36 - tk % 36)
        if t > tk - 36 or min(gap, 36 - gap) > 3 or not Z.loc[t].notna().all():
            continue
        if not (np.isfinite(df.y.get(t - 1, np.nan)) and np.isfinite(df.y.get(t + 2, np.nan))):
            continue
        cand.append((t, float(np.sqrt(((Z.loc[t] - cur) ** 2).mean()))))
    if not cand:
        return dict(items=[], summary='')
    dmax = max(d for _, d in cand) or 1.0
    items = []
    for t, d in sorted(cand, key=lambda x: x[1])[:ANALOGS]:
        base = df.y[t - 1]
        path = [df.y.get(t - 1 + j, np.nan) / base - 1 for j in range(4)]
        items.append(dict(soon=pr.code_of(t), label=soon_label_full(pr.code_of(t)), similarity=1 - d / dmax,
                          next=path[1], path=path))
    moves = {'올랐어요': sum(1 for a in items if a['next'] >= FLAT),
             '내렸어요': sum(1 for a in items if a['next'] <= -FLAT)}
    moves['거의 그대로였어요'] = len(items) - sum(moves.values())
    word, n = max(moves.items(), key=lambda kv: kv[1])
    word = f"{n}번은 그다음 순에{'도' if word == '거의 그대로였어요' else ''} 가격이 {word}"
    return dict(items=items, summary=f"지금과 가장 비슷했던 {len(items)}번 중 {word}", basis=[ind[k]['label'] for k in keys])


# ---------------------------------------------------------------- 앞으로의 흐름
def calendar(df, tk):
    """평년 기준 1년 가격 달력: 최근 5개 완전한 해의 (순 가격 ÷ 그해 평균) 평균 - 1 → 36칸"""
    y = df.y[df.index < tk]
    rows = []
    for yr in sorted({i // 36 for i in y.index}, reverse=True):
        s = y[(y.index // 36) == yr]
        if s.notna().sum() >= 30:
            rows.append((s / s.mean()).reindex(range(yr * 36, yr * 36 + 36)).values)
        if len(rows) == 5:
            break
    if not rows:
        return [np.nan] * 36, np.nan
    cal = np.nanmean(np.array(rows, dtype=float), axis=0) - 1
    cur, prev = tk % 36, (tk - 1) % 36
    change = (1 + cal[cur]) / (1 + cal[prev]) - 1
    return list(cal), float(change)


def calendar_text(target, change):
    if not np.isfinite(change):
        return ''
    if abs(change) < FLAT:
        return f"보통 {soon_label(target)}은 지난 순과 가격이 비슷한 시기예요"
    return f"보통 {soon_label(target)}엔 지난 순보다 가격이 {pct_text(change)} {'오르는' if change > 0 else '내리는'} 시기예요"


def transmission(retail, garak, today, item):
    """도매(경매) 일별 7일 변화가 소매 일별 7일 변화를 며칠 앞서는지(0~28일 상관 최대) + 지금 신호"""
    wn = wholesale_name(item)
    r = retail.pivot_table(index='date', columns='market', values='price')
    r.index = pd.to_datetime(r.index)
    rd = r.reindex(columns=list(pr.MARKETS)).mean(axis=1).sort_index()
    days = pd.date_range(pd.Timestamp(today) - pd.Timedelta(days=3 * 365), pd.Timestamp(today) - pd.Timedelta(days=1))
    rd = rd.reindex(days).ffill(limit=4)
    g = garak.sort_index().reindex(days).ffill(limit=4)
    rw, rr = np.log(g / g.shift(7)), np.log(rd / rd.shift(7))
    lags = []
    for L in range(LAG_DAYS + 1):
        pair = pd.concat([rw.shift(L), rr], axis=1).dropna()
        lags.append(float(pair.corr().iloc[0, 1]) if len(pair) > 120 else np.nan)
    if not any(np.isfinite(v) for v in lags):
        return dict(lagDays=None, linked=False, lags=lags, text='', signal='')
    best = int(np.nanargmax(lags))
    text = (f"{wn} 변화는 보통 {best}일쯤 뒤 소매가에 반영돼요" if lags[best] >= 0.15
            else f"최근 3년은 {josa(wn, '과', '와')} 소매가가 뚜렷하게 같이 움직이지 않았어요")
    w14 = g.iloc[-1] / g.iloc[-15] - 1 if len(g.dropna()) > 15 else np.nan
    r14 = rd.iloc[-1] / rd.iloc[-15] - 1 if len(rd.dropna()) > 15 else np.nan
    signal = ''
    if np.isfinite(w14) and np.isfinite(r14):
        if w14 < -0.05 and r14 > w14 + 0.04:
            signal = f"{josa(wn, '은', '는')} 2주 새 {pct_text(w14)} 내렸는데 소매가는 아직 {pct_text(r14)} 움직였어요. 곧 따라 내릴 수 있어요"
        elif w14 > 0.05 and r14 < w14 - 0.04:
            signal = f"{josa(wn, '이', '가')} 2주 새 {pct_text(w14)} 올랐어요. 소매가도 곧 따라 오를 수 있어요"
        else:
            signal = f"최근 2주 {wn} {'+' if w14 >= 0 else '−'}{abs(w14) * 100:.0f}%, 소매가 {'+' if r14 >= 0 else '−'}{abs(r14) * 100:.0f}%로 비슷하게 움직이고 있어요"
    return dict(lagDays=best, linked=bool(lags[best] >= 0.15), lags=lags, text=text, signal=signal)


# ---------------------------------------------------------------- 한 줄 결론 · 묶기
def headline(item, target, pred, prev, factors, source):
    chg = pred / prev - 1
    a = abs(chg)
    if a < 0.01:
        direction, word = 'flat', '지난 순과 비슷할 것 같아요'
    else:
        size = '조금' if a < 0.03 else '눈에 띄게' if a < 0.08 else '크게'
        direction, word = ('up', f'{size} 오를 것 같아요') if chg > 0 else ('down', f'{size} 내릴 것 같아요')
    lead = next((f for f in factors if f['direction'] == direction), factors[0] if factors else None)
    reason = (f"{josa(lead['label'], '이', '가')} 가격을 {'올리는' if lead['direction'] == 'up' else '내리는'} 쪽으로 "
              f"가장 크게 작용하고 있어요" if lead else '')
    return dict(direction=direction, changePct=chg, predicted=pred, previous=prev, source=source,
                text=f"{soon_label(target)} {item} 소매가는 {word}", reason=reason)


def build_insight(item, retail, garak, target, extras, prediction=None, unit='', today=None, models=None,
                  seeds=EXPLAIN_SEEDS):
    """DB 없이 도는 본체. 학습 표본이 모자라거나 직전 순 소매·도매 값이 없으면 None (운영 예측과 같은 기준)"""
    df = pr.build_frame(retail, garak, target)
    X = pr.features(df, pr.GROUPS.get(item, pr.DEFAULT_GROUPS))
    tk = pr.soon_index(target)
    if int((df.y / df.y.shift(1)).notna().sum()) < pr.MIN_TRAIN or pd.isna(df.y.get(tk - 1)) or pd.isna(df.g.get(tk - 1)):
        return None
    pred_ratio, _, contrib, n_train = fit_explain(df, X, tk, models if models is not None else pr.MODELS[item], seeds)
    prev = float(df.y[tk - 1])
    cal, season_change = calendar(df, tk)
    factors = summarize_factors(contrib, prev, X.loc[tk], item, season_change)
    source = 'retail_model' if prediction else 'insight_refit'
    pred = float(prediction) if prediction else pred_ratio * prev
    ind = build_indicators(df, extras, item)
    flow = transmission(retail, garak, today or pr.kst_today(), item)
    flow.update(calendar=cal, current=tk % 36, previous=(tk - 1) % 36, seasonChange=season_change,
                calendarText=calendar_text(target, season_change))
    known = df.soon[df.y.notna()]
    payload = dict(
        item=item, unit=unit or '', target=target, targetLabel=soon_label(target),
        previousLabel=soon_label(pr.code_of(tk - 1)),
        priceLabel='서울 전통시장 소매가 (경동·복조리 평균, KAMIS)', wholesaleName=wholesale_name(item),
        wholesaleLabel=wholesale_source(item), generatedAt=datetime.now(pr.KST).isoformat(timespec='minutes'),
        headline=headline(item, target, pred, prev, factors, source),
        factors=factors,
        board=board(df, ind, tk),
        timeline=timeline(df, ind, item, tk),
        analogs=analogs(df, ind, tk, item),
        flow=flow,
        coverage=dict(trainSoons=n_train, since=known.iloc[0] if len(known) else None,
                      indicators=[d['label'] for d in ind.values()]),
    )
    return clean(payload)


# ---------------------------------------------------------------- 입출력
def load_prediction(conn, item, target):
    """운영 소매 예측(12:10) 값 — 없으면(건너뛴 순·첫날 배치 전) None 이고 인사이트용 재학습 값을 쓴다"""
    try:
        rows = query(conn, f"SELECT predicted_price FROM {pr.TABLE} WHERE item_name=%s AND target_date=%s",
                     (item, target))
    except Exception as e:      # noqa: BLE001
        log.warning('%s: 운영 예측 조회 실패(%s) — 인사이트 재학습 값 사용', item, e)
        return None
    return float(rows[0][0]) if rows and rows[0][0] is not None else None


def load_unit(conn, item):
    try:
        rows = query(conn, """SELECT UNIT FROM retail_price WHERE ITEM_NAME=%s AND UNIT IS NOT NULL
                              ORDER BY PRICE_DATE DESC LIMIT 1""", (item,))
    except Exception:           # noqa: BLE001
        return ''
    return rows[0][0] if rows else ''


def save(conn, item, target, payload):
    with conn.cursor() as cur:
        cur.execute(f"""CREATE TABLE IF NOT EXISTS {TABLE} (
                           item_name VARCHAR(20) NOT NULL PRIMARY KEY,
                           target_date VARCHAR(16) NOT NULL,
                           payload LONGTEXT NOT NULL,
                           updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)""")
        cur.execute(f"""INSERT INTO {TABLE} (item_name, target_date, payload) VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE target_date=VALUES(target_date), payload=VALUES(payload)""",
                    (item, target, json.dumps(payload, ensure_ascii=False)))
    conn.commit()


def run_item(conn, item, target):
    t = time.time()
    retail = pr.load_retail(conn, item)
    garak = pr.load_g(conn, item)
    payload = build_insight(item, retail, garak, target, load_extras(conn, item),
                            prediction=load_prediction(conn, item, target), unit=load_unit(conn, item))
    if payload is None:
        log.warning('%s: 직전 순 소매·도매 값이 없거나 학습 표본이 모자라 건너뜀', item)
        return None
    save(conn, item, target, payload)
    log.info('%s %s 저장 — %s / 요인 %s / 지표 %d개, 사건 %d건, %.0fs', item, target, payload['headline']['text'],
             [f"{f['label']}:{f['direction']}" for f in payload['factors'][:3]], len(payload['board']['axes']),
             len(payload['timeline']['events']), time.time() - t)
    return True


def main():
    target = pr.soon_code(pr.kst_today())
    log.info('대상 %s — 품목 %s', target, ', '.join(pr.ITEMS))
    conn = pr.db(pr.props())
    results = {}
    try:
        for item in pr.ITEMS:
            try:
                results[item] = run_item(conn, item, target)
            except Exception:   # noqa: BLE001 — 한 품목이 실패해도 나머지는 만든다
                log.exception('%s: 인사이트 계산 실패', item)
                results[item] = False
    finally:
        conn.close()
    log.info('결과 %s', results)
    return 1 if any(r is False for r in results.values()) else 0


if __name__ == '__main__':
    sys.exit(main())
