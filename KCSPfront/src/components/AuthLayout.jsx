import { Link } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-[72px] items-center justify-between border-b border-border-light px-5 sm:px-10">
        <Logo /><Link to="/" className="text-link">시장 둘러보기<Icon className="size-4" /></Link>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1440px] items-start justify-center px-5 py-14 sm:px-10 sm:py-24">
        <div className="w-full max-w-[420px]">
          <h1 className="text-[32px] font-semibold tracking-[-0.04em]">{title}</h1>
          {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-subtext-light">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
