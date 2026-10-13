import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import MyPageSidebar from '../components/MyPageSidebar';
import StatusMessage from '../components/StatusMessage';
import { api } from '../api/api';
import { clearLogin, getUser, loginPath } from '../auth';

const dateText = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');

function AnalysisRow({ item, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [memo, setMemo] = useState(item.memo ?? '');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    try {
      onChanged(await api.updateMyAnalysis(item.id, { title, memo }));
      setEditing(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async () => {
    if (!window.confirm(`'${item.title}' 분석을 지울까요?`)) return;
    try {
      await api.deleteMyAnalysis(item.id);
      onDeleted(item.id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <li className="py-4">
      {editing ? (
        <form onSubmit={save} className="space-y-2" noValidate>
          <input
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="분석 이름"
            className="w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-main focus:border-primary"
          />
          <textarea
            value={memo}
            maxLength={500}
            rows={2}
            onChange={(e) => setMemo(e.target.value)}
            aria-label="메모"
            className="w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-main focus:border-primary"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={!title.trim()} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setTitle(item.title);
                setMemo(item.memo ?? '');
              }}
              className="h-9 rounded-lg bg-background-light px-4 text-sm font-semibold text-text-main hover:bg-border-light"
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-text-main">{item.title}</p>
            {item.memo && <p className="mt-0.5 whitespace-pre-line text-sm text-subtext-light">{item.memo}</p>}
            <p className="mt-1 text-xs text-subtext-light">{dateText(item.updatedAt)} 저장</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link
              to={`/analysis?${item.query}`}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-white hover:bg-primary-hover"
            >
              작업대에서 열기
            </Link>
            <button type="button" onClick={() => setEditing(true)} className="h-8 rounded-lg bg-background-light px-3 text-[13px] font-semibold text-text-main hover:bg-border-light">
              이름·메모
            </button>
            <button type="button" onClick={remove} className="h-8 rounded-lg px-3 text-[13px] font-semibold text-red-700 hover:bg-red-50">
              지우기
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-red-700" role="alert">{error}</p>}
    </li>
  );
}

// 마이페이지 › 내 분석 — 작업대에서 저장한 화면 목록. 열면 저장한 그대로(지표·변환·시차·차트·조건) 작업대가 열린다
export default function MyAnalyses() {
  const navigate = useNavigate();
  const user = getUser();
  const [list, setList] = useState({ status: 'loading', data: [] });

  useEffect(() => {
    if (!user) {
      navigate(loginPath('/mypage/analyses'), { replace: true });
      return;
    }
    api
      .getMyAnalyses()
      .then((data) => setList({ status: 'ready', data }))
      .catch((err) => (err.needsLogin ? navigate(loginPath('/mypage/analyses'), { replace: true }) : setList({ status: 'error', data: [] })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <Layout>
      <div className="flex flex-1 justify-center px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <div className="flex w-full max-w-6xl flex-1 flex-col gap-8 lg:flex-row lg:gap-16">
          <MyPageSidebar
            user={user}
            onLogout={() => {
              clearLogin();
              navigate('/');
            }}
          />
          <main className="flex-1 min-w-0">
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold tracking-[-0.02em] text-text-main">내 분석</h1>
                <p className="mt-2 text-[15px] text-subtext-light">작업대에서 저장한 화면이에요. 열면 지표 · 변환 · 시차 · 차트 · 조건이 저장한 그대로 열려요.</p>
              </div>
              {list.status !== 'ready' || list.data.length === 0 ? (
                <div>
                  <StatusMessage
                    status={list.status}
                    loadingText="내 분석을 불러오는 중이에요"
                    emptyText="아직 저장한 분석이 없어요. 작업대에서 '분석 저장'을 눌러 보세요."
                    errorText="내 분석을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요."
                  />
                  {list.status === 'ready' && (
                    <div className="text-center">
                      <Link to="/analysis" className="text-sm font-semibold text-primary hover:underline">
                        분석 작업대 열기
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {list.data.map((item) => (
                    <AnalysisRow
                      key={item.id}
                      item={item}
                      onChanged={(next) => setList((l) => ({ ...l, data: l.data.map((x) => (x.id === next.id ? next : x)) }))}
                      onDeleted={(id) => setList((l) => ({ ...l, data: l.data.filter((x) => x.id !== id) }))}
                    />
                  ))}
                </ul>
              )}
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
