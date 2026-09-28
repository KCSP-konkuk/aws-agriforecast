import Layout from '../components/Layout';
import { useState, useEffect } from 'react';
import StatusMessage from '../components/StatusMessage';
import RetailPriceSection from '../components/RetailPriceSection';
import { api } from '../api/api';

const DIRECTION_CONFIG = {
  '1': { symbol: '▲', colorClass: 'text-price-up' },
  '0': { symbol: '▼', colorClass: 'text-price-down' },
  '2': { symbol: '―', colorClass: 'text-text-main' },
};

// 화면 폭에 따라 캐러셀에 동시에 보이는 카드 수 (Tailwind sm·lg 기준)
function useVisibleCount() {
  const calc = () => (window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 5);
  const [count, setCount] = useState(calc);
  useEffect(() => {
    const onResize = () => setCount(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return count;
}

export default function Home() {
  const [dailyPrices, setDailyPrices] = useState([]);
  const [pricesStatus, setPricesStatus] = useState('loading');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [news, setNews] = useState([]);
  const [newsStatus, setNewsStatus] = useState('loading');
  const visibleCount = useVisibleCount();

  useEffect(() => {
    loadDailyPrices();
    loadNews();
  }, []);

  const loadDailyPrices = async () => {
    try {
      const data = await api.getDailyPrices();
      setDailyPrices(data);
      setPricesStatus('ready');
    } catch (err) {
      console.error('일일 가격 로드 실패:', err);
      setPricesStatus('error');
    }
  };

  const loadNews = async () => {
    try {
      const data = await api.getAgriNews();
      setNews(data);
      setNewsStatus('ready');
    } catch (err) {
      console.error('뉴스 로드 실패:', err);
      setNewsStatus('error');
    }
  };

  const formatNewsDate = (pubDate) => {
    try {
      const date = new Date(pubDate);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch {
      return pubDate;
    }
  };

  // 카드가 한 화면에 다 들어가면 돌리지 않는다
  const shown = Math.min(visibleCount, dailyPrices.length);
  const rotates = dailyPrices.length > visibleCount;

  useEffect(() => {
    if (!rotates) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCarouselIndex(prev => (prev + 1) % dailyPrices.length);
        setIsTransitioning(false);
      }, 420);
    }, 3000);
    return () => clearInterval(interval);
  }, [rotates, dailyPrices.length]);

  return (
    <Layout>
      <main className="px-4 py-6 sm:px-6 lg:p-10 space-y-8">
        <h1 className="text-text-main text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">
          메인 대시보드
        </h1>

        {/* 주요 농산물 가격 캐러셀 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-text-main text-lg font-bold">주요 농산물 소매가격</h2>
              <p className="text-xs text-subtext-light mt-0.5">KAMIS 전국 평균 소매가 · 전일 대비</p>
            </div>
            {rotates && (
              <div className="flex gap-1.5">
                {dailyPrices.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => { setCarouselIndex(i); setIsTransitioning(false); }, 300);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === carouselIndex ? 'bg-primary' : 'bg-gray-300'
                    }`}
                    aria-label={`${i + 1}번째 품목`}
                  />
                ))}
              </div>
            )}
          </div>

          {pricesStatus !== 'ready' || dailyPrices.length === 0 ? (
            <StatusMessage
              status={pricesStatus}
              loadingText="가격 정보를 불러오는 중..."
              emptyText="오늘 발표된 가격 정보가 없습니다."
              errorText="가격 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
            />
          ) : (
            <div className="overflow-hidden w-full">
              <div
                className="flex"
                style={{
                  // 보이는 카드 수 + 다음 카드 1장을 한 줄에 두고, 카드 1장 폭만큼 밀어 넘긴다
                  width: rotates ? `${((shown + 1) / shown) * 100}%` : '100%',
                  transform: isTransitioning ? `translateX(-${100 / (shown + 1)}%)` : 'translateX(0)',
                  transition: isTransitioning ? 'transform 0.4s ease-in-out' : 'none',
                }}
              >
                {Array.from({ length: rotates ? shown + 1 : shown }, (_, offset) => {
                  const item = dailyPrices[(carouselIndex + offset) % dailyPrices.length];
                  const dir = DIRECTION_CONFIG[item.direction] ?? DIRECTION_CONFIG['2'];
                  const priceNum = item.price ? item.price.replace(/,/g, '') : '';
                  const displayPrice = priceNum ? Number(priceNum).toLocaleString() + '원' : '-';
                  const changeText = item.changeRate && item.changeRate !== '-' && item.changeRate !== '0'
                    ? `${dir.symbol} ${item.changeRate}%`
                    : `${dir.symbol} 0.0%`;
                  return (
                    <div key={`${carouselIndex}-${offset}`} style={{ width: `${100 / (rotates ? shown + 1 : shown)}%` }} className="px-1.5 sm:px-2">
                      <div className="flex flex-col gap-2 rounded-xl p-4 sm:p-5 bg-primary-light border border-primary/20 h-full">
                        <p className="text-text-main text-base font-medium truncate">
                          {item.itemName}{item.unit ? ` (${item.unit})` : ''}
                        </p>
                        <p className="text-text-main text-xl sm:text-2xl font-bold leading-tight">
                          {displayPrice}
                        </p>
                        <p className={`text-sm sm:text-base font-medium leading-normal ${dir.colorClass}`}>
                          {changeText}
                        </p>
                        {item.lastDate && (
                          <p className="text-xs text-text-main/50">{item.lastDate} 기준</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <RetailPriceSection />
          </div>

          <aside className="lg:col-span-1">
            <section>
              <h2 className="text-text-main text-[22px] font-bold leading-tight pb-3 pt-5">최신 시장 동향 및 뉴스</h2>
              <div className="space-y-4">
                {newsStatus !== 'ready' || news.length === 0 ? (
                  <StatusMessage
                    status={newsStatus}
                    loadingText="뉴스를 불러오는 중..."
                    emptyText="표시할 뉴스가 없습니다."
                    errorText="뉴스를 불러오지 못했습니다."
                  />
                ) : (
                  news.map((item, i) => (
                    <a
                      key={i}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-xl bg-primary-light border border-primary/20 space-y-2 hover:border-primary/50 transition-colors"
                    >
                      <p className="font-bold text-text-main line-clamp-2">{item.title}</p>
                      <p className="text-sm text-text-main/80 line-clamp-2">{item.description}</p>
                      <div className="text-xs text-text-main/60">{formatNewsDate(item.pubDate)}</div>
                    </a>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </Layout>
  );
}
