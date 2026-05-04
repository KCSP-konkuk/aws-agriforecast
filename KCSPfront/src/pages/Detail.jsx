import Layout from '../components/Layout';

export default function Detail() {
  return (
    <Layout>
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* PageHeading */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-extrabold tracking-tight text-text-light dark:text-text-dark">농산물 가격 분석: 배추</h2>
              <p className="text-base font-normal text-subtext-light dark:text-subtext-dark">과거, 현재, 그리고 AI 예측 가격 데이터를 시각적으로 분석하세요.</p>
            </div>
          </div>
          
          {/* Filter & Control Panel */}
          <div className="p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 농산물 선택 */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-text-light dark:text-text-dark" htmlFor="product-select">품목 선택</label>
                <select className="w-full h-10 px-3 text-base bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition" id="product-select">
                  <option>야채류</option>
                  <option>과일류</option>
                </select>
              </div>
              {/* 농산물 선택 */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-text-light dark:text-text-dark" htmlFor="product-select-2">품종 선택</label>
                <select className="w-full h-10 px-3 text-base bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition" id="product-select-2">
                  <option>배추</option>
                  <option>사과</option>
                  <option>마늘</option>
                  <option>양파</option>
                </select>
              </div>
              {/* 기간 설정 */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-text-light dark:text-text-dark">기간 설정</p>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary/20 text-primary">최근 1개월</button>
                  <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">1년</button>
                  <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">전체</button>
                  <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
                    <span className="material-symbols-outlined text-lg">calendar_month</span>
                    <span>지정</span>
                  </button>
                </div>
              </div>

              {/* 단위 */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-text-light dark:text-text-dark">단위</p>
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <button className="flex-1 text-center text-sm py-1 rounded-md bg-surface-light dark:bg-surface-dark shadow-sm">일별</button>
                  <button className="flex-1 text-center text-sm py-1 rounded-md text-subtext-light dark:text-subtext-dark">주별</button>
                  <button className="flex-1 text-center text-sm py-1 rounded-md text-subtext-light dark:text-subtext-dark">월별</button>
                </div>
              </div>
            </div>
          </div>
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
              <p className="text-sm font-medium text-subtext-light dark:text-subtext-dark">현재 평균 도매가</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-text-light dark:text-text-dark">2,580원</p>
                <span className="text-sm text-subtext-light dark:text-subtext-dark">/kg</span>
              </div>
            </div>
            <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
              <p className="text-sm font-medium text-subtext-light dark:text-subtext-dark">전일 대비</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-red-500">▼ 120원</p>
                <span className="text-sm font-semibold text-red-500">(-4.4%)</span>
              </div>
            </div>
            <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
              <p className="text-sm font-medium text-subtext-light dark:text-subtext-dark">최근 1개월 최고가</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-text-light dark:text-text-dark">3,120원</p>
                <span className="text-sm text-subtext-light dark:text-subtext-dark">/kg</span>
              </div>
            </div>
            <div className="p-5 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
              <p className="text-sm font-medium text-subtext-light dark:text-subtext-dark">최근 1개월 최저가</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-text-light dark:text-text-dark">2,450원</p>
                <span className="text-sm text-subtext-light dark:text-subtext-dark">/kg</span>
              </div>
            </div>
          </div>
          
          {/* Main Chart */}
          <div className="p-6 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark">배추 가격 추이</h3>
                <p className="text-sm text-subtext-light dark:text-subtext-dark">기간: 2023.10.01 ~ 2023.10.31</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent-past"></div>
                  <span>과거/현재 가격</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent-forecast"></div>
                  <span>AI 예측 가격</span>
                </div>
              </div>
            </div>
            <div>
              <img className="w-full h-auto rounded-lg" alt="A line graph showing the price trend of cabbage over the last month, with one line for actual price and another dotted line for AI predicted price." src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9nzxAT98Ew2Y1V5w7ojx4I47zfCdu19K1oLzqrjcaN55PFq31S3DPYCPlonU7Sku-F6kI2ET2eSfviWRconfDFOiwv6-M_9PcrmCeYruQMMNALfAFSaiwIPBR30XEc2J048dgpRHa1MJt0R4JSVwIegT33CXSC09fMos7ymlx_g5Eiq5JhdqO8UeTxcXV9X5TcN1QR0vaYP5ebLBct7csuHUUYhdZngfAzoEefVqLopaDx1yNtHSL4fGcyCGn2s97j5HKAJ9RQPY" />
            </div>
          </div>
          
          {/* Data Table */}
          <div className="p-6 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold text-text-light dark:text-text-dark">상세 데이터</h3>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtext-light dark:text-subtext-dark">search</span>
                <input className="w-full md:w-64 h-10 pl-10 pr-4 text-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition" placeholder="날짜 검색..." type="text"/>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-subtext-light dark:text-subtext-dark uppercase bg-background-light dark:bg-background-dark">
                  <tr>
                    <th className="px-6 py-3 rounded-l-lg" scope="col">날짜</th>
                    <th className="px-6 py-3" scope="col">가격 (원/kg)</th>
                    <th className="px-6 py-3" scope="col">등락률</th>
                    <th className="px-6 py-3 rounded-r-lg" scope="col">거래량 (톤)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-surface-light dark:bg-surface-dark border-b dark:border-border-dark">
                    <td className="px-6 py-4 font-medium whitespace-nowrap">2023-10-26</td>
                    <td className="px-6 py-4">2,580</td>
                    <td className="px-6 py-4 text-red-500">-4.4%</td>
                    <td className="px-6 py-4">15,230</td>
                  </tr>
                  <tr className="bg-surface-light dark:bg-surface-dark border-b dark:border-border-dark">
                    <td className="px-6 py-4 font-medium whitespace-nowrap">2023-10-25</td>
                    <td className="px-6 py-4">2,700</td>
                    <td className="px-6 py-4 text-blue-500">+1.5%</td>
                    <td className="px-6 py-4">14,890</td>
                  </tr>
                  <tr className="bg-surface-light dark:bg-surface-dark border-b dark:border-border-dark">
                    <td className="px-6 py-4 font-medium whitespace-nowrap">2023-10-24</td>
                    <td className="px-6 py-4">2,660</td>
                    <td className="px-6 py-4 text-subtext-light dark:text-subtext-dark">0.0%</td>
                    <td className="px-6 py-4">16,110</td>
                  </tr>
                  <tr className="bg-surface-light dark:bg-surface-dark border-b dark:border-border-dark">
                    <td className="px-6 py-4 font-medium whitespace-nowrap">2023-10-23</td>
                    <td className="px-6 py-4">2,660</td>
                    <td className="px-6 py-4 text-red-500">-2.2%</td>
                    <td className="px-6 py-4">15,540</td>
                  </tr>
                  <tr className="bg-surface-light dark:bg-surface-dark">
                    <td className="px-6 py-4 font-medium whitespace-nowrap">2023-10-22</td>
                    <td className="px-6 py-4">2,720</td>
                    <td className="px-6 py-4 text-blue-500">+0.7%</td>
                    <td className="px-6 py-4">14,320</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}



