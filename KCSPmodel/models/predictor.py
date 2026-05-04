import pandas as pd


def predict(item_name: str) -> list[dict]:
    """
    저장된 모델로 item_name의 다음 순별 가격을 예측하고 DB에 저장.

    1. models/saved/{item_name}_model.json 로드
    2. models/saved/{item_name}_features.json 로 피쳐 목록 로드
    3. DB에서 최신 데이터 조회 → 전처리 → 피쳐 생성
    4. 모델 추론
    5. db/queries.py save_predictions() 로 결과 저장

    Returns:
        list[dict]: [{"year": ..., "month": ..., "period": ..., "predicted_price": ...}, ...]
    """
    # TODO: implement
    pass


def is_trained(item_name: str) -> bool:
    """저장된 모델 파일 존재 여부 확인"""
    # TODO: implement
    pass
