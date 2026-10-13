import { useMemo, useState } from 'react';
import { toCsv } from '../../lib/series';
import { copyText } from '../../lib/clipboard';
import { colorOf, keyLabel, num } from './format';

const PAGE = 8;

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
export default function DataTable({ rows: all, columns, freq, title, notes = [], match, onShare }) {
  const [limit, setLimit] = useState(PAGE);
  const [copied, setCopied] = useState(null);
  const rows = useMemo(() => (match ? all.filter((r) => match.has(r.key)) : all), [all, match]);
  const latestFirst = useMemo(() => [...rows].reverse(), [rows]);

  const saveCsv = () => {
    const csv = toCsv({
      title,
      notes,
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
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold text-text-main">분석 데이터</h2>
          <p className="mt-0.5 text-[13px] text-subtext-light">
            차트와 같은 값이에요 · {match ? '조건에 맞는 ' : ''}
            {rows.length.toLocaleString('ko-KR')}행 · 최근부터
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="flex min-h-10 items-center rounded-lg bg-background-light px-3 text-[13px] font-semibold text-text-main hover:bg-border-light"
              title="이 화면을 붙여 커뮤니티 글을 써요"
            >
              커뮤니티에 공유
            </button>
          )}
          <button
            type="button"
            onClick={copyLink}
            className="flex min-h-10 items-center rounded-lg bg-background-light px-3 text-[13px] font-semibold text-text-main hover:bg-border-light"
          >
            {copied === 'ok' ? '복사했어요' : copied === 'fail' ? '복사하지 못했어요' : '링크 복사'}
          </button>
          <button
            type="button"
            onClick={saveCsv}
            disabled={!rows.length}
            className="flex min-h-10 items-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            CSV 받기
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-subtext-light">{match ? '조건에 맞는 칸이 없어요.' : '선택한 기간에 값이 없어요.'}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light text-left align-bottom">
                <th className="whitespace-nowrap py-2 pr-3 text-xs font-semibold text-subtext-light">날짜</th>
                {columns.map((c) => (
                  <th key={c.id} className="py-2 pr-3 text-right font-normal">
                    <span className="flex items-center justify-end gap-1 whitespace-nowrap text-xs font-semibold text-text-main">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf(c.color) }} />
                      {c.name}
                    </span>
                    <span className="block whitespace-nowrap text-xs text-subtext-light">
                      {[c.unit, c.adjust, c.lag ? `시차 ${c.lagText}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latestFirst.slice(0, limit).map((r) => (
                <tr key={r.key} className="border-b border-line">
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-subtext-light">{keyLabel(r.key, freq)}</td>
                  {columns.map((c) => (
                    <td key={c.id} className="py-3 pr-3 text-right tabular-nums text-text-main">
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
