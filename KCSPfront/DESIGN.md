# 화면 디자인 기준

AgriForecast 화면은 **정석 제품 화면**을 따른다. 토스증권 · 네이버 증권처럼 사람들이 이미 익숙한 제품 화면을, 꾸밈 없이 제대로 만든다.
새 화면이나 컴포넌트를 만들 때 이 문서와 [tailwind.config.js](tailwind.config.js) 의 토큰만 쓴다.

## 원칙

- **데이터가 주인공이다.** 장식(아이콘 · 그라데이션 · 그림자 · 색 박스)은 빼고, 숫자와 차트가 먼저 보이게 한다.
- **초록은 동작과 선택에만.** 주요 버튼, 고른 탭, 링크. 넓은 면을 초록으로 칠하지 않는다.
- **오름 빨강, 내림 파랑.** 한국 시세 표기 관례. 이 두 색은 방향 말고 다른 뜻으로 쓰지 않는다.
- **카드 안에 카드를 넣지 않는다.** 구역은 위쪽 구분선으로 나누고, 회색 면은 한 화면에 한두 번(가장 중요한 요약, 빈 상태)만 쓴다.
- **말투는 해요체.** "데이터가 없습니다" 대신 "데이터가 없어요".

## 색

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `primary` | `#2C5E1A` | 주요 버튼, 고른 탭 밑줄, 링크, AI 예측선 |
| `primary-hover` | `#234B15` | 주요 버튼 hover |
| `primary-light` | `#EEF4EA` | 저장 완료 같은 성공 안내 면 |
| `text-main` | `#191F1C` | 본문, 숫자, 실제 가격선 |
| `subtext-light` | `#5D6560` | 보조 글, 축 글자, 고르지 않은 탭 |
| `border-light` | `#E3E7E3` | 입력칸 · 표 머리 테두리 |
| `line` | `#EDF0ED` | 구역 구분선, 목록 사이 선, 차트 격자 |
| `background-light` | `#F4F6F4` | 회색 면(요약 블록, 보조 버튼, 세그먼트 바탕) |
| `price-up` / `price-down` | `#CC2F2F` / `#2E6BC6` | 오름 / 내림 |

- 흰 바탕 글자 대비: 본문 16.8 · 보조 6.0 · 오름 5.2 · 내림 5.2. 오류 글자는 `text-red-700`.
- 차트 라이브러리는 클래스가 아니라 색 값을 받아서 hex 를 한 곳씩에 둔다: 오늘의 요약 [dashboard/format.js](src/components/dashboard/format.js) `COLOR`, 작업대 [workbench/format.js](src/components/workbench/format.js) `AXIS` · `SERIES_COLORS`, 홈 [HomeCharts.jsx](src/components/home/HomeCharts.jsx). 위 토큰과 같은 값을 쓴다.
- `text-text-main/60` 같은 투명도 글자색은 쓰지 않는다. 보조 글은 `text-subtext-light`.

## 글자

- 글꼴은 **Pretendard Variable** 하나(npm `pretendard`, 동적 서브셋으로 레포에 묶어 배포). 제목 · 본문 · 숫자 모두.
- 크기 단계: 홈 첫 제목 32/40px · 화면 제목 24px(`text-2xl`) · 구역 제목 18px(`text-lg`) · 목록 · 본문 15px · 보조 13px · **최소 12px(`text-xs`)**. 차트 축 글자도 12px.
- 굵기: 제목 bold, 버튼 · 강조 semibold, 메뉴 medium. black · extrabold 는 쓰지 않는다.
- 큰 제목은 `tracking-[-0.02em]`. 표의 숫자는 오른쪽 정렬 + `tabular-nums`.
- 변동은 기호 대신 부호로: `+3.2%` · `−3.2%`(진짜 빼기 기호) + 오름/내림 색. ▲▼ 같은 글자 아이콘은 쓰지 않는다.

## 틀

- 페이지 바깥 여백 `px-4 sm:px-6 lg:px-10`, 위아래 `pt-8 pb-16`. 최대 폭 1280px([Layout.jsx](src/components/Layout.jsx), 헤더와 왼쪽 끝을 맞춘다). 읽는 화면(커뮤니티)은 가운데 880px.
- 화면 머리: `h1`(24px bold) + 한 줄 설명(15px 보조). 그 아래 구역은 `h2` — 제목 단계를 건너뛰지 않는다.
- 구역: 위쪽 구분선 `border-t border-line pt-5` + `h2`(18px bold) + 한 줄 설명(13px 보조). 오늘의 요약의 [DashboardCard](src/components/dashboard/DashboardCard.jsx) 가 기준.
- 375px 폭에서 가로 스크롤이 생기면 안 된다. 긴 탭 줄은 그 줄만 가로로 넘긴다.

