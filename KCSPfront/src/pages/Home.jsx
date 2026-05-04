import Layout from '../components/Layout';
import { useState, useEffect } from 'react';
import { api } from '../api/api';

// 날짜 포맷 함수
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

export default function Home() {
  const [items, setItems] = useState([]);
  const [selectedItemCode, setSelectedItemCode] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState('전체');
  const [grades, setGrades] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [itemName, setItemName] = useState('');
  const [hoveredPoint, setHoveredPoint] = useState(null);  // 호버된 포인트 정보
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });  // 툴팁 위치

  // 품목 목록 로드
  useEffect(() => {
    loadItems();
  }, []);

  // 등급 목록 로드 (품목 선택 시에만)
  useEffect(() => {
    if (selectedItemCode) {
      loadGrades(selectedItemCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemCode]);

  // 가격 그래프 로드 (품목, 날짜, 등급 변경 시)
  useEffect(() => {
    if (selectedItemCode) {
      loadPriceGraph();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemCode, selectedDate, selectedGrade]);

  const loadItems = async () => {
    try {
      const data = await api.getItems();
      setItems(data);
      if (data.length > 0) {
        setSelectedItemCode(data[0].itemCode);
        setSelectedCategory(data[0].category);
        setItemName(data[0].itemName);
      }
    } catch (err) {
      console.error('품목 목록 로드 실패:', err);
    }
  };

  const loadGrades = async (itemCode) => {
    try {
      const data = await api.getGradesByItemCode(itemCode);
      console.log('등급 목록:', data);
      setGrades(['전체', ...data]);
      // 품목이 변경될 때만 '전체'로 초기화
      setSelectedGrade('전체');
    } catch (err) {
      console.error('등급 목록 로드 실패:', err);
      setGrades(['전체']);
    }
  };

  const loadPriceGraph = async () => {
    if (!selectedItemCode) return;
    
    setLoading(true);
    try {
      const endDate = new Date(selectedDate);
      const data = await api.getPriceGraph(selectedItemCode, endDate, selectedGrade);
      setPriceData(data.priceData || []);
      setItemName(data.itemName || '');
    } catch (err) {
      console.error('가격 그래프 데이터 로드 실패:', err);
      setPriceData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (e) => {
    const itemCode = parseInt(e.target.value);
    const item = items.find(i => i.itemCode === itemCode);
    if (item) {
      setSelectedItemCode(itemCode);
      setSelectedCategory(item.category);
      setItemName(item.itemName);
    }
  };

  const handleCategoryChange = (e) => {
    const category = parseInt(e.target.value);
    setSelectedCategory(category);
    // 카테고리별 품목 필터링
    if (category) {
      loadItemsByCategory(category);
    } else {
      loadItems();
    }
  };

  const loadItemsByCategory = async (category) => {
    try {
      const data = await api.getItemsByCategory(category);
      setItems(data);
      if (data.length > 0) {
        setSelectedItemCode(data[0].itemCode);
        setSelectedCategory(data[0].category);
        setItemName(data[0].itemName);
      }
    } catch (err) {
      console.error('카테고리별 품목 로드 실패:', err);
    }
  };

  const handleGradeChange = (e) => {
    const newGrade = e.target.value;
    console.log('등급 변경:', newGrade);
    setSelectedGrade(newGrade);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  // 그래프 데이터 가공
  const chartData = priceData
    .filter(d => d.price !== null)
    .map(d => ({
      date: formatDate(d.date),  // YYYY.MM.DD 형식
      price: d.price,
      rawDate: d.date
    }));

  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) : 0;
  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) : 0;
  const priceRange = maxPrice - minPrice || 1;

  // 간단한 SVG 그래프 그리기
  const renderGraph = () => {
    if (chartData.length === 0) {
      return (
        <div className="w-full h-80 flex items-center justify-center text-gray-400">
          데이터가 없습니다.
        </div>
      );
    }

    const height = 400;
    const leftPadding = 70;  // Y축 레이블을 위한 여유 공간
    const rightPadding = 40;
    const topPadding = 40;
    const bottomPadding = 50;  // X축 레이블을 위한 여유 공간
    
    // 데이터 포인트 간 최소 간격을 유지하기 위해 동적 너비 계산
    const minPointSpacing = 80;  // 각 포인트 간 최소 간격 (px)
    const minWidth = 600;  // 최소 그래프 너비
    const calculatedWidth = Math.max(minWidth, leftPadding + rightPadding + (chartData.length - 1) * minPointSpacing);
    const width = calculatedWidth;
    const chartWidth = width - leftPadding - rightPadding;
    const chartHeight = height - topPadding - bottomPadding;

    // Y축 범위에 여유를 주기 위해 약간의 여백 추가 (10% 여백)
    const pricePadding = priceRange * 0.1;
    const adjustedMinPrice = minPrice - pricePadding;
    const adjustedMaxPrice = maxPrice + pricePadding;
    const adjustedPriceRange = adjustedMaxPrice - adjustedMinPrice || 1;

    const points = chartData.map((d, index) => {
      const x = leftPadding + (index / (chartData.length - 1 || 1)) * chartWidth;
      const y = topPadding + chartHeight - ((d.price - adjustedMinPrice) / adjustedPriceRange) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    // Y축 그리드 라인 (5개 구간)
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const y = topPadding + chartHeight * (1 - ratio);
      const price = Math.round(adjustedMinPrice + adjustedPriceRange * ratio);
      return { y, price };
    });

    const handlePointMouseEnter = (e, index, data) => {
      const svgElement = e.currentTarget.ownerSVGElement;
      const svgRect = svgElement.getBoundingClientRect();
      const point = svgElement.createSVGPoint();
      point.x = e.clientX - svgRect.left;
      point.y = e.clientY - svgRect.top;
      
      // SVG 좌표로 변환 (viewBox 고려)
      const ctm = svgElement.getScreenCTM();
      const svgPoint = point.matrixTransform(ctm.inverse());
      
      setHoveredPoint({ index, data });
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    };

    return (
      <div 
        className="relative w-full overflow-x-auto"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <svg width={width} height={height}>
          {/* 그리드 라인 */}
          {gridLines.map((grid, i) => (
            <g key={i}>
              <line
                x1={leftPadding}
                y1={grid.y}
                x2={width - rightPadding}
                y2={grid.y}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={leftPadding - 10}
                y={grid.y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#6b7280"
                className="dark:fill-gray-400"
              >
                {grid.price.toLocaleString()}
              </text>
            </g>
          ))}

          {/* 데이터 라인 */}
          <polyline
            fill="none"
            stroke="#64cf17"
            strokeWidth="3"
            points={points}
          />

          {/* 데이터 포인트와 호버 영역 */}
          {chartData.map((d, index) => {
            const x = leftPadding + (index / (chartData.length - 1 || 1)) * chartWidth;
            const y = topPadding + chartHeight - ((d.price - adjustedMinPrice) / adjustedPriceRange) * chartHeight;
            const isHovered = hoveredPoint?.index === index;
            
            // 호버 영역의 너비 계산 (인접 포인트와의 중간 지점까지)
            let hoverWidth = 60;
            if (chartData.length > 1) {
              if (index === 0) {
                // 첫 번째 포인트
                const nextX = leftPadding + (1 / (chartData.length - 1)) * chartWidth;
                hoverWidth = (nextX - x) / 2;
              } else if (index === chartData.length - 1) {
                // 마지막 포인트
                const prevX = leftPadding + ((index - 1) / (chartData.length - 1)) * chartWidth;
                hoverWidth = (x - prevX) / 2;
              } else {
                // 중간 포인트
                const prevX = leftPadding + ((index - 1) / (chartData.length - 1)) * chartWidth;
                const nextX = leftPadding + ((index + 1) / (chartData.length - 1)) * chartWidth;
                hoverWidth = Math.min((x - prevX) / 2, (nextX - x) / 2);
              }
            }
            hoverWidth = Math.max(30, Math.min(hoverWidth, 50)); // 최소 30px, 최대 50px

            return (
              <g key={index}>
                {/* 호버 가능한 영역 (넓은 사각형 영역) */}
                <rect
                  x={x - hoverWidth / 2}
                  y={topPadding}
                  width={hoverWidth}
                  height={chartHeight + bottomPadding}
                  fill="transparent"
                  cursor="pointer"
                  onMouseEnter={(e) => handlePointMouseEnter(e, index, d)}
                  onMouseMove={(e) => handlePointMouseEnter(e, index, d)}
                />
                
                {/* 데이터 포인트 */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? "7" : "5"}
                  fill={isHovered ? "#4a9c0f" : "#64cf17"}
                  stroke="white"
                  strokeWidth="2"
                  style={{ transition: 'r 0.2s, fill 0.2s' }}
                  pointerEvents="none"
                />

                {/* X축 레이블 (날짜) */}
                <text
                  x={x}
                  y={height - bottomPadding + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#6b7280"
                  className="dark:fill-gray-400"
                  pointerEvents="none"
                >
                  {d.date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 툴팁 */}
        {hoveredPoint && (
          <div
            className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 pointer-events-none z-50 whitespace-nowrap"
            style={{
              left: `${tooltipPosition.x + 15}px`,
              top: `${tooltipPosition.y - 50}px`,
            }}
          >
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">
              {hoveredPoint.data.date}
            </div>
            <div className="text-base font-bold text-gray-900 dark:text-gray-100">
              {hoveredPoint.data.price.toLocaleString()}원
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <main className="p-10 space-y-8">
        <div className="flex flex-wrap justify-between gap-3">
          <p className="text-text-main dark:text-gray-100 text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">
            메인 대시보드
          </p>
        </div>

        <section>
          <h2 className="text-text-main dark:text-gray-100 text-lg font-bold mb-4">오늘의 주요 농산물 가격</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col gap-2 rounded-xl p-6 bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30">
              <p className="text-text-main dark:text-gray-200 text-base font-medium">배추 (1포기)</p>
              <p className="text-text-main dark:text-gray-100 tracking-light text-2xl font-bold leading-tight">3,500원</p>
              <p className="text-price-up text-base font-medium leading-normal">▲ 5.2%</p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl p-6 bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30">
              <p className="text-text-main dark:text-gray-200 text-base font-medium">쌀 (20kg)</p>
              <p className="text-text-main dark:text-gray-100 tracking-light text-2xl font-bold leading-tight">48,000원</p>
              <p className="text-price-down text-base font-medium leading-normal">▼ 1.5%</p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl p-6 bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30">
              <p className="text-text-main dark:text-gray-200 text-base font-medium">사과 (1개)</p>
              <p className="text-text-main dark:text-gray-100 tracking-light text-2xl font-bold leading-tight">2,100원</p>
              <p className="text-price-up text-base font-medium leading-normal">▲ 3.8%</p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl p-6 bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30">
              <p className="text-text-main dark:text-gray-200 text-base font-medium">돼지고기 (600g)</p>
              <p className="text-text-main dark:text-gray-100 tracking-light text-2xl font-bold leading-tight">12,500원</p>
              <p className="text-text-main dark:text-gray-200 text-base font-medium leading-normal">― 0.0%</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-text-main dark:text-gray-100 text-[22px] font-bold leading-tight pb-3 pt-5">농산물 가격 추이</h2>
              
              {/* 필터 섹션 */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  {/* 품목 선택 */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-text-main dark:text-gray-300 mb-2">
                      품목
                    </label>
                    <select
                      value={selectedItemCode || ''}
                      onChange={handleItemChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-dark text-text-main dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {items.map(item => (
                        <option key={item.itemCode} value={item.itemCode}>
                          {item.itemName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 품종(카테고리) 선택 */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-medium text-text-main dark:text-gray-300 mb-2">
                      품종
                    </label>
                    <select
                      value={selectedCategory || ''}
                      onChange={handleCategoryChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-dark text-text-main dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">전체</option>
                      <option value="1">카테고리 1</option>
                      <option value="2">카테고리 2</option>
                      <option value="3">카테고리 3</option>
                      {/* 실제 카테고리 데이터로 대체 필요 */}
                    </select>
                  </div>

                  {/* 등급 선택 */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-medium text-text-main dark:text-gray-300 mb-2">
                      등급
                    </label>
                    <select
                      value={selectedGrade}
                      onChange={handleGradeChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-dark text-text-main dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {grades.map(grade => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 시점 선택 */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-medium text-text-main dark:text-gray-300 mb-2">
                      시점
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={handleDateChange}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-dark text-text-main dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* 그래프 */}
              <div className="rounded-xl bg-primary-light dark:bg-primary/10 p-6 border border-primary/20 dark:border-primary/30">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-text-main dark:text-gray-100">
                    {itemName} 가격 추이 (1주일)
                  </h3>
                </div>
                {loading ? (
                  <div className="w-full h-80 flex items-center justify-center">
                    <p className="text-text-main dark:text-gray-300">로딩 중...</p>
                  </div>
                ) : (
                  <div className="w-full bg-white dark:bg-background-dark rounded-lg p-4 overflow-x-auto">
                    {renderGraph()}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:col-span-1">
            <section>
              <h2 className="text-text-main dark:text-gray-100 text-[22px] font-bold leading-tight pb-3 pt-5">최신 시장 동향 및 뉴스</h2>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30 space-y-2">
                  <p className="font-bold text-text-main dark:text-gray-100">"역대급 폭염 예고, 채소 가격 급등 우려"</p>
                  <p className="text-sm text-text-main/80 dark:text-gray-300">기상청 발표에 따르면 올 여름 기록적인 폭염이 예상되어 노지 채소 수급에 비상이 걸릴 것으로 보입니다.</p>
                  <div className="text-xs text-text-main/60 dark:text-gray-400">농업 신문 · 2024-05-21</div>
                </div>

                <div className="p-4 rounded-xl bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30 space-y-2">
                  <p className="font-bold text-text-main dark:text-gray-100">"정부, 농산물 가격 안정을 위한 비축 물량 방출 결정"</p>
                  <p className="text-sm text-text-main/80 dark:text-gray-300">농림축산식품부는 주요 농산물 가격 안정을 위해 비축된 물량을 시장에 공급할 것이라고 밝혔습니다.</p>
                  <div className="text-xs text-text-main/60 dark:text-gray-400">연합뉴스 · 2024-05-20</div>
                </div>

                <div className="p-4 rounded-xl bg-primary-light dark:bg-primary/10 border border-primary/20 dark:border-primary/30 space-y-2">
                  <p className="font-bold text-text-main dark:text-gray-100">"수입 과일 관세 인하, 국내 과일 시장에 미칠 영향은?"</p>
                  <p className="text-sm text-text-main/80 dark:text-gray-300">정부의 수입 과일 관세 인하 조치가 장바구니 물가 안정에 기여할지, 국내 과수 농가에 타격을 줄지 주목됩니다.</p>
                  <div className="text-xs text-text-main/60 dark:text-gray-400">경제 일보 · 2024-05-19</div>
                </div>

                <div className="p-4 rounded-xl bg-accent/20 dark:bg-accent/10 border border-accent/30 dark:border-accent/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-xl">warning</span>
                    <p className="font-bold text-text-main dark:text-accent">[긴급] 강원도 지역 냉해 피해 발생, 배추 생산량 감소 전망</p>
                  </div>
                  <div className="text-xs text-text-main/60 dark:text-gray-400 pl-8">AgriForecast 분석팀 · 2024-05-22</div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </Layout>
  );
}
