import Logo from './Logo';

// 로그인·회원가입·아이디 찾기·비밀번호 재설정 공통 틀 — 흰 화면 가운데 폼 하나
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      <header className="flex h-14 items-center px-4 sm:px-6 lg:px-10">
        <Logo />
      </header>
      <main className="flex flex-1 justify-center px-4 pb-16 pt-8 sm:pt-16">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-text-main">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-subtext-light">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
