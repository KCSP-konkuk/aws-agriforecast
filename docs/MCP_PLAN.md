# 예측 가격 MCP 연결 계획 (구현 전 설계)

웹사이트에 들어가지 않고 AI 프롬프트(Claude Desktop · Claude Code · claude.ai 등)에서
"이번 순 양파 소매가 예측 얼마야?" 같은 질문에 바로 예측가를 받아 오도록, 예측 가격을 **MCP 서버**로 노출하는 방법을 정리한다.

작성: 2026-10-03 · 상태: 원격 MCP(streamable-http, 도매 3품목) 운영 중 — `https://agriforecast.duckdns.org/mcp`. 8절 1~5(HTTPS·HTTP 전송·systemd·nginx·배포 워크플로) 완료, 남은 일은 6(홈페이지 안내)·7(문서)

> 구현하며 바뀐 점: MCP Python SDK 2.x 에서 `FastMCP` 는 `MCPServer`(`mcp.server.mcpserver`)로 이름이 바뀌었다. 도구는 우선 `get_wholesale_forecast` 하나만 만들었다

---

## 1. 지금 구조에서 예측가가 어디에 있나

```
[KCSPmodel/batch] 매일 배치 (XGBoost)
   ├─ pipeline.py / _onion / _redpepper  → MySQL  cabbage_predictions · onion_predictions · redpepper_predictions (도매)
   └─ pipeline_retail.py                 → MySQL  retail_predictions (소매 6품목, item_name 컬럼)
                                                 │
[KCSPback] Spring Boot (EC2 :8080, nginx 뒤) ── 읽기 전용 조회
   ├─ PredictionService     도매 예측·적중 이력
   └─ RetailPriceService    소매 카드·추이 + 예측
                                                 │
[KCSPfront] React  ── /api/... 호출해서 화면에 그림
```

예측을 읽는 **공개 REST API가 이미 있다** (`SecurityConfig` 상 `/api/price/**` 는 `permitAll`, 인증 불필요).

| 용도 | 엔드포인트 | 응답 핵심 |
|---|---|---|
| 소매 6품목 요약 + 이번 순 예측 | `GET /api/price/retail/summary` | `[{itemName, unit, latestDate, latestPrice, prevSoonAvg, changePct, prediction:{target:"202610상순", price}}]` |
| 소매 품목 추이 + 예측 1점 | `GET /api/price/retail/series?itemName=양파&unit=soon` | `{itemName, unit, points[], predictions[]}` |
| 도매 예측(현재 순 이후) | `GET /api/price/agri/predictions?itemName=배추` | `{itemName, predictions:[{date:"202610상순", predictedPrice, actualPrice, errorPct}]}` |
| 도매 적중 이력 | `GET /api/price/agri/prediction-history?itemName=배추` | `{backtest[], live[], summary:{backtestMape, liveMape, ...}}` |
| 도매 실제가 그래프 | `GET /api/price/agri/graph?itemName=&startDate=&endDate=` | `{priceData:[{date, price}]}` |

- 소매 품목: 붉은고추 · 양배추 · 양파 · 애호박 · 시금치 · 오이 (`RetailPriceService.UNITS`)
- 도매 품목(운영 중): 배추 · 양파 · 홍고추. `PredictionService.ITEM_TABLE` 에 당근·양배추도 있지만 운영 모델이 없어 빈 목록이 나온다 (`docs/MODELS.md` 1절)

**결론: MCP 서버는 DB나 모델을 직접 건드릴 필요 없이, 위 REST API를 감싸는 얇은 어댑터면 된다.**

---

## 2. 전체 그림

```
사용자 프롬프트 ─▶ AI 클라이언트(Claude 등) ─(MCP: tool 호출)─▶ agri-forecast MCP 서버 ─(HTTPS GET)─▶ 운영 백엔드 /api/price/...
                       ▲                                              │
                       └──────────── JSON 결과 → AI가 자연어로 답 ◀───┘
```

MCP 서버가 하는 일은 세 가지뿐이다.
1. 도구(tool) 목록과 입력 스키마를 AI에게 알려 준다
2. AI가 도구를 부르면 백엔드 REST API를 호출한다
3. 결과를 AI가 읽기 좋은 형태(단위·순 라벨·기준 설명 포함)로 정리해 돌려준다

### 왜 DB 직접 연결이 아닌가

