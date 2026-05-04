import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function MyPageSidebar({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      if (onLogout) {
        onLogout();
      }
    }
  };

  const menuItems = [
    { path: '/mypage', label: '계정정보', icon: 'person' },
    { path: '/mypage/notifications', label: '받은 알림', icon: 'notifications' },
    { path: '/mypage/notifications/delete', label: '알림 삭제', icon: 'notifications_off' }
  ];

  return (
    <aside className="flex-shrink-0 w-full lg:w-64">
      <div className="flex flex-col gap-6 bg-[#fafcf8] p-4 rounded-lg border border-[#d9e7d0] h-full">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 items-center">
            <div 
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12" 
              style={{
                backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuABR5lA_xfTMGA4GQnJsPJtRDbxvblgln9YnvalBT4vXu9cySy0-c_4fH1ht-gkeZxLxz9zf-0lRKOhAU1XcNR7mGPkUwwvAHmG2jVaYJCVFeygXXI32BHHUe7261gH0ZfKqxWeMWo8wYGdDhlCyUd6LlxkFa-xt20OnHy_ZD4PZWutZi5TTlfrpvxEvykyNGK0JcF5pe8555C1l4ulzQ58Ikopdp6LxajE0YUaSR8hQXLCg26L-Ja4OTnSwWqwNJpMNXezP9tD12U")'
              }}
            />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-[#131b0e]">{user?.name || '사용자'}</h1>
              <p className="text-sm text-[#6d974e]">{user?.email || user?.username || 'user@example.com'}</p>
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
                      ? 'bg-[#64cf17]/20 text-[#64cf17] border border-[#64cf17]'
                      : 'hover:bg-[#ecf3e7] text-[#131b0e]'
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
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#ecf3e7] transition-colors duration-200 text-[#131b0e]"
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

