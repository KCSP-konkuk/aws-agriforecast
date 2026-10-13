"""홈 화면 하이라이트 — 통합 시계열에서 '질문 하나 · 답 한 문장 · 차트 하나'와 오늘의 시장 칸을 계산한다

pipeline_series.main() 이 지표를 적재한 뒤 같은 지표 목록으로 부른다(매일 12:50 KST). 결과는 home_highlights 테이블에
JSON 1행으로 쓰고, 백엔드 GET /api/home 이 그대로 내려준다. 설계: 홈 개편안(2026-10-13)

지켜야 할 것
  - 이 파일에 품목 이름은 없다. 질문마다 규칙으로 '가장 뚜렷한 품목'을 고른다
  - 관계가 약하거나(|r| < MIN_R) 표본이 적으면 그 질문은 빼고 보여 주지 않는다 — 틀린 인상을 주지 않게
  - 숫자는 작업대와 같은 계산으로 낸다(순 평균 → 전년 같은 순 대비 %, 시차 상관). 질문마다 같은 화면을 여는 작업대 링크를 붙인다
"""
import json
import logging
import math
from datetime import date, timedelta
from urllib.parse import quote

import numpy as np
import pandas as pd

import pipeline_retail as pr

log = logging.getLogger('home_highlights')

TABLE = 'home_highlights'
KEY = 'home'
INSIGHT_TABLE = 'item_insight'   # pipeline_insight.TABLE (12:40 에 먼저 쓴다)
MIN_R = 0.3
MIN_LAG_N = 24            # 작업대 '찾아낸 것'과 같다
LAG_GAIN = 0.05           # 시차를 둬도 같은 순보다 |r| 이 이만큼 낫지 않으면 같은 순 관계
LAGS = range(0, 7)
SUPPLY_CUT = 15           # 반입량 전년 대비 ±15%
MIN_GROUP = 20
MIN_SUPPLY_N = 60
MIN_SEASON_YEARS = 5
MIN_FORECAST = 6
SPARK = 12


# ---------------------------------------------------------------- 도우미
def josa(word, with_final, without_final):
    """받침이 있으면 앞, 없으면 뒤 (반입량은 · 소매가는)"""
    last = word[-1] if word else ''
    if '가' <= last <= '힣':
        return word + (with_final if (ord(last) - 0xAC00) % 28 else without_final)
    return word + without_final


def soon_label(d):
    return f"{d.month}월 {'상중하'[0 if d.day <= 10 else 1 if d.day <= 20 else 2]}순"


def step(d):
    return d.year * 36 + (d.month - 1) * 3 + (0 if d.day <= 10 else 1 if d.day <= 20 else 2)


def soon_values(s):
    """지표 → 순 첫날 기준 값. 일별은 순 평균(합계 지표는 합), 순 지표는 그대로. 진행 중인 순은 뺀다"""
    v = s['values'].dropna()
    if v.empty:
        return v
    if s['freq'] != 'soon':
        codes = pr.soon_codes(pd.to_datetime(list(v.index)))
        v = v.groupby(codes).agg('sum' if s['agg'] == 'sum' else 'mean')
        v.index = [pr.soon_start(c) for c in v.index]
    current = pr.soon_start(pr.soon_code(pr.kst_today()))
    return v[[d < current for d in v.index]].sort_index()


def yoy(v):
    """전년 같은 순 대비 % (작업대 '전년 대비'와 같다)"""
    out = {}
    for d, x in v.items():
        prev = v.get(date(d.year - 1, d.month, d.day))
        if prev is not None and prev != 0 and not math.isnan(prev):
            out[d] = (x / prev - 1) * 100
    return pd.Series(out, dtype=float)


def pearson(xs, ys):
    if len(xs) < 3:
        return None
    x, y = np.asarray(xs, float), np.asarray(ys, float)
    if x.std() == 0 or y.std() == 0:
        return None
    return float(np.corrcoef(x, y)[0, 1])


def lag_scan(lead, follow):
    """lead 를 k순 늦춰 follow 의 같은 순과 상관 (작업대 lagCorrelation) → [(k, r, n)]"""
    by_step = {step(d): x for d, x in follow.items()}
    out = []
    for k in LAGS:
        xs, ys = [], []
        for d, x in lead.items():
            y = by_step.get(step(d) + k)
            if y is not None:
                xs.append(x)
                ys.append(y)
        out.append((k, pearson(xs, ys), len(xs)))
    return out


