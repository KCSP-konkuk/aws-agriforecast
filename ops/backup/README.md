# DB 백업

`agriforecast` 스키마를 매일 1회 mysqldump로 덤프하고 gzip 압축해 보관한다.

## 동작

- 실행: systemd 타이머 `agriforecast-backup.timer` (매일 UTC 18:00 = KST 03:00)
- 저장: `/opt/agri-forecast/backup/agriforecast-<날짜>-<시각>.sql.gz`
- 보관: **14일**, 경과분 자동 삭제
- 계정: `application-secret.properties`의 DB 계정을 그대로 사용

`--single-transaction`으로 InnoDB를 잠그지 않고 일관된 스냅샷을 뜬다.
`--no-tablespaces`는 PROCESS 전역 권한 없이 덤프하기 위한 옵션이다.

덤프 후 gzip 무결성과 `Dump completed` 마커를 확인하며, 둘 중 하나라도
실패하면 종료 코드 1로 끝나 systemd에서 실패로 잡힌다.

## 수동 실행 · 확인

```
sudo systemctl start agriforecast-backup.service    # 즉시 1회
systemctl list-timers agriforecast-backup           # 다음 실행 시각
journalctl -u agriforecast-backup -n 30             # 로그
ls -lh /opt/agri-forecast/backup/                   # 보관 목록
```

## 복원

```
zcat agriforecast-20260914-082127.sql.gz | sudo mysql agriforecast
```

임시 DB에 먼저 복원해 행수를 대조하는 방식으로 검증할 수 있다.

```
sudo mysql -e "CREATE DATABASE restore_test CHARACTER SET utf8mb4;"
zcat <덤프> | sudo mysql restore_test
sudo mysql -N restore_test -e "SELECT COUNT(*) FROM agri_price;"
sudo mysql -e "DROP DATABASE restore_test;"
```

## 주의

백업이 EC2 인스턴스 안에만 있으므로 **인스턴스가 종료되면 백업도 함께 사라진다.**
장기 보관이 필요하면 S3 동기화나 EBS 스냅샷을 별도로 검토할 것.
