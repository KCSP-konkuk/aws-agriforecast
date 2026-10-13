import { useState } from 'react';
import TemplateCards from './TemplateCards';
import { TEMPLATES } from './templates';
import Icon from '../Icon';

export default function TemplateBar({ catalog, onApply }) {
  const [open, setOpen] = useState(false);
  const available = TEMPLATES.filter((t) => t.items(catalog).length);
  if (!available.length) return null;
  return (
    <section className="rounded-2xl border border-border-light bg-white p-4 sm:px-5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-h-10 w-full items-center gap-3 text-left" aria-expanded={open} aria-controls="analysis-templates">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary-light text-primary"><Icon name="grid" className="size-4" /></span>
        <span className="flex-1"><span className="block text-sm font-semibold">어디서 시작할지 고민이라면</span><span className="mt-0.5 block text-xs text-subtext-light">{available.length}가지 분석 템플릿에서 골라보세요</span></span>
        <span className="text-sm font-medium text-primary">{open ? '접기' : '템플릿 보기'}</span>
      </button>
      {open && <div id="analysis-templates" className="mt-4 border-t border-line pt-4"><TemplateCards catalog={catalog} onApply={(t, item) => { onApply(t, item); setOpen(false); }} /></div>}
    </section>
  );
}
