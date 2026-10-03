import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusMessage from '../components/StatusMessage';
import { api } from '../api/api';
import Headline from '../components/dashboard/Headline';
import FactorBalance from '../components/dashboard/FactorBalance';
import SituationBoard from '../components/dashboard/SituationBoard';
import EventTimeline from '../components/dashboard/EventTimeline';
import AnalogCards from '../components/dashboard/AnalogCards';
import FlowPanel from '../components/dashboard/FlowPanel';
import { sinceLabel, updatedLabel } from '../components/dashboard/format';

// 가격 대시보드 — 품목마다 배치(pipeline_insight)가 매일 12:40 KST 계산한 인사이트를 보여 준다.
// 품목 목록은 API 에서 받는다(화면에 품목 이름을 두지 않는다)
export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState({ status: 'loading', data: [] });
  const [insight, setInsight] = useState({ status: 'loading', data: null });
  const selected = params.get('item') || items.data[0]?.item || null;

  useEffect(() => {
    api
      .getDashboardItems()
      .then((data) => setItems({ status: 'ready', data }))
      .catch(() => setItems({ status: 'error', data: [] }));
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    let alive = true;
    // 다시 불러오는 동안엔 이전 화면을 흐리게 남긴다(깜빡임 없이)
    setInsight((prev) => ({ ...prev, status: 'loading' }));
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
      <main className="px-4 py-6 sm:px-6 lg:p-10 space-y-6">
        <div>
          <h1 className="text-text-main text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">가격 대시보드</h1>
          <p className="text-subtext-light mt-2 text-sm">
            KAMIS 서울 전통시장 소매가를 도매가·반입량·날씨·환율 같은 데이터와 함께 읽어요. 매일 낮 12시 40분에 갱신돼요.
          </p>
        </div>

        {items.status !== 'ready' || items.data.length === 0 ? (
          <StatusMessage
            status={items.status}
            loadingText="품목을 불러오는 중이에요"
            emptyText="아직 계산된 품목이 없어요. 매일 낮 12시 40분에 갱신돼요."
            errorText="품목을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="품목">
              {items.data.map((it) => (
                <button
                  key={it.item}
                  type="button"
                  role="tab"
                  aria-selected={it.item === selected}
                  onClick={() => setParams({ item: it.item })}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
                    it.item === selected
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-main border-gray-200 hover:border-primary/50'
                  }`}
                >
                  {it.item}
                </button>
              ))}
            </div>

            {!d ? (
              <StatusMessage
                status={insight.status === 'ready' ? 'ready' : insight.status}
                loadingText="대시보드를 불러오는 중이에요"
                emptyText="이 품목은 아직 계산 전이에요. 매일 낮 12시 40분에 갱신돼요."
                errorText="대시보드를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."
              />
            ) : (
              <div className={`space-y-6 transition-opacity ${insight.status === 'loading' ? 'opacity-60' : ''}`}>
                <p className="text-xs text-subtext-light">
                  {d.priceLabel} · {d.unit} · {d.targetLabel} 기준 · {updatedLabel(d.generatedAt)} 갱신
                </p>
                <Headline data={d} />
                <div className="grid gap-6 lg:grid-cols-2">
                  <FactorBalance data={d} />
                  <SituationBoard data={d} />
                </div>
                <EventTimeline data={d} />
                <div className="grid gap-6 lg:grid-cols-2">
                  <AnalogCards data={d} />
                  <FlowPanel data={d} />
                </div>
                <p className="text-xs text-subtext-light">
                  분석 기간 {sinceLabel(d.coverage?.since)}~ · 쓰인 지표: {(d.coverage?.indicators ?? []).join(', ')}.
                  모델의 판단과 과거 데이터를 요약한 것이며, 원인을 단정하지는 않아요.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </Layout>
  );
}
