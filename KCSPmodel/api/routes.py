from fastapi import APIRouter, HTTPException
from api.schemas import TrainResponse, PredictResponse, ModelStatusResponse
from models import trainer, predictor
from db.connection import engine
from sqlalchemy import text

router = APIRouter()


@router.get("/health/db")
def db_health():
    """DB 연결 및 각 테이블 row 수 확인"""
    tables = [
        "agri_price", "station_weather_data", "supply_data",
        "exchange_rate_daily", "oil_price", "cpi_data", "ppi_data"
    ]
    result = {}
    try:
        with engine.connect() as conn:
            for table in tables:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                result[table] = count
        return {"status": "ok", "tables": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train/{item_name}", response_model=TrainResponse)
def train_model(item_name: str):
    # TODO: trainer.train(item_name) 호출
    return TrainResponse(item_name=item_name, status="pending", message="학습 기능 미구현")


@router.get("/predict/{item_name}", response_model=PredictResponse)
def predict(item_name: str):
    # TODO: predictor.predict(item_name) 호출
    return PredictResponse(item_name=item_name, predictions=[])


@router.get("/model/{item_name}/status", response_model=ModelStatusResponse)
def model_status(item_name: str):
    # TODO: 모델 메타 정보 반환
    return ModelStatusResponse(item_name=item_name, is_trained=False)
