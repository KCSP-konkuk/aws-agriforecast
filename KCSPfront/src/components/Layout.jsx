import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header from './Header';
import Logo from './Logo';

export default function Layout({ children, wide = false }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      <a href="#page-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">본문으로 건너뛰기</a>
      <Header />
      <div id="page-content" tabIndex={-1} className={`app-body mx-auto flex w-full flex-1 flex-col ${wide ? 'max-w-[1600px]' : 'max-w-[1440px]'}`}>
        {children}
      </div>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div><Logo /><p className="mt-2 text-xs text-subtext-light">데이터로 읽는 농산물 시장</p></div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-subtext-light">
            <Link to="/analysis/summary" className="hover:text-primary">소매 전망</Link>
            <Link to="/detail" className="hover:text-primary">도매 시세</Link>
            <Link to="/analysis" className="hover:text-primary">분석 작업대</Link>
            <Link to="/community" className="hover:text-primary">커뮤니티</Link>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-subtext-light">가격의 출처·단위·기준일을 함께 확인하세요.<br />예측은 실제 가격과 다를 수 있습니다.</p>
        </div>
      </footer>
    </div>
  );
}
