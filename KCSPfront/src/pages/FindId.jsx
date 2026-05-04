import { Link } from 'react-router-dom';
import { useState } from 'react';

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
    <div className="font-display bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center p-6">
      <div className="findid-container bg-white dark:bg-gray-800 rounded-lg shadow-lg p-10 w-full max-w-md text-center">
        <h2 className="text-3xl font-bold mb-2 text-charcoal-gray dark:text-text-light">아이디 찾기</h2>
        <p className="subtitle text-gray-600 dark:text-gray-400 mb-6">이름과 이메일을 입력하세요</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group text-left">
            <label htmlFor="name" className="text-charcoal-gray dark:text-text-light">이름</label>
            <input
              type="text"
              id="name"
              name="name"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., 김농부"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group text-left relative">
            <label htmlFor="email" className="text-charcoal-gray dark:text-text-light">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-charcoal-gray dark:text-text-light focus:outline-none focus:ring-2 focus:ring-primary ${
                error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
            {error && <p className="error-message text-red-600 text-sm mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-green-brand hover:bg-green-brand-light text-white font-bold py-3 rounded-lg transition-colors mt-2"
          >
            아이디 찾기
          </button>
        </form>

        {showResult && (
          <div className="result-box mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg" style={{display: 'block'}}>
            <p className="text-gray-700 dark:text-gray-300">
              아이디: <strong className="text-green-brand text-lg">{foundId}</strong>
            </p>
          </div>
        )}

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

