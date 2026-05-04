import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MyPageSidebar from '../components/MyPageSidebar';

export default function NotificationsDelete() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      product: '배추',
      price: 19000,
      message: '"배추"의 도매가가 19,000원에 도달할시 알림을 발송합니다.'
    },
    {
      id: 2,
      product: '상추',
      price: 3000,
      message: '"상추"의 도매가가 3,000원에 도달할시 알림을 발송합니다.'
    },
    {
      id: 3,
      product: '깻잎',
      price: 2000,
      message: '"깻잎"의 도매가가 2,000원에 도달할시 알림을 발송합니다.'
    }
  ]);

  useEffect(() => {
    // 로그인 상태 확인
    const userData = localStorage.getItem('user');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (!isLoggedIn || !userData) {
      navigate('/login');
    } else {
      setUser(JSON.parse(userData));
    }

    // TODO: API 호출로 등록된 알림 목록 가져오기
    // fetch('/api/notifications/registered')
    //   .then(res => res.json())
    //   .then(data => setNotifications(data));
  }, [navigate]);

  const handleDelete = (id) => {
    if (window.confirm('이 알림을 삭제하시겠습니까?')) {
      // TODO: API 호출로 알림 삭제
      // fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      //   .then(() => {
      //     setNotifications(notifications.filter(n => n.id !== id));
      //   });
      
      // 임시: 로컬에서 삭제
      setNotifications(notifications.filter(n => n.id !== id));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    window.dispatchEvent(new Event('loginStatusChanged'));
    navigate('/');
  };

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <div className="flex flex-1 justify-center py-5 sm:py-10 px-4">
            <div className="layout-content-container flex w-full max-w-6xl flex-1 flex-col lg:flex-row gap-8">
              <MyPageSidebar user={user} onLogout={handleLogout} />
              
              <main className="flex-1 flex flex-col gap-8">
                <div className="bg-[#fafcf8] p-6 sm:p-8 rounded-lg border border-[#d9e7d0]">
                  <div className="flex flex-wrap justify-between gap-4 pb-8 border-b border-[#d9e7d0]">
                    <div className="flex min-w-72 flex-col gap-2">
                      <p className="text-3xl font-black tracking-tight text-[#131b0e]">알림 삭제</p>
                      <p className="text-base text-[#6d974e]">알림 받기로 등록되어 있는 것 삭제~</p>
                    </div>
                  </div>
                  
                  <div className="pt-8 flex flex-col gap-4">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="p-6 border border-[#d9e7d0] rounded-lg bg-white/40 hover:bg-white/60 transition-colors flex items-center justify-between gap-4"
                        >
                          <p className="flex-1 text-[#131b0e]">{notification.message}</p>
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="px-5 h-10 rounded-lg bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 border border-red-500/30 transition-colors whitespace-nowrap"
                          >
                            삭제
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-[#6d974e]">
                        <p className="text-lg">등록된 알림이 없습니다.</p>
                      </div>
                    )}
                    
                    {notifications.length > 3 && (
                      <div className="text-center py-4 text-[#6d974e]">
                        <span className="text-lg">...</span>
                      </div>
                    )}
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

