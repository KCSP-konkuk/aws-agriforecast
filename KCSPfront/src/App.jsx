import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import StatusMessage from './components/StatusMessage';
import Home from './pages/Home';

// 홈만 처음에 받고, 나머지 화면은 들어갈 때 받는다(작업대·차트 코드가 홈 첫 로드를 무겁게 하지 않게)
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const FindId = lazy(() => import('./pages/FindId'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Community = lazy(() => import('./pages/Community'));
const CommunityWrite = lazy(() => import('./pages/CommunityWrite'));
const CommunityEdit = lazy(() => import('./pages/CommunityEdit'));
const CommunityView = lazy(() => import('./pages/CommunityView'));
const CommunityViewMy = lazy(() => import('./pages/CommunityViewMy'));
const Detail = lazy(() => import('./pages/Detail'));
const MyPage = lazy(() => import('./pages/MyPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Workbench = lazy(() => import('./pages/Workbench'));

// 예전 대시보드 주소(/dashboard?item=…)는 오늘의 요약으로 넘긴다 — 이미 공유된 링크 보호
function DashboardRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/analysis/summary${search}`} replace />;
}

function PageLoading() {
  return (
    <Layout>
      <StatusMessage status="loading" loadingText="화면을 불러오는 중이에요" />
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/find-id" element={<FindId />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/write" element={<CommunityWrite />} />
          <Route path="/community/:id/my" element={<CommunityViewMy />} />
          <Route path="/community/:id/edit" element={<CommunityEdit />} />
          <Route path="/community/:id" element={<CommunityView />} />
          <Route path="/detail" element={<Detail />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/analysis" element={<Workbench />} />
          <Route path="/analysis/summary" element={<Dashboard />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