## 컴포넌트

| 무엇 | 모양 |
|---|---|
| 주요 버튼 | `bg-primary text-white rounded-lg font-semibold` · 높이 h-8(도구) / h-9 · h-10(일반) / h-11 · h-12(폼) |
| 보조 버튼 | `bg-background-light text-text-main hover:bg-border-light` |
| 지우기 · 탈퇴 | 글자만 빨강 `text-red-700 hover:bg-red-50`. 빨간 면 버튼은 마지막 확인 한 번에만 |
| 글자 링크 | `text-primary font-semibold hover:underline`. 보조 링크(아이디 찾기 등)는 회색 글자 |
| 같은 종류 고르기(품목 · 이야기방) | 밑줄 탭: `-mb-px border-b-2 py-2.5 text-[15px]`, 고른 탭은 `border-primary font-semibold` |
| 방식 고르기(작업대/오늘의 요약 · 기간 · 단위 · 차트 종류) | 세그먼트: 회색 바탕 `bg-background-light p-1` 안에 고른 칸만 `bg-white ring-1 ring-border-light` |
| 목록 · 표 | `divide-y divide-line`, 표 머리는 `border-b border-border-light text-[13px] text-subtext-light` |
| 요약 숫자 | 상자 없이 `dl` 로 이름(13px 보조) 위, 값(bold) 아래. 여러 개면 격자에 구분선만 |
| 입력칸 | `h-10 rounded-lg border-border-light bg-white focus:border-primary` |
| 불러오는 중 · 빈 결과 · 오류 | [StatusMessage](src/components/StatusMessage.jsx) — 작은 스피너와 한 줄. 오류는 `role="alert"` |
| 차트 툴팁 | 떠 있는 것이라 그림자(`shadow`)를 허용하는 유일한 곳 |

- 아이콘(Material Symbols)은 **기능이 있을 때만**: 메뉴 열기/닫기, 지우기(×), 검색, 펼치기, 비밀번호 보기, 복사됨, 축 바꾸기. 제목 · 버튼 글자 옆 장식 아이콘은 넣지 않는다. 아이콘만 있는 버튼엔 `aria-label`.
- 포커스는 전역 `:focus-visible` 초록 테두리([index.css](src/index.css)). 입력칸만 `focus:border-primary` 로 대신할 수 있고, 그 밖에서는 지우지 않는다.

## 차트

- 격자는 가로선만 `#EDF0ED`, 축 글자 12px `#5D6560`, 기준선(지수 100 · 0) `#A9B0AB` 점선.
- 실제 = `#191F1C` 실선, AI 예측 = `#2C5E1A` 점선(`5 4`). 지표를 여러 개 겹칠 땐 작업대 범주 8색(`SERIES_COLORS`)을 고른 순서대로.
- 칸 색(지형도 · 시차 상관 · 가격 달력): 0 이 기준이면 파랑(−) · 빨강(+), 값이면 옅은 초록 → 진한 초록.

## 하지 않는 것

[Impeccable](https://github.com/pbakaus/impeccable)(Apache 2.0) 의 기본 금지 목록에 맞춘다.

- 제목 위 작은 머리말(eyebrow), 같은 크기 아이콘+제목+글 카드 격자, 카드 안 카드
- 그라데이션 글자 · 배경, 유리 효과(blur), 1px 넘는 색 왼쪽 테두리, 진한 그림자
- 내용 대신 들어간 장식 스파크라인, 고정폭 글꼴 흉내, 이모지 · 글자 아이콘
- 12px 미만 글자, 대비 4.5 미만 글자

## 검사

```bash
DO_NOT_TRACK=1 npx impeccable@latest detect src
```

로컬 화면도 주소로 검사한다(`npm run dev` 후, Node 22 이상). 모바일 폭은 `--viewport 390x844`.

```bash
DO_NOT_TRACK=1 npx impeccable@latest detect --viewport 390x844 http://localhost:5173/
```
