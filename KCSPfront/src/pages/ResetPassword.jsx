import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';
import AuthLayout from '../components/AuthLayout';
import { TextField, PasswordField, FormError, SubmitButton } from '../components/FormField';
import { RULES, confirmProblem } from '../validation';

const RESEND_SECONDS = 60;

// 비밀번호 재설정: ① 아이디·이메일 → 메일로 6자리 코드 ② 코드 + 새 비밀번호
export default function ResetPassword() {
  const navigate = useNavigate();
  // null = 확인 중, false = 메일 발송 미설정
  const [available, setAvailable] = useState(null);
  const [step, setStep] = useState('request');
  const [form, setForm] = useState({ username: '', email: '', code: '', newPassword: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState({ field: null, message: '' });
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    api.passwordResetAvailable().then((r) => setAvailable(!!r.available)).catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error.message) setError({ field: null, message: '' });
  };
  const handleBlur = (e) => setTouched({ ...touched, [e.target.name]: true });

  const sendCode = async (e) => {
    e?.preventDefault();
    if (!form.username.trim() || RULES.email(form.email)) {
      setError({ field: null, message: '아이디와 가입한 이메일을 입력해 주세요.' });
      return;
    }
    setLoading(true);
    const res = await api.requestPasswordReset(form.username.trim(), form.email.trim());
    setLoading(false);
    if (res.success) {
      setNotice(res.message);
      setStep('confirm');
      setCooldown(RESEND_SECONDS);
    } else {
      setError({ field: res.field ?? null, message: res.message });
    }
  };

  const passwordError = RULES.password(form.newPassword);
  const confirmError = confirmProblem(form.newPassword, form.confirm);

  const confirm = async (e) => {
    e.preventDefault();
    setTouched({ newPassword: true, confirm: true });
    if (!/^\d{6}$/.test(form.code.trim())) {
      setError({ field: 'code', message: '메일로 받은 6자리 숫자를 입력해 주세요.' });
      return;
    }
    if (passwordError || confirmError) return;
    setLoading(true);
    const res = await api.confirmPasswordReset(form.username.trim(), form.code.trim(), form.newPassword);
    setLoading(false);
    if (res.success) {
      navigate('/login?reset=1', { replace: true });
    } else {
      setError({ field: res.field ?? null, message: res.message });
    }
  };

  const fieldError = (name, ruleError) => {
    if (error.field === name) return { invalid: true, message: error.message };
    if (touched[name] && ruleError) return { invalid: true, message: ruleError };
    return {};
  };
  // 새 비밀번호: 틀리기 전에는 규칙을 회색 안내로
  const newPasswordState = fieldError('newPassword', passwordError).message
    ? fieldError('newPassword', passwordError)
    : { message: RULES.password(''), tone: 'info' };

  return (
    <AuthLayout title="비밀번호 재설정" subtitle="가입한 이메일로 인증 코드를 보내 드려요.">
      {available === false ? (
        <div className="rounded-lg border border-border-light bg-white p-5 text-sm text-text-main" role="status">
          <p className="font-semibold">지금은 비밀번호 재설정 메일을 보낼 수 없어요.</p>
          <p className="mt-1 text-subtext-light">메일 발송을 준비 중입니다. 급하시면 관리자에게 문의해 주세요.</p>
        </div>
      ) : step === 'request' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-5" noValidate>
          <TextField label="아이디" id="username" value={form.username} onChange={handleChange} placeholder="아이디를 입력하세요" autoComplete="username" />
          <TextField label="가입한 이메일" id="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" />
          <FormError>{error.message}</FormError>
          <SubmitButton loading={loading || available === null} loadingText={available === null ? '확인 중...' : '보내는 중...'}>인증 코드 받기</SubmitButton>
        </form>
      ) : (
        <form onSubmit={confirm} className="flex flex-col gap-5" noValidate>
          <p className="rounded-lg border border-primary/20 bg-primary-light px-4 py-3 text-sm text-text-main" role="status">{notice}</p>
          <TextField label="인증 코드" id="code" value={form.code} onChange={handleChange} placeholder="6자리 숫자" inputMode="numeric" maxLength={6} autoComplete="one-time-code" {...fieldError('code', '')} />
          <PasswordField label="새 비밀번호" id="newPassword" value={form.newPassword} onChange={handleChange} onBlur={handleBlur} placeholder="새 비밀번호를 입력하세요" autoComplete="new-password"
{...newPasswordState} />
          <PasswordField label="새 비밀번호 확인" id="confirm" value={form.confirm} onChange={handleChange} onBlur={handleBlur} placeholder="새 비밀번호를 다시 입력하세요" autoComplete="new-password" {...fieldError('confirm', confirmError)} />
          <FormError>{error.field ? '' : error.message}</FormError>
          <SubmitButton loading={loading} loadingText="바꾸는 중...">비밀번호 재설정</SubmitButton>
          <button
            type="button"
            onClick={() => sendCode()}
            disabled={cooldown > 0 || loading}
            className="text-sm text-primary font-semibold hover:underline disabled:text-subtext-light disabled:no-underline"
          >
            {cooldown > 0 ? `코드 다시 받기 (${cooldown}초 후)` : '코드 다시 받기'}
          </button>
        </form>
      )}

      <p className="mt-8 flex justify-center gap-4 text-sm">
        <Link to="/login" className="font-bold text-primary hover:underline">로그인</Link>
        <span className="text-gray-300">|</span>
        <Link to="/find-id" className="font-bold text-primary hover:underline">아이디 찾기</Link>
      </p>
    </AuthLayout>
  );
}
