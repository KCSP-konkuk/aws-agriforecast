// 분석 작업대 계산 — 순수 함수.
// 서버(/api/series/*)는 원래 주기 그대로 주고, 주기 맞추기 · 변환 · 시차 · 정렬 · 상관은 여기서 한다.
// 날짜는 모두 'YYYY-MM-DD' 문자열로 다룬다(기기 시간대와 무관하게).

export const FREQ_LABEL = { d: '일', w: '주', s: '순', m: '월' };
const FREQ_RANK = { d: 0, w: 1, s: 2, m: 3 };
const NATIVE_RANK = { daily: 0, soon: 2, monthly: 3 };

export const TRANSFORMS = {
  raw: '원값',
  index: '지수 (시작=100)',
  yoy: '전년 대비',
  normal: '평년 대비',
  ma3: '이동평균(3)',
};

export const MAX_SERIES = 8;

const pad = (n) => String(n).padStart(2, '0');
const DAY = 86400000;
const MONDAY0 = Date.UTC(1970, 0, 5); // 주 순번의 기준(첫 월요일)
const parse = (iso) => iso.split('-').map(Number);
const utc = (iso) => {
  const [y, m, d] = parse(iso);
  return Date.UTC(y, m - 1, d);
};
const isoOf = (t) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

// 고른 지표들의 가장 거친 원래 주기보다 촘촘하게는 고를 수 없다
export function allowedFreqs(catalogEntries) {
  const coarsest = Math.max(0, ...catalogEntries.map((c) => NATIVE_RANK[c?.freq] ?? 0));
  return Object.keys(FREQ_RANK).filter((f) => FREQ_RANK[f] >= coarsest && !(coarsest >= 2 && f === 'w'));
}

// 날짜 → 주기 칸의 대표 날짜 (주 = 그 주 월요일, 순 = 1·11·21일, 월 = 1일)
export function bucketOf(iso, f) {
  const [y, m, d] = parse(iso);
  if (f === 'd') return iso;
  if (f === 'm') return `${y}-${pad(m)}-01`;
  if (f === 's') return `${y}-${pad(m)}-${d <= 10 ? '01' : d <= 20 ? '11' : '21'}`;
  const t = Date.UTC(y, m - 1, d);
  const mondayOffset = (new Date(t).getUTCDay() + 6) % 7;
  return isoOf(t - mondayOffset * DAY);
}

// 칸 → 정수 순번(시차 계산용)과 그 반대
export function stepOf(key, f) {
  const [y, m, d] = parse(key);
  if (f === 'd') return Math.round(utc(key) / DAY);
  if (f === 'w') return Math.round((utc(key) - MONDAY0) / DAY / 7);
  if (f === 's') return y * 36 + (m - 1) * 3 + (d <= 10 ? 0 : d <= 20 ? 1 : 2);
  return y * 12 + (m - 1);
}

export function keyOfStep(n, f) {
  if (f === 'd') return isoOf(n * DAY);
  if (f === 'w') return isoOf(MONDAY0 + n * 7 * DAY);
  if (f === 's') {
    const y = Math.floor(n / 36);
    const r = n - y * 36;
    return `${y}-${pad(Math.floor(r / 3) + 1)}-${['01', '11', '21'][r % 3]}`;
  }
  const y = Math.floor(n / 12);
  return `${y}-${pad(n - y * 12 + 1)}-01`;
}

// 원래 점들 [[날짜, 값]] → 주기별 [[칸, 값]] (agg: mean | sum), 칸 오름차순
export function resample(points, f, agg = 'mean') {
  const acc = new Map();
  for (const [iso, v] of points) {
    if (v == null || !Number.isFinite(v)) continue;
    const k = bucketOf(iso, f);
    const a = acc.get(k) ?? { sum: 0, n: 0 };
    a.sum += v;
    a.n += 1;
    acc.set(k, a);
  }
  return [...acc.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, a]) => [k, agg === 'sum' ? a.sum : a.sum / a.n]);
}

const NATIVE_FREQ = { daily: 'd', soon: 's', monthly: 'm' };

// 칸의 마지막 날 (일은 그날, 주는 일요일, 순은 10·20·말일, 월은 말일)
function lastDayOf(iso, f) {
  if (f === 'd') return iso;
  const next = keyOfStep(stepOf(bucketOf(iso, f), f) + 1, f);
  return keyOfStep(stepOf(next, 'd') - 1, 'd');
}

