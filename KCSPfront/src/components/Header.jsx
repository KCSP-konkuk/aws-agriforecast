import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Header() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

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

  const handleProfileClick = () => {
    if (isLoggedIn) {
      // 로그인 되어 있으면 마이페이지로 이동
      navigate('/mypage');
    } else {
      // 로그인 안 되어 있으면 로그인 페이지로 이동
      navigate('/login');
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-solid border-primary/20 px-10 py-3 dark:border-primary/30">
      <Link to="/" className="flex items-center gap-4 text-primary">
        <div className="size-6">
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 45.8096C19.6865 45.8096 15.4698 44.5305 11.8832 42.134C8.29667 39.7376 5.50128 36.3314 3.85056 32.3462C2.19985 28.361 1.76794 23.9758 2.60947 19.7452C3.451 15.5145 5.52816 11.6284 8.57829 8.5783C11.6284 5.52817 15.5145 3.45101 19.7452 2.60948C23.9758 1.76795 28.361 2.19986 32.3462 3.85057C36.3314 5.50129 39.7376 8.29668 42.134 11.8833C44.5305 15.4698 45.8096 19.6865 45.8096 24L24 24L24 45.8096Z" fill="currentColor"/>
          </svg>
        </div>
        <h2 className="text-primary text-xl font-bold leading-tight tracking-[-0.015em]">AgriForecast</h2>
      </Link>

      <div className="flex flex-1 justify-end gap-8 items-center">
        <div className="flex items-center gap-9">
          <Link to="/" className="text-text-main dark:text-gray-200 text-sm font-medium hover:text-primary">홈</Link>
          <Link to="/detail" className="text-text-main dark:text-gray-200 text-sm font-medium hover:text-primary">상세검색</Link>
          <Link to="/community" className="text-text-main dark:text-gray-200 text-sm font-medium hover:text-primary">커뮤니티</Link>
        </div>

        {isLoggedIn ? (
          // 로그인 되어 있을 때: 프로필 사진 표시
          <div 
            onClick={handleProfileClick}
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAEguDXPhY0FbKVvYxjjW-itvK6H37a_7w2xm14RxsBzQsjb-tIXZbB5hyvmNs6hoWilkr18wz860E9g2huIs_3Ltq6hjIsIWWI-y-YQc2dgl76wPFTiOzmnHMwJigJQykCkeaSTJMFEgjYj0BazsVskFgIkWDtbl6BH4MOhhKUDmlzrUO6weWh3XCpzyQOvbumTiT-xUbpW155XRmykp_FKzix0eVBAo4fCvlfx8nKtffyye5qxv750or1gXsFyoRQ46GhAF-yJ2s")'}}
            title={user?.name || '마이페이지'}
          >
          </div>
        ) : (
          // 로그인 안 되어 있을 때: "로그인" 텍스트 표시
          <button
            onClick={handleProfileClick}
            className="text-text-main dark:text-gray-200 text-sm font-medium hover:text-primary cursor-pointer px-3 py-1 rounded transition-colors"
          >
            로그인
          </button>
        )}
      </div>
    </header>
  );
}

