import Logo from './Logo';

// 로그인·회원가입·아이디 찾기·비밀번호 재설정 공통 틀
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-primary to-primary-hover text-white">
        <Logo className="text-white" />
        <div>
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
