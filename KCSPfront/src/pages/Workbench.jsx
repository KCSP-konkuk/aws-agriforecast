import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusMessage from '../components/StatusMessage';
import AnalysisTabs from '../components/AnalysisTabs';
import { api } from '../api/api';
import {
  align,
  allowedFreqs,
  convertLag,
  displayUnit,
  FREQ_LABEL,
  freeColor,
  MAX_SERIES,
  prepare,
  rangeOf,
  readState,
  TRANSFORMS,
  writeState,
} from '../lib/series';
import TemplateBar from '../components/workbench/TemplateBar';
import SelectedSeries from '../components/workbench/SelectedSeries';
import SeriesPicker from '../components/workbench/SeriesPicker';
import Controls from '../components/workbench/Controls';
import LineView from '../components/workbench/LineView';
import ScatterView from '../components/workbench/ScatterView';
import Readout from '../components/workbench/Readout';
import DataTable from '../components/workbench/DataTable';
import { defaultState, TEMPLATES } from '../components/workbench/templates';
import { lagLabel, spanLabel } from '../components/workbench/format';

const NATIVE = { daily: 'd', soon: 's', monthly: 'm' };
const EMPTY = readState(new URLSearchParams());

// 산점도 축(고른 지표 순번)이 범위를 넘거나 가로·세로가 같아지지 않게
function fixAxes(state) {
  const n = state.series.length;
  const x = state.x >= 0 && state.x < n ? state.x : 0;
  const y = state.y >= 0 && state.y < n && state.y !== x ? state.y : n > 1 ? (x === 0 ? 1 : 0) : 0;
  return { ...state, x, y };
}

// 주기는 고른 지표가 허락하는 것으로 맞추고, 주기가 바뀌면 시차를 같은 날 수에 가깝게 옮긴다
function normalize(next, catById, prevFreq) {
  const allowed = allowedFreqs(next.series.map((s) => catById[s.id]).filter(Boolean));
  const freq = allowed.includes(next.freq) ? next.freq : allowed[0];
  const series = freq === prevFreq ? next.series : next.series.map((s) => ({ ...s, lag: convertLag(s.lag, prevFreq, freq) }));
  return fixAxes({ ...next, freq, series });
}

// 표 머리에 적는 '무엇을 어떻게 맞췄나' — 예: 일→순 평균 · 지수 (시작=100). 그대로면 빈 문자열
function adjustText(entry, kind, f) {
  const native = NATIVE[entry.freq] ?? 'd';
  const resampled = native === f ? [] : [`${FREQ_LABEL[native]}→${FREQ_LABEL[f]} ${entry.agg === 'sum' ? '합계' : '평균'}`];
  return [...resampled, ...(kind === 'raw' ? [] : [TRANSFORMS[kind]])].join(' · ');
}

// 템플릿 링크(?tpl=&item=)나 빈 주소로 들어오면 첫 화면을 만든다
function initialState(params, catalog) {
  const tpl = TEMPLATES.find((t) => t.key === params.get('tpl'));
  const items = tpl ? tpl.items(catalog) : [];
  if (tpl && items.length) return tpl.build(catalog, items.includes(params.get('item')) ? params.get('item') : items[0]);
  return defaultState(catalog);
}

