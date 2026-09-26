"""순별 예측 백테스트 공통 부분 — 세 파이프라인이 `--backtest` 로 실행될 때 쓴다.

백테스트 = 이미 가격이 확정된 과거 순마다 "그 순 직전까지의 데이터만으로 학습해 예측했다면"을 다시 계산한다.
  - 대상: BACKTEST_START(2026년 상순)부터 마지막 완료 순까지. 상세 화면 가격이 2026년부터라 차트에 겹쳐 보이게 한다
  - 입력·피쳐·모델 설정은 매일 도는 예측과 같다. 대상 순 행의 피쳐는 모두 직전 순까지의 값(shift ≥ 1)이라
    학습 행만 대상 순보다 앞으로 자르면 그때 알 수 없던 정보는 쓰이지 않는다
  - 결과는 {품목}_backtest 테이블에만 쓴다. 운영 예측 테이블({품목}_predictions)은 건드리지 않는다
  - 피쳐·하이퍼파라미터는 2025년 이전 검증으로 고른 값이다. 2026년 순은 그 선택에 쓰이지 않았다

실행 (서버, 한 번):
  cd /opt/agri-forecast/model && venv/bin/python pipeline.py --backtest
"""
import sys

BACKTEST_START = '202601상순'


def requested():
    return '--backtest' in sys.argv[1:]


def targets(dates, known):
    """백테스트할 순 목록. dates: 시간순 DATE(예: '202603중순'), known: 실제 가격이 있는지(bool 목록).
    '상'<'중'<'하' 가 유니코드 순서와 같아 문자열 비교로 순서가 맞는다"""
    return [d for d, k in zip(dates, known) if k and str(d) >= BACKTEST_START]


def error_pct(pred, actual):
    return round(abs(pred - actual) / actual * 100, 2) if actual else None


def mape(rows):
    errs = [r['error_pct'] for r in rows if r['error_pct'] is not None]
    return round(sum(errs) / len(errs), 2) if errs else None


def save(conn, table, rows):
    """rows: [{target_date, predicted_price, actual_price, error_pct, trained_until}] — 같은 순은 덮어쓴다"""
    with conn.cursor() as cur:
        cur.execute(f"""CREATE TABLE IF NOT EXISTS {table} (
                           target_date VARCHAR(16) PRIMARY KEY,
                           predicted_price DOUBLE,
                           actual_price DOUBLE,
                           error_pct DOUBLE,
                           trained_until VARCHAR(16),
                           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)""")
        for r in rows:
            cur.execute(f"""INSERT INTO {table} (target_date, predicted_price, actual_price, error_pct, trained_until)
                            VALUES (%s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE predicted_price=VALUES(predicted_price),
                              actual_price=VALUES(actual_price), error_pct=VALUES(error_pct),
                              trained_until=VALUES(trained_until)""",
                        (r['target_date'], round(r['predicted_price'], 2), float(r['actual_price']),
                         r['error_pct'], r['trained_until']))
    conn.commit()


def row(target, pred, actual, trained_until):
    return {'target_date': str(target), 'predicted_price': float(pred), 'actual_price': float(actual),
            'error_pct': error_pct(float(pred), float(actual)), 'trained_until': str(trained_until)}
