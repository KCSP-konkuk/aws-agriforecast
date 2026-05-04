import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function ResetPassword() {
  const [formData, setFormData] = useState({
    username: '',
    current: '',
    new: '',
    confirm: ''
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const togglePassword = (field) => {
    setShowPassword({
      ...showPassword,
      [field]: !showPassword[field]
    });
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
    <div className="font-display bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center p-6">
      <div className="reset-container bg-white dark:bg-gray-800 rounded-lg shadow-lg p-10 w-full max-w-md text-center">
        <h2 className="text-3xl font-bold mb-6 text-charcoal-gray dark:text-text-light">비밀번호 재설정</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group text-left relative">
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

          <div className="form-group text-left relative">
            <label htmlFor="current" className="text-charcoal-gray dark:text-text-light">현재 비밀번호</label>
            <input
              type={showPassword.current ? 'text' : 'password'}
              id="current"
              name="current"
              className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="현재 비밀번호를 입력하세요"
              value={formData.current}
              onChange={handleChange}
              required
            />
            <span
              className="show-password absolute right-4 top-10 cursor-pointer text-gray-500"
              onClick={() => togglePassword('current')}
            >
              👁️
            </span>
          </div>

          <div className="form-group text-left relative">
            <label htmlFor="new" className="text-charcoal-gray dark:text-text-light">새로운 비밀번호</label>
            <input
              type={showPassword.new ? 'text' : 'password'}
              id="new"
              name="new"
              className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="새로운 비밀번호를 입력하세요"
              value={formData.new}
              onChange={handleChange}
              required
            />
            <span
              className="show-password absolute right-4 top-10 cursor-pointer text-gray-500"
              onClick={() => togglePassword('new')}
            >
              👁️
            </span>
          </div>

          <div className="form-group text-left relative">
            <label htmlFor="confirm" className="text-charcoal-gray dark:text-text-light">새로운 비밀번호 확인</label>
            <input
              type={showPassword.confirm ? 'text' : 'password'}
              id="confirm"
              name="confirm"
              className={`w-full px-4 py-3 pr-12 rounded-lg border bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary ${
                error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="새로운 비밀번호를 다시 입력하세요"
              value={formData.confirm}
              onChange={handleChange}
              required
            />
            <span
              className="show-password absolute right-4 top-10 cursor-pointer text-gray-500"
              onClick={() => togglePassword('confirm')}
            >
              👁️
            </span>
            {error && <p className="error-message text-red-600 text-sm mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-green-brand hover:bg-green-brand-light text-white font-bold py-3 rounded-lg transition-colors mt-2"
          >
            비밀번호 재설정
          </button>
        </form>

        <Link 
          to="/login" 
          className="back-login block mt-6 text-muted-blue hover:underline text-sm font-medium"
        >
          로그인 화면으로
        </Link>
      </div>
    </div>
  );
}



