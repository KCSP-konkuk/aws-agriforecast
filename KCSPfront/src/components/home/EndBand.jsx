import { useState } from 'react';
import { Link } from 'react-router-dom';
import { copyText } from '../../lib/clipboard';
import { MCP_URL } from '../../lib/mcp';

// 홈 마지막 띠 — 작업대로, 그리고 AI 비서(MCP)로 이어지는 출구
export default function EndBand() {
  const [copied, setCopied] = useState(null);
  const copy = async () => {
    try {
      setCopied((await copyText(MCP_URL)) ? 'ok' : 'fail');
    } catch {
      setCopied('fail');
    }
  };
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-light px-5 py-4">
      <p className="text-base font-bold text-text-main">궁금한 품목은 직접 겹쳐 보세요</p>
      <div className="flex flex-wrap gap-2">
        <Link to="/analysis" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover">
          작업대 열기
        </Link>
        <button
          type="button"
          onClick={copy}
          title={`${MCP_URL} — Claude 등 MCP 클라이언트에 등록하세요`}
          className="inline-flex h-10 items-center rounded-lg border border-primary/30 bg-white px-4 text-sm font-bold text-primary hover:border-primary"
        >
          {copied === 'ok' ? 'MCP 주소를 복사했어요' : copied === 'fail' ? '복사하지 못했어요' : 'AI 비서에서 쓰기 (MCP 주소 복사)'}
        </button>
      </div>
    </section>
  );
}
