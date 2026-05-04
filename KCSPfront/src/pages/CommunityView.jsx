import Layout from '../components/Layout';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';

export default function CommunityView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMyPost, setIsMyPost] = useState(false);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [id]);

  const loadPost = async () => {
    try {
      setLoading(true);
      setError('');
      const postData = await api.getPost(id);
      setPost(postData);
      
      // 본인 글인지 확인
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (postData.authorId === user.seqNoA010) {
          setIsMyPost(true);
          navigate(`/community/${id}/my`, { replace: true });
        }
      }
    } catch (err) {
      console.error('게시글 로드 실패:', err);
      setError('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const commentsData = await api.getComments(id);
      setComments(commentsData);
    } catch (err) {
      console.error('댓글 로드 실패:', err);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setCommentLoading(true);
    try {
      await api.createComment(id, comment);
      setComment('');
      loadComments(); // 댓글 목록 새로고침
    } catch (err) {
      console.error('댓글 작성 실패:', err);
      alert('댓글 작성에 실패했습니다.');
    } finally {
      setCommentLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  if (loading) {
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

  if (error || !post) {
    return (
      <Layout>
        <main className="flex-1 py-10">
          <div className="mx-auto w-full max-w-[960px] px-6">
            <div className="text-center py-10 text-red-600">{error || '게시글을 찾을 수 없습니다.'}</div>
            <Link to="/community" className="text-[#64cf17] hover:underline">목록으로 돌아가기</Link>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="flex-1 py-10">
        <div className="mx-auto w-full max-w-[960px] px-6">
          <h1 className="text-3xl font-extrabold text-[#131b0e] mb-4">글 보기</h1>
          <div className="bg-white/40 border border-[#d9e7d0] rounded-lg p-6">
            <h2 className="text-2xl font-bold text-[#131b0e] mb-3">{post.title}</h2>
            <p className="text-sm text-[#6d974e] mb-4">
              작성자: {post.authorName || '익명'} | 작성일: {formatDate(post.createdAt)} | 조회수: {post.viewCount || 0}
            </p>
            <div className="text-[#131b0e] leading-relaxed whitespace-pre-wrap">{post.content}</div>
          </div>

          <section className="mt-8">
            <h3 className="text-lg font-bold text-[#131b0e] mb-3">댓글 {comments.length}</h3>
            <div className="space-y-3">
              {comments.map((commentItem) => (
                <div key={commentItem.id} className="p-4 border border-[#d9e7d0] rounded-lg bg-[#fafcf8]">
                  <p className="text-sm text-[#131b0e]">
                    <span className="font-semibold">{commentItem.authorName || '익명'}</span> · {formatDate(commentItem.createdAt)}
                    <br />
                    {commentItem.content}
                  </p>
                </div>
              ))}
            </div>
            <form className="mt-4 flex gap-2" onSubmit={handleCommentSubmit}>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#d9e7d0] bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#64cf17]"
                placeholder="댓글을 입력하세요"
                disabled={commentLoading}
              />
              <button
                type="submit"
                disabled={commentLoading}
                className="px-4 h-10 rounded-lg bg-[#64cf17] text-[#131b0e] font-bold hover:bg-opacity-90 disabled:opacity-50"
              >
                {commentLoading ? '등록 중...' : '등록'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </Layout>
  );
}
