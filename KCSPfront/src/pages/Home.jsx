import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import HomeHero from '../components/home/HomeHero';
import SummaryCards from '../components/home/SummaryCards';
import TemplateCards from '../components/workbench/TemplateCards';
import { api } from '../api/api';

// 홈 — 정체성(흩어진 데이터를 한곳에서) · 작업대 바로가기 · 시작 템플릿 · 오늘의 요약
export default function Home() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    // 작업대 지표 목록 — 첫 화면 숫자·미리보기·템플릿에 쓴다. 못 받으면 그 부분만 숨긴다
    api
      .getSeriesCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  const openTemplate = (t, item) => navigate(`/analysis?tpl=${t.key}${item ? `&item=${encodeURIComponent(item)}` : ''}`);

  return (
    <Layout>
      <main className="px-4 py-6 sm:px-6 lg:p-10 space-y-10">
        <HomeHero catalog={catalog} />

        {catalog.length > 0 && (
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-text-main">이런 분석을 바로 열 수 있어요</h2>
                <p className="mt-0.5 text-xs text-subtext-light">템플릿에서 품목을 누르면 작업대가 그 설정으로 열려요</p>
              </div>
              <Link to="/analysis" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                작업대 열기
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
            <TemplateCards catalog={catalog} onApply={openTemplate} />
          </section>
        )}

        <SummaryCards />
      </main>
    </Layout>
  );
}
