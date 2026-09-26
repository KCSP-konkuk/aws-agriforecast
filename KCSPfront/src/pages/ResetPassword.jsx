import { Link } from 'react-router-dom';
import { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { TextField, PasswordField, FormError, SubmitButton } from '../components/FormField';

export default function ResetPassword() {
  const [formData, setFormData] = useState({
    username: '',
    current: '',
    new: '',
    confirm: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.new !== formData.confirm) {
      setError('입력한 비밀번호가 일치하지 않습니다!');
      return;
    }

    if (formData.new.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    // 비밀번호 재설정 처리
    alert('비밀번호가 성공적으로 변경되었습니다!');
    console.log('Password reset:', formData);
  };

  return (
    <AuthLayout title="비밀번호 재설정" subtitle="현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField label="아이디" id="username" value={formData.username} onChange={handleChange} placeholder="아이디를 입력하세요" required />
        <PasswordField label="현재 비밀번호" id="current" value={formData.current} onChange={handleChange} placeholder="현재 비밀번호를 입력하세요" required />
        <PasswordField label="새로운 비밀번호" id="new" value={formData.new} onChange={handleChange} placeholder="6자 이상 입력하세요" required />
        <PasswordField label="새로운 비밀번호 확인" id="confirm" invalid={!!error} value={formData.confirm} onChange={handleChange} placeholder="새로운 비밀번호를 다시 입력하세요" required />
        <FormError>{error}</FormError>
        <SubmitButton>비밀번호 재설정</SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm">
        <Link to="/login" className="font-bold text-primary hover:underline">로그인 화면으로</Link>
      </p>
    </AuthLayout>
  );
}