// 합계 지표는 아직 다 차지 않은 마지막 칸을 뺀다 — 순 중간의 강수 합계는 실제보다 작게 보인다.
// native: 지표의 원래 주기(daily|soon|monthly). 순 값은 그 순 첫날에 있으므로 순의 마지막 날까지 찬 것으로 본다
export function dropPartial(series, points, f, agg, native) {
  const nf = NATIVE_FREQ[native] ?? 'd';
  if (agg !== 'sum' || nf === f || !series.length || !points.length) return series;
  const lastRaw = points.reduce((m, [d]) => (d > m ? d : m), '');
  return lastDayOf(lastRaw, nf) < lastDayOf(lastRaw, f) ? series.slice(0, -1) : series;
}

// 평년 비교용 같은 시기: 일·주는 그 날이 속한 순, 순은 순, 월은 월
function seasonOf(key, f) {
  const [, m, d] = parse(key);
  if (f === 'm') return `${m}`;
  return `${m}-${d <= 10 ? 0 : d <= 20 ? 1 : 2}`;
}

// 비율이 아니라 차이로 비교하는 단위. 기온(℃)은 0 근처를 오가고,
// 강수(mm)는 평년이 0 에 가까운 마른 철에 비율이 수천 %로 튄다
export function diffUnit(unit) {
  const u = unit ?? '';
  if (u.includes('℃')) return '℃';
  if (u.startsWith('mm')) return 'mm';
  return null;
}

// 변환(원값 · 전년 대비 · 평년 대비 · 이동평균). 지수는 기간이 정해진 뒤 indexFrom 으로
export function transform(series, kind, f, unit) {
  if (kind === 'raw' || kind === 'index') return series;
  const diff = diffUnit(unit) != null; // 기온·강수는 비율이 아니라 차이(℃·mm)
  const rel = (v, base) => (diff ? v - base : (v / base - 1) * 100);
  if (kind === 'ma3') {
    return series.map(([k, v], i) => {
      if (i < 2) return [k, null];
      const steps = [0, 1, 2].map((j) => stepOf(series[i - j][0], f));
      return steps[0] - steps[2] === 2 ? [k, (v + series[i - 1][1] + series[i - 2][1]) / 3] : [k, null];
    });
  }
  const byKey = new Map(series);
  if (kind === 'yoy') {
    return series.map(([k, v]) => {
      const [y, m, d] = parse(k);
      const prevKey = f === 'w' ? keyOfStep(stepOf(k, f) - 52, f) : `${y - 1}-${pad(m)}-${pad(d)}`;
      // 일별은 1년 전 같은 날이 주말·휴일이면 앞뒤 3일 안의 가장 가까운 날
      const near = f === 'd' ? [0, -1, 1, -2, 2, -3, 3].map((o) => keyOfStep(stepOf(prevKey, 'd') + o, 'd')) : [prevKey];
      const base = near.map((key) => byKey.get(key)).find((x) => x != null);
      return [k, base != null && (diff || base !== 0) ? rel(v, base) : null];
    });
  }
  // 평년 대비: 같은 시기의 지난 5년 평균(3년 이상 있을 때)
  const yearly = new Map(); // 'season|year' → {sum, n}
  for (const [k, v] of series) {
    const id = `${seasonOf(k, f)}|${parse(k)[0]}`;
    const a = yearly.get(id) ?? { sum: 0, n: 0 };
    a.sum += v;
    a.n += 1;
    yearly.set(id, a);
  }
  return series.map(([k, v]) => {
    const season = seasonOf(k, f);
    const year = parse(k)[0];
    const means = [];
    for (let yy = year - 5; yy < year; yy += 1) {
      const a = yearly.get(`${season}|${yy}`);
      if (a) means.push(a.sum / a.n);
    }
    if (means.length < 3) return [k, null];
    const base = means.reduce((s, x) => s + x, 0) / means.length;
    return [k, diff || base !== 0 ? rel(v, base) : null];
  });
}

// 주기를 바꾸면 시차를 같은 날 수에 가깝게 옮긴다 (14일 → 순 주기 1순)
const DAYS_PER = { d: 1, w: 7, s: 365.25 / 36, m: 365.25 / 12 };
export function convertLag(lag, from, to) {
  if (!lag || from === to) return lag;
  return Math.round((lag * DAYS_PER[from]) / DAYS_PER[to]);
}

