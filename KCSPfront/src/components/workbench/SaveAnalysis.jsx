import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/api';
import { getUser } from '../../auth';
import LoginRequired from '../LoginRequired';

// 분석 저장 — 지금 작업대 화면(주소의 쿼리)을 이름·메모와 함께 내 분석에 남긴다. 로그인해야 한다
export default function SaveAnalysis({ defaultTitle, query, onClose }) {
  const [title, setTitle] = useState(defaultTitle.slice(0, 100));
  const [memo, setMemo] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });

  if (!getUser()) {
    return <LoginRequired compact title="분석을 저장하려면 로그인해 주세요. 로그인하면 이 화면으로 돌아와요." />;
  }

  const save = async (e) => {
    e.preventDefault();
    setState({ status: 'saving', message: '' });
    try {
      await api.saveMyAnalysis({ title, memo, query });
      setState({ status: 'saved', message: '' });
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  };

  if (state.status === 'saved') {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary-light px-4 py-3 text-sm text-text-main">
        <span className="material-symbols-outlined text-lg text-primary">check_circle</span>
        저장했어요. 마이페이지 ›
        <Link to="/mypage/analyses" className="font-semibold text-primary hover:underline">
          내 분석
        </Link>
        에서 다시 열 수 있어요.
        <button type="button" onClick={onClose} className="ml-auto text-xs text-subtext-light hover:text-text-main">
          닫기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-2 rounded-lg border border-gray-200 bg-white p-3" noValidate>
      <p className="text-sm font-semibold text-text-main">이 화면을 내 분석에 저장</p>
      <label className="block text-xs text-subtext-light">
        이름
        <input
          id="analysis-title"
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-text-main"
        />
      </label>
      <label className="block text-xs text-subtext-light">
        메모 (선택)
        <textarea
          id="analysis-memo"
          value={memo}
          maxLength={500}
          rows={2}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 반입량이 평년보다 적은 순에 경매가가 어땠는지 다음 달에 다시 보기"
          className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-text-main"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={state.status === 'saving' || !title.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {state.status === 'saving' ? '저장 중…' : '저장'}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-text-main hover:bg-background-light">
          닫기
        </button>
        {state.status === 'error' && <span className="text-xs text-red-600">{state.message}</span>}
      </div>
    </form>
  );
}
