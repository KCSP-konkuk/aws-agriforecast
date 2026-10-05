import { useEffect, useState } from 'react';
import { api } from '../api/api';
import { getUser } from '../auth';
import { queryFromLink } from '../lib/workbenchLink';
import AnalysisPreview from './AnalysisPreview';

// 글에 작업대 화면 붙이기 — 작업대에서 [링크 복사]한 주소를 붙여 넣거나 내 분석에서 고른다. value: 붙인 쿼리(없으면 null)
export default function AttachAnalysis({ value, onChange }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [mine, setMine] = useState([]);

  useEffect(() => {
    if (getUser()) {
      api
        .getMyAnalyses()
        .then(setMine)
        .catch(() => setMine([]));
    }
  }, []);

  if (value) {
    return (
      <div className="space-y-2">
        <AnalysisPreview query={value} />
        <button type="button" onClick={() => onChange(null)} className="text-sm text-subtext-light hover:text-text-main hover:underline">
          붙인 분석 떼기
        </button>
      </div>
    );
  }

  const attach = () => {
    const q = queryFromLink(text);
    if (!q) {
      setError('작업대 화면 링크가 아니에요. 작업대에서 [링크 복사]한 주소를 붙여 넣어 주세요.');
      return;
    }
    onChange(q);
    setText('');
    setError('');
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border-light bg-white p-3">
      <p className="text-sm font-medium text-text-main">
        작업대 분석 붙이기 <span className="text-xs font-normal text-subtext-light">(선택) — 글에 미니 차트와 [작업대에서 열기]가 붙어요</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          id="attach-link"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              attach();
            }
          }}
          placeholder="작업대에서 [링크 복사]한 주소"
          className="min-w-0 flex-1 rounded-lg border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button type="button" onClick={attach} className="rounded-lg bg-primary-light px-4 py-2 text-sm font-semibold text-text-main hover:bg-primary/15">
          붙이기
        </button>
      </div>
      {mine.length > 0 && (
        <select
          id="attach-mine"
          value=""
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-main"
        >
          <option value="">내 분석에서 고르기</option>
          {mine.map((a) => (
            <option key={a.id} value={a.query}>
              {a.title}
            </option>
          ))}
        </select>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
