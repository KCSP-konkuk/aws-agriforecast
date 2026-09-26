import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/api';
import AuthLayout from '../components/AuthLayout';
import { TextField, PasswordField, FormError, SubmitButton } from '../components/FormField';

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullname: '',
    username: '',
    email: '',
    password: '',
    confirm: ''
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
    if (!formData.fullname || !formData.username || !formData.email || !formData.password) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (formData.password !== formData.confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // API 호출
      const response = await api.signup(
        formData.username,
        formData.password,
        formData.fullname,
        formData.email
      );

      if (response.success) {
        // 회원가입 성공
        alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
        navigate('/login');
      } else {
        setError(response.message || '회원가입에 실패했습니다.');
      }
    } catch (err) {
      console.error('회원가입 에러:', err);
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="회원가입" subtitle="몇 가지 정보만 입력하면 바로 시작할 수 있어요.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField label="이름" id="fullname" value={formData.fullname} onChange={handleChange} placeholder="예: 김농부" required />
        <TextField label="아이디" id="username" value={formData.username} onChange={handleChange} placeholder="아이디를 입력하세요" required />
        <TextField label="이메일" id="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" required />
        <PasswordField label="비밀번호" id="password" value={formData.password} onChange={handleChange} placeholder="6자 이상 입력하세요" required />
        <PasswordField label="비밀번호 확인" id="confirm" invalid={!!error} value={formData.confirm} onChange={handleChange} placeholder="비밀번호를 다시 입력하세요" required />
        <FormError>{error}</FormError>
        <SubmitButton loading={loading} loadingText="회원가입 중...">회원가입</SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-subtext-light">
        이미 계정이 있으신가요?
        <Link to="/login" className="font-bold text-primary hover:underline ml-1">로그인</Link>
      </p>
    </AuthLayout>
  );
}
