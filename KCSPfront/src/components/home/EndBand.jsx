import { useState } from 'react';
import { Link } from 'react-router-dom';
import { copyText } from '../../lib/clipboard';
import { MCP_URL } from '../../lib/mcp';
import Icon from '../Icon';

export default function EndBand() {
  const [copied, setCopied] = useState(null);
  const copy = async () => { try { setCopied((await copyText(MCP_URL)) ? 'ok' : 'fail'); } catch { setCopied('fail'); } };
  return (
    <section className="grid gap-8 border-t border-text-main py-8 lg:grid-cols-[1fr_auto] lg:items-center">
      <div><h2 className="text-[27px] font-medium tracking-[-0.035em] sm:text-[32px]">같은 기간, 다른 지표.</h2><p className="mt-3 text-sm leading-relaxed text-subtext-light">가격·반입량·날씨를 겹쳐 보고 분석을 저장하세요.</p></div>
      <Link to="/analysis" className="button-primary">분석 작업대 열기<Icon /></Link>
      <details className="border-t border-border-light pt-5 lg:col-span-2"><summary className="text-sm text-subtext-light">AI 비서에서 도매 예측을 보고 싶다면</summary><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm leading-relaxed text-subtext-light">Claude 등 MCP 지원 앱에 주소를 등록하면 배추·양파·홍고추의 도매 예측을 물어볼 수 있어요.</p><button onClick={copy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-light px-4 text-sm text-text-main"><Icon name={copied === 'ok' ? 'check' : 'copy'} className="size-4" />MCP 주소 복사</button><span role="status" className="text-sm text-subtext-light">{copied === 'ok' ? '주소를 복사했어요.' : copied === 'fail' ? `복사하지 못했어요. 주소: ${MCP_URL}` : ''}</span></div></details>
    </section>
  );
}