def link(ids, kinds, freq, period, chart, x=None, y=None, cond=None):
    """작업대 주소(쿼리) — 프론트 writeState 와 같은 모양"""
    parts = [('s', ','.join(ids)), ('t', ','.join(kinds)), ('lag', ','.join('0' for _ in ids)),
             ('k', ','.join(str(i) for i in range(len(ids)))), ('f', freq), ('p', period), ('c', chart)]
    if chart != 'line':
        parts += [('x', str(x or 0)), ('y', str(y if y is not None else 1))]
    if cond:
        parts.append(('q', cond))
    return '&'.join(f'{k}={quote(v, safe=",:")}' for k, v in parts)


def price_label(s):
    return '경매가' if s['id'].startswith('auction:') else '도매가'


def pairs(by_id):
    """품목 → (소매 지표, 경매가 또는 KAMIS 도매가 지표). 경매가가 있으면 경매가 (작업대 템플릿과 같은 짝)"""
    out = {}
    for s in by_id.values():
        if not s['id'].startswith('retail:'):
            continue
        item = s['item']
        price = next((p for p in by_id.values() if p['id'].startswith('auction:') and p['item'] == item), None) \
            or next((p for p in by_id.values() if p['id'].startswith('wholesale:') and p['item'] == item), None)
        if price is not None:
            out[item] = (s, price)
    return out


def rounded(points, nd=1):
    return [[round(float(v), nd) for v in p] for p in points]


# ---------------------------------------------------------------- 질문
def q_overlay(by_id):
    """경매 · 도매가가 크게 출렁일 때 소매가는 얼마나 움직였나 — 최근 1년 주별 지수"""
    best = None
    for item, (r, p) in pairs(by_id).items():
        rv, pv = r['values'].dropna(), p['values'].dropna()
        if rv.empty or pv.empty:
            continue
        end = min(rv.index.max(), pv.index.max())
        start = end - timedelta(days=364)
        weekly = lambda v: v[[start <= d <= end for d in v.index]].groupby(lambda d: d - pd.Timedelta(days=d.weekday())).mean()
        rw, pw = weekly(rv), weekly(pv)
        both = sorted(set(rw.index) & set(pw.index))
        if len(both) < 40:
            continue
        rw, pw = rw[both], pw[both]
        ri, pi = rw / rw.iloc[0] * 100, pw / pw.iloc[0] * 100
        ratio = (pi.max() / pi.min()) / (ri.max() / ri.min())
        if best is None or ratio > best[0]:
            best = (ratio, item, r, p, ri, pi)
    if best is None:
        return None
    _, item, r, p, ri, pi = best
    pr_range, rr_range = pi.max() / pi.min(), ri.max() / ri.min()
    return dict(
        key='overlay', who='소매상', question=f'{price_label(p)}가 출렁일 때 소매가는 얼마나 움직일까?',
        answer=f'최근 1년 {item} {price_label(p)}가 최고·최저 {pr_range:.1f}배로 출렁이는 동안 소매가는 {rr_range:.1f}배 움직였어요.',
        meta=f'{item} · 최근 1년 주별 지수(첫 주 = 100)', item=item,
        link=link([r['id'], p['id']], ['index', 'index'], 'w', '1y', 'line'),
        chart=dict(type='overlay', names=[r['name'], p['name']],
                   points=[[d.isoformat(), round(float(a), 1), round(float(b), 1)] for d, a, b in zip(ri.index, ri.values, pi.values)]))


