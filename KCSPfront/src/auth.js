// 로그인 상태는 이 모듈로만 읽고 쓴다.
// 토큰(JWT)은 서버가 로그인 성공 시 발급하며, 쓰기 요청마다 Authorization 헤더로 보낸다.
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// 토큰 본문의 exp(초)만 읽는다. 서명 검증은 서버가 한다
function isExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function notify() {
  window.dispatchEvent(new Event('loginStatusChanged'));
}

export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isExpired(token)) {
    clearLogin();
    return null;
  }
  return token;
}

export function getUser() {
  if (!getToken()) return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return getToken() !== null;
}

export function saveLogin(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem('isLoggedIn'); // 토큰 도입 전 방식의 흔적
  notify();
}

export function clearLogin() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('isLoggedIn');
  notify();
}

// 로그인 후 돌아갈 경로. 외부 주소로 튕기지 않도록 사이트 안 경로만 허용한다
export function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function loginPath(next) {
  return `/login?next=${encodeURIComponent(next)}`;
}
