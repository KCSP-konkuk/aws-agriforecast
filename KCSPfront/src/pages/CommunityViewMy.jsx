import Layout from '../components/Layout';
import AnalysisPreview from '../components/AnalysisPreview';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';
import LoginRequired from '../components/LoginRequired';
import { isLoggedIn, getUser, loginPath } from '../auth';
import { toLocalDate } from '../date';

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
    // 글 번호가 바뀔 때만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return toLocalDate(date);
  };

  if (loading) {
    return (
      <Layout>
        <main className="page-shell">
          <div className="mx-auto w-full max-w-[900px]">
            <p className="py-12 text-center text-sm text-subtext-light" role="status">불러오는 중이에요</p>
          </div>
        </main>
      </Layout>
    );
  }

  if (error || !post) {
    return (
      <Layout>
        <main className="page-shell">
          <div className="mx-auto w-full max-w-[900px]">
            <p className="py-12 text-center text-sm text-red-700" role="alert">{error || '글을 찾을 수 없어요.'}</p>
            <p className="text-center"><Link to="/community" className="text-sm font-semibold text-primary hover:underline">커뮤니티 목록으로</Link></p>
          </div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="page-shell">
        <div className="mx-auto w-full max-w-[900px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to={post.category ? `/community?room=${encodeURIComponent(post.category)}` : '/community'}
              className="text-sm font-medium text-subtext-light hover:text-text-main"
            >
              커뮤니티{post.category ? ` · ${post.category}` : ''}
            </Link>
            <div className="flex gap-2">
              <Link
                to={`/community/${id}/edit`}
                className="inline-flex h-9 items-center rounded-lg bg-background-light px-4 text-sm font-semibold text-text-main hover:bg-border-light"
              >
                수정
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                className="h-9 rounded-lg px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>

          {actionError && <p className="mt-3 text-sm text-red-700" role="alert">{actionError}</p>}
          <article className="reading-surface mt-5">
            <h1 className="text-[28px] font-semibold leading-snug tracking-[-0.02em] text-text-main">{post.title}</h1>
            <p className="mt-2 text-sm text-subtext-light">
              {post.authorName || '익명'} · {formatDate(post.createdAt)} · 조회 {post.viewCount || 0}
            </p>
            <div className="mt-7 whitespace-pre-wrap text-[16px] leading-[1.9] text-text-main">{post.content}</div>
            {post.analysisQuery && (
              <div className="mt-6">
                <AnalysisPreview query={post.analysisQuery} />
              </div>
            )}
          </article>

          <section className="panel mt-5">
            <h2 className="text-lg font-bold tracking-[-0.02em] text-text-main">댓글 {comments.length}</h2>
            {comments.length === 0 ? (
              <p className="mt-3 border-t border-line py-6 text-sm text-subtext-light">아직 댓글이 없어요.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {comments.map((commentItem) => (
                  <li key={commentItem.id} className="py-4">
                    <p className="text-[13px] text-subtext-light">
                      <span className="font-semibold text-text-main">{commentItem.authorName || '익명'}</span> · {formatDate(commentItem.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] text-text-main">{commentItem.content}</p>
                  </li>
                ))}
              </ul>
            )}
            {commentError && <p className="mt-4 text-sm text-red-700" role="alert">{commentError}</p>}
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
                className="h-11 min-w-0 flex-1 rounded-lg border border-border-light bg-white px-4 text-[15px] text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="댓글 내용"
                placeholder="이 시장에 대한 생각을 남겨주세요"
                disabled={commentLoading}
              />
              <button
                type="submit"
                disabled={commentLoading}
                className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
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
