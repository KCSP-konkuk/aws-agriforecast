import Layout from '../components/Layout';
import { useState, useEffect } from 'react';
import { api } from '../api/api';

const DIRECTION_CONFIG = {
  '1': { symbol: '▲', colorClass: 'text-price-up' },
  '0': { symbol: '▼', colorClass: 'text-price-down' },
  '2': { symbol: '―', colorClass: 'text-text-main dark:text-gray-200' },
};

const DATA_SOURCES = [
  { icon: 'price_change',            label: '가격 이력',       desc: '순별 도매 평균가' },
  { icon: 'wb_sunny',                label: '기상 데이터',     desc: '기온·강수·습도·일사량' },
  { icon: 'local_shipping',          label: '시장 반입량',     desc: '도매시장 공급량' },
  { icon: 'currency_exchange',       label: '환율',            desc: 'USD/KRW · CNY/KRW' },
  { icon: 'shopping_cart',           label: '소비자물가지수',  desc: 'CPI' },
  { icon: 'precision_manufacturing', label: '생산자물가지수',  desc: 'PPI' },
  { icon: 'local_gas_station',       label: '국제 유가',       desc: '원유 종가 · 등락률' },
];

const PIPELINE_STEPS = [
  { step: '01', icon: 'database',       title: '데이터 수집',      desc: '7종 외부 데이터 통합 및 순별 정렬' },
  { step: '02', icon: 'auto_awesome',   title: '피처 엔지니어링',  desc: '시계열 래그·이동평균·계절성·교차변수' },
  { step: '03', icon: 'model_training', title: 'XGBoost 학습',     desc: '5-Fold 시계열 교차검증 + 하이퍼파라미터 탐색' },
  { step: '04', icon: 'trending_up',    title: '순별 가격 예측',   desc: '상순·중순·하순 10일 단위 도매가 예측' },
];

