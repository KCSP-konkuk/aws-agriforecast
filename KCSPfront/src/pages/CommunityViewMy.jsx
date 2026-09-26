import Layout from '../components/Layout';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';
import LoginRequired from '../components/LoginRequired';
import { isLoggedIn, getUser, loginPath } from '../auth';

export default function CommunityViewMy() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [error, setError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [actionError, setActionError] = useState('');

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
      
      // 로그인 안 했거나 본인 글이 아니면 일반 보기 페이지로 (수정·삭제 버튼을 보이지 않게)
      const user = getUser();
      if (!user || postData.authorId !== user.seqNoA010) {
        navigate(`/community/${id}`, { replace: true });
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
    setCommentError('');
    try {
      await api.createComment(id, comment);
      setComment('');
      loadComments(); // 댓글 목록 새로고침
    } catch (err) {
      console.error('댓글 작성 실패:', err);
      // 로그인이 만료됐으면 clearLogin 으로 폼이 로그인 안내로 바뀐다
      setCommentError(err.needsLogin ? '' : err.message || '댓글 작성에 실패했습니다.');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await api.deletePost(id);
      navigate('/community');
    } catch (err) {
      console.error('게시글 삭제 실패:', err);
      // 로그인이 만료됐으면 로그인 후 이 글로 돌아오게 한다
      if (err.needsLogin) navigate(loginPath(`/community/${id}/my`));
      else setActionError(err.message || '게시글 삭제에 실패했습니다.');
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
          <div className="mx-auto w-full max-w-[960px] px-4 sm:px-6">
            <div className="text-center py-10 text-subtext-light">로딩 중...</div>
          </div>
        </main>
      </Layout>
    );
  }

  if (error || !post) {
    return (
      <Layout>
        <main className="flex-1 py-10">
          <div className="mx-auto w-full max-w-[960px] px-4 sm:px-6">
            <div className="text-center py-10 text-red-600">{error || '게시글을 찾을 수 없습니다.'}</div>
            <Link to="/community" className="text-primary hover:underline">목록으로 돌아가기</Link>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="flex-1 py-10">
        <div className="mx-auto w-full max-w-[960px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main">내 글 보기</h1>
            <div className="flex gap-2">
              <Link
                to={`/community/${id}/edit`}
                className="px-5 h-10 inline-flex items-center justify-center rounded-lg bg-primary text-white font-bold hover:bg-primary-hover"
              >
                글 수정
              </Link>
              <button
                onClick={handleDelete}
                className="px-5 h-10 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600"
              >
                글 삭제
              </button>
            </div>
          </div>

          {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}
          <div className="bg-white border border-border-light rounded-lg p-6">
            <h2 className="text-2xl font-bold text-text-main mb-3">{post.title}</h2>
            <p className="text-sm text-subtext-light mb-4">
              작성자: {post.authorName || '익명'} | 작성일: {formatDate(post.createdAt)} | 조회수: {post.viewCount || 0}
            </p>
            <div className="text-text-main leading-relaxed whitespace-pre-wrap">{post.content}</div>
          </div>

          <section className="mt-8">
            <h3 className="text-lg font-bold text-text-main mb-3">댓글 {comments.length}</h3>
            <div className="space-y-3">
              {comments.map((commentItem) => (
                <div key={commentItem.id} className="p-4 border border-border-light rounded-lg bg-white">
                  <p className="text-sm text-text-main">
                    <span className="font-semibold">{commentItem.authorName || '익명'}</span> · {formatDate(commentItem.createdAt)}
                    <br />
                    {commentItem.content}
                  </p>
                </div>
              ))}
            </div>
            {commentError && <p className="mt-4 text-sm text-red-600">{commentError}</p>}
            {!isLoggedIn() ? (
              <div className="mt-4">
                <LoginRequired compact title="댓글을 쓰려면 로그인해 주세요." />
              </div>
            ) : (
            <form className="mt-4 flex gap-2" onSubmit={handleCommentSubmit}>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-border-light bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="댓글을 입력하세요"
                disabled={commentLoading}
              />
              <button
                type="submit"
                disabled={commentLoading}
                className="px-4 h-10 rounded-lg bg-primary text-white font-bold hover:bg-primary-hover disabled:opacity-50"
              >
                {commentLoading ? '등록 중...' : '등록'}
              </button>
            </form>
            )}
          </section>
        </div>
      </main>
    </Layout>
  );
}
