import Layout from '../components/Layout';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';
import LoginRequired from '../components/LoginRequired';
import AttachAnalysis from '../components/AttachAnalysis';
import { isLoggedIn, getUser } from '../auth';
import { ROOMS, DEFAULT_ROOM } from '../community';

export default function CommunityEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [analysisQuery, setAnalysisQuery] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    category: DEFAULT_ROOM,
    content: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingPost, setLoadingPost] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(!isLoggedIn());

  useEffect(() => {
    loadPost();
    // 글 번호가 바뀔 때만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPost = async () => {
    try {
      setLoadingPost(true);
      setError('');
      const postData = await api.getPost(id);
      
      // 본인 글이 아니면 일반 보기로 (로그인 안 했으면 안내 화면이 대신 뜬다)
      const user = getUser();
      if (user && postData.authorId !== user.seqNoA010) {
        navigate(`/community/${id}`, { replace: true });
        return;
      }
      
      setFormData({
        title: postData.title,
        // 개편 전 카테고리 글은 '자유'로 보인다 (서버도 기동 때 옮긴다)
        category: ROOMS.includes(postData.category) ? postData.category : DEFAULT_ROOM,
        content: postData.content,
      });
      setAnalysisQuery(postData.analysisQuery ?? null);
    } catch (err) {
      console.error('게시글 로드 실패:', err);
      setError('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoadingPost(false);
    }
  };

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
      await api.updatePost(id, formData.title, formData.category, formData.content, analysisQuery);
      navigate(`/community/${id}/my`);
    } catch (err) {
      console.error('글 수정 실패:', err);
      if (err.needsLogin) setNeedsLogin(true);
      else setError(err.message || '글 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await api.deletePost(id);
      navigate('/community');
    } catch (err) {
      console.error('게시글 삭제 실패:', err);
      if (err.needsLogin) setNeedsLogin(true);
      else setError(err.message || '게시글 삭제에 실패했습니다.');
    }
  };

  if (needsLogin) {
    return (
      <Layout>
        <main className="flex-1 pb-16 pt-8">
          <div className="mx-auto w-full max-w-[880px] px-4 sm:px-6">
            <LoginRequired title="로그인하면 글을 수정할 수 있어요" description="내가 쓴 글은 로그인한 뒤에 고치거나 지울 수 있습니다." />
          </div>
        </main>
      </Layout>
    );
  }

  if (loadingPost) {
    return (
      <Layout>
        <main className="flex-1 pb-16 pt-8">
          <div className="mx-auto w-full max-w-[880px] px-4 sm:px-6">
            <p className="py-12 text-center text-sm text-subtext-light" role="status">불러오는 중이에요</p>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="flex-1 pb-16 pt-8">
        <div className="mx-auto w-full max-w-[880px] px-4 sm:px-6">
          <h1 className="mb-6 text-2xl font-bold tracking-[-0.02em] text-text-main">글 수정</h1>
          
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
              {error}
            </div>
          )}
          
          <form className="space-y-5" onSubmit={handleSubmit}>
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
                {loading ? '수정 중...' : '수정 완료'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-10 rounded-lg px-5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                글 삭제
              </button>
              <Link
                to={`/community/${id || ''}/my`}
                className="inline-flex h-10 items-center rounded-lg bg-background-light px-5 text-sm font-semibold text-text-main hover:bg-border-light"
              >
                취소
              </Link>
            </div>
          </form>
        </div>
      </main>
    </Layout>
  );
}
