import { colorOf, josa, lagLabel } from './format';

const strength = (r) => (Math.abs(r) >= 0.7 ? '뚜렷하게' : Math.abs(r) >= 0.5 ? '꽤' : '약하게');

function sentence(f, nameOf, freq) {
  const [lead, follow] = [nameOf(f.lead), nameOf(f.follow)];
  const how = `${strength(f.r)} ${f.r > 0 ? '같은 방향으로' : '반대 방향으로'} 움직였어요`;
  if (!f.lag) return `${josa(lead, '과', '와')} ${josa(follow, '은', '는')} 같은 때 ${how}`;
  return `${josa(lead, '이', '가')} ${lagLabel(f.lag, freq).replace('+', '')} 앞서 ${josa(follow, '과', '와')} ${how}`;
}

// 찾아낸 것 — 고른 지표 쌍에서 가장 강하게 함께 움직인 관계 셋. 누르면 그 시차를 건 겹쳐 보기 · 산점도로
export default function FindingsPanel({ findings, lines, freq, maxLag, converted, onOverlay, onScatter }) {
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  const nameOf = (id) => byId[id]?.name ?? id;
  const dot = (id) => <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(byId[id]?.color ?? 0) }} />;

  return (
    <div className="rounded-lg border border-primary/15 bg-primary-light p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="material-symbols-outlined text-lg text-primary">auto_awesome</span>
        <span className="text-sm font-semibold text-text-main">찾아낸 것</span>
        <span className="text-xs text-subtext-light">
          고른 지표 쌍마다 0~{maxLag} 시차를 훑었어요{converted ? ' · 원값·지수·이동평균은 계절·추세에 속지 않게 전년 대비로 맞춰 계산' : ''}
        </span>
      </div>
      {findings.length === 0 ? (
        <p className="mt-2 text-sm text-subtext-light">뚜렷하게 함께 움직인 짝을 찾지 못했어요. (상관 0.3 미만이거나 함께 있는 칸이 적어요)</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {findings.map((f, i) => (
            <li key={`${f.lead}|${f.follow}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-white px-3 py-2">
              <span className="flex min-w-0 items-center gap-1.5 text-sm text-text-main">
                <b className="text-primary">{i + 1}</b>
                {dot(f.lead)}
                {dot(f.follow)}
                <span>{sentence(f, nameOf, freq)}</span>
              </span>
              <span className="text-xs text-subtext-light tabular-nums">
                r {f.r.toFixed(2)} · 사례 {f.n.toLocaleString('ko-KR')}개
              </span>
              <span className="ml-auto flex gap-1">
                {f.lag > 0 && (
                  <button
                    type="button"
                    onClick={() => onOverlay(f)}
                    className="rounded-full border border-primary/30 px-2.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light"
                  >
                    시차 걸어 겹쳐 보기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onScatter(f)}
                  className="rounded-full border border-primary/30 px-2.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light"
                >
                  산점도로 보기
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] text-subtext-light">함께 움직였다는 뜻일 뿐, 한쪽이 다른 쪽의 원인이라는 뜻은 아니에요.</p>
    </div>
  );
}
