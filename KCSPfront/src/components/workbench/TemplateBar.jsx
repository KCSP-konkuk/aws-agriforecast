import { useMemo, useState } from 'react';
import { TEMPLATES } from './templates';

// 시작 템플릿 — 자주 쓰는 분석을 품목만 골라 바로 연다. 품목은 지표 목록에서 찾는다
export default function TemplateBar({ catalog, onApply }) {
  const [open, setOpen] = useState(true);
  const list = useMemo(
    () => TEMPLATES.map((t) => ({ ...t, options: t.items(catalog) })).filter((t) => t.options.length),
    [catalog],
  );
  if (!list.length) return null;

  return (
    <section className="rounded-xl bg-white border border-gray-200 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <span className="material-symbols-outlined text-xl text-primary">auto_awesome</span>
        <span className="font-bold text-text-main">시작 템플릿</span>
        <span className="hidden text-xs text-subtext-light sm:inline">자주 쓰는 분석을 품목만 골라 바로 열어요</span>
        <span className="material-symbols-outlined ml-auto text-lg text-subtext-light">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
          {list.map((t) => (
            <div key={t.key} className="flex w-64 shrink-0 snap-start flex-col rounded-lg border border-gray-100 p-3 sm:w-auto">
              <p className="text-sm font-semibold text-text-main">{t.title}</p>
              <p className="text-[11px] font-semibold text-primary">{t.who}</p>
              <p className="mt-1 flex-1 text-xs text-subtext-light">{t.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {t.options.map((item) => (
                  <button
                    key={item ?? 'all'}
                    type="button"
                    onClick={() => onApply(t, item)}
                    className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-text-main hover:border-primary hover:text-primary"
                  >
                    {item ?? '열기'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
