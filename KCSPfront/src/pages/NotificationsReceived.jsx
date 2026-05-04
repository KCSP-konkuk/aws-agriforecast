import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MyPageSidebar from '../components/MyPageSidebar';

export default function NotificationsReceived() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      product: '배추',
      price: 19000,
      unit: 'Kg',
      date: '2025.10.10',
      message: '민자로 해당 가격에 도달하였습니다.'
    },
    {
      id: 2,
      product: '상추',
      price: 2000,
      unit: 'Kg',
      date: '2025.11.11',
      message: '민자로 해당 가격에 도달하였습니다.'
    },
    {
      id: 3,
      product: '깻잎',
      price: 3000,
      unit: 'Kg',
      date: '2025.12.12',
      message: '민자로 해당 가격에 도달하였습니다.'
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

    // TODO: API 호출로 알림 목록 가져오기
    // fetch('/api/notifications/received')
    //   .then(res => res.json())
    //   .then(data => setNotifications(data));
  }, [navigate]);

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
                      <p className="text-3xl font-black tracking-tight text-[#131b0e]">받은 알림</p>
                    </div>
                  </div>
                  
                  <div className="pt-8 flex flex-col gap-4">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="p-6 border border-[#d9e7d0] rounded-lg bg-white/40 hover:bg-white/60 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl font-bold text-[#131b0e]">
                                  {notification.product}
                                </span>
                                <span className="text-lg font-semibold text-[#64cf17]">
                                  {notification.price.toLocaleString()}원
                                </span>
                                <span className="text-sm text-[#6d974e]">
                                  ({notification.unit})
                                </span>
                              </div>
                              <p className="text-sm text-[#6d974e]">
                                {notification.date} {notification.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-[#6d974e]">
                        <p className="text-lg">받은 알림이 없습니다.</p>
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

