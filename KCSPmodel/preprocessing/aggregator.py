import pandas as pd


def get_period(day: int) -> int:
    """day → 순별 index (0=상순, 1=중순, 2=하순)"""
    if day <= 10:
        return 0
    elif day <= 20:
        return 1
    else:
        return 2


def aggregate_price(df: pd.DataFrame) -> pd.DataFrame:
    # TODO: 일별 avg_price → 순별 AVG
    # input:  year, month, day, avg_price
    # output: year, month, period(0/1/2), avg_price
    pass


def aggregate_weather(df: pd.DataFrame) -> pd.DataFrame:
    # TODO: 일별 기상 → 순별 AVG (11개 지점 평균 포함)
    # input:  observation_date, station_code, avg_temp, max_temp, min_temp,
    #         rainfall, solar_radiation, avg_humidity, prev_year_*
    # output: year, month, period, avg_temp, max_temp, min_temp,
    #         rainfall, solar_radiation, avg_humidity, prev_year_*
    pass


def aggregate_supply(df: pd.DataFrame) -> pd.DataFrame:
    # TODO: 일별 total_supply → 순별 SUM
    # input:  year, month, day, total_supply
    # output: year, month, period, total_supply
    pass


def aggregate_exchange(df: pd.DataFrame) -> pd.DataFrame:
    # TODO: 일별 환율 → 순별 AVG
    # input:  base_date, usd_krw, cny_krw
    # output: year, month, period, usd_krw, cny_krw
    pass


def expand_monthly_to_period(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    # TODO: 월별 데이터 → 순별 3행으로 동일값 확장 (CPI, PPI용)
    # input:  year, month, {value_col}
    # output: year, month, period(0/1/2), {value_col}
    pass
