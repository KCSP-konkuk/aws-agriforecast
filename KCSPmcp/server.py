"""
도매 예측가 MCP 서버 (streamable-http)

운영 백엔드의 공개 조회 API를 그대로 부른다. DB·모델에는 직접 붙지 않는다.
  - GET /api/price/agri/predictions        진행 중인 순 이후 예측
  - GET /api/price/agri/prediction-history 평균 오차율(백테스트·운영)

백엔드 주소는 환경변수 AGRI_API_BASE_URL (예: http://<서버>). 품목·단위는 상세 화면(Detail.jsx)과 같다.
"""
import os

import httpx
from mcp.server.mcpserver import MCPServer

BASE_URL = os.environ.get("AGRI_API_BASE_URL", "http://localhost:8080").rstrip("/")
SITE_URL = os.environ.get("AGRI_SITE_URL", "https://agriforecast.duckdns.org").rstrip("/")
TIMEOUT = 10.0

# 운영 중인 도매 예측 모델 (docs/MODELS.md 2절). 가격은 가락시장 경매가(농넷)
UNITS = {"배추": "10kg 망대", "양파": "1kg", "홍고추": "10kg 상자(상)"}

SOON_DAYS = {"상순": "1~10일", "중순": "11~20일", "하순": "21일~말일"}

mcp = MCPServer("agri-forecast")


def soon_label(code: str) -> str:
    """'202610상순' → '2026년 10월 상순(1~10일)'. 규칙은 KCSPback util/Soon.java 와 같다"""
    if not code or len(code) < 8:
        return code
    part = code[6:]
    return f"{code[:4]}년 {int(code[4:6])}월 {part}({SOON_DAYS.get(part, '')})"


def get_json(client: httpx.Client, path: str, item: str) -> dict:
    r = client.get(f"{BASE_URL}{path}", params={"itemName": item})
    r.raise_for_status()
    return r.json()


def forecast(client: httpx.Client, item: str) -> dict:
    preds = get_json(client, "/api/price/agri/predictions", item).get("predictions", [])
    try:
        summary = get_json(client, "/api/price/agri/prediction-history", item).get("summary", {})
    except httpx.HTTPError:
        summary = {}  # 오차율은 덤이라 실패해도 예측은 돌려준다
    return {
        "품목": item,
        "가격 기준": f"가락시장 경매가 순 평균, {UNITS[item]} 당 원",
        "예측": [
            {"대상 순": soon_label(p["date"]), "예측가(원)": round(p["predictedPrice"])}
            for p in preds if p.get("predictedPrice") is not None
        ] or "아직 예측 없음 (매일 새벽 배치가 진행 중인 순의 예측을 낸다)",
        "평균 오차율(%)": {
            "운영": summary.get("liveMape"), "운영 순 수": summary.get("liveCount"),
            "백테스트": summary.get("backtestMape"), "백테스트 순 수": summary.get("backtestCount"),
        },
        "상세 보기": f"{SITE_URL}/?item={item}",
    }


@mcp.tool()
def get_wholesale_forecast(item_name: str | None = None) -> dict:
    """농산물 도매가(가락시장 경매가) AI 예측을 조회한다.

    품목: 배추, 양파, 홍고추. 비우면 세 품목 모두.
    순(1~10일 상순 / 11~20일 중순 / 21일~ 하순) 단위로 진행 중인 순 1개의 평균 가격만 예측한다.
    다음 달이나 더 먼 미래의 예측은 없다. 예측은 참고용이며 평균 오차율을 함께 돌려준다.
    """
    if item_name is not None and item_name not in UNITS:
        return {"오류": f"도매 예측이 없는 품목: {item_name}", "가능한 품목": list(UNITS)}
    items = [item_name] if item_name else list(UNITS)
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            return {"결과": [forecast(client, i) for i in items]}
    except httpx.HTTPError as e:
        return {"오류": f"예측 서버에 연결하지 못했다 ({BASE_URL}): {e}"}


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="127.0.0.1", port=3001,
            stateless_http=True)