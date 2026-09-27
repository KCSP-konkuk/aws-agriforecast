import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/api';
import AuthLayout from '../components/AuthLayout';
import { TextField, PasswordField, FormError, SubmitButton } from '../components/FormField';
import { saveLogin, safeNext } from '../auth';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  // 다른 화면에서 넘어오며 알려줄 것 (가입·비밀번호 재설정·탈퇴 완료, 로그인 후 돌아갈 화면)
  const banner = searchParams.get('joined') === '1' ? '회원가입이 완료됐어요. 가입한 아이디로 로그인해 주세요.'
    : searchParams.get('reset') === '1' ? '비밀번호를 재설정했어요. 새 비밀번호로 로그인해 주세요.'
    : searchParams.get('withdrawn') === '1' ? '탈퇴가 완료됐어요. 그동안 이용해 주셔서 감사합니다.'
    : next ? '로그인하면 보던 화면으로 돌아갑니다.' : '';
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 입력값 검증
    if (!formData.username || !formData.password) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // API 호출
      const response = await api.login(formData.username, formData.password);

      if (response.success) {
        // 토큰과 화면 표시용 사용자 정보 저장 (헤더는 loginStatusChanged 로 갱신)
        saveLogin(response.token, {
          seqNoA010: response.user.seqNoA010,
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
        });

        // 로그인을 요청한 화면이 있으면 그리로 돌아간다
        navigate(safeNext(next), { replace: true });
      } else {
        setError(response.message || '로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error('로그인 에러:', err);
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="로그인" subtitle="AgriForecast 계정으로 로그인하세요.">
      {banner && (
        <p className="mb-5 rounded-lg border border-primary/20 bg-primary-light px-4 py-3 text-sm text-text-main" role="status">
          {banner}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField label="아이디" id="username" value={formData.username} onChange={handleChange} placeholder="아이디를 입력하세요" required />
        <PasswordField label="비밀번호" id="password" value={formData.password} onChange={handleChange} placeholder="비밀번호를 입력하세요" required />
        <FormError>{error}</FormError>
        <SubmitButton loading={loading} loadingText="로그인 중...">로그인</SubmitButton>
      </form>

      <div className="mt-8 text-center text-sm space-y-3">
        <p className="text-subtext-light">
          아직 회원이 아니신가요?
          <Link className="font-bold text-primary hover:underline ml-1" to={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}>회원가입</Link>
        </p>
        <div className="flex justify-center gap-4">
          <Link className="font-bold text-primary hover:underline" to="/find-id">아이디 찾기</Link>
          <span className="text-gray-300">|</span>
          <Link className="font-bold text-primary hover:underline" to="/reset-password">비밀번호 재설정</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
