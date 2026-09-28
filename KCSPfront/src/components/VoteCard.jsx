import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/api';
import { isLoggedIn, loginPath } from '../auth';

const OPTIONS = [
  { key: 'UP', label: '▲ 오른다', color: 'text-price-up', ring: 'border-price-up ring-1 ring-price-up', fill: 'bg-price-up/10' },
  { key: 'SAME', label: '― 비슷', color: 'text-text-main', ring: 'border-text-main/60 ring-1 ring-text-main/60', fill: 'bg-gray-100' },
  { key: 'DOWN', label: '▼ 내린다', color: 'text-price-down', ring: 'border-price-down ring-1 ring-price-down', fill: 'bg-price-down/10' },
];
const WORD = { UP: '▲ 오른다', SAME: '― 비슷', DOWN: '▼ 내린다' };
const TONE = { UP: 'text-price-up', SAME: 'text-text-main', DOWN: 'text-price-down' };
const won = (v) => `${Math.round(v).toLocaleString()}원`;

function ResultRow({ label, dir, price, hit }) {
  return (
    <tr>
      <td className="py-1.5 text-text-main/80">{label}</td>
      <td className="py-1.5 text-right">
        {dir ? <span className={TONE[dir]}>{price != null ? `${WORD[dir].slice(0, 1)} ${won(price)}` : WORD[dir]}</span> : <span className="text-subtext-light">-</span>}
        {hit === true && <span className="ml-2 font-semibold text-primary">적중</span>}
      </td>
    </tr>
  );
}

export default function VoteCard({ itemName }) {
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setError('');
    setNeedsLogin(false);
    api.getVoteStatus(itemName)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setError('투표를 불러오지 못했습니다.'); });
    return () => { cancelled = true; };
  }, [itemName]);

  const choose = async (key) => {
    if (!isLoggedIn()) { setNeedsLogin(true); return; }
    if (sending || status?.myChoice === key) return;
    setSending(true);
    try {
      setStatus(await api.vote(itemName, key));
    } catch (err) {
      if (err.needsLogin) setNeedsLogin(true);
      else setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (error && !status) return <div className="rounded-xl border border-border-light bg-white p-6 text-text-main/80">{error}</div>;
  if (!status) return <div className="h-56 rounded-xl border border-border-light bg-white animate-pulse" />;

  const { target, counts, total, myChoice, last } = status;
  const pct = (key) => (total > 0 ? Math.round((counts[key] / total) * 100) : 0);

  return (
    <section className="rounded-xl border border-border-light bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-text-main">{target.label} {itemName}값, 오를까요?</h2>
        <span className="shrink-0 rounded-md bg-primary-light px-2.5 py-1 text-sm font-semibold text-primary">
          {target.dday === 0 ? '오늘 마감' : `D-${target.dday}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const selected = myChoice === o.key;
          return (
            <button
              key={o.key}
              type="button"
              disabled={sending}
              onClick={() => choose(o.key)}
              className={`relative overflow-hidden rounded-lg border px-3 py-3 text-left transition ${selected ? o.ring : 'border-border-light hover:border-primary/40'}`}
            >
              <span className={`absolute inset-x-0 bottom-0 ${selected ? o.fill : 'bg-gray-50'}`} style={{ height: `${pct(o.key)}%` }} />
              <span className={`relative block text-sm ${o.color}`}>{o.label}</span>
              <span className="relative mt-1 block text-2xl font-medium text-text-main">
                {total > 0 ? `${pct(o.key)}%` : ' '}
              </span>
            </button>
          );
        })}
      </div>
      {total === 0 && <p className="mt-3 text-sm text-text-main/70">첫 표를 기다려요</p>}
      {needsLogin && (
        <p className="mt-3 text-sm text-text-main/80">
          투표는 로그인 후 할 수 있어요. <Link to={loginPath(location.pathname + location.search)} className="font-semibold text-primary hover:underline">로그인하기</Link>
        </p>
      )}

      {last && (
        <div className="mt-5 border-t border-border-light pt-4">
          <h3 className="text-base font-semibold text-text-main">{last.label} 결과</h3>
          <table className="mt-2 w-full text-[15px]">
            <tbody>
              <ResultRow label="참여자 예측" dir={last.crowd} hit={last.crowdHit} />
              <ResultRow label="AI 예측" dir={last.ai} price={last.aiPrice} hit={last.aiHit} />
              <ResultRow label="실제" dir={last.actual} price={last.actualPrice} />
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
