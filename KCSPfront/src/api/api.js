// API 기본 설정
const API_BASE_URL = '/api';

// 헤더에 사용자 ID 추가하는 헬퍼 함수
const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  const userData = localStorage.getItem('user');
  if (userData) {
    const user = JSON.parse(userData);
    if (user.seqNoA010) {
      headers['X-User-Id'] = user.seqNoA010.toString();
    }
  }
  
  return headers;
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
      throw new Error(data.message || '회원가입에 실패했습니다.');
    }

    return data;
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
  createPost: async (title, category, content) => {
    const response = await fetch(`${API_BASE_URL}/community/posts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title,
        category,
        content,
      }),
    });

    if (!response.ok) {
      let errorMessage = '게시글 작성에 실패했습니다.';
      try {
        const errorText = await response.text();
        if (errorText) {
          const error = JSON.parse(errorText);
          errorMessage = error.message || errorMessage;
        }
      } catch (e) {
        // JSON 파싱 실패 시 기본 메시지 사용
        console.error('에러 응답 파싱 실패:', e);
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  },

  // 게시글 수정
  updatePost: async (id, title, category, content) => {
    const response = await fetch(`${API_BASE_URL}/community/posts/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        title,
        category,
        content,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '게시글 수정에 실패했습니다.');
    }

    return await response.json();
  },

  // 게시글 삭제
  deletePost: async (id) => {
    const response = await fetch(`${API_BASE_URL}/community/posts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error('게시글 삭제에 실패했습니다.');
    }
  },

  // 댓글 목록 조회
  getComments: async (postId) => {
    const response = await fetch(`${API_BASE_URL}/community/posts/${postId}/comments`);
    if (!response.ok) {
      throw new Error('댓글 목록을 불러오는데 실패했습니다.');
    }
    return await response.json();
  },

  // 댓글 작성
  createComment: async (postId, content) => {
    const response = await fetch(`${API_BASE_URL}/community/posts/${postId}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        content,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '댓글 작성에 실패했습니다.');
    }

    return await response.json();
  },

  // 댓글 수정
  updateComment: async (id, content) => {
    const response = await fetch(`${API_BASE_URL}/community/comments/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        content,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '댓글 수정에 실패했습니다.');
    }

    return await response.json();
  },

  // 댓글 삭제
  deleteComment: async (id) => {
    const response = await fetch(`${API_BASE_URL}/community/comments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error('댓글 삭제에 실패했습니다.');
    }
  },

  // ========== 가격 API ==========
  
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
  
  // 가격 그래프 데이터 조회
  getPriceGraph: async (itemCode, endDate, grade = '전체') => {
    const dateStr = endDate.toISOString().split('T')[0];  // YYYY-MM-DD 형식
    const response = await fetch(
      `${API_BASE_URL}/price/graph?itemCode=${itemCode}&endDate=${dateStr}&grade=${encodeURIComponent(grade)}`
    );
    if (!response.ok) {
      throw new Error('가격 그래프 데이터를 불러오는데 실패했습니다.');
    }
    return await response.json();
  },
};


