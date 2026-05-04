import Layout from '../components/Layout';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';

export default function CommunityEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    title: '',
    category: '도매정보',
    content: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingPost, setLoadingPost] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPost();
  }, [id]);

  const loadPost = async () => {
    try {
      setLoadingPost(true);
      setError('');
      const postData = await api.getPost(id);
      
      // 본인 글인지 확인
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (postData.authorId !== user.seqNoA010) {
          alert('수정 권한이 없습니다.');
          navigate(`/community/${id}`);
          return;
        }
      }
      
      setFormData({
        title: postData.title,
        category: postData.category,
        content: postData.content,
      });
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
      await api.updatePost(id, formData.title, formData.category, formData.content);
      navigate(`/community/${id}/my`);
    } catch (err) {
      console.error('글 수정 실패:', err);
      setError(err.message || '글 수정에 실패했습니다.');
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
      alert('게시글 삭제에 실패했습니다.');
    }
  };

  if (loadingPost) {
    return (
      <Layout>
        <main className="flex-1 py-10">
          <div className="mx-auto w-full max-w-[960px] px-6">
            <div className="text-center py-10 text-[#6d974e]">로딩 중...</div>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="flex-1 py-10">
        <div className="mx-auto w-full max-w-[960px] px-6">
          <h1 className="text-3xl font-extrabold text-[#131b0e] mb-6">글 수정</h1>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#131b0e] mb-1">제목</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-[#d9e7d0] bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#64cf17]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#131b0e] mb-1">카테고리</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-[#d9e7d0] bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#64cf17]"
                >
                  <option>도매정보</option>
                  <option>소매노하우</option>
                  <option>구인구직</option>
                  <option>자유게시판</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#131b0e] mb-1">내용</label>
              <textarea
                rows="12"
                name="content"
                value={formData.content}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-[#d9e7d0] bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#64cf17]"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-5 h-10 rounded-lg bg-[#64cf17] text-[#131b0e] font-bold hover:bg-opacity-90 disabled:opacity-50"
              >
                {loading ? '수정 중...' : '수정 완료'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 h-10 rounded-lg bg-[#f87171] text-white font-bold hover:bg-[#ef4444]"
              >
                글 삭제
              </button>
              <Link
                to={`/community/${id || ''}/my`}
                className="px-5 h-10 inline-flex items-center rounded-lg bg-[#ecf3e7] text-[#131b0e] hover:bg-[#d9e7d0]"
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
