# 배추 순별 가격 예측 배치

`pipeline.py`가 순별(10일) 단위로 다음 1순의 배추 도매가를 예측해
`cabbage_predictions` 테이블에 적재한다. 백엔드는 이 테이블을 조회만 한다.

## 동작

1. 기상청 ASOS API로 해남(261)·태백(216) 일별 관측을 받아 순별 집계
   - 두 지점은 일사량 미관측 → 목포(165)·대관령(100) 값으로 보완
   - 마지막 보유 순은 진행 중일 수 있으므로 해당 월부터 다시 받아 덮어씀
2. DB에서 2026년 이후 가격·반입량·검색량을 순별 집계
   - 가격 = 순 내 일별 평균, 반입량 = 순 내 합계, 검색량 = 순 내 평균
3. `data/hist_*.csv`(2018~2025)와 결합
4. XGBoost 학습 후 다음 1순 예측
5. `cabbage_predictions` upsert + 지난 순의 실제가/오차율 갱신

## 배치 실행

```
sudo systemctl start agriforecast-predict.service   # 즉시 1회
systemctl list-timers agriforecast-predict          # 다음 실행 시각
journalctl -u agriforecast-predict -n 50            # 로그
```

타이머는 매일 UTC 20:30(KST 05:30) 실행. 순이 바뀌면 예측 대상이 자동으로 다음 순이 된다.

## 서버 배치 경로

```
/opt/agri-forecast/model/pipeline.py
/opt/agri-forecast/model/data/*.csv
/opt/agri-forecast/model/venv/          # pandas==2.2.3 고정 (3.x 미지원)
/etc/systemd/system/agriforecast-predict.{service,timer}
```

DB 접속정보와 기상청 인증키는 `/opt/agri-forecast/application-secret.properties`에서 읽는다.
