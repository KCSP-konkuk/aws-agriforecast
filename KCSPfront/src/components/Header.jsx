import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Logo from './Logo';
import Avatar from './Avatar';
import { getUser } from '../auth';
import { copyText } from '../lib/clipboard';
import { MCP_URL } from '../lib/mcp';

const NAV_ITEMS = [
  { to: '/', label: '홈', end: true },
  { to: '/detail', label: '도매 예측' },
  { to: '/community', label: '커뮤니티' },
  { to: '/analysis', label: '분석' },
];

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(null);

  const checkLoginStatus = () => {
    // 토큰이 없거나 만료됐으면 로그아웃 상태
    const current = getUser();
    setIsLoggedIn(current !== null);
    setUser(current);
  };

  useEffect(() => {
    // 컴포넌트 마운트 시 로그인 상태 확인
    checkLoginStatus();

    // storage 이벤트 리스너 추가 (다른 탭이나 페이지에서 로그인 상태 변경 감지)
    window.addEventListener('storage', checkLoginStatus);

    // 커스텀 이벤트 리스너 추가 (같은 페이지에서 로그인 상태 변경 감지)
    window.addEventListener('loginStatusChanged', checkLoginStatus);

    return () => {
      window.removeEventListener('storage', checkLoginStatus);
      window.removeEventListener('loginStatusChanged', checkLoginStatus);
    };
  }, []);

  // 페이지를 옮기면 모바일 메뉴를 닫는다
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleProfileClick = () => {
    navigate(isLoggedIn ? '/mypage' : '/login');
  };

  const copyMcpUrl = async () => {
    try {
      setCopied((await copyText(MCP_URL)) ? 'ok' : 'fail');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied(null), 2500);
  };

  const mcpLabel = copied === 'ok' ? '복사했어요' : copied === 'fail' ? '복사하지 못했어요' : 'MCP 주소 복사';
  const mcpIcon = copied === 'ok' ? 'check' : 'content_copy';

  // 지금 화면 메뉴는 굵은 글자 + 아래 초록 막대, 나머지는 보조 글자색
  const navClass = ({ isActive }) =>
    `relative flex h-full items-center text-[15px] transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full ${
      isActive ? 'font-semibold text-text-main after:bg-primary' : 'font-medium text-subtext-light hover:text-text-main after:bg-transparent'
    }`;

  const account = isLoggedIn ? (
    <button onClick={handleProfileClick} title={user?.name || '마이페이지'} className="rounded-full">
      <Avatar name={user?.name} />
    </button>
  ) : (
    <button
      onClick={handleProfileClick}
      className="h-9 rounded-lg bg-primary px-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
    >
      로그인
    </button>
  );

  const mcpButton = (extra = '') => (
    <button
      type="button"
      onClick={copyMcpUrl}
      title={`${MCP_URL} — Claude 등 MCP 클라이언트에 등록하세요`}
      className={`flex items-center gap-1 rounded-lg text-sm font-medium text-subtext-light transition-colors hover:bg-background-light hover:text-text-main ${extra}`}
    >
      <span className="material-symbols-outlined text-[18px] leading-none">{mcpIcon}</span>
      {mcpLabel}
    </button>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <div className="flex h-full items-center gap-10">
          <Logo />
          <nav className="hidden h-full items-center gap-7 md:flex" aria-label="주 메뉴">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {mcpButton('h-9 px-2.5')}
          {account}
        </div>

        <button
          className="-mr-2 flex items-center p-2 text-text-main md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
        >
          <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {menuOpen && (
        <nav className="mx-auto flex max-w-[1280px] flex-col border-t border-line px-4 pb-3 md:hidden" aria-label="주 메뉴">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `border-b border-line px-1 py-3 text-[15px] ${isActive ? 'font-semibold text-primary' : 'font-medium text-text-main'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="flex items-center justify-between gap-2 pt-3">
            {mcpButton('h-10 px-1')}
            <button onClick={handleProfileClick} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
              {isLoggedIn ? `${user?.name || '내'} 계정` : '로그인'}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