// 시차: +n 이면 n칸 뒤로 밀어서(늦춰서) 그린다 — 앞서 움직이는 지표를 뒤 지표에 겹쳐 보기
export function shift(series, lag, f) {
  if (!lag) return series;
  return series.map(([k, v]) => [keyOfStep(stepOf(k, f) + lag, f), v]);
}

// 기간 [from, to] (칸 기준) 안만
export function within(series, from, to) {
  return series.filter(([k]) => (!from || k >= from) && (!to || k <= to));
}

// 지수: 기간 안 첫 값 = 100
export function indexFrom(series) {
  const first = series.find(([, v]) => v != null && v !== 0);
  if (!first) return series;
  return series.map(([k, v]) => [k, v == null ? null : (v / first[1]) * 100]);
}

// 지표 하나를 화면용으로: 주기(덜 찬 합계 칸 빼기) → 변환 → 시차 → 기간 → (지수)
export function prepare(points, { f, agg, unit, native, kind = 'raw', lag = 0, from, to }) {
  const base = transform(dropPartial(resample(points, f, agg), points, f, agg, native), kind, f, unit);
  const moved = within(shift(base, lag, f), from, to).filter(([, v]) => v != null && Number.isFinite(v));
  return kind === 'index' ? indexFrom(moved) : moved;
}

