import pandas as pd
import numpy as np


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    순별 집계된 df를 받아 모델 입력 피쳐를 생성.
    prediction_model.py의 피쳐 엔지니어링 로직을 이식할 곳.

    input:  year, month, period, avg_price, total_supply,
            usd_krw, cny_krw, avg_temp, max_temp, min_temp,
            rainfall, solar_radiation, avg_humidity, prev_year_*,
            oil_close, cpi, ppi
    output: 위 원본 컬럼 + 생성된 피쳐 컬럼들
    """
    # TODO: 가격 lag/MA/momentum 피쳐
    # TODO: 반입량 lag/MA 피쳐
    # TODO: 환율 lag/MA 피쳐
    # TODO: 유가 lag/MA 피쳐
    # TODO: CPI/PPI lag/변화율 피쳐
    # TODO: 기상 lag + 스트레스 지표 피쳐
    # TODO: 달력 피쳐 (sin/cos, 수확기/저장기, 보릿고개 교차 피쳐)
    pass
