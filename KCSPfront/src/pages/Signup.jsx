import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api/api';

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullname: '',
    username: '',
    email: '',
    password: '',
    confirm: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    <div className="font-display bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center p-6">
      <div className="signup-container bg-white dark:bg-gray-800 rounded-lg shadow-lg p-10 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-6 text-charcoal-gray dark:text-text-light">AgriForecaster</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullname" className="text-charcoal-gray dark:text-text-light">이름</label>
            <input
              type="text"
              id="fullname"
              name="fullname"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., 김농부"
              value={formData.fullname}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="username" className="text-charcoal-gray dark:text-text-light">아이디</label>
            <input
              type="text"
              id="username"
              name="username"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="아이디를 입력하세요"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="text-charcoal-gray dark:text-text-light">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group relative">
            <label htmlFor="password" className="text-charcoal-gray dark:text-text-light">비밀번호</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="비밀번호를 입력하세요"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <span
              className="absolute right-4 top-10 cursor-pointer text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              👁️
            </span>
          </div>

          <div className="form-group relative">
            <label htmlFor="confirm" className="text-charcoal-gray dark:text-text-light">비밀번호 확인</label>
            <input
              type={showConfirm ? 'text' : 'password'}
              id="confirm"
              name="confirm"
              className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary ${
                error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="비밀번호를 다시 입력하세요"
              value={formData.confirm}
              onChange={handleChange}
              required
            />
            <span
              className="absolute right-4 top-10 cursor-pointer text-gray-500"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              👁️
            </span>
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-brand hover:bg-green-brand-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
          >
            {loading ? '회원가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-muted-blue hover:underline">이미 계정이 있으신가요? 로그인</Link>
        </div>
      </div>
    </div>
  );
}



