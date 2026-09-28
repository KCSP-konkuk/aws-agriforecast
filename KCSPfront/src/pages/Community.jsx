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
      <main className="flex flex-1 justify-center px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex flex-col max-w-[880px] flex-1 min-w-0">
          <h1 className="text-text-main text-3xl sm:text-4xl font-bold tracking-[-0.02em] mb-6">커뮤니티</h1>

          <div className="flex gap-2 mb-6 overflow-x-auto">
            {ROOMS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setParams({ room: r })}
                className={`h-9 shrink-0 rounded-lg px-4 text-sm ${r === room ? 'bg-primary text-white font-semibold' : 'bg-primary-light text-text-main font-medium hover:bg-primary/15'}`}
              >
                {r}
              </button>
            ))}
          </div>

          {VOTE_ROOMS.includes(room) && <VoteCard itemName={room} />}

          <div className="flex items-center justify-between mt-8 mb-3">
            <h2 className="text-lg font-semibold text-text-main">{room === '자유' ? '자유 이야기' : `${room} 이야기`}</h2>
            <Link to={`/community/write?category=${encodeURIComponent(room)}`} className="h-9 inline-flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">
              글쓰기
            </Link>
          </div>

          <div className="rounded-xl border border-border-light bg-white overflow-hidden">
            {status === 'loading' ? (
              <div className="h-40 animate-pulse" />
            ) : status === 'error' ? (
              <p className="px-5 py-10 text-center text-text-main/80">글을 불러오지 못했습니다.</p>
            ) : ordered.length === 0 ? (
              <p className="px-5 py-10 text-center text-text-main/80">아직 글이 없어요. 첫 이야기를 남겨 보세요.</p>
            ) : (
              ordered.map((post, i) => {
                const pinned = i === 0 && post.kind === 'BRIEF' && page === 0;
                return (
                  <Link
                    key={post.id}
                    to={`/community/${post.id}`}
                    className={`flex items-center justify-between gap-4 px-5 py-4 text-[15px] ${i > 0 ? 'border-t border-border-light' : ''} ${pinned ? 'bg-primary-light' : 'hover:bg-background-light'}`}
                  >
                    <span className="min-w-0 truncate">
                      <span className={pinned ? 'font-medium text-primary' : 'text-text-main'}>{post.title}</span>
                      {post.commentCount > 0 && <span className="ml-2 font-medium text-primary">{post.commentCount}</span>}
                    </span>
                    <span className="shrink-0 text-sm text-text-main/60">{when(post.createdAt)}</span>
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
                  className={`h-8 w-8 rounded-lg text-sm ${page === i ? 'bg-primary text-white font-semibold' : 'text-text-main hover:bg-primary-light'}`}
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
