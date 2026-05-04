# React 컴포넌트 설계 문서

## 프로젝트 개요
AgriForecast - 농산물 가격 예측 플랫폼의 React 프론트엔드 애플리케이션

---

## 1. 메인 애플리케이션 컴포넌트

### 1.1 App.jsx
**기능**: 애플리케이션의 라우팅을 담당하는 최상위 컴포넌트

**설계**:
- React Router를 사용한 SPA 라우팅 구조
- 모든 페이지 경로를 정의하고 각 경로에 해당하는 컴포넌트를 매핑

**Props**: 없음

**State**: 없음

**함수**:
- 없음 (순수 함수형 컴포넌트)

**라우트 구성**:
- `/` → Home
- `/login` → Login
- `/signup` → Signup
- `/find-id` → FindId
- `/reset-password` → ResetPassword
- `/community` → Community
- `/community/write` → CommunityWrite
- `/community/:id` → CommunityView
- `/community/:id/my` → CommunityViewMy
- `/community/:id/edit` → CommunityEdit
- `/detail` → Detail
- `/mypage` → MyPage
- `/mypage/notifications` → NotificationsReceived
- `/mypage/notifications/delete` → NotificationsDelete

---

### 1.2 main.jsx
**기능**: React 애플리케이션의 진입점

**설계**:
- ReactDOM을 사용하여 App 컴포넌트를 DOM에 렌더링
- React.StrictMode로 감싸서 개발 모드에서 추가 검사 수행

**Props**: 없음

**State**: 없음

**함수**: 없음

---

## 2. 공통 컴포넌트 (components/)

### 2.1 Header.jsx
**기능**: 전역 네비게이션 헤더 컴포넌트

**설계**:
- 로그인 상태에 따라 UI를 동적으로 변경
- localStorage를 통해 로그인 상태 관리
- 이벤트 리스너를 통한 실시간 로그인 상태 동기화

**Props**: 없음

**State**:
- `isLoggedIn` (boolean): 로그인 여부
- `user` (object | null): 로그인된 사용자 정보

**함수**:
- `checkLoginStatus()`: localStorage에서 로그인 상태를 확인하고 state 업데이트
- `handleProfileClick()`: 프로필 클릭 시 로그인 여부에 따라 마이페이지 또는 로그인 페이지로 이동

**생명주기**:
- `useEffect`: 컴포넌트 마운트 시 로그인 상태 확인 및 이벤트 리스너 등록
  - `storage` 이벤트: 다른 탭에서의 로그인 상태 변경 감지
  - `loginStatusChanged` 커스텀 이벤트: 같은 페이지에서의 로그인 상태 변경 감지

---

### 2.2 Layout.jsx
**기능**: 공통 레이아웃 래퍼 컴포넌트

**설계**:
- 모든 페이지에 공통으로 적용되는 레이아웃 구조 제공
- Header 컴포넌트를 포함하고 children을 렌더링

**Props**:
- `children` (ReactNode): 레이아웃 내부에 표시할 컨텐츠

**State**: 없음

**함수**: 없음

---

### 2.3 MyPageSidebar.jsx
**기능**: 마이페이지 사이드바 네비게이션 컴포넌트

**설계**:
- 마이페이지 관련 메뉴 항목을 표시
- 현재 경로에 따라 활성 메뉴 하이라이트
- 로그아웃 기능 제공

**Props**:
- `user` (object): 사용자 정보 객체
- `onLogout` (function): 로그아웃 처리 함수

**State**: 없음

**함수**:
- `handleLogout()`: 로그아웃 확인 후 onLogout 콜백 실행

**데이터**:
- `menuItems` (array): 메뉴 항목 배열
  - 경로, 라벨, 아이콘 정보 포함

---

## 3. 페이지 컴포넌트 (pages/)

### 3.1 Home.jsx
**기능**: 메인 대시보드 페이지

**설계**:
- 농산물 가격 정보를 카드 형태로 표시
- 가격 예측 차트 및 시장 동향 뉴스 표시

**Props**: 없음

**State**: 없음

**함수**: 없음

**표시 데이터**:
- 주요 농산물 가격 카드 (배추, 쌀, 사과, 돼지고기)
- 가격 예측 차트
- 시장 동향 뉴스 목록

---