| 방식 | 장점 | 단점 |
|---|---|---|
| **REST API 감싸기 (권장)** | 이미 공개·검증된 경로. 순 필터·경동/복조리 평균 등 로직을 다시 짜지 않음. DB 자격증명 불필요 | 백엔드가 죽으면 같이 안 됨 |
| DB 직접 조회 | 백엔드 독립 | RDS/MySQL을 외부에 열거나 SSH 터널 필요, 로직 중복, 보안 위험 |
| 백엔드 안에 MCP 엔드포인트 추가 (Spring AI MCP) | 서버 하나로 끝 | Java 쪽 의존성·배포 변경 필요, 첫 시도로는 무거움 |

---

## 3. 노출할 도구(tool) 설계

이름은 영어, 설명(description)은 한국어로 써서 AI가 언제 어떤 도구를 쓸지 판단하게 한다.

| 도구 | 입력 | 내부 호출 | 돌려줄 것 |
|---|---|---|---|
| `list_items` | 없음 | (상수) | 소매 6품목 + 단위, 도매 3품목, 순 규칙 설명 |
| `get_retail_forecast` | `item_name?` (없으면 전체) | `/retail/summary` | 품목별 최근 소매가·직전 순 평균·증감률·**이번 순 예측가**·대상 순 |
| `get_retail_trend` | `item_name`, `unit`(`soon`/`daily`), `limit?` | `/retail/series` | 최근 N개 순 평균 + 예측 1점 |
| `get_wholesale_forecast` | `item_name` (배추/양파/홍고추) | `/agri/predictions` | 현재 순 이후 예측가 목록 |
| `get_forecast_accuracy` | `item_name` | `/agri/prediction-history` | 백테스트·운영 평균 오차율(MAPE), 최근 몇 순 비교 |

응답을 다듬을 때 꼭 넣을 것:
- **순 라벨 변환**: `"202610상순"` → `"2026년 10월 상순(1~10일)"`. 규칙은 `KCSPback/.../util/Soon.java` 와 같게 (1~10 상순 / 11~20 중순 / 21~ 하순)
- **기준 명시**: 소매 = 서울 경동·복조리 전통시장 평균(상품), 도매 = 가락시장 경매가. 단위(1kg, 100g, 1포기…)
- **예측이 비었을 때 이유**: 순 첫날(1·11·21일) KST 12:10 배치 전에는 이번 순 소매 예측이 없다 → `"오늘 12시 이후 공개"` 안내 (`docs/MODELS.md` 3.5절)
- **입력 검증**: 없는 품목명이면 가능한 목록을 같이 돌려준다 (`/retail/series` 는 400, `/agri/predictions` 는 빈 목록)
- 예측은 참고용이라는 한 줄과 오차율(가능하면) — AI가 단정적으로 말하지 않게

선택: 도구 외에 MCP **resource** 로 `docs/MODELS.md` 요약(모델 설명·성능)을 노출하면 "이 예측 얼마나 믿을 만해?" 질문에도 답할 수 있다.

---

## 4. 기술 선택

**Python + 공식 MCP SDK(`mcp` 패키지의 `FastMCP`) + `httpx`** 를 권장한다.
- 레포에 이미 Python(`KCSPmodel`)이 있어 팀이 익숙하다
- 데코레이터로 함수 하나 = 도구 하나, 타입 힌트가 곧 입력 스키마
- 대안: TypeScript(`@modelcontextprotocol/sdk`) — 프론트 팀이 맡는다면 이쪽도 무방

폴더 제안 (새 최상위 폴더, 기존 서비스와 분리):

```
KCSPmcp/
├─ README.md            설치·클라이언트 등록 방법
├─ pyproject.toml       mcp, httpx
├─ server.py            FastMCP 인스턴스 + 도구 5개
├─ client.py            백엔드 REST 호출 (BASE_URL, 타임아웃, 에러 처리)
├─ soon.py              순 코드 ↔ 라벨 변환
└─ tests/               백엔드 응답 샘플(JSON)로 포맷 함수 테스트
```

설정은 환경변수 하나: `AGRI_API_BASE_URL` (예: 운영 도메인 `https://<서비스 도메인>` 또는 로컬 `http://localhost:8080`). 서버 주소는 CONTRIBUTING 규칙대로 레포에 적지 않는다.

---

