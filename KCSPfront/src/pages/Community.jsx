import Layout from '../components/Layout';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/api';
import VoteCard from '../components/VoteCard';
import { ROOMS, VOTE_ROOMS } from '../community';

// "2시간 전" · "어제" · "09.21"
function when(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}시간 전`;
  if (diffMin < 60 * 48) return '어제';
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function Community() {
  const [params, setParams] = useSearchParams();
  const room = ROOMS.includes(params.get('room')) ? params.get('room') : ROOMS[0];
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('loading');

  useEffect(() => { setPage(0); }, [room]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    api.getPostsByCategory(room, page, 10)
      .then((res) => {
        if (cancelled) return;
        setPosts(res.content || []);
        setTotalPages(res.totalPages || 1);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) { setPosts([]); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [room, page]);

  // 최신 브리핑 1개만 맨 위로, 나머지 브리핑은 목록에서 일반 글처럼
  const briefIndex = page === 0 ? posts.findIndex((p) => p.kind === 'BRIEF') : -1;
  const ordered = briefIndex > 0 ? [posts[briefIndex], ...posts.filter((_, i) => i !== briefIndex)] : posts;

  return (
    <Layout>
      <main className="flex flex-1 justify-center px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <div className="flex min-w-0 max-w-[880px] flex-1 flex-col">
          <h1 className="mb-5 text-2xl font-bold tracking-[-0.02em] text-text-main">커뮤니티</h1>

          <div className="-mx-4 mb-6 flex gap-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="이야기방">
            {ROOMS.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={r === room}
                onClick={() => setParams({ room: r })}
                className={`-mb-px shrink-0 border-b-2 py-2.5 text-[15px] transition-colors ${
                  r === room ? 'border-primary font-semibold text-text-main' : 'border-transparent font-medium text-subtext-light hover:text-text-main'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* key: 방을 바꾸면 카드를 새로 만들어 이전 방의 늦은 투표 응답이 섞이지 않게 */}
          {VOTE_ROOMS.includes(room) && <VoteCard key={room} itemName={room} />}

          <div className="mb-2 mt-10 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-[-0.02em] text-text-main">{room === '자유' ? '자유 이야기' : `${room} 이야기`}</h2>
            <Link to={`/community/write?category=${encodeURIComponent(room)}`} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">
              글쓰기
            </Link>
          </div>

          <div className="border-y border-line">
            {status === 'loading' ? (
              <div className="h-40 animate-pulse bg-background-light" />
            ) : status === 'error' ? (
              <p className="py-12 text-center text-sm text-red-700" role="alert">글을 불러오지 못했어요.</p>
            ) : ordered.length === 0 ? (
              <p className="py-12 text-center text-sm text-subtext-light">아직 글이 없어요. 첫 이야기를 남겨 보세요.</p>
            ) : (
              ordered.map((post, i) => {
                const pinned = i === 0 && post.kind === 'BRIEF' && page === 0;
                return (
                  <Link
                    key={post.id}
                    to={`/community/${post.id}`}
                    className={`flex items-center justify-between gap-4 px-1 py-4 text-[15px] transition-colors hover:bg-background-light ${i > 0 ? 'border-t border-line' : ''}`}
                  >
                    <span className="min-w-0 truncate">
                      {pinned && <span className="mr-2 text-[13px] font-semibold text-primary">브리핑</span>}
                      <span className={pinned ? 'font-semibold text-text-main' : 'text-text-main'}>{post.title}</span>
                      {post.commentCount > 0 && <span className="ml-2 font-medium text-primary">{post.commentCount}</span>}
                    </span>
                    <span className="shrink-0 text-sm text-subtext-light">{when(post.createdAt)}</span>
                  </Link>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {Array.from({ length: Math.min(10, totalPages) }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  aria-current={page === i ? 'page' : undefined}
                  className={`h-8 w-8 rounded-lg text-sm ${page === i ? 'bg-text-main font-semibold text-white' : 'text-subtext-light hover:bg-background-light hover:text-text-main'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}
