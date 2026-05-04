import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import NotificationsReceived from './pages/NotificationsReceived';
import NotificationsDelete from './pages/NotificationsDelete';

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
        <Route path="/mypage/notifications" element={<NotificationsReceived />} />
        <Route path="/mypage/notifications/delete" element={<NotificationsDelete />} />
      </Routes>
    </Router>
  );
}

export default App;

