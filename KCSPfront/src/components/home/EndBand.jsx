import { useState } from 'react';
import { Link } from 'react-router-dom';
import { copyText } from '../../lib/clipboard';
import { MCP_URL } from '../../lib/mcp';

// 홈 마지막 — 작업대로, 그리고 AI 비서(MCP)로 이어지는 출구
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
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-background-light px-6 py-6">
      <div>
        <p className="text-lg font-bold tracking-[-0.02em] text-text-main">궁금한 품목은 직접 겹쳐 보세요</p>
        <p className="mt-1 text-sm text-subtext-light">Claude 같은 AI 비서에 MCP 주소를 등록하면 도매 예측을 물어볼 수 있어요</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          title={MCP_URL}
          className="inline-flex h-11 items-center rounded-lg bg-white px-4 text-[15px] font-semibold text-text-main ring-1 ring-inset ring-border-light hover:ring-subtext-light/40"
        >
          {copied === 'ok' ? 'MCP 주소를 복사했어요' : copied === 'fail' ? '복사하지 못했어요' : 'MCP 주소 복사'}
        </button>
        <Link to="/analysis" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover">
          작업대 열기
        </Link>
      </div>
    </section>
  );
}
