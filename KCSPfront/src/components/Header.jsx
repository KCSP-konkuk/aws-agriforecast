import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import Logo from './Logo';
import Avatar from './Avatar';
import Icon from './Icon';
import { getUser } from '../auth';
import { copyText } from '../lib/clipboard';
import { MCP_URL } from '../lib/mcp';

const NAV_ITEMS = [
  { to: '/', label: '시장 한눈에', end: true },
  { to: '/analysis/summary', label: '소매 전망' },
  { to: '/detail', label: '도매 시세' },
  { to: '/analysis', label: '분석 작업대', end: true },
  { to: '/community', label: '커뮤니티' },
];

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const [copied, setCopied] = useState(null);
  const copyMcpUrl = async () => {
    try { setCopied((await copyText(MCP_URL)) ? 'ok' : 'fail'); } catch { setCopied('fail'); }
    setTimeout(() => setCopied(null), 2500);
  };
  const mcpLabel = copied === 'ok' ? '복사했어요' : copied === 'fail' ? '복사하지 못했어요' : 'MCP 주소 복사';
  const mcpButton = (className) => <button type="button" onClick={copyMcpUrl} title={`${MCP_URL} — Claude 등 MCP 클라이언트에 등록하세요`} aria-live="polite" className={className}><Icon name={copied === 'ok' ? 'check' : 'copy'} className="size-4" />{mcpLabel}</button>;
  useEffect(() => {
    const check = () => setUser(getUser());
    window.addEventListener('storage', check);
    window.addEventListener('loginStatusChanged', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('loginStatusChanged', check);
    };
  }, []);
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const escape = (e) => { if (e.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [menuOpen]);
  const navClass = ({ isActive }) => `flex min-h-10 items-center rounded-full px-4 text-sm transition-colors ${isActive ? 'bg-primary-light font-semibold text-primary' : 'font-medium text-subtext-light hover:bg-background-light hover:text-text-main'}`;
  return (
    <header className="sticky top-0 z-30 border-b border-border-light bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-5 px-4 sm:px-7 lg:px-10">
        <Logo />
        <nav className="hidden items-center gap-1 xl:flex" aria-label="주 메뉴">
          {NAV_ITEMS.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>{item.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-3 xl:flex">
          {mcpButton('inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-light px-4 text-sm font-medium text-subtext-light hover:text-primary')}
          {user ? <><Link to="/mypage/analyses" className="text-sm font-medium text-subtext-light hover:text-primary">내 분석</Link><button onClick={() => navigate('/mypage')} aria-label="내 계정" className="rounded-full"><Avatar name={user.name} /></button></> : <Link to="/login" className="button-primary !min-h-10 !px-4">로그인<Icon className="size-4" /></Link>}
        </div>
        <button ref={menuButton} className="flex size-11 items-center justify-center rounded-xl border border-border-light xl:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={menuOpen} aria-controls="mobile-navigation"><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
      {menuOpen && <nav id="mobile-navigation" className="border-t border-line bg-white px-4 py-4 xl:hidden" aria-label="모바일 주 메뉴">
        <div className="grid gap-1">{NAV_ITEMS.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>{item.label}</NavLink>)}</div>
        <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">{mcpButton('button-secondary gap-2')}<Link to="/mypage/analyses" className="button-secondary">내 분석</Link><Link to={user ? '/mypage' : '/login'} className="button-primary">{user ? '내 계정' : '로그인'}</Link></div>
      </nav>}
    </header>
  );
}
