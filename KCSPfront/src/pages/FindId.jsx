import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/api';
import AuthLayout from '../components/AuthLayout';
import { TextField, FormError, SubmitButton } from '../components/FormField';
import { RULES } from '../validation';

export default function FindId() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // null = 아직 안 찾음, [] = 없음, [...] = 찾은 아이디(일부 가림)
  const [ids, setIds] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
    if (ids) setIds(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = RULES.fullname(formData.name) || RULES.email(formData.email);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    try {
      const res = await api.findId(formData.name.trim(), formData.email.trim());
      setIds(res.ids ?? []);
    } catch {
      setError('아이디를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="아이디 찾기" subtitle="가입할 때 입력한 이름과 이메일을 입력하세요.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <TextField label="이름" id="name" value={formData.name} onChange={handleChange} placeholder="예: 김농부" autoComplete="name" />
        <TextField label="이메일" id="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" />
        <FormError>{error}</FormError>
        <SubmitButton loading={loading} loadingText="찾는 중...">아이디 찾기</SubmitButton>
      </form>

      {ids && (
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary-light p-4" role="status">
          {ids.length === 0 ? (
            <p className="text-sm text-text-main">입력한 이름과 이메일로 가입한 계정이 없습니다.</p>
          ) : (
            <>
              <p className="text-sm text-subtext-light mb-2">가입한 아이디 (일부는 가려서 보여드려요)</p>
              <ul className="space-y-1">
                {ids.map((id) => (
                  <li key={id} className="text-lg font-bold text-primary tracking-wide">{id}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="mt-8 flex justify-center gap-4 text-sm">
        <Link to="/login" className="font-bold text-primary hover:underline">로그인</Link>
        <span className="text-gray-300">|</span>
        <Link to="/reset-password" className="font-bold text-primary hover:underline">비밀번호 재설정</Link>
      </p>
    </AuthLayout>
  );
}
