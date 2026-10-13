"""
농산물 가격 예측 · 실제 가격 MCP 서버 (streamable-http)

운영 백엔드의 공개 조회 API를 그대로 부른다. DB·모델에는 직접 붙지 않는다.
  - GET /api/price/agri/predictions        도매 예측 (진행 중인 순 이후)
  - GET /api/price/agri/prediction-history 도매 평균 오차율(백테스트·운영)
  - GET /api/price/retail/summary          소매 예측 · 최근 조사가
  - GET /api/series/catalog · /data        통합 시계열 — 품목별 실제 가격(소매·도매·경매)과 소매 예측 오차

백엔드 주소는 환경변수 AGRI_API_BASE_URL (예: http://<서버>). 도매 품목·단위는 상세 화면(Detail.jsx)과 같다.
"""
import os
from datetime import date, datetime, timedelta, timezone

import httpx
from mcp.server.mcpserver import MCPServer

BASE_URL = os.environ.get("AGRI_API_BASE_URL", "http://localhost:8080").rstrip("/")
SITE_URL = os.environ.get("AGRI_SITE_URL", "https://agriforecast.duckdns.org").rstrip("/")
TIMEOUT = 10.0

# 운영 중인 도매 예측 모델 (docs/MODELS.md 2절). 가격은 가락시장 경매가(농넷)
UNITS = {"배추": "10kg 망대", "양파": "1kg", "홍고추": "10kg 상자(상)"}

SOON_DAYS = {"상순": "1~10일", "중순": "11~20일", "하순": "21일~말일"}

KST = timezone(timedelta(hours=9))

# 통합 시계열(series_catalog)의 가격 지표 접두어 → 구분. 배치 KCSPmodel/batch/pipeline_series.py 가 만든다
PRICE_KINDS = {"retail": "소매", "wholesale": "도매", "auction": "경매"}
# 시계열 · 소매 품목명은 KAMIS 이름(붉은고추)이다. 도매 예측 쪽 이름(홍고추)으로 물어도 찾게 한다
ITEM_ALIASES = {"홍고추": "붉은고추"}
SERIES_BATCH = 8           # /api/series/data 한 번에 받을 수 있는 지표 수 (SeriesService.MAX_SERIES)
DEFAULT_DAYS = 90          # 기간을 비우면 최근 약 3달 (9순)
MAX_DAYS_ALL_ITEMS = 366   # 전 품목을 한꺼번에 받을 때 최대 기간 — 응답이 너무 커지지 않게

mcp = MCPServer("agri-forecast")


def soon_label(code: str) -> str:
    """'202610상순' → '2026년 10월 상순(1~10일)'. 규칙은 KCSPback util/Soon.java 와 같다"""
    if not code or len(code) < 8:
        return code
    part = code[6:]
    return f"{code[:4]}년 {int(code[4:6])}월 {part}({SOON_DAYS.get(part, '')})"


def soon_code(d: date) -> str:
    """날짜 → 순 코드 '202610상순'. 1~10일 상순 / 11~20일 중순 / 21일~ 하순"""
    part = "상순" if d.day <= 10 else "중순" if d.day <= 20 else "하순"
    return f"{d.year}{d.month:02d}{part}"


def today_kst() -> date:
    return datetime.now(KST).date()


def get_json(client: httpx.Client, path: str, item: str | None = None, **params) -> dict | list:
    if item is not None:
        params["itemName"] = item
    r = client.get(f"{BASE_URL}{path}", params=params)
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


def retail_error_rates(client: httpx.Client, items: list[str]) -> dict:
    """품목 → (운영 평균 오차율 %, 순 수). 소매 예측 오차는 통합 시계열 forecast_error:<품목> 에 순별로 쌓인다"""
    out = {}
    for i in range(0, len(items), SERIES_BATCH):
        ids = ",".join(f"forecast_error:{it}" for it in items[i:i + SERIES_BATCH])
        for s in get_json(client, "/api/series/data", ids=ids).get("series", []):
            vals = [v for _, v in s.get("points", []) if v is not None]
            out[s["id"].split(":", 1)[1]] = (round(sum(vals) / len(vals), 2) if vals else None, len(vals))
    return out


def retail_forecast(row: dict, error: tuple) -> dict:
    p = row.get("prediction")
    return {
        "품목": row["itemName"],
        "가격 기준": f"서울 전통시장(경동·복조리) 소매가 순 평균, {row['unit']} 당 원",
        "예측": [{"대상 순": soon_label(p["target"]), "예측가(원)": p["price"]}] if p
        else "아직 예측 없음 (매일 새벽 배치가 다음 순의 예측을 낸다)",
        "최근 조사가": {"날짜": row.get("latestDate"), "가격(원)": row.get("latestPrice"),
                    "직전 순 평균(원)": row.get("prevSoonAvg"), "직전 순 대비(%)": row.get("changePct")},
        "평균 오차율(%)": {"운영": error[0], "운영 순 수": error[1]},
    }


