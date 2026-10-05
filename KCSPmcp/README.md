# 도매 예측가 MCP 서버

AI 클라이언트(claude.ai · Claude Desktop · Claude Code)에서 배추 · 양파 · 홍고추 도매 예측가를 바로 묻게 해 주는 원격 MCP 서버(streamable-http).
운영 백엔드의 공개 조회 API만 부른다 — DB·모델에는 직접 붙지 않는다. 설계는 [`docs/MCP_PLAN.md`](../docs/MCP_PLAN.md).

## 도구

| 도구 | 입력 | 돌려주는 것 |
|---|---|---|
| `get_wholesale_forecast` | `item_name` (배추/양파/홍고추, 비우면 전체) | 진행 중인 순의 예측가(가락시장 경매가 순 평균), 단위, 평균 오차율(운영·백테스트) |

## 연결 (설치 없음)

| 클라이언트 | 방법 |
|---|---|
| claude.ai · Claude Desktop | 설정 → 커넥터 → 커스텀 커넥터 추가 → `https://agriforecast.duckdns.org/mcp` |
| Claude Code | `claude mcp add --transport http agri-forecast https://agriforecast.duckdns.org/mcp` |

그다음 "이번 순 배추 도매가 예측 알려줘" 처럼 묻는다.

## 로컬에서 고치고 확인하기

```
cd KCSPmcp
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt pytest   # 맥·리눅스는 .venv/bin/
.venv/Scripts/python -m pytest -q tests
AGRI_API_BASE_URL=<백엔드 주소> .venv/Scripts/python server.py                 # http://127.0.0.1:3001/mcp
claude mcp add --transport http agri-forecast-local http://127.0.0.1:3001/mcp
```

`AGRI_API_BASE_URL` 이 없으면 `http://localhost:8080`(로컬 백엔드)을 부른다.

## 배포 · 운영 구성

`main` 에 `KCSPmcp/**` 가 들어가면 [`deploy-mcp.yml`](../.github/workflows/deploy-mcp.yml) 이 자동 배포한다
(파일 복사 → venv 에 고정 버전 설치 → 서비스 재시작 → `tools/list` 헬스체크, 실패하면 이전 `server.py` 로 롤백).
PR 단계에선 `ci.yml` 의 `mcp` job 이 테스트와 기동 확인을 한다.

| 항목 | 값 |
|---|---|
| 코드 | `/opt/agri-forecast/mcp/server.py` |
| venv | `/opt/agri-forecast/mcp/venv` (`requirements.txt` 고정 버전) |
| 서비스 | `agriforecast-mcp.service` (이 폴더의 파일이 배포 때 `/etc/systemd/system/` 로 복사된다) |
| 포트 | `127.0.0.1:3001`, nginx `location /mcp` 가 프록시 (버퍼링 끔, `proxy_read_timeout 300s`) |
| 백엔드 | 같은 서버 `http://127.0.0.1:8080` |
| 로그 | `journalctl -u agriforecast-mcp` |

nginx 설정과 HTTPS 인증서(DuckDNS + Let's Encrypt)는 서버에서 직접 관리한다 — 워크플로가 건드리지 않는다.

## 주의

- 순이 바뀐 날(1·11·21일) 새벽 배치 전에는 이번 순 예측이 없을 수 있다 → "아직 예측 없음"으로 답한다
- 조회 전용이다. 수집 트리거(`/api/collect/**`) 같은 쓰기 API는 도구로 만들지 않는다
- 서버 버전(`mcp` · `httpx`)을 바꿀 땐 `requirements.txt` 만 고치면 다음 배포 때 서버 venv 에 반영된다
