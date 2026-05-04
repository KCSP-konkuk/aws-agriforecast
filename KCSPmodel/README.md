# AgriForecast Model Server

농산물 순별(상순/중순/하순) 가격 예측 FastAPI 서버.

## 기술 스택

- **Runtime**: Python 3.14
- **API**: FastAPI + Uvicorn
- **ML**: XGBoost, scikit-learn, pandas, numpy
- **DB**: MySQL (`agriforecast`) + SQLAlchemy + PyMySQL

## 디렉토리 구조

```
KCSPmodel/
├── main.py                  # FastAPI 앱 진입점 (포트 8000)
├── config.py                # DB 접속 설정
├── requirements.txt
│
├── api/
│   ├── routes.py            # 라우트 정의
│   └── schemas.py           # Pydantic 요청/응답 스키마
│
├── db/
│   ├── connection.py        # SQLAlchemy 엔진/세션
│   └── queries.py           # 테이블별 데이터 조회/저장 함수
│
├── models/
│   ├── trainer.py           # XGBoost 학습 파이프라인
│   ├── predictor.py         # 추론 파이프라인
│   └── saved/               # 학습된 모델 파일 저장소
│                            #   {item_name}_model.json
│                            #   {item_name}_features.json
│
└── preprocessing/
    ├── aggregator.py        # 일별 → 순별 집계 함수
    └── features.py          # 피쳐 엔지니어링
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/health/db` | DB 연결 및 테이블별 row 수 확인 |
| POST | `/api/train/{item_name}` | 품목별 모델 학습 |
| GET | `/api/predict/{item_name}` | 품목별 순별 가격 예측 |
| GET | `/api/model/{item_name}/status` | 모델 학습 상태 및 메트릭 조회 |

## DB 테이블

| 테이블 | 내용 |
|--------|------|
| `agri_price` | 일별 농산물 평균 가격 |
| `station_weather_data` | 지점별 일별 기상 데이터 |
| `supply_data` | 일별 반입량 |
| `exchange_rate_daily` | 일별 환율 (USD/CNY) |
| `oil_price` | 순별 유가 |
| `cpi_data` | 월별 소비자물가지수 |
| `ppi_data` | 월별 생산자물가지수 |

## 실행 방법

```bash
pip install -r requirements.txt
python main.py
```

서버 기동 후 `http://localhost:8000/docs` 에서 Swagger UI 확인 가능.

---

## 구현 현황

### 완료

- FastAPI 앱 골격 및 라우트/스키마 정의
- DB 연결 설정 (`config.py`, `db/connection.py`)
- 순별 인덱스 변환 함수 `get_period(day)` — 0=상순, 1=중순, 2=하순

### 미구현 (TODO)

#### 1. `db/queries.py` — DB 쿼리 함수
나머지 모든 레이어의 기반. 가장 먼저 구현 필요.

- `fetch_agri_price(item_name)` → 일별 가격
- `fetch_weather()` → 지점별 일별 기상
- `fetch_supply(item_name)` → 일별 반입량
- `fetch_exchange_rate()` → 일별 환율
- `fetch_oil_price()` → 순별 유가
- `fetch_cpi()` → 월별 CPI
- `fetch_ppi()` → 월별 PPI
- `save_predictions(item_name, predictions)` → 예측 결과 저장

#### 2. `preprocessing/aggregator.py` — 일별 → 순별 집계

- `aggregate_price(df)` → 일별 avg_price의 순별 AVG
- `aggregate_weather(df)` → 지점별 일별 기상의 순별 AVG (11개 지점 평균 포함)
- `aggregate_supply(df)` → 일별 반입량의 순별 SUM
- `aggregate_exchange(df)` → 일별 환율의 순별 AVG
- `expand_monthly_to_period(df, value_col)` → 월별 데이터(CPI/PPI)를 순별 3행으로 확장

#### 3. `preprocessing/features.py` — 피쳐 엔지니어링

`build_features(df)` 내부 구현:

- 가격 lag / 이동평균 / 모멘텀 피쳐
- 반입량 lag / 이동평균 피쳐
- 환율 lag / 이동평균 피쳐
- 유가 lag / 이동평균 피쳐
- CPI / PPI lag 및 변화율 피쳐
- 기상 lag + 스트레스 지표 피쳐
- 달력 피쳐 (sin/cos 인코딩, 수확기/저장기 플래그, 보릿고개 교차 피쳐)

#### 4. `models/trainer.py` — 학습 파이프라인

`train(item_name)` 구현:

1. `db/queries.py`로 각 테이블 조회
2. `preprocessing/aggregator.py`로 순별 집계
3. `preprocessing/features.py`로 피쳐 엔지니어링
4. TimeSeriesSplit CV + GridSearch 하이퍼파라미터 탐색
5. 최종 모델 학습 후 `models/saved/{item_name}_model.json` 저장
6. 선택 피쳐 목록 `models/saved/{item_name}_features.json` 저장
7. 반환값: `r2`, `rmse`, `mape`, `n_features` 메트릭 dict

#### 5. `models/predictor.py` — 추론 파이프라인

- `predict(item_name)`: 저장된 모델 로드 → 최신 데이터 조회/전처리 → 추론 → DB 저장
- `is_trained(item_name)`: `models/saved/` 내 모델 파일 존재 여부 확인

#### 6. `api/routes.py` — 엔드포인트 실제 연결

`train`, `predict`, `status` 엔드포인트가 현재 더미 응답 반환 중. 위 함수 구현 후 연결 필요.

---

## 개선 필요 사항

| 항목 | 현재 상태 | 개선 방향 |
|------|-----------|-----------|
| 설정 관리 | `config.py`에 DB 비밀번호 하드코딩 | `.env` 파일 + `python-dotenv` 적용 |
| prediction 테이블 | 미존재 | `save_predictions()` 사용을 위한 테이블 생성 |
| 로깅 | 앱 내 로깅 설정 없음 | `logging` 모듈 또는 `loguru` 설정 |
| 에러 핸들링 | 학습/예측 실패 처리 없음 | 각 단계별 예외 처리 및 HTTP 에러 응답 |
| 테스트 | 테스트 코드 전무 | `pytest` 기반 단위/통합 테스트 작성 |

2026년 4월 29일 작성
