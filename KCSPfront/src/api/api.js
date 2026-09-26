import { getToken, clearLogin } from '../auth';

// API 기본 설정
const API_BASE_URL = '/api';

// 로그인 토큰을 붙인 요청 헤더
const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

// 로그인이 필요한 요청(글·댓글 쓰기/수정/삭제). 401 이면 남은 로그인 정보를 지우고
// needsLogin 표시가 붙은 오류를 던져 화면이 로그인 안내를 띄울 수 있게 한다
const authorizedRequest = async (url, options, fallbackMessage) => {
  const response = await fetch(url, { ...options, headers: getHeaders() });
  if (response.ok) {
    return response.status === 204 ? null : response.json();
  }
  let message = fallbackMessage;
  try {
    const body = await response.json();
    if (body?.message) message = body.message;
  } catch {
    // 본문이 없거나 JSON 이 아니면 기본 문구
  }
  const error = new Error(response.status === 401 ? '로그인이 필요합니다. 다시 로그인해 주세요.' : message);
  if (response.status === 401) {
    clearLogin();
    error.needsLogin = true;
  }
  throw error;
};

// API 호출 함수
export const api = {
  // 로그인
  login: async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '로그인에 실패했습니다.');
    }

    return await response.json();
  },

  // 회원가입
  signup: async (username, password, fullname, email) => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        fullname,
        email,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || '회원가입에 실패했습니다.');
      error.field = data.field;
      throw error;
    }

    return data;
  },

  // 아이디 사용 가능 여부 { success, message }
  checkUsername: async (username) => {
    const response = await fetch(`${API_BASE_URL}/auth/check-username?username=${encodeURIComponent(username)}`);
    if (!response.ok) throw new Error('아이디 확인에 실패했습니다.');
    return response.json();
  },

  // ========== 커뮤니티 API ==========
  
  // 게시글 목록 조회 (전체)
  getPosts: async (page = 0, size = 10) => {
    try {
      const response = await fetch(`${API_BASE_URL}/community/posts?page=${page}&size=${size}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 에러 응답:', response.status, errorText);
        throw new Error(`서버 에러 (${response.status}): ${errorText}`);
      }
      return await response.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('서버에 연결할 수 없습니다. BackEnd 서버가 실행 중인지 확인해주세요.');
      }
      throw err;
    }
  },

  // 게시글 목록 조회 (카테고리별)
  getPostsByCategory: async (category, page = 0, size = 10) => {
    try {
      const response = await fetch(`${API_BASE_URL}/community/posts/category/${encodeURIComponent(category)}?page=${page}&size=${size}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 에러 응답:', response.status, errorText);
        throw new Error(`서버 에러 (${response.status}): ${errorText}`);
      }
      return await response.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('서버에 연결할 수 없습니다. BackEnd 서버가 실행 중인지 확인해주세요.');
      }
      throw err;
    }
  },

  // 게시글 상세 조회
  getPost: async (id) => {
    const response = await fetch(`${API_BASE_URL}/community/posts/${id}`);
    if (!response.ok) {
      throw new Error('게시글을 불러오는데 실패했습니다.');
    }
    return await response.json();
  },

  // 게시글 작성
  createPost: (title, category, content) =>
    authorizedRequest(`${API_BASE_URL}/community/posts`,
      { method: 'POST', body: JSON.stringify({ title, category, content }) }, '게시글 작성에 실패했습니다.'),

  // 게시글 수정
  updatePost: (id, title, category, content) =>
    authorizedRequest(`${API_BASE_URL}/community/posts/${id}`,
      { method: 'PUT', body: JSON.stringify({ title, category, content }) }, '게시글 수정에 실패했습니다.'),

  // 게시글 삭제
  deletePost: (id) =>
    authorizedRequest(`${API_BASE_URL}/community/posts/${id}`, { method: 'DELETE' }, '게시글 삭제에 실패했습니다.'),

  // 댓글 목록 조회
  getComments: async (postId) => {
    const response = await fetch(`${API_BASE_URL}/community/posts/${postId}/comments`);
    if (!response.ok) {
      throw new Error('댓글 목록을 불러오는데 실패했습니다.');
    }
    return await response.json();
  },

  // 댓글 작성
  createComment: (postId, content) =>
    authorizedRequest(`${API_BASE_URL}/community/posts/${postId}/comments`,
      { method: 'POST', body: JSON.stringify({ content }) }, '댓글 작성에 실패했습니다.'),

  // 댓글 수정
  updateComment: (id, content) =>
    authorizedRequest(`${API_BASE_URL}/community/comments/${id}`,
      { method: 'PUT', body: JSON.stringify({ content }) }, '댓글 수정에 실패했습니다.'),

  // 댓글 삭제
  deleteComment: (id) =>
    authorizedRequest(`${API_BASE_URL}/community/comments/${id}`, { method: 'DELETE' }, '댓글 삭제에 실패했습니다.'),

  // ========== 가격 API ==========

  // 네이버 농산물 뉴스 조회
  getAgriNews: async () => {
    const response = await fetch(`${API_BASE_URL}/news/agri`);
    if (!response.ok) {
      throw new Error('뉴스를 불러오는데 실패했습니다.');
    }
    return await response.json();
  },

  // KAMIS 주요 농산물 일일 가격 조회
  getDailyPrices: async () => {
    const response = await fetch(`${API_BASE_URL}/price/daily`);
    if (!response.ok) {
      throw new Error('일일 가격 데이터를 불러오는데 실패했습니다.');
    }
    return await response.json();
  },

  // 모든 품목 목록 조회
  getItems: async () => {
    const response = await fetch(`${API_BASE_URL}/price/items`);
    if (!response.ok) {
      throw new Error('품목 목록을 불러오는데 실패했습니다.');
    }
    return await response.json();
  },
  
  // 카테고리별 품목 목록 조회
  getItemsByCategory: async (category) => {
    const response = await fetch(`${API_BASE_URL}/price/items/category/${category}`);
    if (!response.ok) {
      throw new Error('품목 목록을 불러오는데 실패했습니다.');
    }
    return await response.json();
  },
  
  // 특정 품목의 등급 목록 조회
  getGradesByItemCode: async (itemCode) => {
    const response = await fetch(`${API_BASE_URL}/price/items/${itemCode}/grades`);
    if (!response.ok) {
      throw new Error('등급 목록을 불러오는데 실패했습니다.');
    }
    return await response.json();
  },
  
  // agri_price 테이블 품목 목록 조회 (배추·양파·양배추·당근)
  getAgriItems: async () => {
    const response = await fetch(`${API_BASE_URL}/price/agri/items`);
    if (!response.ok) throw new Error('품목 목록을 불러오는데 실패했습니다.');
    return await response.json();
  },

  // 품목별 AI 예측가 조회 (onion/cabbage/carrot/head_cabbage predictions 테이블)
  getPredictions: async (itemName) => {
    const response = await fetch(
      `${API_BASE_URL}/price/agri/predictions?itemName=${encodeURIComponent(itemName)}`
    );
    if (!response.ok) throw new Error('예측 데이터를 불러오는데 실패했습니다.');
    return await response.json();
  },

  // agri_price 테이블 기반 가격 그래프 조회
  getAgriPriceGraph: async (itemName, startDate, endDate) => {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr   = endDate.toISOString().split('T')[0];
    const response = await fetch(
      `${API_BASE_URL}/price/agri/graph?itemName=${encodeURIComponent(itemName)}&startDate=${startStr}&endDate=${endStr}`
    );
    if (!response.ok) throw new Error('가격 데이터를 불러오는데 실패했습니다.');
    return await response.json();
  },

  // 가격 그래프 데이터 조회
  getPriceGraph: async (itemCode, startDate, endDate, grade = '전체') => {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const response = await fetch(
      `${API_BASE_URL}/price/graph?itemCode=${itemCode}&startDate=${startStr}&endDate=${endStr}&grade=${encodeURIComponent(grade)}`
    );
    if (!response.ok) {
      throw new Error('가격 그래프 데이터를 불러오는데 실패했습니다.');
    }
    return await response.json();
  },
};


