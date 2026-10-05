import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import FindId from './pages/FindId';
import ResetPassword from './pages/ResetPassword';
import Community from './pages/Community';
import CommunityWrite from './pages/CommunityWrite';
import CommunityEdit from './pages/CommunityEdit';
import CommunityView from './pages/CommunityView';
import CommunityViewMy from './pages/CommunityViewMy';
import Detail from './pages/Detail';
import MyPage from './pages/MyPage';
import Dashboard from './pages/Dashboard';
import Workbench from './pages/Workbench';

// 예전 대시보드 주소(/dashboard?item=…)는 오늘의 요약으로 넘긴다 — 이미 공유된 링크 보호
function DashboardRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/analysis/summary${search}`} replace />;
}

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;

