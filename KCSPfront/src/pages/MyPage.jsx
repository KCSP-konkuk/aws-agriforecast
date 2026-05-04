import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MyPageSidebar from '../components/MyPageSidebar';

export default function MyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 로그인 상태 확인
    const userData = localStorage.getItem('user');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (!isLoggedIn || !userData) {
      // 로그인 안 되어 있으면 로그인 페이지로 이동
      navigate('/login');
    } else {
      const parsedUser = JSON.parse(userData);
      // 이메일이 없으면 username을 email로 사용
      if (!parsedUser.email) {
        parsedUser.email = parsedUser.username || 'user@example.com';
      }
      setUser(parsedUser);
    }
  }, [navigate]);

  const handleLogout = () => {
    // localStorage에서 로그인 정보 삭제
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    
    // 헤더 업데이트를 위한 커스텀 이벤트 발생
    window.dispatchEvent(new Event('loginStatusChanged'));
    
    // 홈 페이지로 이동
    navigate('/');
  };

  if (!user) {
    return null; // 로그인 체크 중이면 아무것도 렌더링하지 않음
  }

  return (
    <Layout>
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <div className="flex flex-1 justify-center py-5 sm:py-10 px-4">
            <div className="layout-content-container flex w-full max-w-6xl flex-1 flex-col lg:flex-row gap-8">
              <MyPageSidebar user={user} onLogout={handleLogout} />
              
              {/* Main Content */}
              <main className="flex-1 flex flex-col gap-8">
                <div className="bg-[#fafcf8] p-6 sm:p-8 rounded-lg border border-[#d9e7d0]">
                  {/* Page Heading */}
                  <div className="flex flex-wrap justify-between gap-4 pb-8 border-b border-[#d9e7d0]">
                    <div className="flex min-w-72 flex-col gap-2">
                      <p className="text-3xl font-black tracking-tight text-[#131b0e]">계정 정보</p>
                      <p className="text-base text-[#6d974e]">개인 정보를 관리하고 비밀번호를 변경할 수 있습니다.</p>
                    </div>
                  </div>
                  
                  {/* Content Sections */}
                  <div className="pt-8 flex flex-col gap-8">
                    {/* Profile Information Section */}
                    <section className="flex flex-col gap-6">
                      <h3 className="text-xl font-bold text-[#131b0e]">프로필 정보</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="flex flex-col">
                          <p className="text-base font-medium pb-2 text-[#131b0e]">이름</p>
                          <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#131b0e] focus:outline-0 focus:ring-2 focus:ring-[#64cf17]/50 border border-[#d9e7d0] bg-white/60 h-14 placeholder:text-[#6d974e] p-4 text-base" defaultValue={user.name || "김농부"}/>
                        </label>
                        <label className="flex flex-col">
                          <p className="text-base font-medium pb-2 text-[#131b0e]">이메일</p>
                          <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#131b0e] focus:outline-0 focus:ring-2 focus:ring-[#64cf17]/50 border border-[#d9e7d0] bg-white/60 h-14 placeholder:text-[#6d974e] p-4 text-base" disabled={true} defaultValue={user.email || user.username || "kim@naver.com"}/>
                        </label>
                        <label className="flex flex-col">
                          <p className="text-base font-medium pb-2 text-[#131b0e]">연락처</p>
                          <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#131b0e] focus:outline-0 focus:ring-2 focus:ring-[#64cf17]/50 border border-[#d9e7d0] bg-white/60 h-14 placeholder:text-[#6d974e] p-4 text-base" defaultValue="010-1234-5678"/>
                        </label>
                      </div>
                    </section>
                    
                    {/* Password Change Section */}
                    <section className="flex flex-col gap-6 border-t border-[#d9e7d0] pt-8">
                      <h3 className="text-xl font-bold text-[#131b0e]">비밀번호 변경</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <label className="flex flex-col">
                          <p className="text-base font-medium pb-2 text-[#131b0e]">현재 비밀번호</p>
                          <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#131b0e] focus:outline-0 focus:ring-2 focus:ring-[#64cf17]/50 border border-[#d9e7d0] bg-white/60 h-14 placeholder:text-[#6d974e] p-4 text-base" placeholder="••••••••" type="password"/>
                        </label>
                        <label className="flex flex-col">
                          <p className="text-base font-medium pb-2 text-[#131b0e]">새 비밀번호</p>
                          <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#131b0e] focus:outline-0 focus:ring-2 focus:ring-[#64cf17]/50 border border-[#d9e7d0] bg-white/60 h-14 placeholder:text-[#6d974e] p-4 text-base" placeholder="새 비밀번호 입력" type="password"/>
                        </label>
                      </div>
                    </section>
                    
                    {/* Account Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#d9e7d0] pt-8">
                      <button className="text-red-500 font-semibold hover:underline">계정 탈퇴</button>
                      <div className="flex gap-4">
                        <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-[#ecf3e7] text-[#131b0e] text-base font-bold transition-colors duration-200 hover:bg-[#d9e7d0]">
                          <span className="truncate">취소</span>
                        </button>
                        <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-[#64cf17] text-[#131b0e] text-base font-bold transition-colors duration-200 hover:bg-opacity-90">
                          <span className="truncate">변경사항 저장</span>
                        </button>
                      </div>
                    </div>
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



