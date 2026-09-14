#!/usr/bin/env bash
# agriforecast DB 백업: 매일 1회 덤프 + gzip, 보관 기간 경과분 삭제
set -euo pipefail

DEST=/opt/agri-forecast/backup
KEEP_DAYS=14
SECRET=/opt/agri-forecast/application-secret.properties
DB=agriforecast
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$DEST/${DB}-${STAMP}.sql.gz"

USER=$(grep '^spring.datasource.username=' "$SECRET" | cut -d= -f2-)
PASS=$(grep '^spring.datasource.password=' "$SECRET" | cut -d= -f2-)

mkdir -p "$DEST"

# --single-transaction: InnoDB 무잠금 일관성 스냅샷
MYSQL_PWD="$PASS" mysqldump \
  --user="$USER" \
  --single-transaction --quick --routines --events --triggers --no-tablespaces \
  --default-character-set=utf8mb4 \
  "$DB" | gzip -9 > "$OUT.tmp"

mv "$OUT.tmp" "$OUT"

# 덤프 무결성 확인 (gzip CRC + 종료 마커)
gzip -t "$OUT"
if ! zcat "$OUT" | tail -5 | grep -q "Dump completed"; then
  echo "ERROR: 덤프가 완료 마커 없이 끝남 - $OUT" >&2
  exit 1
fi

SIZE=$(du -h "$OUT" | cut -f1)
ROWS=$(zcat "$OUT" | grep -c '^INSERT INTO' || true)
echo "백업 완료: $(basename "$OUT")  크기 $SIZE  INSERT문 ${ROWS}개"

# 보관 기간 경과분 정리
DELETED=$(find "$DEST" -name "${DB}-*.sql.gz" -mtime +$KEEP_DAYS -print -delete | wc -l | tr -d ' ')
[ "$DELETED" -gt 0 ] && echo "오래된 백업 ${DELETED}개 삭제"
echo "보관 중: $(ls -1 "$DEST"/${DB}-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')개"
