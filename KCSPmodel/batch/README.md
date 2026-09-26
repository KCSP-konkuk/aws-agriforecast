# 순별 가격 예측 배치

| 품목 | 파이프라인 | 결과 테이블 | 실행 (KST) | 로그 |
|---|---|---|---|---|
| 배추 | `pipeline.py` | `cabbage_predictions` | 05:30 (+최대 10분) | `journalctl -u agriforecast-predict` |
| 양파 | `pipeline_onion.py` | `onion_predictions` | 05:50 (+최대 10분) | `journalctl -u agriforecast-predict-onion` |
| 홍고추 | `pipeline_redpepper.py` | `redpepper_predictions` | 06:10 (+최대 10분) | `journalctl -u agriforecast-predict-redpepper` |

- 품목마다 입력·모델이 다르다. 차이는 각 파이프라인 파일 맨 위 설명에 적혀 있다 — **다른 품목 코드를 복사해 쓰기 전에 읽을 것**
  - 홍고추는 가격을 직접 맞히지 않고 비율을 맞힌다, DB 대신 농넷·데이터랩을 직접 받는다, 서버 캐시(`data/cache_*.csv`)를 쓴다
- 테스트: `python -m pytest tests` (외부 요청·DB 없이 돈다, PR 마다 CI). 현재 홍고추만 있다 — 배추·양파를 고칠 때 붙일 것
- 배포·타이머·주의점은 루트 `CONTRIBUTING.md` 3·6절

아래는 배추(`pipeline.py`) 설명이다.

## 배추

`pipeline.py`가 순별(10일) 단위로 다음 1순의 배추 도매가를 예측해
`cabbage_predictions` 테이블에 적재한다. 백엔드는 이 테이블을 조회만 한다.

### 동작

1. 기상청 ASOS API로 해남(261)·태백(216) 일별 관측을 받아 순별 집계
   - 두 지점은 일사량 미관측 → 목포(165)·대관령(100) 값으로 보완
   - 마지막 보유 순은 진행 중일 수 있으므로 해당 월부터 다시 받아 덮어씀
2. DB에서 2026년 이후 가격·반입량·검색량을 순별 집계
   - 가격 = 순 내 일별 평균, 반입량 = 순 내 합계, 검색량 = 순 내 평균
3. `data/hist_*.csv`(2018~2025)와 결합
4. XGBoost 학습 후 다음 1순 예측
5. `cabbage_predictions` upsert + 지난 순의 실제가/오차율 갱신

### 배치 실행

```
sudo systemctl start agriforecast-predict.service   # 즉시 1회
systemctl list-timers agriforecast-predict          # 다음 실행 시각
journalctl -u agriforecast-predict -n 50            # 로그
```

타이머는 매일 UTC 20:30(KST 05:30) 실행. 순이 바뀌면 예측 대상이 자동으로 다음 순이 된다.

### 서버 배치 경로

```
/opt/agri-forecast/model/pipeline.py
/opt/agri-forecast/model/data/*.csv
/opt/agri-forecast/model/venv/          # pandas==2.2.3 고정 (3.x 미지원)
/etc/systemd/system/agriforecast-predict.{service,timer}
```

DB 접속정보와 기상청 인증키는 `/opt/agri-forecast/application-secret.properties`에서 읽는다.
