import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusMessage from '../components/StatusMessage';
import PageHeading from '../components/PageHeading';
import ItemJourney from '../components/ItemJourney';
import Icon from '../components/Icon';
import { api } from '../api/api';
import Headline from '../components/dashboard/Headline';
import FactorBalance from '../components/dashboard/FactorBalance';
import SituationBoard from '../components/dashboard/SituationBoard';
import EventTimeline from '../components/dashboard/EventTimeline';
import AnalogCards from '../components/dashboard/AnalogCards';
import FlowPanel from '../components/dashboard/FlowPanel';
import { sinceLabel, updatedLabel } from '../components/dashboard/format';
import { TEMPLATES } from '../components/workbench/templates';

// 오늘의 요약(분석 › 오늘의 요약) — 품목마다 배치(pipeline_insight)가 매일 12:40 KST 계산한 인사이트를 보여 준다.
// 품목 목록은 API 에서 받는다(화면에 품목 이름을 두지 않는다)
export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState({ status: 'loading', data: [] });
  const [insight, setInsight] = useState({ status: 'loading', data: null });
  const [catalog, setCatalog] = useState([]);
  const selected = params.get('item') || items.data[0]?.item || null;
  // 이 품목으로 열 수 있는 작업대 템플릿 (품목끼리 비교는 품목과 무관해 뺀다)
  const bridges = selected ? TEMPLATES.filter((t) => t.key !== 'compare' && t.items(catalog).includes(selected)) : [];
  // 카드마다 더 파 볼 템플릿 — 이 품목으로 열 수 있을 때만
  const open = (key, label) =>
    bridges.some((t) => t.key === key) ? [{ to: `/analysis?tpl=${key}&item=${encodeURIComponent(selected)}`, label }] : [];

  useEffect(() => {
    api
      .getDashboardItems()
      .then((data) => setItems({ status: 'ready', data }))
      .catch(() => setItems({ status: 'error', data: [] }));
    api
      .getSeriesCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    let alive = true;
    // 품목을 바꾼 동안 이전 품목의 전망을 새 품목 아래에 표시하지 않는다.
    setInsight({ status: 'loading', data: null });
    api
      .getDashboard(selected)
      .then((data) => alive && setInsight({ status: 'ready', data }))
      .catch(() => alive && setInsight({ status: 'error', data: null }));
    return () => {
      alive = false;
    };
  }, [selected]);

  const d = insight.data;

  return (
    <Layout>
      <main className="page-shell space-y-6">
        <PageHeading title="소매 가격 전망" description="서울 전통시장 가격, 다음 순의 흐름을 읽어보세요.">
          <span className="pill">서울 전통시장 · KAMIS</span>
        </PageHeading>
        {items.status !== 'ready' || items.data.length === 0 ? (
          <div className="panel"><StatusMessage status={items.status} loadingText="품목을 불러오고 있어요" emptyText="아직 계산된 품목이 없어요." errorText="품목을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." /></div>
        ) : (
          <>
            <div className="crop-tabs" role="group" aria-label="소매 전망 품목">
              {items.data.map((it) => <button key={it.item} type="button" aria-pressed={it.item === selected} onClick={() => setParams({ item: it.item })} className={`crop-tab ${it.item === selected ? 'crop-tab-active' : ''}`}>{it.item}</button>)}
            </div>
            {!d ? (
              <div className="panel"><StatusMessage status={insight.status} loadingText="가격 전망을 불러오고 있어요" emptyText="이 품목은 아직 계산 전이에요. 매일 낮 12시 40분 이후 갱신돼요." errorText="전망을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요." /></div>
            ) : (
              <div className="space-y-5">
                <Headline data={d} />
                <div className="flex flex-wrap justify-between gap-2 px-1 data-note"><span>{d.priceLabel} · {d.unit} · {d.targetLabel} 기준</span><span>{updatedLabel(d.generatedAt)} 갱신</span></div>
                <ItemJourney item={selected} current="retail" />
                <div className="grid gap-5 lg:grid-cols-2"><FactorBalance data={d} /><SituationBoard data={d} actions={open('situation', '상황 비교')} /></div>
                <div className="grid gap-5 lg:grid-cols-2"><FlowPanel data={d} actions={[...open('lead', '시차 분석'), ...open('terrain', '가격 지형도')]} /><AnalogCards data={d} actions={open('situation', '과거 상황 비교')} /></div>
                <EventTimeline data={d} actions={open('transmission', '도매가와 비교')} />
                {bridges.length > 0 && <details className="panel"><summary className="font-semibold">이 품목 직접 분석하기</summary><div className="mt-4 flex flex-wrap gap-2">{bridges.map((t) => <Link key={t.key} to={`/analysis?tpl=${t.key}&item=${encodeURIComponent(selected)}`} className="button-secondary !min-h-10">{t.title}<Icon className="size-4" /></Link>)}</div></details>}
                <p className="data-note px-1">분석 기간 {sinceLabel(d.coverage?.since)}~ · {(d.coverage?.indicators ?? []).join(', ')}.<br />모델의 판단과 과거 데이터를 요약했으며, 원인을 단정하지 않아요.</p>
              </div>
            )}
          </>
        )}
      </main>
    </Layout>
  );
}
