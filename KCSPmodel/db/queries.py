import pandas as pd
from sqlalchemy import text
from db.connection import engine


def fetch_agri_price(item_name: str) -> pd.DataFrame:
    # TODO: agri_price 테이블에서 item_name 기준 일별 가격 조회
    # columns: year, month, day, avg_price
    pass


def fetch_weather() -> pd.DataFrame:
    # TODO: station_weather_data 테이블에서 전 지점 일별 기상 조회
    # columns: observation_date, station_code, avg_temp, max_temp, min_temp,
    #          rainfall, solar_radiation, avg_humidity, prev_year_*
    pass


def fetch_supply(item_name: str) -> pd.DataFrame:
    # TODO: supply_data 테이블에서 item_name 기준 일별 반입량 조회
    # columns: year, month, day, total_supply
    pass


def fetch_exchange_rate() -> pd.DataFrame:
    # TODO: exchange_rate_daily 테이블에서 일별 환율 조회
    # columns: base_date, usd_krw, cny_krw
    pass


def fetch_oil_price() -> pd.DataFrame:
    # TODO: oil_price 테이블에서 순별 유가 조회 (INTERNATIONAL, DUBAI or WTI)
    # columns: year, month, period_type, close_price
    pass


def fetch_cpi() -> pd.DataFrame:
    # TODO: cpi_data 테이블에서 월별 CPI 조회
    # columns: year, month, cpi
    pass


def fetch_ppi() -> pd.DataFrame:
    # TODO: ppi_data 테이블에서 월별 PPI 조회
    # columns: year, month, ppi
    pass


def save_predictions(item_name: str, predictions: list[dict]) -> None:
    # TODO: prediction 테이블에 예측 결과 저장
    pass
