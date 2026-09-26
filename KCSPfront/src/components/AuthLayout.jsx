import Logo from './Logo';

// 로그인·회원가입·아이디 찾기·비밀번호 재설정 공통 틀
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      {/* 사진: Unsplash (무료 라이선스) — public/images/README.md */}
      <div
        className="relative hidden md:flex flex-col justify-between p-12 text-white bg-cover bg-center"
        style={{ backgroundImage: "url('/images/login-field.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/30 to-black/70" aria-hidden="true" />
        <Logo className="relative text-white" />
        <div className="relative">
          <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-[-0.033em]">
            데이터로 농산물의<br />다음 가격을 예측합니다
          </h2>
          <p className="text-white/80 text-lg mt-4">
            배추·양파·홍고추의 다음 순 도매가를 매일 새로 예측해 드립니다.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background-light px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-8">
            <Logo />
          </div>
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-[-0.033em] text-text-main">{title}</h1>
            {subtitle && <p className="mt-2 text-base text-subtext-light">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
