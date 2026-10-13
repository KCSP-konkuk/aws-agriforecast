import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import HomeHero from '../components/home/HomeHero';
import AskPanel from '../components/home/AskPanel';
import DataMap from '../components/home/DataMap';
import MarketStrip from '../components/home/MarketStrip';
import EndBand from '../components/home/EndBand';
import { api } from '../api/api';

// 홈 — 질문 하나 · 차트 하나 · 문장 하나. 무엇을 하는 곳인지(첫 화면) → 무엇을 알 수 있는지(질문) → 어떤 데이터인지(지도)
// → 지금 시장(예측 칸) → 출구. 질문 · 시장 칸은 배치(home_highlights)가 매일 계산하고, 못 받으면 그 구역만 숨긴다
export default function Home() {
  const [catalog, setCatalog] = useState([]);
  const [home, setHome] = useState(null);

  useEffect(() => {
    api
      .getSeriesCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
    api
      .getHome()
      .then(setHome)
      .catch(() => setHome(null));
  }, []);

  return (
    <Layout>
      <main className="mx-auto w-full max-w-6xl space-y-12 px-4 py-8 sm:px-6 lg:py-12">
        <HomeHero catalog={catalog} />
        {home?.questions?.length > 0 && <AskPanel questions={home.questions} />}
        <DataMap catalog={catalog} />
        <MarketStrip tiles={home?.market} />
        <EndBand />
      </main>
    </Layout>
  );
}
