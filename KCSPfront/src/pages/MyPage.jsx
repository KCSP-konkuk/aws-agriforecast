import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MyPageSidebar from '../components/MyPageSidebar';
import { TextField, PasswordField } from '../components/FormField';
import { api } from '../api/api';
import { getUser, clearLogin, loginPath, updateStoredUser } from '../auth';
import { RULES, confirmProblem } from '../validation';

// 섹션마다 결과 문구 { tone: 'success' | 'error', text }
function Result({ result }) {
  if (!result) return null;
  return (
    <p className={`text-sm ${result.tone === 'success' ? 'text-primary' : 'text-red-600'}`} role="status">{result.text}</p>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="flex flex-col gap-5 border-t border-border-light pt-8 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-xl font-bold text-text-main">{title}</h3>
        {description && <p className="text-sm text-subtext-light mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const buttonClass = 'h-11 px-5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export default function MyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getUser());

  const [name, setName] = useState(user?.name ?? '');
  const [nameResult, setNameResult] = useState(null);
  const [savingName, setSavingName] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwTouched, setPwTouched] = useState({});
  const [pwResult, setPwResult] = useState(null);
  const [pwField, setPwField] = useState(null);
  const [savingPw, setSavingPw] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPw, setWithdrawPw] = useState('');
  const [withdrawResult, setWithdrawResult] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // 로그인이 풀렸으면(만료·탈퇴) 로그인 후 다시 마이페이지로
  const toLogin = () => navigate(loginPath('/mypage'), { replace: true });

  useEffect(() => {
    if (!getUser()) {
      toLogin();
      return;
    }
    // 저장된 표시용 정보 대신 서버의 최신 정보
    api.getMe()
      .then((me) => {
        setUser(me);
        setName(me.name ?? '');
        updateStoredUser({ name: me.name, email: me.email });
      })
      .catch((err) => { if (err.needsLogin) toLogin(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    clearLogin();
    navigate('/');
  };

  const fail = (err, setResult) => {
    if (err.needsLogin) toLogin();
    else setResult({ tone: 'error', text: err.message });
  };

  const saveName = async (e) => {
    e.preventDefault();
    const problem = RULES.fullname(name);
    if (problem) return setNameResult({ tone: 'error', text: problem });
    setSavingName(true);
    try {
      const res = await api.updateProfile(name.trim());
      updateStoredUser({ name: name.trim() });
      setUser((u) => ({ ...u, name: name.trim() }));
      setNameResult({ tone: 'success', text: res.message });
    } catch (err) {
      fail(err, setNameResult);
    } finally {
      setSavingName(false);
    }
  };

  const pwErrors = {
    next: RULES.password(pw.next) || (pw.next && pw.next === pw.current ? '현재 비밀번호와 다른 비밀번호를 입력해 주세요.' : ''),
    confirm: confirmProblem(pw.next, pw.confirm),
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwTouched({ next: true, confirm: true });
    setPwField(null);
    if (!pw.current) return setPwResult({ tone: 'error', text: '현재 비밀번호를 입력해 주세요.' });
    if (pwErrors.next || pwErrors.confirm) return setPwResult(null);
    setSavingPw(true);
    try {
      const res = await api.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setPwTouched({});
      setPwResult({ tone: 'success', text: res.message });
    } catch (err) {
      setPwField(err.field === 'currentPassword' ? 'current' : err.field === 'newPassword' ? 'next' : null);
      fail(err, setPwResult);
    } finally {
      setSavingPw(false);
    }
  };

  const pwState = (key) => {
    if (pwField === key && pwResult?.tone === 'error') return { invalid: true };
    if (pwTouched[key] && pwErrors[key]) return { invalid: true, message: pwErrors[key] };
    if (key === 'next') return { message: RULES.password(''), tone: 'info' };
    return {};
  };

  const withdraw = async (e) => {
    e.preventDefault();
    if (!withdrawPw) return setWithdrawResult({ tone: 'error', text: '비밀번호를 입력해 주세요.' });
    setWithdrawing(true);
    try {
      await api.withdraw(withdrawPw);
      clearLogin();
      navigate('/login?withdrawn=1', { replace: true });
    } catch (err) {
      fail(err, setWithdrawResult);
      setWithdrawing(false);
    }
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="flex flex-1 justify-center py-5 sm:py-10 px-4 sm:px-6 lg:px-10">
        <div className="flex w-full max-w-6xl flex-1 flex-col lg:flex-row gap-8">
          <MyPageSidebar user={user} onLogout={handleLogout} />

          <main className="flex-1 min-w-0">
            <div className="bg-white p-6 sm:p-8 rounded-lg border border-border-light flex flex-col gap-8">
              <div className="pb-2">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-text-main">계정 정보</h2>
                <p className="text-base text-subtext-light mt-1">이름과 비밀번호를 바꾸거나 탈퇴할 수 있습니다.</p>
              </div>

              <Section title="프로필">
                <form onSubmit={saveName} className="flex flex-col gap-4" noValidate>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField label="아이디" id="account-id" value={user.id ?? ''} disabled readOnly />
                    <TextField label="이메일" id="account-email" value={user.email ?? ''} disabled readOnly />
                    <TextField label="이름" id="account-name" value={name} maxLength={20}
                      onChange={(e) => { setName(e.target.value); setNameResult(null); }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" className={buttonClass} disabled={savingName || name.trim() === (user.name ?? '')}>
                      {savingName ? '저장 중...' : '이름 저장'}
                    </button>
                    <Result result={nameResult} />
                  </div>
                </form>
              </Section>

              <Section title="비밀번호 변경">
                <form onSubmit={changePassword} className="flex flex-col gap-4" noValidate>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PasswordField label="현재 비밀번호" id="current" value={pw.current} autoComplete="current-password"
                      onChange={(e) => { setPw({ ...pw, current: e.target.value }); setPwResult(null); }} {...pwState('current')} />
                    <div className="hidden md:block" />
                    <PasswordField label="새 비밀번호" id="next" value={pw.next} autoComplete="new-password"
                      onChange={(e) => { setPw({ ...pw, next: e.target.value }); setPwResult(null); }}
                      onBlur={() => setPwTouched({ ...pwTouched, next: true })} {...pwState('next')} />
                    <PasswordField label="새 비밀번호 확인" id="confirm" value={pw.confirm} autoComplete="new-password"
                      onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); setPwResult(null); }}
                      onBlur={() => setPwTouched({ ...pwTouched, confirm: true })} {...pwState('confirm')} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" className={buttonClass} disabled={savingPw}>{savingPw ? '변경 중...' : '비밀번호 변경'}</button>
                    <Result result={pwResult} />
                  </div>
                </form>
              </Section>

              <Section title="계정 탈퇴" description="탈퇴하면 이 아이디로 다시 로그인할 수 없습니다. 작성한 글과 댓글은 남습니다.">
                {!withdrawOpen ? (
                  <div>
                    <button type="button" onClick={() => setWithdrawOpen(true)}
                      className="h-11 px-5 rounded-lg border border-red-300 text-red-600 text-sm font-bold hover:bg-red-50">
                      탈퇴하기
                    </button>
                  </div>
                ) : (
                  <form onSubmit={withdraw} className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50/50 p-4" noValidate>
                    <p className="text-sm text-text-main font-semibold">정말 탈퇴할까요? 확인을 위해 비밀번호를 입력해 주세요.</p>
                    <div className="max-w-sm">
                      <PasswordField label="비밀번호" id="withdraw-password" value={withdrawPw} autoComplete="current-password"
                        onChange={(e) => { setWithdrawPw(e.target.value); setWithdrawResult(null); }} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" disabled={withdrawing}
                        className="h-11 px-5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                        {withdrawing ? '처리 중...' : '탈퇴'}
                      </button>
                      <button type="button" onClick={() => { setWithdrawOpen(false); setWithdrawPw(''); setWithdrawResult(null); }}
                        className="h-11 px-5 rounded-lg bg-white border border-border-light text-sm font-semibold text-text-main hover:bg-background-light">
                        취소
                      </button>
                      <Result result={withdrawResult} />
                    </div>
                  </form>
                )}
              </Section>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