### 3.2 Login.jsx
**기능**: 사용자 로그인 페이지

**설계**:
- 양분할 레이아웃 (브랜딩 섹션 + 로그인 폼)
- Mock 계정을 사용한 로그인 처리 (실제 API 연동 전까지)
- 비밀번호 표시/숨김 토글 기능

**Props**: 없음

**State**:
- `showPassword` (boolean): 비밀번호 표시 여부
- `formData` (object): 폼 입력 데이터
  - `username` (string): 아이디
  - `password` (string): 비밀번호
- `error` (string): 에러 메시지

**함수**:
- `handleChange(e)`: 입력 필드 변경 시 formData 업데이트 및 에러 초기화
- `handleSubmit(e)`: 폼 제출 시 로그인 처리
  - 입력값 검증
  - Mock 계정과 비교
  - 로그인 성공 시 localStorage에 저장 및 홈으로 이동

**데이터**:
- `mockAccounts` (array): 테스트용 계정 목록

---

### 3.3 Signup.jsx
**기능**: 회원가입 페이지

**설계**:
- 회원가입 폼 제공
- 비밀번호 확인 검증

**Props**: 없음

**State**:
- `formData` (object): 폼 입력 데이터
  - `fullname` (string): 이름
  - `username` (string): 아이디
  - `email` (string): 이메일
  - `password` (string): 비밀번호
  - `confirm` (string): 비밀번호 확인
- `showPassword` (boolean): 비밀번호 표시 여부
- `showConfirm` (boolean): 비밀번호 확인 표시 여부
- `error` (string): 에러 메시지

**함수**:
- `handleChange(e)`: 입력 필드 변경 시 formData 업데이트
- `handleSubmit(e)`: 폼 제출 시 비밀번호 일치 검증 및 회원가입 처리

---

### 3.4 FindId.jsx
**기능**: 아이디 찾기 페이지

**설계**:
- 이름과 이메일로 아이디 찾기
- Mock 데이터를 사용한 검색 (실제 API 연동 전까지)

**Props**: 없음

**State**:
- `formData` (object): 폼 입력 데이터
  - `name` (string): 이름
  - `email` (string): 이메일
- `foundId` (string): 찾은 아이디
- `error` (string): 에러 메시지
- `showResult` (boolean): 결과 표시 여부

**함수**:
- `handleChange(e)`: 입력 필드 변경 시 formData 업데이트
- `handleSubmit(e)`: 폼 제출 시 Mock 계정에서 일치하는 계정 검색

**데이터**:
- `mockAccounts` (array): 테스트용 계정 목록

---

### 3.5 ResetPassword.jsx
**기능**: 비밀번호 재설정 페이지

**설계**:
- 현재 비밀번호, 새 비밀번호, 확인 비밀번호 입력
- 각 비밀번호 필드별 표시/숨김 토글

**Props**: 없음

**State**:
- `formData` (object): 폼 입력 데이터
  - `username` (string): 아이디
  - `current` (string): 현재 비밀번호
  - `new` (string): 새 비밀번호
  - `confirm` (string): 새 비밀번호 확인
- `showPassword` (object): 각 필드별 비밀번호 표시 여부
  - `current` (boolean)
  - `new` (boolean)
  - `confirm` (boolean)
- `error` (string): 에러 메시지

**함수**:
- `handleChange(e)`: 입력 필드 변경 시 formData 업데이트
- `togglePassword(field)`: 특정 필드의 비밀번호 표시/숨김 토글
- `handleSubmit(e)`: 폼 제출 시 비밀번호 일치 및 길이 검증

---

### 3.6 Community.jsx
**기능**: 커뮤니티 게시판 목록 페이지

**설계**:
- 게시글 목록을 테이블 형태로 표시
- 카테고리 필터링 (전체, 도매 정보, 소매 노하우, 구인/구직, 자유게시판)
- 페이지네이션

**Props**: 없음

**State**: 없음

**함수**: 없음

**표시 데이터**:
- 게시글 목록 (제목, 작성자, 작성일, 조회수, 댓글 수)
- 카테고리 필터 버튼
- 페이지네이션 버튼

---

### 3.7 CommunityWrite.jsx
**기능**: 커뮤니티 게시글 작성 페이지

**설계**:
- 게시글 작성 폼 제공
- 제목, 카테고리, 내용, 첨부파일 입력

