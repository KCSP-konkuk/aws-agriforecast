import Layout from '../components/Layout';
import { useState, useEffect } from 'react';
import StatusMessage from '../components/StatusMessage';
import { api } from '../api/api';

const DIRECTION_CONFIG = {
  '1': { symbol: '▲', colorClass: 'text-price-up' },
  '0': { symbol: '▼', colorClass: 'text-price-down' },
  '2': { symbol: '―', colorClass: 'text-text-main' },
};

// 품목별 사용 데이터는 KCSPmodel/batch/pipeline*.py 기준. 모델 입력이 바뀌면 여기도 맞출 것
const DATA_SOURCES = [
  { icon: 'price_change',      label: '도매 가격',        desc: '농넷 가락시장 · 전 품목' },
  { icon: 'local_shipping',    label: '시장 반입량',      desc: '배추 · 양파' },
  { icon: 'wb_sunny',          label: '산지 기상',        desc: '기상청 ASOS · 배추 · 양파' },
  { icon: 'search',            label: '검색량',           desc: '네이버 데이터랩 · 배추 · 홍고추' },
  { icon: 'currency_exchange', label: '환율',             desc: 'USD · CNY · 양파' },
  { icon: 'shopping_cart',     label: '물가지수',         desc: 'CPI · PPI · 양파' },
  { icon: 'history',           label: '평년 · 전년 가격', desc: '양파 · 홍고추' },
  { icon: 'nutrition',         label: '연관 품목 가격',   desc: '풋고추 · 청피망 · 홍고추' },
];

const PIPELINE_STEPS = [
  { step: '01', icon: 'database',       title: '데이터 수집',      desc: '시세·기상·환율·물가·검색량을 순별로 정렬' },
  { step: '02', icon: 'auto_awesome',   title: '피처 엔지니어링',  desc: '가격 래그·이동평균·계절성·기상 지표' },
  { step: '03', icon: 'model_training', title: 'XGBoost 학습',     desc: '품목별 모델을 최신 데이터로 매일 재학습' },
  { step: '04', icon: 'trending_up',    title: '순별 가격 예측',   desc: '다음 순 도매가 예측 후 실제가와 오차 기록' },
];

const MODEL_FEATURES = [
  '품목별 XGBoost 모델을 따로 학습',
  '배추: 여름(7~9월)엔 고랭지 산지 기상으로 전환',
  '양파: 보릿고개(1~4월) 구간 가중 학습',
  '홍고추: 직전 순 대비 변화율 예측 + 12개 모델 평균',
];

const KEY_VARIABLES = [
  '과거 가격 추이 (최대 36순 래그 · 이동평균)',
  '반입량 변화 · 가격 대비 공급 비율',
  '산지 기상 (기온·강수·일사 · 집중호우)',
  '환율·물가지수 시차 영향 · 검색량 추이',
];

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
              <p className="text-xs text-subtext-light mt-0.5">KAMIS 농산물유통정보 · 전일 대비</p>
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
            <section>
              <h2 className="text-text-main text-[22px] font-bold leading-tight pb-3 pt-5">
                AI 농산물 가격 예측 모델
              </h2>

              {/* 개요 카드 */}
              <div className="rounded-xl bg-primary-light border border-primary/20 p-5 mb-4">
                <div className="flex items-start gap-4">
                  <span className="hidden sm:block material-symbols-outlined text-primary text-4xl mt-0.5">model_training</span>
                  <div>
                    <h3 className="font-bold text-lg text-text-main mb-1">
                      XGBoost 기반 순별(10일) 도매가격 예측
                    </h3>
                    <p className="text-sm text-text-main/75 leading-relaxed">
                      품목마다 가격을 움직이는 요인이 달라 <strong className="text-text-main">배추·양파·홍고추 모델을 각각 따로</strong> 설계했습니다.
                      가격·반입량·기상·환율·물가지수·검색량 중 품목에 맞는 데이터로 매일 새벽 다시 학습해
                      <strong className="text-text-main"> 다음 순(상순·중순·하순)</strong> 도매가격을 예측합니다.
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-3 mt-3">
                      {[
                        { label: '예측 품목', value: '배추·양파·홍고추' },
                        { label: '예측 단위', value: '순별 (10일)' },
                        { label: '알고리즘',  value: 'XGBoost' },
                        { label: '갱신 주기', value: '매일 새벽' },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p className="text-xs text-text-main/50">{label}</p>
                          <p className="text-sm font-bold text-primary">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 예측 파이프라인 */}
              <div className="mb-4">
                <p className="text-xs font-bold text-text-main/50 uppercase tracking-wider mb-3">
                  예측 파이프라인
                </p>
                <div className="grid grid-cols-2 gap-2 lg:flex lg:items-stretch">
                  {PIPELINE_STEPS.map((s, i) => (
                    <div key={s.step} className="flex items-center gap-2 flex-1">
                      <div className="flex-1 rounded-xl p-4 bg-white border border-gray-200 text-center">
                        <p className="text-xs font-bold text-primary mb-1">STEP {s.step}</p>
                        <span className="material-symbols-outlined text-primary text-2xl block">{s.icon}</span>
                        <p className="text-xs font-bold text-text-main mt-1.5">{s.title}</p>
                        <p className="text-xs text-text-main/55 mt-0.5 leading-tight">{s.desc}</p>
                      </div>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <span className="hidden lg:inline material-symbols-outlined text-gray-300 text-xl flex-shrink-0">
                          arrow_forward
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 학습 데이터 소스 */}
              <div className="mb-4">
                <p className="text-xs font-bold text-text-main/50 uppercase tracking-wider mb-3">
                  학습 데이터 소스 ({DATA_SOURCES.length}종)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {DATA_SOURCES.map((src) => (
                    <div
                      key={src.label}
                      className="flex items-center gap-2.5 rounded-xl p-3 bg-white border border-gray-200"
                    >
                      <span className="material-symbols-outlined text-primary text-xl flex-shrink-0">{src.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-main truncate">{src.label}</p>
                        <p className="text-xs text-text-main/55 truncate">{src.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 모델 특징 & 주요 예측 변수 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl p-4 bg-primary-light border border-primary/20">
                  <h4 className="font-bold text-text-main mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-lg">psychology</span>
                    모델 특징
                  </h4>
                  <ul className="space-y-1.5 text-sm text-text-main/80">
                  {MODEL_FEATURES.map((text) => (
                    <li key={text} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                      {text}
                    </li>
                  ))}
                </ul>
                </div>

                <div className="rounded-xl p-4 bg-primary-light border border-primary/20">
                  <h4 className="font-bold text-text-main mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-lg">insights</span>
                    주요 예측 변수
                  </h4>
                  <ul className="space-y-1.5 text-sm text-text-main/80">
                  {KEY_VARIABLES.map((text) => (
                    <li key={text} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">bar_chart</span>
                      {text}
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            </section>
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
