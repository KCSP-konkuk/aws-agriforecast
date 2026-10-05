"""서버·외부 API 없이 도는 테스트. 백엔드 응답은 httpx.MockTransport 로 흉내 낸다"""
import httpx

import server


def client_with(routes: dict) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        body = routes.get(request.url.path)
        return httpx.Response(200, json=body) if body is not None else httpx.Response(500)
    return httpx.Client(transport=httpx.MockTransport(handler))


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