**Props**: 없음

**State**:
- `formData` (object): 폼 입력 데이터
  - `title` (string): 제목
  - `category` (string): 카테고리
  - `content` (string): 내용
  - `file` (File | null): 첨부파일

**함수**:
- `handleChange(e)`: 입력 필드 변경 시 formData 업데이트 (파일 포함)
- `handleSubmit(e)`: 폼 제출 시 게시글 등록 처리 및 커뮤니티 목록으로 이동

---

### 3.8 CommunityEdit.jsx
**기능**: 커뮤니티 게시글 수정 페이지

**설계**:
- 기존 게시글 데이터를 불러와 수정 폼에 표시
- 게시글 수정 및 삭제 기능

**Props**: 없음

**State**:
- `formData` (object): 폼 입력 데이터
  - `title` (string): 제목
  - `category` (string): 카테고리
  - `content` (string): 내용
  - `file` (File | null): 새 첨부파일
  - `existingFile` (string): 기존 첨부파일명

**함수**:
- `handleChange(e)`: 입력 필드 변경 시 formData 업데이트
- `handleSubmit(e)`: 폼 제출 시 게시글 수정 처리 및 상세 페이지로 이동
- `handleDelete()`: 게시글 삭제 확인 후 삭제 처리 및 목록으로 이동

**생명주기**:
- `useEffect`: URL 파라미터에서 id를 가져와 기존 게시글 데이터 로드 (현재는 주석 처리)

---

### 3.9 CommunityView.jsx
**기능**: 커뮤니티 게시글 상세 보기 페이지 (타인 글)

**설계**:
- 게시글 상세 내용 표시
- 댓글 목록 및 댓글 작성 기능
- 본인 글인 경우 자동으로 CommunityViewMy로 리다이렉트

**Props**: 없음

**State**:
- `post` (object): 게시글 데이터
  - `title` (string): 제목
  - `author` (string): 작성자
  - `authorId` (string): 작성자 ID
  - `date` (string): 작성일
  - `views` (number): 조회수
  - `content` (string): 내용
  - `details` (array): 상세 정보 배열
  - `comments` (array): 댓글 배열
- `comment` (string): 작성 중인 댓글 내용

**함수**:
- `handleCommentSubmit(e)`: 댓글 제출 처리

**생명주기**:
- `useEffect`: 
  - 게시글 데이터 로드 (현재는 주석 처리)
  - 로그인된 사용자가 본인 글인지 확인하여 자동 리다이렉트

---

### 3.10 CommunityViewMy.jsx
**기능**: 커뮤니티 게시글 상세 보기 페이지 (본인 글)

**설계**:
- 본인 게시글 상세 내용 표시
- 글 수정 버튼 제공
- 댓글 목록 및 댓글 작성 기능

**Props**: 없음

**State**:
- `post` (object): 게시글 데이터 (CommunityView와 동일 구조)
- `comment` (string): 작성 중인 댓글 내용

**함수**:
- `handleCommentSubmit(e)`: 댓글 제출 처리

**생명주기**:
- `useEffect`: URL 파라미터에서 id를 가져와 게시글 데이터 로드 (현재는 주석 처리)

---

### 3.11 Detail.jsx
**기능**: 농산물 가격 상세 분석 페이지

**설계**:
- 농산물 가격 데이터를 필터링하고 시각화
- KPI 카드, 차트, 데이터 테이블 제공

**Props**: 없음

**State**: 없음

**함수**: 없음

**표시 데이터**:
- 필터 옵션 (품목, 품종, 기간, 단위)
- KPI 카드 (현재 평균 도매가, 전일 대비, 최고가, 최저가)
- 가격 추이 차트
- 상세 데이터 테이블

---

### 3.12 MyPage.jsx
**기능**: 마이페이지 - 계정 정보 관리

**설계**:
- 로그인 상태 확인 후 접근 허용
- 프로필 정보 수정
- 비밀번호 변경
- MyPageSidebar와 함께 레이아웃 구성

**Props**: 없음

**State**:
- `user` (object | null): 사용자 정보

**함수**:
- `handleLogout()`: 로그아웃 처리 (localStorage 정리, 이벤트 발생, 홈으로 이동)