def q_lag(by_id):
    """경매 · 도매가가 몇 순 앞서 소매가와 함께 움직였나 — 전년 대비 시차 상관(작업대 시차 상관과 같은 숫자)"""
    best = None
    for item, (r, p) in pairs(by_id).items():
        scan = lag_scan(yoy(soon_values(p)), yoy(soon_values(r)))
        ok = [(k, c, n) for k, c, n in scan if c is not None and n >= MIN_LAG_N]
        if not ok or scan[0][1] is None:
            continue
        k, c, n = max(ok, key=lambda t: abs(t[1]))
        if k == 0 or abs(c) - abs(scan[0][1]) < LAG_GAIN or abs(c) < MIN_R:
            continue
        if best is None or abs(c) > abs(best[1]):
            best = (k, c, n, item, r, p, scan)
    if best is None:
        return None
    k, c, n, item, r, p, scan = best
    return dict(
        key='lag', who='소매상 · 도매상', question=f'{price_label(p)}가 오르면 소매가는 며칠 뒤 따라올까?',
        answer=f'{josa(item, "은", "는")} {price_label(p)}가 움직이고 약 {k * 10}일({k}순) 뒤의 소매가가 가장 비슷하게 움직였어요. 상관 {c:.2f}.',
        meta=f'{item} · 순별 전년 대비 · 시차 0~{max(LAGS)}순', item=item,
        link=link([r['id'], p['id']], ['yoy', 'yoy'], 's', 'all', 'lag', x=1, y=0),
        chart=dict(type='lag', best=k, bars=[[kk, None if cc is None else round(cc, 3)] for kk, cc, _ in scan]))


def supply_pairs(by_id):
    """품목 → (반입량 지표, 경매 · 도매가 지표, 소매 지표 또는 None)"""
    out = {}
    for s in by_id.values():
        if not s['id'].startswith('supply:'):
            continue
        item = s['item']
        price = next((p for p in by_id.values() if p['id'].startswith('auction:') and p['item'] == item), None) \
            or next((p for p in by_id.values() if p['id'].startswith('wholesale:') and p['item'] == item), None)
        if price is None:
            continue
        retail = by_id.get(f'retail:{item}')
        out[item] = (s, price, retail)
    return out


def supply_table(sup, price, retail=None):
    cols = {'s': yoy(soon_values(sup)), 'p': yoy(soon_values(price))}
    if retail is not None:
        cols['r'] = yoy(soon_values(retail))
    return pd.DataFrame(cols).dropna()


def strongest_supply(by_id):
    best = None
    for item, (sup, price, retail) in supply_pairs(by_id).items():
        t = supply_table(sup, price)
        if len(t) < MIN_SUPPLY_N:
            continue
        c = pearson(t.s, t.p)
        if c is None or c > -MIN_R:
            continue
        low = t[t.s < -SUPPLY_CUT]
        if len(low) < MIN_GROUP:
            continue
        if best is None or c < best[0]:
            best = (c, item, sup, price, retail)
    return best


def q_supply(by_id):
    best = strongest_supply(by_id)
    if best is None:
        return None
    c, item, sup, price, _ = best
    t = supply_table(sup, price)
    low, high = t[t.s < -SUPPLY_CUT], t[t.s > SUPPLY_CUT]
    low_med = float(low.p.median())
    years = sorted({d.year for d in t.index})
    label = price_label(price)
    how = f'{low_med:.0f}% 높았어요' if low_med >= 0 else f'{-low_med:.0f}% 낮았어요'
    return dict(
        key='supply', who='도매상', question='반입량이 줄면 값은 얼마나 오를까?',
        answer=f'{item} 반입량이 전년보다 {SUPPLY_CUT}% 넘게 줄었던 {len(low)}개 순에 {josa(label, "은", "는")} 전년보다 {how}(중앙값).',
        meta=f'{item} · {years[0]}~{years[-1]} · {len(t)}개 순 · 상관 {c:.2f}', item=item,
        link=link([sup['id'], price['id']], ['yoy', 'yoy'], 's', 'all', 'scatter', x=0, y=1),
        chart=dict(type='scatter', names=[sup['name'], price['name']], cut=SUPPLY_CUT,
                   points=rounded(t[['s', 'p']].values),
                   low=dict(n=len(low), median=round(low_med, 1)),
                   high=dict(n=len(high), median=None if high.empty else round(float(high.p.median()), 1))))


def q_condition(by_id):
    """물량이 적었던 순만 골라 보면 — 반입량 · 경매 · 도매가 · 소매가 평행 좌표와 조건"""
    best = strongest_supply(by_id)
    if best is None or best[4] is None:
        return None
    _, item, sup, price, retail = best
    t = supply_table(sup, price, retail)
    low = t[t.s < -SUPPLY_CUT]
    if len(low) < MIN_GROUP:
        return None
    up = float((low.r > 0).mean() * 100)
    return dict(
        key='condition', who='KAMIS 직원', question='물량이 적었던 때만 골라 보면?',
        answer=f'{item} 반입량이 {SUPPLY_CUT}% 넘게 줄었던 {len(low)}개 순 가운데 {up:.0f}%에서 소매가도 전년보다 올랐어요.',
        meta=f'{item} · 조건: 반입량 전년 대비 −{SUPPLY_CUT}% 미만', item=item,
        link=link([sup['id'], price['id'], retail['id']], ['yoy'] * 3, 's', 'all', 'parallel', x=0, y=1,
                  cond=f'{sup["id"]},,-{SUPPLY_CUT}'),
        chart=dict(type='parallel', names=['반입량', price_label(price), '소매가'], cut=-SUPPLY_CUT,
                   lines=rounded(t[['s', 'p', 'r']].values)))