// 분석 작업대 — 흩어진 지표를 골라 주기·변환·시차를 맞춰 겹쳐 보고 표로 가져간다.
// 상태는 모두 주소(쿼리)에 있어 링크를 받은 사람이 같은 화면을 연다. 지표 목록은 API 에서 받는다
export default function Workbench() {
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState({ status: 'loading', data: [] });
  const [store, setStore] = useState({}); // 지표 → 원래 점들. 한 번 받은 지표는 다시 받지 않는다
  const [load, setLoad] = useState({ busy: false, error: false });
  const [retry, setRetry] = useState(0);
  const [dropped, setDropped] = useState(0);

  useEffect(() => {
    api
      .getSeriesCatalog()
      .then((data) => setCatalog({ status: 'ready', data }))
      .catch(() => setCatalog({ status: 'error', data: [] }));
  }, []);

  const ready = catalog.status === 'ready';
  const catById = useMemo(() => Object.fromEntries(catalog.data.map((c) => [c.id, c])), [catalog.data]);
  const state = useMemo(() => readState(params), [params]);

  // 첫 화면 채우기, 목록에 없는 지표(사라졌거나 잘못된 링크) 빼기
  useEffect(() => {
    if (!ready) return;
    if (!params.has('s')) {
      const built = initialState(params, catalog.data);
      if (built) setParams(writeState(normalize({ ...EMPTY, ...built }, catById, built.freq)), { replace: true });
      return;
    }
    const known = state.series.filter((s) => catById[s.id]);
    if (known.length < state.series.length) {
      setDropped(state.series.length - known.length);
      setParams(writeState(normalize({ ...state, series: known }, catById, state.freq)), { replace: true });
    }
  }, [ready, params, state, catalog.data, catById, setParams]);

  const series = useMemo(() => state.series.filter((s) => catById[s.id]), [state.series, catById]);
  const missingKey = series
    .map((s) => s.id)
    .filter((id) => !(id in store))
    .join(',');

  useEffect(() => {
    if (!missingKey) {
      setLoad((l) => (l.busy ? { ...l, busy: false } : l));
      return undefined;
    }
    let alive = true;
    const want = missingKey.split(',');
    setLoad({ busy: true, error: false });
    api
      .getSeriesData(want)
      .then((res) => {
        if (!alive) return;
        setStore((prev) => {
          const next = { ...prev };
          for (const id of want) next[id] = [];
          for (const s of res.series ?? []) next[s.id] = s.points;
          return next;
        });
        setLoad({ busy: false, error: false });
      })
      .catch(() => alive && setLoad({ busy: false, error: true }));
    return () => {
      alive = false;
    };
  }, [missingKey, retry]);

  const entries = series.map((s) => catById[s.id]);
  const allowed = allowedFreqs(entries);
  const freq = allowed.includes(state.freq) ? state.freq : allowed[0];
  const firstIso = entries.reduce((m, c) => (c.firstDate && (!m || c.firstDate < m) ? c.firstDate : m), null);
  const lastIso = entries.reduce((m, c) => (c.lastDate && (!m || c.lastDate > m) ? c.lastDate : m), null);
  const range = rangeOf(state, freq, lastIso);

  const prepared = useMemo(() => {
    const out = {};
    for (const s of series) {
      const c = catById[s.id];
      if (store[s.id]) {
        out[s.id] = prepare(store[s.id], { f: freq, agg: c.agg, unit: c.unit, native: c.freq, kind: s.kind, lag: s.lag, ...range });
      }
    }
    return out;
    // range 는 매번 새 객체라 값으로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, store, catById, freq, range.from, range.to]);
  const rows = useMemo(() => align(prepared), [prepared]);
  const lines = useMemo(
    () =>
      series.map((s) => {
        const c = catById[s.id];
        return {
          ...s,
          name: c.name,
          source: c.source,
          unit: c.unit,
          unitLabel: displayUnit(s.kind, c.unit),
          adjust: adjustText(c, s.kind, freq),
          lagText: lagLabel(s.lag, freq),
        };
      }),
    [series, catById, freq],
  );

  const update = useCallback(
    (patch, replace = true) => setParams(writeState(normalize({ ...state, ...patch }, catById, freq)), { replace }),
    [state, catById, freq, setParams],
  );

  const addSeries = (id) => {
    if (series.length >= MAX_SERIES || series.some((s) => s.id === id)) return;
    // 지금 지표들이 모두 같은 변환이면 새 지표도 그 변환으로 (지수끼리 보던 중이면 지수로)
    const kinds = new Set(series.map((s) => s.kind));
    update({ series: [...series, { id, kind: kinds.size === 1 ? [...kinds][0] : 'raw', lag: 0, color: freeColor(series) }] });
  };
  const removeSeries = (id) => {
    const at = series.findIndex((s) => s.id === id);
    const move = (v) => (v > at ? v - 1 : v);
    update({ series: series.filter((s) => s.id !== id), x: move(state.x), y: move(state.y) });
  };
  const changeSeries = (id, patch) => update({ series: series.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const applyTemplate = (t, item) => {
    const built = t.build(catalog.data, item);
    setParams(writeState(normalize({ ...EMPTY, ...built }, catById, built.freq)));
  };

  // 지표마다 기간이 다르면 모두 있는 기간을 알린다(산점도·상관은 함께 있는 칸만 쓴다)
  const spans = Object.values(prepared)
    .filter((p) => p.length)
    .map((p) => [p[0][0], p[p.length - 1][0]]);
  const overlap =
    spans.length > 1 ? [spans.reduce((m, s) => (s[0] > m ? s[0] : m), spans[0][0]), spans.reduce((m, s) => (s[1] < m ? s[1] : m), spans[0][1])] : null;
  // 끝이 며칠 어긋난 정도는 알리지 않는다 — 함께 없는 칸이 전체의 5%(최소 3칸)를 넘을 때만
  const outside = overlap ? rows.filter((r) => r.key < overlap[0] || r.key > overlap[1]).length : 0;
  const partial = overlap && (overlap[0] > overlap[1] || outside > Math.max(3, rows.length * 0.05));
  const hasData = Object.keys(prepared).length > 0;

  let body;
  if (!series.length) {
    body = <p className="py-16 text-center text-sm text-subtext-light">왼쪽 목록에서 지표를 고르거나, 위 시작 템플릿을 눌러 보세요.</p>;
  } else if (load.error && !hasData) {
    body = (
      <div className="py-12 text-center">
        <StatusMessage status="error" errorText="데이터를 불러오지 못했어요." />
        <button type="button" onClick={() => setRetry((n) => n + 1)} className="text-sm font-semibold text-primary hover:underline">
          다시 시도
        </button>
      </div>
    );
  } else if (!hasData) {
    body = <StatusMessage status="loading" loadingText="데이터를 불러오는 중이에요" />;
  } else {
    body = (
      <div className={`space-y-4 transition-opacity ${load.busy ? 'opacity-60' : ''}`}>
        {state.chart === 'scatter' ? (
          <ScatterView rows={rows} lines={lines} x={state.x} y={state.y} freq={freq} onAxes={(x, y) => update({ x, y })} />
        ) : (
          <LineView rows={rows} lines={lines} freq={freq} onIndexAll={() => update({ series: series.map((s) => ({ ...s, kind: 'index' })) })} />
        )}
        <div className="space-y-1 text-xs text-subtext-light">
          {load.error && (
            <p className="text-red-600">
              일부 지표를 불러오지 못했어요.{' '}
              <button type="button" onClick={() => setRetry((n) => n + 1)} className="font-semibold underline">
                다시 시도
              </button>
            </p>
          )}
          {partial &&
            (overlap[0] <= overlap[1] ? (
              <p>지표마다 기간이 달라요. 모두 있는 기간은 {spanLabel(overlap[0], overlap[1])}이에요. 산점도·상관은 함께 있는 칸만 써요.</p>
            ) : (
              <p>고른 지표들이 함께 있는 기간이 없어요. 기간을 넓히거나 다른 지표를 골라 보세요.</p>
            ))}
          {freq === 'd' && rows.length > 1500 && <p>점이 많아요. 주·순 단위로 보면 흐름이 더 잘 보여요.</p>}
        </div>
        <Readout lines={lines} prepared={prepared} freq={freq} />
      </div>
    );
  }

  return (
    <Layout>
      <main className="px-4 py-6 sm:px-6 lg:p-10 space-y-5">
        <div>
          <h1 className="text-text-main text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">분석 작업대</h1>
          <p className="text-subtext-light mt-2 text-sm">
            흩어진 시세·수급·날씨·거시 데이터를 한곳에 모았어요. 지표를 골라 겹쳐 보고, 관계를 확인하고, 표로 가져가세요.
          </p>
        </div>
        <AnalysisTabs />

        {!ready || catalog.data.length === 0 ? (
          <StatusMessage
            status={catalog.status}
            loadingText="지표 목록을 불러오는 중이에요"
            emptyText="아직 모인 지표가 없어요. 매일 낮 12시 50분에 갱신돼요."
            errorText="지표 목록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."
          />
        ) : (
          <>
            <TemplateBar catalog={catalog.data} onApply={applyTemplate} />
            {dropped > 0 && <p className="text-xs text-subtext-light">링크에 있던 지표 {dropped}개는 지금 목록에 없어 뺐어요.</p>}
            {/* 넓은 화면: 왼쪽에 고른 지표·데이터 고르기, 오른쪽에 차트·표. 좁은 화면: 고른 지표 → 차트·표 → 데이터 고르기 */}
            <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
              <div className="lg:col-start-1 lg:row-start-1">
                <SelectedSeries series={series} catById={catById} freq={freq} onChange={changeSeries} onRemove={removeSeries} />
              </div>
              <div className="lg:col-start-1 lg:row-start-2 order-last lg:order-none">
                <SeriesPicker catalog={catalog.data} selectedIds={series.map((s) => s.id)} onAdd={addSeries} />
              </div>
              <div className="min-w-0 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
                <section className="space-y-4 rounded-xl bg-white border border-gray-200 p-4">
                  <Controls
                    chart={state.chart}
                    freq={freq}
                    allowed={allowed}
                    period={state.period}
                    from={state.from}
                    to={state.to}
                    bounds={{ min: firstIso, max: lastIso, from: range.from ?? firstIso, to: lastIso }}
                    onChange={update}
                  />
                  {body}
                </section>
                {hasData && (
                  <DataTable
                    rows={rows}
                    columns={lines}
                    freq={freq}
                    title={`AgriForecast 분석 작업대 (${FREQ_LABEL[freq]} 단위${rows.length ? `, ${spanLabel(rows[0].key, rows[rows.length - 1].key)}` : ''})`}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </Layout>
  );
}