**생명주기**:
- `useEffect`: 
  - 로그인 상태 확인
  - 미로그인 시 로그인 페이지로 리다이렉트
  - 로그인 시 사용자 정보 로드 및 이메일 기본값 설정

---

### 3.13 NotificationsReceived.jsx
**기능**: 받은 알림 목록 페이지

**설계**:
- 사용자가 받은 알림 목록 표시
- 로그인 상태 확인 후 접근 허용
- MyPageSidebar와 함께 레이아웃 구성

**Props**: 없음

**State**:
- `user` (object | null): 사용자 정보
- `notifications` (array): 알림 목록
  - 각 알림 객체: `id`, `product`, `price`, `unit`, `date`, `message`

**함수**:
- `handleLogout()`: 로그아웃 처리

**생명주기**:
- `useEffect`: 
  - 로그인 상태 확인
  - 미로그인 시 로그인 페이지로 리다이렉트
  - 알림 목록 로드 (현재는 주석 처리, Mock 데이터 사용)

---

### 3.14 NotificationsDelete.jsx
**기능**: 등록된 알림 삭제 페이지

**설계**:
- 사용자가 등록한 알림 목록 표시
- 각 알림 삭제 기능
- 로그인 상태 확인 후 접근 허용
- MyPageSidebar와 함께 레이아웃 구성

**Props**: 없음

**State**:
- `user` (object | null): 사용자 정보
- `notifications` (array): 등록된 알림 목록
  - 각 알림 객체: `id`, `product`, `price`, `message`

**함수**:
- `handleDelete(id)`: 알림 삭제 확인 후 삭제 처리
- `handleLogout()`: 로그아웃 처리

**생명주기**:
- `useEffect`: 
  - 로그인 상태 확인
  - 미로그인 시 로그인 페이지로 리다이렉트
  - 등록된 알림 목록 로드 (현재는 주석 처리, Mock 데이터 사용)

---

## 4. 공통 설계 패턴

### 4.1 상태 관리
- **로컬 상태**: 각 컴포넌트에서 `useState` 훅 사용
- **전역 상태**: localStorage를 통한 로그인 상태 관리
- **상태 동기화**: 커스텀 이벤트(`loginStatusChanged`) 및 `storage` 이벤트 활용

### 4.2 라우팅
- React Router v6 사용
- 동적 라우팅: URL 파라미터(`useParams`) 활용
- 프로그래밍 방식 네비게이션: `useNavigate` 훅 사용

### 4.3 인증 및 권한
- localStorage 기반 인증 (실제 API 연동 전까지)
- 보호된 라우트: 컴포넌트 레벨에서 로그인 상태 확인
- 자동 리다이렉트: 미로그인 시 로그인 페이지로 이동

### 4.4 데이터 페칭
- 현재 대부분의 API 호출이 주석 처리되어 있음
- Mock 데이터를 사용한 개발 단계
- TODO 주석으로 실제 API 연동 지점 표시

### 4.5 컴포넌트 구조
- 함수형 컴포넌트만 사용
- Hooks 기반 상태 관리 및 생명주기 관리
- 재사용 가능한 컴포넌트 구조 (Layout, Header, MyPageSidebar)

---

## 5. 주요 데이터 구조

### 5.1 사용자 정보 (User)
```javascript
{
  username: string,
  name: string,
  email?: string,
  password?: string
}
```

### 5.2 게시글 (Post)
```javascript
{
  title: string,
  author: string,
  authorId: string,
  date: string,
  views: number,
  content: string,
  details?: string[],
  comments: Comment[]
}
```

### 5.3 댓글 (Comment)
```javascript
{
  author: string,
  date: string,
  content: string
}
```

### 5.4 알림 (Notification)
```javascript
{
  id: number,
  product: string,
  price: number,
  unit?: string,
  date: string,
  message: string
}
```

---

## 6. 향후 개선 사항

1. **API 연동**: 모든 TODO 주석 처리된 API 호출 구현
2. **상태 관리 라이브러리**: Context API 또는 Redux 도입 검토
3. **에러 처리**: 전역 에러 바운더리 및 에러 핸들링 개선
4. **로딩 상태**: 데이터 로딩 중 로딩 인디케이터 추가
5. **폼 검증**: 더 강화된 폼 검증 로직 (라이브러리 활용 가능)
6. **타입 안정성**: TypeScript 마이그레이션 검토



