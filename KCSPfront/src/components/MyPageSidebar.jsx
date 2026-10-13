import { Link, useLocation } from 'react-router-dom';
import Avatar from './Avatar';

export default function MyPageSidebar({ user, onLogout }) {
  const location = useLocation();

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      if (onLogout) {
        onLogout();
      }
    }
  };

  const menuItems = [
    { path: '/mypage', label: '계정 정보' },
    { path: '/mypage/analyses', label: '내 분석' },
  ];

  return (
    <aside className="panel h-fit w-full flex-shrink-0 lg:sticky lg:top-[96px] lg:w-60">
      <div className="flex items-center gap-3">
        <Avatar name={user?.name} size="size-11" />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold text-text-main">{user?.name || '사용자'}</p>
          <p className="truncate text-[13px] text-subtext-light">{user?.email || user?.id || ''}</p>
        </div>
      </div>
      <nav className="mt-6 flex gap-1 lg:flex-col" aria-label="마이페이지 메뉴">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                isActive ? 'bg-primary-light font-semibold text-primary' : 'font-medium text-subtext-light hover:bg-background-light hover:text-text-main'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button type="button" onClick={handleLogout} className="mt-4 px-3 py-2 text-sm font-medium text-subtext-light hover:text-text-main lg:mt-8">
        로그아웃
      </button>
    </aside>
  );
}