export default function Home() {
  const [dailyPrices, setDailyPrices] = useState([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [news, setNews] = useState([]);

  useEffect(() => {
    loadDailyPrices();
    loadNews();
  }, []);

  const loadDailyPrices = async () => {
    try {
      const data = await api.getDailyPrices();
      setDailyPrices(data);
    } catch (err) {
      console.error('일일 가격 로드 실패:', err);
    }
  };

  const loadNews = async () => {
    try {
      const data = await api.getAgriNews();
      setNews(data);
    } catch (err) {
      console.error('뉴스 로드 실패:', err);
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

  useEffect(() => {
    if (dailyPrices.length < 2) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCarouselIndex(prev => (prev + 1) % dailyPrices.length);
        setIsTransitioning(false);
      }, 420);
    }, 3000);
    return () => clearInterval(interval);
  }, [dailyPrices.length]);

  return (
    <Layout>
      <main className="p-10 space-y-8">
        <div className="flex flex-wrap justify-between gap-3">
          <p className="text-text-main dark:text-gray-100 text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">
            메인 대시보드
          </p>
        </div>

        {/* 주요 농산물 가격 캐러셀 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-text-main dark:text-gray-100 text-lg font-bold">주요 농산물 가격</h2>
            {dailyPrices.length > 0 && (
              <div className="flex gap-1.5">
                {dailyPrices.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => { setCarouselIndex(i); setIsTransitioning(false); }, 300);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === carouselIndex ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {dailyPrices.length === 0 ? (
            <p className="text-center text-gray-400 py-8">가격 데이터를 불러오는 중...</p>
          ) : (
            <div className="overflow-hidden w-full">
              <div
                className="flex"
                style={{
                  width: '125%',
                  transform: isTransitioning ? 'translateX(-20%)' : 'translateX(0)',
                  transition: isTransitioning ? 'transform 0.4s ease-in-out' : 'none',
                }}
              >
                {Array.from({ length: 5 }, (_, offset) => {
                  const item = dailyPrices[(carouselIndex + offset) % dailyPrices.length];
                  const dir = DIRECTION_CONFIG[item.direction] ?? DIRECTION_CONFIG['2'];
                  const priceNum = item.price ? item.price.replace(/,/g, '') : '';
                  const displayPrice = priceNum ? Number(priceNum).toLocaleString() + '원' : '-';
                  const changeText = item.changeRate && item.changeRate !== '-' && item.changeRate !== '0'
                    ? `${dir.symbol} ${item.changeRate}%`
                    : `${dir.symbol} 0.0%`;
                  return (
                    <div key={`${carouselIndex}-${offset}`} style={{ width: '20%' }} className="px-2">
                      <div className="flex flex-col gap-2 rounded-xl p-5 bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30 h-full">
                        <p className="text-text-main dark:text-gray-200 text-base font-medium truncate">
                          {item.itemName}{item.unit ? ` (${item.unit})` : ''}
                        </p>
                        <p className="text-text-main dark:text-gray-100 text-2xl font-bold leading-tight">
                          {displayPrice}
                        </p>
                        <p className={`text-base font-medium leading-normal ${dir.colorClass}`}>
                          {changeText}
                        </p>
                        {item.lastDate && (
                          <p className="text-xs text-text-main/50 dark:text-gray-500">{item.lastDate} 기준</p>
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
              <h2 className="text-text-main dark:text-gray-100 text-[22px] font-bold leading-tight pb-3 pt-5">
                AI 농산물 가격 예측 모델
              </h2>

              {/* 개요 카드 */}
              <div className="rounded-xl bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30 p-5 mb-4">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-primary text-4xl mt-0.5">model_training</span>
                  <div>
                    <h3 className="font-bold text-lg text-text-main dark:text-gray-100 mb-1">
                      XGBoost 기반 순별(10일) 도매가격 예측
                    </h3>
                    <p className="text-sm text-text-main/75 dark:text-gray-300 leading-relaxed">
                      2018~2024년 실측 데이터를 학습한 AI 모델이 가격·기상·공급량·환율·물가지수·유가 등
                      <strong className="text-text-main dark:text-gray-100"> 7종의 외부 데이터</strong>를 복합 분석하여
                      <strong className="text-text-main dark:text-gray-100"> 상순·중순·하순 단위</strong>로 농산물 도매가격을 예측합니다.
                    </p>
                    <div className="flex gap-4 mt-3">
                      {[
                        { label: '학습 기간', value: '2018 – 2024' },
                        { label: '예측 단위', value: '순별 (10일)' },
                        { label: '알고리즘',  value: 'XGBoost' },
                        { label: '검증 방법', value: '5-Fold CV' },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p className="text-xs text-text-main/50 dark:text-gray-500">{label}</p>
                          <p className="text-sm font-bold text-primary">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 예측 파이프라인 */}
              <div className="mb-4">
                <p className="text-xs font-bold text-text-main/50 dark:text-gray-500 uppercase tracking-wider mb-3">
                  예측 파이프라인
                </p>
                <div className="flex items-stretch gap-2">
                  {PIPELINE_STEPS.map((s, i) => (
                    <div key={s.step} className="flex items-center gap-2 flex-1">
                      <div className="flex-1 rounded-xl p-4 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-700 text-center">
                        <p className="text-xs font-bold text-primary mb-1">STEP {s.step}</p>
                        <span className="material-symbols-outlined text-primary text-2xl block">{s.icon}</span>
                        <p className="text-xs font-bold text-text-main dark:text-gray-100 mt-1.5">{s.title}</p>
                        <p className="text-xs text-text-main/55 dark:text-gray-400 mt-0.5 leading-tight">{s.desc}</p>
                      </div>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-xl flex-shrink-0">
                          arrow_forward
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 학습 데이터 소스 */}
              <div className="mb-4">
                <p className="text-xs font-bold text-text-main/50 dark:text-gray-500 uppercase tracking-wider mb-3">
                  학습 데이터 소스 (7종)
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {DATA_SOURCES.map((src) => (
                    <div
                      key={src.label}
                      className="flex items-center gap-2.5 rounded-xl p-3 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-700"
                    >
                      <span className="material-symbols-outlined text-primary text-xl flex-shrink-0">{src.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-main dark:text-gray-100 truncate">{src.label}</p>
                        <p className="text-xs text-text-main/55 dark:text-gray-400 truncate">{src.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 모델 특징 & 주요 예측 변수 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4 bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30">
                  <h4 className="font-bold text-text-main dark:text-gray-100 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-lg">psychology</span>
                    모델 특징
                  </h4>
                  <ul className="space-y-1.5 text-sm text-text-main/80 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                      XGBoost 그래디언트 부스팅
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                      시계열 5-Fold 교차검증
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                      보릿고개(1~4월) 구간 가중 학습
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">check_circle</span>
                      그리드 탐색 기반 하이퍼파라미터 최적화
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl p-4 bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30">
                  <h4 className="font-bold text-text-main dark:text-gray-100 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-lg">insights</span>
                    주요 예측 변수
                  </h4>
                  <ul className="space-y-1.5 text-sm text-text-main/80 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">bar_chart</span>
                      과거 가격 추이 (최대 36순 래그)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">bar_chart</span>
                      반입량 변화율 · 전년 대비 공급량
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">bar_chart</span>
                      기상 이상 지표 (폭염·냉해·가뭄)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">bar_chart</span>
                      환율·유가 복합 시차 영향
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>

          <aside className="lg:col-span-1">
            <section>
              <h2 className="text-text-main dark:text-gray-100 text-[22px] font-bold leading-tight pb-3 pt-5">최신 시장 동향 및 뉴스</h2>
              <div className="space-y-4">
                {news.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">뉴스를 불러오는 중...</p>
                ) : (
                  news.map((item, i) => (
                    <a
                      key={i}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-xl bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30 space-y-2 hover:border-primary/50 transition-colors"
                    >
                      <p className="font-bold text-text-main dark:text-gray-100 line-clamp-2">{item.title}</p>
                      <p className="text-sm text-text-main/80 dark:text-gray-300 line-clamp-2">{item.description}</p>
                      <div className="text-xs text-text-main/60 dark:text-gray-400">{formatNewsDate(item.pubDate)}</div>
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
