from pydantic import BaseModel
from typing import Optional


class TrainResponse(BaseModel):
    item_name: str
    status: str
    message: str


class PredictionItem(BaseModel):
    year: int
    month: int
    period: int          # 0=상순, 1=중순, 2=하순
    predicted_price: float


class PredictResponse(BaseModel):
    item_name: str
    predictions: list[PredictionItem]


class ModelStatusResponse(BaseModel):
    item_name: str
    is_trained: bool
    last_trained: Optional[str] = None
    metrics: Optional[dict] = None