## 5. 실행 방식 — 단계별로

### 1단계: 로컬 stdio (가장 쉬움, 먼저 이걸로)

MCP 서버를 **내 PC에서** 프로세스로 띄우고, 운영 백엔드의 공개 API를 HTTPS로 부른다. 서버 쪽 변경 없음.

- Claude Code 등록 예:
  `claude mcp add agri-forecast -e AGRI_API_BASE_URL=https://<도메인> -- uv run --directory KCSPmcp server.py`
- Claude Desktop: `claude_desktop_config.json` 의 `mcpServers` 에 같은 명령을 넣는다
- 확인: MCP Inspector(`npx @modelcontextprotocol/inspector`)로 도구 목록·호출 결과를 먼저 본다

단점: 쓰는 사람마다 설치해야 한다.

### 2단계: 원격 MCP (Streamable HTTP) — 팀원·claude.ai 커넥터에서 설치 없이

같은 코드를 `transport="streamable-http"` 로 EC2에 띄운다.

- systemd 서비스로 상주(예: `127.0.0.1:8090`), nginx 에 `location /mcp` 프록시 추가, HTTPS 필수
- 백엔드는 같은 서버이므로 `AGRI_API_BASE_URL=http://127.0.0.1:8080` 로 내부 호출
- claude.ai → 설정 → 커넥터 → 커스텀 커넥터에 `https://<도메인>/mcp` 등록
- 배포: 기존 `deploy-model-batch.yml` 처럼 `KCSPmcp/**` 변경 시 rsync + 서비스 재시작하는 워크플로 추가

주의할 점:
- 데이터가 공개 API와 같아 **읽기 전용이면 인증 없이도** 위험은 낮다. 다만 남용 방지로 nginx `limit_req` 정도는 건다
- 나중에 개인화(로그인 사용자 기능)를 붙이면 MCP 권한 부여(OAuth) 스펙을 따라야 한다 — 1차 범위 밖
- `/api/collect/**` 같은 쓰기·수집 트리거는 **절대 도구로 노출하지 않는다** (`CollectLocalOnlyFilter` 취지와 같음)

### 3단계(선택): 백엔드 내장

트래픽이나 운영 부담이 커지면 Spring AI MCP Server 로 `PriceController` 옆에 붙이는 것도 가능. 지금은 필요 없음.

---

## 6. 구현 순서 체크리스트

1. [ ] 운영 API를 직접 호출해 응답 샘플 JSON 저장 (`retail/summary`, `retail/series`, `agri/predictions`, `agri/prediction-history`) → 테스트 픽스처
2. [ ] `KCSPmcp/` 생성, `client.py` (타임아웃 10초, 4xx/5xx → 사람이 읽을 메시지)
3. [ ] `soon.py` + 테스트 (`Soon.java` 와 같은 결과인지)
4. [ ] `server.py` 도구 5개, description 한국어로 꼼꼼히
5. [ ] MCP Inspector 로 확인 → Claude Code/Desktop 에 stdio 등록 → 실제 질문으로 테스트
   - "이번 순 오이 소매가 예측 알려줘"
   - "배추 도매 예측이랑 지난 예측 정확도 같이 보여줘"
   - "소매 6품목 중 지난 순보다 많이 오를 것 같은 건?"
   - 순 첫날 오전 / 없는 품목("감자") 같은 경계 상황
6. [ ] (2단계) EC2 systemd + nginx `/mcp` + 배포 워크플로 + claude.ai 커넥터 등록
7. [ ] `README`, `CONTRIBUTING.md`, `PROGRESS.md` 갱신

---

## 7. 미리 알아 둘 것

- 백엔드의 `@CrossOrigin(origins = "http://localhost:5173")` 은 브라우저 CORS 용이라 MCP 서버(서버→서버 호출)에는 영향 없다
- `/agri/predictions` 는 `target_date >= 현재 순` 만 돌려준다. 지난 순 예측은 `prediction-history` 로 본다
- 소매 예측은 진행 중인 순 1개만 있다(1순 뒤 예측). "다음 달 가격" 같은 질문엔 없다고 답하게 description 에 적어 둔다
- 백엔드 시간대는 KST 기준(`RetailPriceService` 의 `Asia/Seoul`). MCP 서버에서 날짜 계산할 때도 KST 로 맞춘다

---