// 지표별 [[칸, 값]] → 칸 오름차순 행 [{key, [id]: 값}]
export function align(prepared) {
  const rows = new Map();
  for (const [id, series] of Object.entries(prepared)) {
    for (const [k, v] of series) {
      const row = rows.get(k) ?? { key: k };
      row[id] = v;
      rows.set(k, row);
    }
  }
  return [...rows.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function pearson(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  if (n < 3) return { r: null, n };
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return { r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : null, n };
}

// 시차 상관에서 훑어볼 시차 (칸 단위, 설계 4.4: 0~12순)
export const LAG_SCAN = {
  d: [0, 3, 7, 10, 14, 21, 30, 45, 60, 90],
  w: [0, 1, 2, 3, 4, 6, 8, 10, 12],
  s: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  m: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

// 시차 상관: 다른 지표를 k칸 늦춰(k칸 앞서 움직였다고 보고) 기준 지표의 같은 칸과 상관. [{lag, r, n}]
export function lagCorrelation(base, other, lags, f) {
  const target = new Map(base);
  return lags.map((k) => {
    const xs = [];
    const ys = [];
    for (const [key, v] of other) {
      const b = target.get(keyOfStep(stepOf(key, f) + k, f));
      if (b != null && Number.isFinite(b) && Number.isFinite(v)) {
        xs.push(v);
        ys.push(b);
      }
    }
    return { lag: k, ...pearson(xs, ys) };
  });
}

// 찾아낸 것 — 지표 쌍마다 한쪽을 0~k칸 늦춘 값과 다른 쪽의 상관을 훑어 가장 강한 관계를 고른다.
// series: { id: [[칸, 값]] } (같은 주기·변환). 결과는 |r| 큰 순 [{ lead, follow, lag, r, n }]
// lag 0 이면 '같은 칸에서 함께', lag > 0 이면 lead 가 lag 칸 앞서 follow 와 함께 움직였다는 뜻.
// 시차를 둬도 같은 칸보다 뚜렷하게(|r| 0.05) 낫지 않으면 같은 칸 관계로 본다
export function findLeads(series, f, lags, { minN = 24, minR = 0.3 } = {}) {
  const ids = Object.keys(series).filter((id) => series[id]?.length);
  const stepped = Object.fromEntries(ids.map((id) => [id, series[id].map(([k, v]) => [stepOf(k, f), v])]));
  const byStep = Object.fromEntries(ids.map((id) => [id, new Map(stepped[id])]));
  const scan = (lead, follow) =>
    lags.map((k) => {
      const xs = [];
      const ys = [];
      for (const [step, v] of stepped[lead]) {
        const w = byStep[follow].get(step + k);
        if (w != null && Number.isFinite(w) && Number.isFinite(v)) {
          xs.push(v);
          ys.push(w);
        }
      }
      return { lag: k, ...pearson(xs, ys) };
    });
  const strongest = (list) =>
    list.filter((c) => c.r != null && c.n >= minN).reduce((m, c) => (!m || Math.abs(c.r) > Math.abs(m.r) ? c : m), null);
  const out = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const [a, b] = [ids[i], ids[j]];
      const ab = scan(a, b);
      const ba = scan(b, a);
      const [bestAB, bestBA] = [strongest(ab), strongest(ba)];
      if (!bestAB && !bestBA) continue;
      const best =
        !bestBA || (bestAB && Math.abs(bestAB.r) >= Math.abs(bestBA.r)) ? { ...bestAB, lead: a, follow: b } : { ...bestBA, lead: b, follow: a };
      const same = ab[0];
      const pick = same.r != null && same.n >= minN && Math.abs(best.r) - Math.abs(same.r) < 0.05 ? { ...same, lead: a, follow: b } : best;
      if (Math.abs(pick.r) >= minR) out.push({ lead: pick.lead, follow: pick.follow, lag: pick.lag, r: pick.r, n: pick.n });
    }
  }
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

// 멈춘 지표: 마지막 날이 원래 주기에 비해 오래됐으면 지난 날 수, 아니면 null (일 14일 · 순 40일 · 월 75일 넘게)
const STALE_DAYS = { daily: 14, soon: 40, monthly: 75 };
export function staleDays(entry, todayIso) {
  if (!entry?.lastDate || !todayIso) return null;
  const days = Math.round((utc(todayIso) - utc(entry.lastDate)) / DAY);
  return days > (STALE_DAYS[entry.freq] ?? 30) ? days : null;
}

// 분위수 (선형 보간). 값이 없으면 null
export function quantile(values, q) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  const pos = (xs.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}

// 조건: [{ id, min, max }] — 화면에 보이는 값(변환·시차 반영) 기준, 비운 쪽은 열려 있다.
// 모든 조건을 만족하는 칸의 Set (값이 없는 칸은 맞지 않음). 조건이 없으면 null
export function matchRows(rows, conditions) {
  if (!conditions.length) return null;
  const ok = (r) =>
    conditions.every((c) => {
      const v = r[c.id];
      return Number.isFinite(v) && (c.min == null || v >= c.min) && (c.max == null || v <= c.max);
    });
  return new Set(rows.filter(ok).map((r) => r.key));
}

// 계절(3~5월 봄 …) — 3D 산점도 색
export function seasonName(key) {
  const m = parse(key)[1];
  return m >= 3 && m <= 5 ? '봄' : m >= 6 && m <= 8 ? '여름' : m >= 9 && m <= 11 ? '가을' : '겨울';
}

// 지형도 격자: [[칸, 값]] (순 또는 월) → 해(행) × 한 해 안 시기(열: 순 36 · 월 12)
export function seasonGrid(series, f) {
  const cols = f === 'm' ? 12 : 36;
  const byYear = new Map();
  for (const [k, v] of series) {
    const [y, m, d] = parse(k);
    const col = f === 'm' ? m - 1 : (m - 1) * 3 + (d <= 10 ? 0 : d <= 20 ? 1 : 2);
    if (!byYear.has(y)) byYear.set(y, Array(cols).fill(null));
    byYear.get(y)[col] = v;
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  return { years, cols, z: years.map((y) => byYear.get(y)) };
}

// 화면에 보일 단위: 원값·이동평균은 지표 단위, 지수·비율은 공통 단위 — 같은 단위끼리 한 차트에
export function displayUnit(kind, unit) {
  if (kind === 'index') return '지수 (시작=100)';
  if (kind === 'yoy' || kind === 'normal') return `${TRANSFORMS[kind]} ${diffUnit(unit) ?? '%'}`;
  return unit ?? '';
}

// 기간 단축키 → 시작일 (끝은 데이터 마지막 날)
export function periodStart(period, lastIso) {
  if (!lastIso || period === 'all') return null;
  const years = period === '1y' ? 1 : period === '3y' ? 3 : period === '5y' ? 5 : null;
  if (!years) return null;
  const [y, m, d] = parse(lastIso);
  return `${y - years}-${pad(m)}-${pad(d)}`;
}

// 화면에 쓸 기간 [from, to] (칸 기준). 직접 고른 기간은 그대로, 단축키는 마지막 날에서 거꾸로
export function rangeOf(state, f, lastIso) {
  const from = state.period === 'custom' ? state.from : periodStart(state.period, lastIso);
  const to = state.period === 'custom' ? state.to : null;
  return { from: from ? bucketOf(from, f) : null, to: to ? bucketOf(to, f) : null };
}

// CSV — 맨 위에 제목·설명 줄(조건 등), 지표 설명(출처·단위·변환·시차), 빈 줄, 그 아래 표. 엑셀에서 한글이 깨지지 않게 BOM
export function toCsv({ title, notes = [], columns, rows }) {
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    [title].map(esc).join(','),
    ...notes.map(esc),
    ['지표', '출처', '단위', '변환', '시차'].join(','),
    ...columns.map((c) => [c.name, c.source, c.unit, c.transform, c.lag].map(esc).join(',')),
    '',
    ['날짜', ...columns.map((c) => c.name)].map(esc).join(','),
    ...rows.map((r) => [r.key, ...columns.map((c) => r[c.id])].map(esc).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}\n`;
}

const PERIOD_KEYS = ['1y', '3y', '5y', 'all', 'custom'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_BY = /^(season|year|\d)$/;
const CHART_KEYS = ['line', 'scatter', 'scatter3d', 'parallel', 'lag', 'terrain'];

// 조건 ↔ 주소: 'supply:양파,,-15;area_temp:haenam,1.5,' (지표, 최소, 최대 — 비우면 열림)
export function parseConditions(raw) {
  if (!raw) return [];
  const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return raw
    .split(';')
    .map((part) => {
      const [id, lo, hi] = part.split(',');
      return { id, min: num(lo), max: num(hi) };
    })
    .filter((c) => c.id && (c.min != null || c.max != null));
}

export function formatConditions(list) {
  return list.map((c) => [c.id, c.min ?? '', c.max ?? ''].join(',')).join(';');
}

// 주소(쿼리) ↔ 작업대 상태. 링크를 받은 사람이 같은 화면을 연다
export function readState(params) {
  const list = (key) => (params.get(key) ? params.get(key).split(',') : []);
  const ids = list('s').slice(0, MAX_SERIES);
  const kinds = list('t');
  const lags = list('lag');
  const colors = list('k');
  return {
    series: ids.map((id, i) => ({
      id,
      kind: TRANSFORMS[kinds[i]] ? kinds[i] : 'raw',
      lag: Number.parseInt(lags[i] ?? '0', 10) || 0,
      color: Number.isInteger(Number(colors[i])) && colors[i] !== '' ? Number(colors[i]) : i,
    })),
    freq: FREQ_LABEL[params.get('f')] ? params.get('f') : 's',
    period: PERIOD_KEYS.includes(params.get('p')) ? params.get('p') : '3y',
    from: DATE_RE.test(params.get('from') ?? '') ? params.get('from') : null,
    to: DATE_RE.test(params.get('to') ?? '') ? params.get('to') : null,
    chart: CHART_KEYS.includes(params.get('c')) ? params.get('c') : 'line',
    x: Number.parseInt(params.get('x') ?? '0', 10) || 0,
    y: Number.parseInt(params.get('y') ?? '1', 10) || 0,
    z: Number.parseInt(params.get('z') ?? '2', 10) || 0,
    cz: COLOR_BY.test(params.get('cz') ?? '') ? params.get('cz') : 'season',
    conditions: parseConditions(params.get('q')),
  };
}

export function writeState(state) {
  const p = new URLSearchParams();
  p.set('s', state.series.map((s) => s.id).join(',')); // 비어 있어도 둔다 — 다 지운 화면에 기본 템플릿을 다시 채우지 않게
  if (state.series.length) {
    p.set('t', state.series.map((s) => s.kind).join(','));
    p.set('lag', state.series.map((s) => s.lag).join(','));
    p.set('k', state.series.map((s) => s.color).join(','));
  }
  p.set('f', state.freq);
  p.set('p', state.period);
  if (state.period === 'custom') {
    if (state.from) p.set('from', state.from);
    if (state.to) p.set('to', state.to);
  }
  p.set('c', state.chart);
  if (state.chart !== 'line') {
    p.set('x', String(state.x));
    p.set('y', String(state.y));
  }
  if (state.chart === 'scatter3d') {
    p.set('z', String(state.z));
    p.set('cz', state.cz);
  }
  if (state.conditions?.length) p.set('q', formatConditions(state.conditions));
  return p;
}

// 새 지표 색: 비어 있는 첫 칸 (지워도 다른 지표 색은 그대로)
export function freeColor(series) {
  const used = new Set(series.map((s) => s.color));
  for (let i = 0; i < MAX_SERIES; i += 1) if (!used.has(i)) return i;
  return 0;
}
