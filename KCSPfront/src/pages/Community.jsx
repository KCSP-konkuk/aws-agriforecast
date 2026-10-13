import Layout from '../components/Layout';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/api';
import VoteCard from '../components/VoteCard';
import PageHeading from '../components/PageHeading';
import ItemJourney from '../components/ItemJourney';
import Icon from '../components/Icon';
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

  const firstPage = Math.max(0, Math.min(page - 2, totalPages - 5));
  return (
    <Layout>
      <main className="page-shell">
        <PageHeading title="시장을 함께 읽는 이야기" description="시세를 나누고, 서로의 전망을 비교해보세요.">
          <Link to={`/community/write?category=${encodeURIComponent(room)}`} className="button-primary">이야기 쓰기<Icon name="plus" className="size-4" /></Link>
        </PageHeading>
        <div className="crop-tabs mb-7" role="group" aria-label="이야기방">
          {ROOMS.map((r) => <button key={r} type="button" aria-pressed={r === room} onClick={() => { setPage(0); setParams({ room: r }); }} className={`crop-tab ${r === room ? 'crop-tab-active' : ''}`}>{r}{r === '자유' ? ' 이야기' : ''}</button>)}
        </div>
        <div className={`grid items-start gap-6 ${VOTE_ROOMS.includes(room) ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
          <section className="panel">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold tracking-[-0.03em]">{room === '자유' ? '자유 이야기' : `${room} 이야기`}</h2><span className="text-xs text-subtext-light">최신순</span></div>
            <div className="divide-y divide-line border-y border-line">
              {status === 'loading' ? <div className="h-40 animate-pulse rounded-xl bg-background-light" role="status" aria-label="글을 불러오는 중" /> : status === 'error' ? <p className="py-12 text-center text-sm text-red-700" role="alert">글을 불러오지 못했어요.</p> : ordered.length === 0 ? <div className="py-16 text-center"><p className="text-[17px] font-medium">첫 이야기를 기다리고 있어요.</p><p className="mt-2 text-sm text-subtext-light">오늘의 시장에서 발견한 것을 나눠주세요.</p><Link to={`/community/write?category=${encodeURIComponent(room)}`} className="text-link mt-5">이야기 쓰기<Icon className="size-4" /></Link></div> : ordered.map((post, i) => {
                const pinned = i === 0 && post.kind === 'BRIEF' && page === 0;
                return <Link key={post.id} to={`/community/${post.id}`} className={`group block rounded-lg px-3 py-5 transition-colors hover:bg-background-light ${pinned ? 'bg-primary-light/50' : ''}`}>
                  <div className="mb-2 flex items-center gap-2 text-xs text-subtext-light"><span className={pinned ? 'font-semibold text-primary' : ''}>{post.kind === 'BRIEF' ? '시장 브리핑' : room}</span><span>·</span><span>{when(post.createdAt)}</span></div>
                  <div className="flex items-start justify-between gap-4"><h3 className="text-[17px] font-semibold leading-relaxed text-text-main group-hover:text-primary">{post.title}</h3><Icon name="chevron" className="mt-1 size-4 shrink-0 text-subtext-light" /></div>
                  <p className="mt-3 text-xs text-subtext-light">{post.authorName || '익명'}{post.commentCount > 0 ? ` · 댓글 ${post.commentCount}` : ''}{post.analysisQuery ? ' · 분석 첨부' : ''}</p>
                </Link>;
              })}
            </div>
            {totalPages > 1 && <nav className="mt-6 flex flex-wrap justify-center gap-2" aria-label="게시글 페이지">
              <button type="button" className="button-secondary !min-h-9 !px-3" disabled={page === 0} onClick={() => setPage((v) => v - 1)}>이전</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => firstPage + i).map((i) => <button key={i} type="button" onClick={() => setPage(i)} aria-current={page === i ? 'page' : undefined} className={`size-10 rounded-lg text-sm ${page === i ? 'bg-primary font-semibold text-white' : 'hover:bg-background-light'}`}>{i + 1}</button>)}
              <button type="button" className="button-secondary !min-h-9 !px-3" disabled={page >= totalPages - 1} onClick={() => setPage((v) => v + 1)}>다음</button>
            </nav>}
          </section>
          {VOTE_ROOMS.includes(room) && <aside className="space-y-4 lg:sticky lg:top-[96px]"><VoteCard key={room} itemName={room} /><ItemJourney item={room} current="community" /><div className="px-2 text-[13px] leading-relaxed text-subtext-light">가격의 근거도 함께 나눠보세요. 작업대의 분석을 글에 붙일 수 있어요.</div></aside>}
        </div>
      </main>
    </Layout>
  );
}
