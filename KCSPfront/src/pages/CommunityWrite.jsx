import Layout from '../components/Layout';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/api';
import LoginRequired from '../components/LoginRequired';
import AttachAnalysis from '../components/AttachAnalysis';
import { isLoggedIn } from '../auth';
import { ROOMS, DEFAULT_ROOM } from '../community';
import { queryFromLink } from '../lib/workbenchLink';

export default function CommunityWrite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // 방에서 누른 글쓰기면 그 방이 기본값
  const initialRoom = ROOMS.includes(params.get('category')) ? params.get('category') : DEFAULT_ROOM;
  const [formData, setFormData] = useState({
    title: '',
    category: initialRoom,
    content: '',
  });
  // 작업대 [커뮤니티에 공유]로 들어오면 그 화면이 붙어 있다
  const [analysisQuery, setAnalysisQuery] = useState(() => queryFromLink(params.get('analysis')));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 로그인 안 했거나 쓰는 도중 로그인이 만료되면 안내 화면으로 바꾼다
  const [needsLogin, setNeedsLogin] = useState(!isLoggedIn());

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.createPost(
        formData.title,
        formData.category,
        formData.content,
        analysisQuery
      );
      navigate(`/community/${response.id}`);
    } catch (err) {
      console.error('글 작성 실패:', err);
      if (err.needsLogin) setNeedsLogin(true);
      else setError(err.message || '글 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <main className="page-shell">
        <div className="mx-auto w-full max-w-[900px]">
          <h1 className="mb-6 text-[28px] font-semibold tracking-[-0.02em] text-text-main">이야기 쓰기</h1>
          {needsLogin ? (
            <LoginRequired
              title="로그인하면 글을 쓸 수 있어요"
              description="커뮤니티에 글을 남기려면 AgriForecast 계정으로 로그인해 주세요. 로그인하면 이 화면으로 돌아옵니다."
            />
          ) : (<>
          
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
              {error}
            </div>
          )}
          
          <form className="form-surface space-y-6" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="post-title" className="mb-1.5 block text-sm font-medium text-text-main">제목</label>
                <input
                  id="post-title"
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-border-light bg-white px-4 py-2.5 text-[15px] text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="제목을 입력하세요"
                  required
                />
              </div>
              <div>
                <label htmlFor="post-category" className="mb-1.5 block text-sm font-medium text-text-main">이야기방</label>
                <select
                  id="post-category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-border-light bg-white px-4 py-2.5 text-[15px] text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {ROOMS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="post-content" className="mb-1.5 block text-sm font-medium text-text-main">내용</label>
              <textarea
                id="post-content"
                rows="12"
                name="content"
                value={formData.content}
                onChange={handleChange}
                className="w-full rounded-lg border border-border-light bg-white px-4 py-2.5 text-[15px] text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="내용을 입력하세요"
                required
              />
            </div>

            <AttachAnalysis value={analysisQuery} onChange={setAnalysisQuery} />

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? '등록 중...' : '등록'}
              </button>
              <Link
                to="/community"
                className="inline-flex h-10 items-center rounded-lg bg-background-light px-5 text-sm font-semibold text-text-main hover:bg-border-light"
              >
                취소
              </Link>
            </div>
          </form>
          </>)}
        </div>
      </main>
    </Layout>
  );
}
