// 계정 입력 규칙. 서버 규칙(KCSPback SignupValidator)과 같게 유지할 것 — 서버가 최종 판정한다.
// 각 함수는 문제가 없으면 '' , 있으면 안내 문구를 돌려준다
export const RULES = {
  fullname: (v) => (v.trim().length >= 1 && v.trim().length <= 20 ? '' : '이름은 1~20자로 입력해 주세요.'),
  username: (v) => (/^[a-z0-9_]{4,20}$/.test(v) ? '' : '영문 소문자·숫자·밑줄(_)로 4~20자'),
  email: (v) => (v.trim().length <= 50 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : '올바른 이메일 주소를 입력해 주세요.'),
  password: (v) => (v.length >= 8 && v.length <= 64 && /[A-Za-z]/.test(v) && /[0-9]/.test(v) ? '' : '영문과 숫자를 섞어 8자 이상'),
};

export const confirmProblem = (password, confirm) =>
  confirm && confirm === password ? '' : '비밀번호가 일치하지 않습니다.';
