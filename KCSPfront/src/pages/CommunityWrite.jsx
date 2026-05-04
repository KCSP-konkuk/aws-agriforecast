import Layout from '../components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/api';

export default function CommunityWrite() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    category: '도매정보',
    content: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        formData.content
      );
      navigate(`/community/${response.id}`);
    } catch (err) {
      console.error('글 작성 실패:', err);
      setError(err.message || '글 작성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <main className="flex-1 py-10">
        <div className="mx-auto w-full max-w-[960px] px-6">
          <h1 className="text-3xl font-extrabold text-[#131b0e] mb-6">글 쓰기</h1>
          
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
                  placeholder="제목을 입력하세요"
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
                placeholder="내용을 입력하세요"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-5 h-10 rounded-lg bg-[#64cf17] text-[#131b0e] font-bold hover:bg-opacity-90 disabled:opacity-50"
              >
                {loading ? '등록 중...' : '등록'}
              </button>
              <Link
                to="/community"
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
