import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import HomeHero from '../components/home/HomeHero';
import AskPanel from '../components/home/AskPanel';
import DataMap from '../components/home/DataMap';
import MarketStrip from '../components/home/MarketStrip';
import EndBand from '../components/home/EndBand';
import StatusMessage from '../components/StatusMessage';
import Icon from '../components/Icon';
import { api } from '../api/api';

export default function Home() {
  const [catalog, setCatalog] = useState([]);
  const [home, setHome] = useState(null);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setStatus('loading');
    api.getSeriesCatalog().then((data) => alive && setCatalog(data)).catch(() => alive && setCatalog([]));
    api.getHome().then((data) => { if (alive) { setHome(data); setStatus('ready'); } }).catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [attempt]);
  return (
    <Layout>
      <main className="page-shell space-y-12 !pt-5 sm:space-y-16 sm:!pt-7">
        <HomeHero catalog={catalog} />
        {status === 'loading' ? <div className="panel"><StatusMessage status="loading" loadingText="오늘의 시장을 불러오고 있어요" /></div> : status === 'error' || !home?.market?.length ? <section id="market" className="panel text-center"><StatusMessage status={status} emptyText="가격 전망을 준비하고 있어요. 작업대에서 시세를 먼저 살펴보세요." errorText="가격 전망을 불러오지 못했어요." /><div className="flex justify-center gap-3">{status === 'error' && <button className="button-secondary" onClick={() => setAttempt((n) => n + 1)}>다시 시도</button>}<Link className="button-primary" to="/analysis">시세 살펴보기<Icon className="size-4" /></Link></div></section> : <MarketStrip tiles={home.market} />}
        {home?.questions?.length > 0 && <AskPanel questions={home.questions} />}
        <DataMap catalog={catalog} />
        <EndBand />
      </main>
    </Layout>
  );
}
