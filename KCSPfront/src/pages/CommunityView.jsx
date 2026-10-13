import Layout from '../components/Layout';
import AnalysisPreview from '../components/AnalysisPreview';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';
import LoginRequired from '../components/LoginRequired';
import { isLoggedIn, getUser } from '../auth';
import { toLocalDate } from '../date';

export default function CommunityView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [error, setError] = useState('');
  const [commentError, setCommentError] = useState('');
  // 로그인 상태가 바뀌면(만료 포함) 댓글 입력 칸을 다시 그린다
  const [, setLoginVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setLoginVersion((v) => v + 1);
    window.addEventListener('loginStatusChanged', onChange);
    return () => window.removeEventListener('loginStatusChanged', onChange);
  }, []);

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
      
      // 본인 글이면 수정·삭제 버튼이 있는 화면으로
      const user = getUser();
      if (user && postData.authorId === user.seqNoA010) {
        navigate(`/community/${id}/my`, { replace: true });
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
          <Link
            to={post.category ? `/community?room=${encodeURIComponent(post.category)}` : '/community'}
            className="text-sm font-medium text-subtext-light hover:text-text-main"
          >
            커뮤니티{post.category ? ` · ${post.category}` : ''}
          </Link>
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
