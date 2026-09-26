import { Link } from 'react-router-dom';
import { useState } from 'react';
import AuthLayout from '../components/AuthLayout';
import { TextField, FormError, SubmitButton } from '../components/FormField';

export default function FindId() {
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  });
  const [foundId, setFoundId] = useState('');
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(false);

  // 샘플 데이터 (DB 대신 임시 하드코딩)
  const mockAccounts = [
    { name: 'Jane Doe', email: 'jane@example.com', id: 'jane123' },
    { name: 'John Smith', email: 'john@abc.com', id: 'john_smith89' },
    { name: '김상혁', email: 'shpark@example.com', id: 'sanghyuk01' }
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
    if (showResult) setShowResult(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const nameVal = formData.name.trim();
    const emailVal = formData.email.trim();

    const user = mockAccounts.find(
      acc => acc.name === nameVal && acc.email === emailVal
    );

    if (user) {
      setFoundId(user.id);
      setShowResult(true);
      setError('');
    } else {
      setShowResult(false);
      setError('해당 정보로 등록된 계정을 찾을 수 없습니다.');
    }
  };

  return (
    <AuthLayout title="아이디 찾기" subtitle="가입할 때 입력한 이름과 이메일을 입력하세요.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <TextField label="이름" id="name" value={formData.name} onChange={handleChange} placeholder="예: 김농부" required />
        <TextField label="이메일" id="email" type="email" invalid={!!error} value={formData.email} onChange={handleChange} placeholder="you@example.com" required />
        <FormError>{error}</FormError>
        <SubmitButton>아이디 찾기</SubmitButton>
      </form>

      {showResult && (
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary-light p-4 text-center">
          <p className="text-text-main">
            아이디: <strong className="text-primary text-lg">{foundId}</strong>
          </p>
        </div>
      )}

      <p className="mt-8 text-center text-sm">
        <Link to="/login" className="font-bold text-primary hover:underline">로그인 화면으로</Link>
      </p>
    </AuthLayout>
  );
}
