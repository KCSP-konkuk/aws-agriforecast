import { useState } from 'react';
import TemplateCards from './TemplateCards';
import { TEMPLATES } from './templates';

// 작업대 위 시작 템플릿 — 접었다 펼 수 있다
export default function TemplateBar({ catalog, onApply }) {
  const [open, setOpen] = useState(true);
  if (!TEMPLATES.some((t) => t.items(catalog).length)) return null;

  return (
    <section className="rounded-xl bg-white border border-gray-200 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <span className="material-symbols-outlined text-xl text-primary">auto_awesome</span>
        <span className="font-bold text-text-main">시작 템플릿</span>
        <span className="hidden text-xs text-subtext-light sm:inline">자주 쓰는 분석을 품목만 골라 바로 열어요</span>
        <span className="material-symbols-outlined ml-auto text-lg text-subtext-light">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <TemplateCards catalog={catalog} onApply={onApply} />
        </div>
      )}
    </section>
  );
}
