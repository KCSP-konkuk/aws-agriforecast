import { useMemo, useState } from 'react';
import { toCsv } from '../../lib/series';
import { colorOf, keyLabel, num } from './format';

const PAGE = 30;

// 주소 복사 — https 가 아닌 곳에서는 clipboard API 가 없어 textarea 로 복사한다
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// 표 미리보기 · CSV 받기 · 링크 복사 — 차트와 같은 값(주기·변환·시차·기간 반영)
// columns: [{ id, name, source, unit(원래 단위), adjust(맞춘 방법), lagText, color }]
export default function DataTable({ rows, columns, freq, title }) {
  const [limit, setLimit] = useState(PAGE);
  const [copied, setCopied] = useState(null);
  const latestFirst = useMemo(() => [...rows].reverse(), [rows]);

  const saveCsv = () => {
    const csv = toCsv({
      title,
      columns: columns.map((c) => ({ id: c.id, name: c.name, source: c.source, unit: c.unit, transform: c.adjust || '원값', lag: c.lagText })),
      rows,
    });
    download(`agriforecast-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const copyLink = async () => {
    try {
      setCopied((await copyText(window.location.href)) ? 'ok' : 'fail');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <section className="rounded-xl bg-white border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-text-main">표로 보기</h3>
          <p className="text-xs text-subtext-light">차트와 같은 값이에요 · {rows.length.toLocaleString('ko-KR')}행 · 최근부터</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-text-main hover:border-primary/50"
          >
            <span className="material-symbols-outlined text-lg">{copied === 'ok' ? 'check' : 'link'}</span>
            {copied === 'ok' ? '복사했어요' : copied === 'fail' ? '복사하지 못했어요' : '링크 복사'}
          </button>
          <button
            type="button"
            onClick={saveCsv}
            disabled={!rows.length}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            CSV 받기
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-subtext-light">고른 기간에 값이 없어요.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left align-bottom">
                <th className="whitespace-nowrap py-2 pr-3 text-xs font-semibold text-subtext-light">날짜</th>
                {columns.map((c) => (
                  <th key={c.id} className="py-2 pr-3 text-right font-normal">
                    <span className="flex items-center justify-end gap-1 whitespace-nowrap text-xs font-semibold text-text-main">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf(c.color) }} />
                      {c.name}
                    </span>
                    <span className="block whitespace-nowrap text-[11px] text-subtext-light">
                      {[c.unit, c.adjust, c.lag ? `시차 ${c.lagText}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latestFirst.slice(0, limit).map((r) => (
                <tr key={r.key} className="border-b border-gray-100">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-subtext-light">{keyLabel(r.key, freq)}</td>
                  {columns.map((c) => (
                    <td key={c.id} className="py-1.5 pr-3 text-right tabular-nums text-text-main">
                      {num(r[c.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {limit < rows.length && (
            <button
              type="button"
              onClick={() => setLimit((v) => v + PAGE * 3)}
              className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-primary hover:bg-primary-light"
            >
              더 보기 ({(rows.length - limit).toLocaleString('ko-KR')}행 남음)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
