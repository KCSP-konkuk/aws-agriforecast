# UI 개편 로컬 검토안

- 기준: develop `2e6c7b0`, 작업 브랜치 `feature/ui-refresh-review`
- 범위: 프론트엔드 화면·스타일·화면 연결. 백엔드, 모델, 품목 구성은 변경하지 않음.
- 상태: 팀원 검토용 브랜치. PR·배포는 진행하지 않음.

## 2차 수정: 사진과 반복 카드 제거

사용자 피드백에 따라 생성 농산물 사진을 홈·계정에서 제거했다. 홈은 큰 타이포그래피와 데이터 규모로 구성하고, 품목 전망을 가격·변동률·흐름·요인이 정렬된 행으로 바꿨다. 민트 박스·둥근 패널·장식성 문구를 줄였다. 계정 화면은 가운데 폼으로 정리했다.

## 최초 방향과 변화

선택한 A 방향: [Polysense](https://www.polysense.ai/)의 밝은 농식품 분위기와 [Attio](https://attio.com/)의 정돈된 제품 화면을 참고했다. 농산물 사진, 민트·짙은 초록, 여백과 크기 차이로 정보를 구분한다.

| 영역 | 변경 |
|---|---|
| 공통 | 헤더·현재 메뉴·모바일 메뉴·푸터·글꼴 위계·버튼·패널 통일 |
| 홈 | 사진과 소개 → 가격 전망 → 질문별 분석 → 데이터 지도. 소매/도매 선택과 전체 품목 카드 |
| 소매 | 예측가·기간·기준 가격을 먼저 표시. 관련 품목 이동과 상세 분석 연결 |
| 도매 | 현재 조회 기간 마지막 가격과 순 평균 예측을 나란히 표시. 날짜 축 자동 간격 |
| 작업대 | 데스크톱 지표 사이드바, 모바일 상단 지표 설정, 접을 수 있는 8개 템플릿. 표는 처음 8행과 더 보기 |
| 커뮤니티 | 읽기 쉬운 목록, 별도 투표 영역, 품목별 가격 화면 연결, 글 상세·작성·수정 패널 |
| 계정 | 로그인·가입·복구 공통 화면과 마이페이지·저장 분석 레이아웃 |

유지한 범위: 소매 예측 7개, 도매 예측 3개, 카탈로그의 전체 품목·지표, 분석 지표 최대 8개, 템플릿 8개, 차트 6종, 변환·시차·조건, CSV·이미지·링크 내보내기, 분석 저장·공유, 커뮤니티·계정 기능. 홈 숫자는 카탈로그 응답에서 계산한다.

## 검증 기록

- 프론트엔드 빌드·ESLint 통과, Vitest 3개 파일 / 33개 테스트 통과.
- 1440px / 390px: 홈·소매·도매·작업대·커뮤니티·로그인·가입·아이디 찾기·비밀번호 재설정·로그인 전 글쓰기 확인. 페이지 실행 오류·가로 넘침 없음.
- 375px / 768px / 1024px: 주요 5개 화면에서 추가 15회 반응형 검사 통과.
- 소매 7개 / 도매 3개 카드, 품목 전환, 홍고추→붉은고추 연결, 모바일 메뉴 열기·Escape 닫기, 모바일 지표 설정 확인.
- 작업대 시계열·산점도·3D 산점도·평행 좌표·시차 상관·가격 지형도 화면 확인.
- 계정·내 분석·글쓰기·글 상세·내 글·글 수정은 브라우저의 로컬 응답과 가상 로그인으로 1440px / 390px 검토. 실제 인증·계정 변경·저장 요청 성공까지 검증한 것은 아님.
- 스크린샷과 실행 결과는 `/tmp/agri-ui-review/`에 보관.
- 빌드는 성공하나 기존 Plotly 번들 크기와 브라우저 호환성 데이터 갱신 안내는 남아 있음.

## 로컬 미리보기

브랜치를 받은 팀원은 다음 명령으로 같은 화면을 확인할 수 있다. 공개 API의 조회만 운영 서버에 연결하며 로그인·변경 요청·수집 경로는 차단한다. 계정·글 저장은 사용할 수 없다.

```bash
cd KCSPfront
npm ci
npm run dev:review
```

브라우저에서 `http://127.0.0.1:5173/`을 연다. 이 주소는 실행한 컴퓨터에서만 열리므로 팀원마다 각자 명령을 실행해야 한다.

일반 개발은 기존처럼 `npm run dev`와 로컬 백엔드(8080)를 사용한다. Vite의 기본 프록시 설정은 변경하지 않았다.

## 최초 이미지 자산 (2차 시안에서 사용 중지)

- 파일: `/tmp/agri-ui-review/harvest-still-life-unused.png` (검토용 원본 보관)
- 최초 사용: 홈과 계정 화면, 1536×1024 PNG. 현재 화면에서는 사용하지 않음.
- 생성: 내장 imagegen 도구(built-in mode). 최종 적용은 생성물 1종.
- 프롬프트:

> Use case: photorealistic-natural. Create a premium editorial still-life photograph for a Korean agricultural data startup website. Landscape 3:2 composition, approximately 1536x1024. A few beautiful real napa cabbage leaves, a pale green whole cabbage, two golden onions, two glossy elongated red chili peppers and a cucumber artfully arranged on a matte pale mint green studio surface. Close-up tangible natural textures, soft morning side light, organic shadows, sophisticated food editorial photography. Composition: produce clustered on the right and bottom, generous clean pale mint negative space in upper left for website overlays. Fresh, calm, modern agricultural technology brand mood; deep forest green, mint, natural yellow and red. No text, no labels, no charts, no logos, no people, no packaging, no borders, no watermark. This is a photographic web asset, not a website mockup.
