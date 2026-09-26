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
    { path: '/mypage', label: '계정정보', icon: 'person' },
  ];

  return (
    <aside className="flex-shrink-0 w-full lg:w-64">
      <div className="flex flex-col gap-6 bg-white p-4 rounded-lg border border-border-light h-full">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 items-center">
            <Avatar name={user?.name} size="size-12" />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-text-main">{user?.name || '사용자'}</h1>
              <p className="text-sm text-subtext-light">{user?.email || user?.id || ''}</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2 mt-4">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-light text-primary border border-primary/30'
                      : 'hover:bg-primary-light text-text-main'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <p className={`text-base ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</p>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col gap-4 mt-auto">
          <Link
            to="#"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary-light transition-colors duration-200 text-text-main"
          >
            <span className="material-symbols-outlined text-xl">help</span>
            <p className="text-base font-medium">고객 지원</p>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-4 bg-red-500/10 text-red-500 text-base font-bold transition-colors duration-200 hover:bg-red-500/20 border border-red-500/30"
          >
            <span className="truncate">로그아웃</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

