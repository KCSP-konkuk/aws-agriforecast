import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Logo from './Logo';
import Avatar from './Avatar';

const NAV_ITEMS = [
  { to: '/', label: '홈', end: true },
  { to: '/detail', label: '상세검색' },
  { to: '/community', label: '커뮤니티' },
];

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const checkLoginStatus = () => {
    // 로그인 상태 확인
    const loginStatus = localStorage.getItem('isLoggedIn');
    const userData = localStorage.getItem('user');

    if (loginStatus === 'true' && userData) {
      setIsLoggedIn(true);
      setUser(JSON.parse(userData));
    } else {
      setIsLoggedIn(false);
      setUser(null);
    }
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

  const navClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${isActive ? 'text-primary font-bold' : 'text-text-main hover:text-primary'}`;

  const account = isLoggedIn ? (
    <button onClick={handleProfileClick} title={user?.name || '마이페이지'} className="rounded-full hover:ring-2 hover:ring-primary/50 transition-all">
      <Avatar name={user?.name} />
    </button>
  ) : (
    <button
      onClick={handleProfileClick}
      className="text-sm font-semibold text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors"
    >
      로그인
    </button>
  );

  return (
    <header className="border-b border-primary/20 bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-10 py-3">
        <Logo />

        <div className="hidden md:flex items-center gap-9">
          <nav className="flex items-center gap-9">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>{item.label}</NavLink>
            ))}
          </nav>
          {account}
        </div>

        <button
          className="md:hidden flex items-center p-2 -mr-2 text-text-main"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
        >
          <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {menuOpen && (
        <nav className="md:hidden mx-auto flex max-w-[1280px] flex-col gap-1 px-4 pb-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `px-3 py-2.5 rounded-lg ${navClass({ isActive })} ${isActive ? 'bg-primary-light' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={handleProfileClick}
            className="mt-2 px-3 py-2.5 rounded-lg text-left text-sm font-semibold text-primary border border-primary/30"
          >
            {isLoggedIn ? `${user?.name || '내'} 계정` : '로그인'}
          </button>
        </nav>
      )}
    </header>
  );
}