## 8. 최종 목표 — 원격 MCP + 홈페이지에서 URL 복사

사용자는 홈페이지에서 URL 하나를 복사해 Claude 에 붙여 넣기만 한다. 사용자 PC 에는 아무것도 설치하지 않는다.

| 클라이언트 | 사용자가 하는 일 |
|---|---|
| Claude Desktop · claude.ai | 설정 → 커넥터 → 커스텀 커넥터 추가 → `https://<도메인>/mcp` 붙여넣기 |
| Claude Code | `claude mcp add --transport http agri-forecast https://<도메인>/mcp` |

### 할 일 (순서대로)

1. **HTTPS 주소 (도메인 구입 없이)** — claude.ai 커스텀 커넥터는 공개 HTTPS 주소가 필요하다. 브라우저 복사(`navigator.clipboard`)도 HTTPS 에서만 동작한다. 도메인은 사지 않기로 했다(2026-10-03)
   - EC2 IP 는 탄력적 IP 로 확인됨(2026-10-03). IP 그대로 HTTP 로 열면 Claude Code 는 붙을 수 있어도 Desktop·claude.ai 커스텀 커넥터는 HTTPS 를 요구한다
   - **0안 IP 주소 인증서**: DNS 없이 `https://3.37.177.25` — Let's Encrypt IP 인증서(유효기간 며칠, 자동 갱신 필수, ACME 클라이언트 지원 확인 필요)
   - **1안 DuckDNS 무료 서브도메인**: `<이름>.duckdns.org` → EC2 IP. nginx 에 `certbot --nginx` 로 Let's Encrypt 인증서·자동 갱신. 사이트·MCP 모두 일반적인 절차 그대로
   - AWS 가 기본 HTTPS 주소를 주는 건 CloudFront·API Gateway·App Runner 등. ALB 는 HTTPS 에 내 도메인 인증서(ACM)가 필요해 안 되고, EC2 퍼블릭 DNS 에는 AWS 가 인증서를 주지 않는다
   - 2안 CloudFront 기본 주소 (EC2 앞에 두면 사이트·API·MCP 가 한 주소로 HTTPS. 오리진은 IP 가 아닌 EC2 퍼블릭 DNS 로 지정, `/api/*`·`/mcp*` 는 캐시 끄기. MCP 서버는 긴 SSE 대신 JSON 응답 모드 권장) `https://xxxx.cloudfront.net`: AWS 안에서 끝나지만 주소가 무작위이고, `/mcp` 는 캐시 끄기·POST 허용·헤더 전달(`Mcp-Session-Id`) 설정과 응답 시간 제한 확인이 필요하다
   - 어느 쪽이든 EC2 IP 가 탄력적 IP 여야 주소가 안 깨진다
2. **MCP 서버를 HTTP 전송으로** — `server.py` 의 `mcp.run()` 을 `streamable-http`(127.0.0.1:8090 등)로 띄우는 옵션 추가. 도구 코드는 그대로. 백엔드 주소는 서버 안 `http://127.0.0.1:8080`
3. **EC2 상주** — systemd 서비스(`agriforecast-mcp.service`), 의존성은 uv 또는 venv 고정
4. **nginx** — `location /mcp` 프록시(스트리밍이라 버퍼링 끄기), `limit_req` 로 요청 속도 제한
5. **배포 워크플로** — `deploy-mcp.yml`: `KCSPmcp/**` 변경 시 복사 + 재시작 + `tools/list` 헬스체크·롤백. PR 검사는 `ci.yml` 의 `mcp` job
6. **홈페이지 안내 섹션** — 탭(Desktop·claude.ai / Claude Code), URL·명령 복사 버튼, 단계 안내, 예시 질문, 지원 품목, "예측은 참고용"
7. 문서 — `CONTRIBUTING.md`(배포·운영), `PROGRESS.md`

### 알아 둘 것

- 조회 전용이고 공개 API 와 같은 데이터라 1차는 인증 없이 연다. 로그인 사용자 기능을 붙이면 MCP 권한 부여(OAuth) 스펙을 따라야 한다
- 커스텀 커넥터 개수는 Claude 요금제에 따라 제한이 있을 수 있다 — 안내 문구에 적는다
- 소매 6품목 도구(`get_retail_forecast` 등, 3절)는 이 단계 전후 언제든 같은 서버에 더할 수 있다
