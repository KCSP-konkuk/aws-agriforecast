import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../api/api';
import AuthLayout from '../components/AuthLayout';
import { TextField, PasswordField, FormError, SubmitButton } from '../components/FormField';

// 서버 규칙(KCSPback SignupValidator)과 같게 유지할 것. 서버가 최종 판정한다
const RULES = {
  fullname: (v) => (v.trim().length >= 1 && v.trim().length <= 20 ? '' : '이름은 1~20자로 입력해 주세요.'),
  username: (v) => (/^[a-z0-9_]{4,20}$/.test(v) ? '' : '영문 소문자·숫자·밑줄(_)로 4~20자'),
  email: (v) => (v.trim().length <= 50 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : '올바른 이메일 주소를 입력해 주세요.'),
  password: (v) => (v.length >= 8 && v.length <= 64 && /[A-Za-z]/.test(v) && /[0-9]/.test(v) ? '' : '영문과 숫자를 섞어 8자 이상'),
};

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const [formData, setFormData] = useState({ fullname: '', username: '', email: '', password: '', confirm: '' });
  // 한 번이라도 벗어난(또는 제출 시도한) 칸만 오류를 보여준다
  const [touched, setTouched] = useState({});
  // 아이디 중복 확인: idle | checking | available | taken | error
  const [usernameCheck, setUsernameCheck] = useState({ status: 'idle', message: '' });
  const [serverError, setServerError] = useState({ field: null, message: '' });
  const [loading, setLoading] = useState(false);

  const errors = {
    fullname: RULES.fullname(formData.fullname),
    username: RULES.username(formData.username),
    email: RULES.email(formData.email),
    password: RULES.password(formData.password),
    confirm: formData.confirm && formData.confirm === formData.password ? '' : '비밀번호가 일치하지 않습니다.',
  };

  // 아이디 규칙이 맞으면 입력을 멈춘 뒤 서버에 사용 가능 여부를 묻는다
  useEffect(() => {
    if (errors.username) {
      setUsernameCheck({ status: 'idle', message: '' });
      return;
    }
    setUsernameCheck({ status: 'checking', message: '확인 중...' });
    let cancelled = false;
    const timer = setTimeout(() => {
      api.checkUsername(formData.username)
        .then((res) => {
          if (!cancelled) setUsernameCheck({ status: res.success ? 'available' : 'taken', message: res.message });
        })
        .catch(() => {
          if (!cancelled) setUsernameCheck({ status: 'error', message: '아이디를 확인하지 못했습니다. 가입할 때 다시 확인합니다.' });
        });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.username, errors.username]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (serverError.message) setServerError({ field: null, message: '' });
  };

  const handleBlur = (e) => setTouched({ ...touched, [e.target.name]: true });

  // 칸 아래 문구와 테두리 색
  const fieldState = (name) => {
    if (serverError.field === name) return { invalid: true, message: serverError.message };
    if (name === 'username' && !errors.username) {
      const { status, message } = usernameCheck;
      return { invalid: status === 'taken', message, tone: status === 'available' ? 'success' : status === 'taken' ? 'error' : 'info' };
    }
    if (touched[name] && errors[name]) return { invalid: true, message: errors[name] };
    // 아직 틀렸다고 하기 전에는 규칙을 회색 안내로 보여준다
    if (name === 'username' || name === 'password') return { message: RULES[name](''), tone: 'info' };
    return {};
  };

  const hasError = Object.values(errors).some(Boolean) || usernameCheck.status === 'taken' || usernameCheck.status === 'checking';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ fullname: true, username: true, email: true, password: true, confirm: true });
    if (hasError) return;

    setLoading(true);
    try {
      await api.signup(formData.username, formData.password, formData.fullname.trim(), formData.email.trim());
      const params = new URLSearchParams({ joined: '1' });
      if (next) params.set('next', next);
      navigate(`/login?${params}`, { replace: true });
    } catch (err) {
      setServerError({ field: err.field ?? null, message: err.message || '회원가입 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const bind = (name) => ({ value: formData[name], onChange: handleChange, onBlur: handleBlur, ...fieldState(name) });

  return (
    <AuthLayout title="회원가입" subtitle="몇 가지 정보만 입력하면 바로 시작할 수 있어요.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <TextField label="이름" id="fullname" placeholder="예: 김농부" autoComplete="name" {...bind('fullname')} />
        <TextField label="아이디" id="username" placeholder="예: farmer_01" autoComplete="username" {...bind('username')} />
        <TextField label="이메일" id="email" type="email" placeholder="you@example.com" autoComplete="email" {...bind('email')} />
        <PasswordField label="비밀번호" id="password" placeholder="비밀번호를 입력하세요" autoComplete="new-password" {...bind('password')} />
        <PasswordField label="비밀번호 확인" id="confirm" placeholder="비밀번호를 다시 입력하세요" autoComplete="new-password" {...bind('confirm')} />
        <FormError>{serverError.field ? '' : serverError.message}</FormError>
        <SubmitButton loading={loading} loadingText="가입하는 중...">회원가입</SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-subtext-light">
        이미 계정이 있으신가요?
        <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-bold text-primary hover:underline ml-1">로그인</Link>
      </p>
    </AuthLayout>
  );
}
