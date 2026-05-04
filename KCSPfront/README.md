# AgriForecast - 농산물 가격 예측 플랫폼

## 📋 프로젝트 정보

- **프로젝트명**: AgriForecast
- **버전**: v0.1.0 (초기 개발 버전)
- **프로젝트 타입**: React 웹 애플리케이션
- **빌드 도구**: Vite 5.0.8

## 🛠 기술 스택

### 핵심 프레임워크
- **React**: 18.2.0
- **React Router DOM**: 6.20.0 (라우팅)

### 스타일링
- **Tailwind CSS**: 3.3.6
- **PostCSS**: 8.4.32
- **Autoprefixer**: 10.4.16

### 개발 도구
- **Vite**: 5.0.8 (빌드 도구)
- **ESLint**: 8.55.0 (코드 린팅)
- **TypeScript 타입 정의**: @types/react, @types/react-dom

## 📦 설치 방법

```bash
# 의존성 설치
npm install

# 또는
yarn install

# 또는
pnpm install
```

## 🚀 실행 방법

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 빌드 미리보기
npm run preview

# 린트 검사
npm run lint
```

## 📁 프로젝트 구조

```
KCSPproject/
├── src/
│   ├── components/       # 공통 컴포넌트
│   │   ├── Header.jsx    # 헤더 컴포넌트
│   │   └── Layout.jsx    # 레이아웃 컴포넌트
│   ├── pages/            # 페이지 컴포넌트
│   │   ├── Home.jsx      # 홈 페이지
│   │   ├── Login.jsx     # 로그인 페이지
│   │   ├── Signup.jsx    # 회원가입 페이지
│   │   ├── FindId.jsx    # 아이디 찾기 페이지
│   │   ├── ResetPassword.jsx  # 비밀번호 재설정 페이지
│   │   ├── Community.jsx # 커뮤니티 페이지
│   │   ├── Detail.jsx    # 상세 검색 페이지
│   │   └── MyPage.jsx    # 마이페이지
│   ├── App.jsx           # 메인 앱 컴포넌트 (라우팅)
│   ├── main.jsx          # 엔트리 포인트
│   └── index.css         # 전역 스타일
├── public/               # 정적 파일
├── index.html            # HTML 템플릿
├── package.json          # 프로젝트 설정 및 의존성
├── vite.config.js        # Vite 설정
├── tailwind.config.js    # Tailwind CSS 설정
├── postcss.config.js     # PostCSS 설정
└── .eslintrc.cjs         # ESLint 설정
```

## 🔐 테스트 계정 (개발용)

로그인 페이지에서 사용 가능한 테스트 계정:

1. **관리자 계정**
   - 아이디: `admin`
   - 비밀번호: `123456`

2. **테스트 계정**
   - 아이디: `test`
   - 비밀번호: `password`

3. **사용자 계정**
   - 아이디: `sanghyuk01`
   - 비밀번호: `test1234`

> ⚠️ **주의**: 실제 데이터베이스 연결 전까지 사용하는 테스트 계정입니다.

## ✨ 주요 기능

### 인증 관련
- ✅ 로그인/로그아웃
- ✅ 회원가입
- ✅ 아이디 찾기
- ✅ 비밀번호 재설정

### 페이지
- ✅ 홈 대시보드 (농산물 가격 정보)
- ✅ 상세 검색 (농산물 가격 분석)
- ✅ 커뮤니티 게시판
- ✅ 마이페이지

### 공통 기능
- ✅ 반응형 디자인 (모바일/태블릿/데스크톱)
- ✅ 다크 모드 지원 (Tailwind CSS dark mode)
- ✅ 로그인 상태 관리 (localStorage)
- ✅ 라우팅 (React Router)

## 🎨 디자인 시스템

### 주요 색상
- **Primary**: `#2C5E1A` (녹색)
- **Primary Light**: `#F0F5F0`
- **Accent**: `#FFC700` (노란색)
- **Green Brand**: `#1A535C`
- **Price Up**: `#D9534F` (빨간색)
- **Price Down**: `#337AB7` (파란색)

### 폰트
- **Display Font**: Work Sans, Noto Sans KR

## 📝 개발 규칙

### 코드 스타일
- ESLint 규칙 준수
- React Hooks 규칙 준수
- 컴포넌트는 함수형 컴포넌트 사용

### 파일 명명 규칙
- 컴포넌트: PascalCase (예: `Header.jsx`)
- 페이지: PascalCase (예: `Login.jsx`)
- 유틸리티: camelCase (예: `utils.js`)

### Git 브랜치 전략
```
main          # 메인 브랜치 (배포)
develop       # 개발 브랜치
feature/*     # 기능 개발 브랜치
bugfix/*      # 버그 수정 브랜치
```

## 🔄 업데이트 내역

### v0.1.0 (현재 버전)
- ✅ HTML 기반 페이지를 React 컴포넌트로 변환 완료
- ✅ React Router를 통한 라우팅 구현
- ✅ 로그인/로그아웃 기능 구현 (localStorage 기반)
- ✅ 반응형 디자인 적용
- ✅ 테스트 계정 시스템 구현

## 🚧 향후 계획

- [ ] 실제 백엔드 API 연동
- [ ] 데이터베이스 연결
- [ ] 사용자 인증 시스템 (JWT 등)
- [ ] 농산물 가격 데이터 연동
- [ ] 차트/그래프 라이브러리 통합
- [ ] 파일 업로드 기능
- [ ] 실시간 알림 기능

## 👥 팀원 공유 사항

### 🎯 현재 상태
- **버전**: v0.1.0
- **개발 단계**: 초기 개발 완료 (프로토타입)
- **데이터베이스**: 미연결 (테스트 계정만 사용 중)

### ⚠️ 통일 필요 사항
1. **Node.js 버전**: 팀원 모두 동일한 Node.js 버전 사용 권장 (18.x 이상)
2. **패키지 관리자**: npm, yarn, pnpm 중 하나로 통일 (권장: npm)
3. **코드 포맷팅**: ESLint 규칙 준수
4. **Git 커밋 메시지**: 명확한 커밋 메시지 작성

### 📌 작업 시작 전 체크리스트
- [ ] `npm install` 실행하여 의존성 설치 확인
- [ ] `npm run dev` 실행하여 개발 서버 정상 작동 확인
- [ ] 브랜치 생성 후 작업 시작
- [ ] 커밋 전 `npm run lint` 실행하여 린트 오류 확인

## 📞 문의

프로젝트 관련 문의사항이 있으면 팀 채널로 연락주세요.

---

**마지막 업데이트**: 2024년 (현재 버전 기준)

