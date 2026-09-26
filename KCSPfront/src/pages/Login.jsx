import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/api';
import AuthLayout from '../components/AuthLayout';
import { TextField, PasswordField, FormError, SubmitButton } from '../components/FormField';

export default function Login() {
  const navigate = useNavigate();
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
        // 로그인 성공
        console.log('로그인 성공:', response.user);
        
        // 로그인 상태 저장
        const userData = {
          seqNoA010: response.user.seqNoA010,
          id: response.user.id,
          name: response.user.name,
          email: response.user.email
        };
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');
        
        // 헤더 업데이트를 위한 커스텀 이벤트 발생
        window.dispatchEvent(new Event('loginStatusChanged'));
        
        // 홈 페이지로 이동
        navigate('/');
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField label="아이디" id="username" value={formData.username} onChange={handleChange} placeholder="아이디를 입력하세요" required />
        <PasswordField label="비밀번호" id="password" value={formData.password} onChange={handleChange} placeholder="비밀번호를 입력하세요" required />
        <FormError>{error}</FormError>
        <SubmitButton loading={loading} loadingText="로그인 중...">로그인</SubmitButton>
      </form>

      <div className="mt-8 text-center text-sm space-y-3">
        <p className="text-subtext-light">
          아직 회원이 아니신가요?
          <Link className="font-bold text-primary hover:underline ml-1" to="/signup">회원가입</Link>
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
