"""서버·외부 API 없이 도는 테스트. 백엔드 응답은 httpx.MockTransport 로 흉내 낸다"""
import httpx

import server

RealClient = httpx.Client  # 도구 테스트에서 httpx.Client 를 바꿔 끼우기 전 원본


def client_with(routes: dict) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        body = routes.get(request.url.path)
        return httpx.Response(200, json=body) if body is not None else httpx.Response(500)
    return RealClient(transport=httpx.MockTransport(handler))


def test_soon_label():
    assert server.soon_label("202610상순") == "2026년 10월 상순(1~10일)"
    assert server.soon_label("202602하순") == "2026년 2월 하순(21일~말일)"
    assert server.soon_label("") == ""


def test_unknown_item_lists_choices():
    res = server.get_wholesale_forecast("감자")
    assert "오류" in res
    assert res["가능한 품목"] == ["배추", "양파", "홍고추"]


def test_forecast_formats_prediction_and_error_rate():
    with client_with({
        "/api/price/agri/predictions": {"predictions": [{"date": "202610상순", "predictedPrice": 15234.6}]},
        "/api/price/agri/prediction-history": {"summary": {"liveMape": 8.1, "liveCount": 5,
                                                           "backtestMape": 9.4, "backtestCount": 24}},
    }) as c:
        res = server.forecast(c, "배추")
    assert res["예측"] == [{"대상 순": "2026년 10월 상순(1~10일)", "예측가(원)": 15235}]
    assert res["평균 오차율(%)"]["운영"] == 8.1
    assert "10kg 망대" in res["가격 기준"]


def test_forecast_without_history_still_returns_prediction():
    # 오차율 API 가 실패해도 예측은 돌려준다
    with client_with({"/api/price/agri/predictions": {"predictions": []}}) as c:
        res = server.forecast(c, "양파")
    assert res["예측"].startswith("아직 예측 없음")
    assert res["평균 오차율(%)"]["운영"] is None


def patch_client(monkeypatch, routes: dict):
    # 도구 함수는 안에서 httpx.Client 를 만들므로 MockTransport 를 끼운 클라이언트로 바꿔 끼운다
    monkeypatch.setattr(server.httpx, "Client", lambda **kw: client_with(routes))


def test_soon_code():
    from datetime import date
    assert server.soon_code(date(2026, 10, 10)) == "202610상순"
    assert server.soon_code(date(2026, 10, 11)) == "202610중순"
    assert server.soon_code(date(2026, 2, 28)) == "202602하순"


def test_soon_averages_marks_current_soon():
    pts = [["2026-09-21", 1000.0], ["2026-09-30", 1100.0], ["2026-10-01", 1200.0], ["2026-10-02", None]]
    res = server.soon_averages(pts, "202610상순")
    assert res == [
        {"순": "2026년 9월 하순(21일~말일)", "평균가(원)": 1050, "조사일 수": 2},
        {"순": "2026년 10월 상순(1~10일) · 진행 중", "평균가(원)": 1200, "조사일 수": 1},
    ]


def test_retail_forecast_with_error_rate(monkeypatch):
    patch_client(monkeypatch, {
        "/api/price/retail/summary": [
            {"itemName": "양파", "unit": "1kg", "latestDate": "2026-10-13", "latestPrice": 2295,
             "prevSoonAvg": 2295, "changePct": 0.0, "prediction": {"target": "202610중순", "price": 2341}},
            {"itemName": "붉은고추", "unit": "100g", "latestDate": None, "latestPrice": None,
             "prevSoonAvg": None, "changePct": None, "prediction": None},
        ],
        "/api/series/data": {"series": [{"id": "forecast_error:붉은고추", "points": [["2026-09-21", 2.0], ["2026-10-01", 4.0]]}]},
    })
    res = server.get_retail_forecast("홍고추")  # 홍고추로 물어도 붉은고추를 찾는다
    [r] = res["결과"]
    assert r["품목"] == "붉은고추"
    assert r["예측"].startswith("아직 예측 없음")
    assert r["평균 오차율(%)"] == {"운영": 3.0, "운영 순 수": 2}

    res = server.get_retail_forecast("양파")
    assert res["결과"][0]["예측"] == [{"대상 순": "2026년 10월 중순(11~20일)", "예측가(원)": 2341}]


def test_retail_forecast_unknown_item(monkeypatch):
    patch_client(monkeypatch, {"/api/price/retail/summary": [{"itemName": "양파", "unit": "1kg"}]})
    res = server.get_retail_forecast("배추")
    assert res["가능한 품목"] == ["양파"]


CATALOG = [
    {"id": "retail:양파", "item": "양파", "source": "KAMIS 소매", "unit": "원/1kg"},
    {"id": "auction:양파", "item": "양파", "source": "가락시장 경매가", "unit": "원/1키로"},
    {"id": "auction:홍고추", "item": "붉은고추", "source": "가락시장 경매가", "unit": "원/10키로"},
    {"id": "forecast:양파", "item": "양파", "source": "예측", "unit": "원/1kg"},  # 가격이 아니라 빠진다
    {"id": "fx:usd", "item": None, "source": "환율", "unit": "원/달러"},
]


def test_actual_prices_all_kinds(monkeypatch):
    patch_client(monkeypatch, {
        "/api/series/catalog": CATALOG,
        "/api/series/data": {"series": [
            {"id": "retail:양파", "points": [["2026-09-01", 2000.0], ["2026-09-02", 2100.0]]},
            {"id": "auction:양파", "points": [["2026-09-15", 1200.0]]},
        ]},
    })
    res = server.get_actual_prices("양파", start_date="2026-09-01", end_date="2026-09-30")
    assert res["기간"] == "2026-09-01 ~ 2026-09-30"
    [onion] = res["결과"]
    assert [(p["구분"], p["단위"]) for p in onion["가격"]] == [("소매", "1kg"), ("경매", "1키로")]
    assert onion["가격"][0]["순별 평균"] == [{"순": "2026년 9월 상순(1~10일)", "평균가(원)": 2050, "조사일 수": 2}]


def test_actual_prices_alias_and_errors(monkeypatch):
    patch_client(monkeypatch, {"/api/series/catalog": CATALOG,
                               "/api/series/data": {"series": [{"id": "auction:홍고추", "points": []}]}})
    assert server.get_actual_prices("홍고추", start_date="2026-09-01")["결과"] == "이 기간에 가격 데이터가 없음"
    assert server.get_actual_prices("감자")["가능한 품목"] == ["붉은고추", "양파"]
    assert "가능한 구분" in server.get_actual_prices(price_type="산지")
    assert "오류" in server.get_actual_prices(start_date="2026/09/01")
    assert "오류" in server.get_actual_prices(start_date="2024-01-01", end_date="2026-01-01")
