import { Link, useLocation } from 'react-router-dom';
import { loginPath } from '../auth';

// 로그인이 필요한 기능 자리에 대신 보여주는 안내.
// 로그인 후에는 지금 보던 화면으로 돌아온다 (Login 의 ?next=)
export default function LoginRequired({ title, description, compact = false }) {
  const location = useLocation();
  const next = location.pathname + location.search;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-light bg-white px-4 py-3">
        <p className="text-sm text-subtext-light">{title}</p>
        <Link to={loginPath(next)} className="text-sm font-bold text-primary hover:underline">로그인하기</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center rounded-xl border border-border-light bg-white px-6 py-12">
      <span className="material-symbols-outlined text-5xl text-primary">lock_person</span>
      <h2 className="mt-4 text-xl font-bold text-text-main">{title}</h2>
      {description && <p className="mt-2 text-sm text-subtext-light">{description}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to={loginPath(next)} className="h-10 px-5 inline-flex items-center rounded-lg bg-primary text-white font-bold hover:bg-primary-hover">
          로그인
        </Link>
        <Link to="/signup" className="h-10 px-5 inline-flex items-center rounded-lg bg-primary-light text-text-main font-semibold hover:bg-primary/15">
          회원가입
        </Link>
      </div>
    </div>
  );
}