@mcp.tool()
def get_retail_forecast(item_name: str | None = None) -> dict:
    """농산물 소매가(서울 전통시장 경동·복조리 평균) AI 예측을 조회한다.

    품목: 양파, 붉은고추, 양배추, 애호박, 시금치, 오이, 파프리카. 비우면 모두.
    순(1~10일 상순 / 11~20일 중순 / 21일~ 하순) 단위로 순 1개의 평균 소매가만 예측한다.
    최근 조사가와 직전 순 평균, 운영 평균 오차율을 함께 돌려준다. 예측은 참고용이다.
    """
    item = ITEM_ALIASES.get(item_name, item_name)
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            rows = get_json(client, "/api/price/retail/summary")
            names = [r["itemName"] for r in rows]
            if item is not None and item not in names:
                return {"오류": f"소매 예측이 없는 품목: {item_name}", "가능한 품목": names}
            rows = [r for r in rows if item is None or r["itemName"] == item]
            try:
                errors = retail_error_rates(client, [r["itemName"] for r in rows])
            except httpx.HTTPError:
                errors = {}  # 오차율은 덤이라 실패해도 예측은 돌려준다
            return {"결과": [retail_forecast(r, errors.get(r["itemName"], (None, 0))) for r in rows]}
    except httpx.HTTPError as e:
        return {"오류": f"예측 서버에 연결하지 못했다 ({BASE_URL}): {e}"}


def soon_averages(points: list, current: str) -> list[dict]:
    """[[날짜, 값], …] 일별 → 순별 평균 (값이 있는 날만). 진행 중인 순은 표시한다"""
    by_soon: dict[str, list[float]] = {}
    for d, v in points:
        if v is not None:
            by_soon.setdefault(soon_code(date.fromisoformat(d)), []).append(v)
    return [
        {"순": soon_label(code) + (" · 진행 중" if code == current else ""),
         "평균가(원)": round(sum(vals) / len(vals)), "조사일 수": len(vals)}
        for code, vals in sorted(by_soon.items())
    ]


def kind(series_id: str) -> str | None:
    return PRICE_KINDS.get(series_id.split(":", 1)[0])


@mcp.tool()
def get_actual_prices(item_name: str | None = None, price_type: str | None = None,
                      start_date: str | None = None, end_date: str | None = None) -> dict:
    """농산물 실제 가격을 순(1~10일 상순 / 11~20일 중순 / 21일~ 하순)별 평균으로 조회한다.

    item_name: 품목 (예: 배추, 양파, 붉은고추(=홍고추), 감자, 사과 …). 비우면 데이터가 있는 모든 품목.
    price_type: 소매(서울 전통시장 경동·복조리 평균) / 도매(KAMIS 가락도매 중도매인 판매가) /
                경매(가락시장 경매가 상 등급, 도매 예측의 기준). 비우면 모두.
    start_date, end_date: YYYY-MM-DD. 비우면 최근 90일. 전 품목을 한꺼번에 받을 땐 1년까지.
    데이터가 있는 순만 돌려준다. 품목 · 구분마다 단위가 다르니 '단위'를 함께 본다.
    """
    if price_type is not None and price_type not in PRICE_KINDS.values():
        return {"오류": f"없는 가격 구분: {price_type}", "가능한 구분": list(PRICE_KINDS.values())}
    try:
        end = date.fromisoformat(end_date) if end_date else today_kst()
        start = date.fromisoformat(start_date) if start_date else end - timedelta(days=DEFAULT_DAYS)
    except ValueError:
        return {"오류": "날짜는 YYYY-MM-DD 형식으로 적어 주세요."}
    if start > end:
        return {"오류": "시작일이 종료일보다 늦어요."}
    if item_name is None and (end - start).days > MAX_DAYS_ALL_ITEMS:
        return {"오류": f"전 품목은 {MAX_DAYS_ALL_ITEMS}일까지만 한 번에 조회한다. 기간을 줄이거나 품목을 정해 주세요."}
    item = ITEM_ALIASES.get(item_name, item_name)
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            catalog = [s for s in get_json(client, "/api/series/catalog") if kind(s["id"]) and s.get("item")]
            items = sorted({s["item"] for s in catalog})
            if item is not None and item not in items:
                return {"오류": f"가격 데이터가 없는 품목: {item_name}", "가능한 품목": items}
            chosen = [s for s in catalog if (item is None or s["item"] == item)
                      and (price_type is None or kind(s["id"]) == price_type)]
            points = {}
            for i in range(0, len(chosen), SERIES_BATCH):
                ids = ",".join(s["id"] for s in chosen[i:i + SERIES_BATCH])
                data = get_json(client, "/api/series/data", ids=ids,
                                **{"from": start.isoformat(), "to": end.isoformat()})
                points.update({s["id"]: s.get("points", []) for s in data.get("series", [])})
    except httpx.HTTPError as e:
        return {"오류": f"가격 서버에 연결하지 못했다 ({BASE_URL}): {e}"}

    current = soon_code(today_kst())
    result: dict[str, list] = {}
    for s in chosen:
        soons = soon_averages(points.get(s["id"], []), current)
        if soons:
            result.setdefault(s["item"], []).append({
                "구분": kind(s["id"]), "출처": s.get("source"),
                "단위": (s.get("unit") or "").removeprefix("원/"), "순별 평균": soons,
            })
    return {
        "기간": f"{start.isoformat()} ~ {end.isoformat()}",
        "결과": [{"품목": k, "가격": v} for k, v in result.items()] or "이 기간에 가격 데이터가 없음",
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="127.0.0.1", port=3001,
            stateless_http=True)