def q_season(by_id):
    """한 해 중 언제 가장 비싸나 — 해마다 순 값 ÷ 그해 평균. 고점 · 저점 비가 가장 큰 품목"""
    best = None
    for s in by_id.values():
        if not s['id'].startswith('retail:'):
            continue
        v = soon_values(s)
        if v.empty:
            continue
        df = pd.DataFrame({'v': v.values}, index=[step(d) for d in v.index])
        df['y'], df['p'] = df.index // 36, df.index % 36
        full = df.groupby('y').p.nunique()
        years = [y for y, n in full.items() if n >= 33]
        if len(years) < MIN_SEASON_YEARS:
            continue
        df = df[df.y.isin(years)].copy()
        df['rel'] = df.v / df.groupby('y').v.transform('mean')
        prof = df.groupby('p').rel.mean()
        amp = prof.max() / prof.min()
        if best is None or amp > best[0]:
            best = (amp, s, df, prof, years)
    if best is None:
        return None
    _, s, df, prof, years = best
    item = s['item']
    peak, trough = int(prof.idxmax()), int(prof.idxmin())
    as_date = lambda p: date(2000, p // 3 + 1, (1, 11, 21)[p % 3])
    grid = df.pivot_table(index='y', columns='p', values='rel').reindex(columns=range(36))
    return dict(
        key='season', who='모두', question='한 해 중 언제 가장 비쌀까?',
        answer=(f'{item} 소매가는 {soon_label(as_date(peak))}에 그해 평균의 {prof.max():.2f}배, '
                f'{soon_label(as_date(trough))}엔 {prof.min():.2f}배였어요.'),
        meta=f'{item} · {years[0]}~{years[-1]} · 그해 평균 대비', item=item,
        link=link([s['id']], ['raw'], 's', 'all', 'terrain', x=0, y=0),
        chart=dict(type='heat', years=[int(y) for y in grid.index], peak=peak, trough=trough,
                   rows=[[None if pd.isna(x) else round(float(x), 3) for x in row] for row in grid.values]))


def q_forecast(by_id):
    """AI 예측은 얼마나 맞았나 — 오차 기록이 가장 긴 예측 지표"""
    best = None
    for e in by_id.values():
        if not e['id'].startswith(('forecast_error:', 'forecast_w_error:')):
            continue
        err = e['values'].dropna()
        if len(err) < MIN_FORECAST:
            continue
        wholesale = e['id'].startswith('forecast_w_error:')
        key = e['id'].split(':', 1)[1]
        pred = by_id.get(f'forecast_w:{key}' if wholesale else f'forecast:{key}')
        actual = by_id.get(f'auction:{key}' if wholesale else f'retail:{key}')
        if pred is None or actual is None:
            continue
        if best is None or len(err) > len(best[1]):
            best = (e, err, pred, actual, wholesale, key)
    if best is None:
        return None
    e, err, pred, actual, wholesale, key = best
    within = float((err <= 10).mean() * 100)
    act = soon_values(actual)
    pts = [[d.isoformat(), round(float(v)), None if act.get(d) is None else round(float(act.get(d)))]
           for d, v in pred['values'].dropna().items()]
    label = '도매' if wholesale else '소매'
    return dict(
        key='forecast', who='모두', question='AI 예측은 얼마나 맞았나?',
        answer=f'{key} {label} 예측은 올해 {len(err)}개 순 중 {within:.0f}%를 10% 안으로 맞혔어요. 평균 오차 {err.mean():.1f}%.',
        meta=f'{key} · 순별 예측 기록 · {actual["source"].split("(")[0].strip()}', item=pred['item'],
        link=link([actual['id'], pred['id']], ['raw', 'raw'], 's', '1y', 'line'),
        chart=dict(type='forecast', names=[actual['name'], pred['name']], unit=actual['unit'], points=pts))


QUESTIONS = [q_overlay, q_lag, q_supply, q_season, q_condition, q_forecast]


# ---------------------------------------------------------------- 오늘의 시장 칸
def market(by_id, insights):
    """소매 예측(인사이트 결론) + 도매 예측(운영 · 백테스트 예측 지표) → 칸 목록"""
    out = []
    for item, payload in sorted(insights.items()):
        h = payload.get('headline') or {}
        if h.get('predicted') is None:
            continue
        retail = by_id.get(f'retail:{item}')
        spark = [] if retail is None else [round(float(x)) for x in soon_values(retail).iloc[-SPARK:]]
        reason, reason_dir = None, None
        text = h.get('reason') or ''
        for mark, d in ((' 가격을 올리는', 'up'), (' 가격을 내리는', 'down')):
            if mark in text:
                head = text.split(mark)[0]
                reason, reason_dir = head[:-1] if head[-1:] in ('이', '가') else head, d
        out.append(dict(item=item, kind='retail', target=payload.get('targetLabel'), unit=payload.get('unit'),
                        predicted=round(float(h['predicted'])), changePct=round(float(h.get('changePct') or 0) * 100, 1),
                        direction=h.get('direction'), reason=reason, reasonDirection=reason_dir, spark=spark))
    for s in sorted(by_id.values(), key=lambda s: s['id']):
        if not s['id'].startswith('forecast_w:'):
            continue
        key = s['id'].split(':', 1)[1]
        actual = by_id.get(f'auction:{key}')
        pred = s['values'].dropna()
        if actual is None or pred.empty:
            continue
        target = pred.index.max()
        if target < pr.soon_start(pr.soon_code(pr.kst_today())):
            continue    # 이번 순 예측이 아직 없다(지난 순 예측을 지금 것처럼 보이지 않게)
        act = soon_values(actual)
        before = act[[d < target for d in act.index]]
        if before.empty:
            continue
        change = (float(pred[target]) / float(before.iloc[-1]) - 1) * 100
        unit = (actual.get('unit') or '').replace('원/', '').replace('키로', 'kg') or None
        out.append(dict(item=key, kind='wholesale', target=soon_label(target), unit=unit,
                        predicted=round(float(pred[target])), changePct=round(change, 1),
                        direction='up' if change > 0.5 else 'down' if change < -0.5 else 'flat',
                        reason=None, reasonDirection=None, spark=[round(float(x)) for x in before.iloc[-SPARK:]]))
    return out


# ---------------------------------------------------------------- 묶기 · 저장
def build(series, insights, generated_at):
    """series: pipeline_series 지표 목록, insights: {품목: 인사이트 JSON}. 계산 못 한 질문은 빠진다"""
    by_id = {s['id']: s for s in series if len(s['values'])}
    questions = []
    for fn in QUESTIONS:
        try:
            q = fn(by_id)
        except Exception:   # noqa: BLE001 — 한 질문이 실패해도 나머지는 보여 준다
            log.exception('%s 계산 실패', fn.__name__)
            q = None
        if q is not None:
            questions.append(q)
    return dict(generatedAt=generated_at, questions=questions, market=market(by_id, insights))


def load_insights(conn):
    """소매 예측 품목의 인사이트 JSON (오늘의 시장 소매 칸). 인사이트 배치 첫 실행 전이면 빈 dict"""
    try:
        with conn.cursor() as cur:
            cur.execute(f'SELECT item_name, payload FROM {INSIGHT_TABLE}')
            return {name: json.loads(payload) for name, payload in cur.fetchall()}
    except Exception:   # noqa: BLE001
        log.warning('인사이트를 읽지 못해 소매 예측 칸 없이 만든다')
        return {}


def save(conn, payload):
    with conn.cursor() as cur:
        cur.execute(f"""CREATE TABLE IF NOT EXISTS {TABLE} (
                           id VARCHAR(20) NOT NULL PRIMARY KEY,
                           payload LONGTEXT NOT NULL,
                           updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)""")
        cur.execute(f"""INSERT INTO {TABLE} (id, payload) VALUES (%s, %s)
                        ON DUPLICATE KEY UPDATE payload = VALUES(payload)""",
                    (KEY, json.dumps(payload, ensure_ascii=False, allow_nan=False)))
    conn.commit()
