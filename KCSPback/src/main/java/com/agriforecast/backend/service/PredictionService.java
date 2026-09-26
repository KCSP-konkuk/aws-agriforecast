package com.agriforecast.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PredictionService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final Map<String, String> ITEM_TABLE = Map.of(
        "양파",   "onion_predictions",
        "배추",   "cabbage_predictions",
        "당근",   "carrot_predictions",
        "양배추", "head_cabbage_predictions",
        "홍고추", "redpepper_predictions"
    );

    public List<Map<String, Object>> getPredictions(String itemName) {
        String tableName = ITEM_TABLE.get(itemName);
        if (tableName == null) return Collections.emptyList();

        // target_date가 "202606상순" 형식의 문자열이므로 SQL DATE 비교 불가 → 전체 조회 후 Java 필터링
        String sql =
            "SELECT target_date, predicted_price, actual_price, error_pct " +
            "FROM " + tableName + " " +
            "ORDER BY target_date ASC";

        List<Map<String, Object>> all = jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", rs.getString("target_date"));
            row.put("predictedPrice", rs.getObject("predicted_price"));
            row.put("actualPrice",    rs.getObject("actual_price"));
            row.put("errorPct",       rs.getObject("error_pct"));
            return row;
        });

        LocalDate today = LocalDate.now();
        int currentRank = periodRank(today.getYear(), today.getMonthValue(), today.getDayOfMonth());

        return all.stream()
                .filter(row -> parsePeriodRank((String) row.get("date")) >= currentRank)
                .collect(Collectors.toList());
    }

    /**
     * 예측 적중 이력. 두 종류를 따로 돌려준다.
     *  - backtest: {품목}_backtest — 2026년 완료 순마다 "그 직전까지 데이터로 학습했다면"의 예측 (배치 --backtest 로 1회 생성)
     *  - live: {품목}_predictions 중 실제가가 확정된 순 — 매일 배치가 실제로 낸 예측
     * 테이블이 아직 없으면 빈 목록
     */
    public Map<String, Object> getHistory(String itemName) {
        String liveTable = ITEM_TABLE.get(itemName);
        List<Map<String, Object>> backtest = List.of();
        List<Map<String, Object>> live = List.of();
        if (liveTable != null) {
            backtest = queryResolved(liveTable.replace("_predictions", "_backtest"));
            live = queryResolved(liveTable);
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("backtestMape", mape(backtest));
        summary.put("backtestCount", backtest.size());
        summary.put("liveMape", mape(live));
        summary.put("liveCount", live.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("itemName", itemName);
        result.put("backtest", backtest);
        result.put("live", live);
        result.put("summary", summary);
        return result;
    }

    // 실제가가 있는 행만, 순 순서로 (테이블 이름은 ITEM_TABLE 에서만 온다)
    private List<Map<String, Object>> queryResolved(String table) {
        String sql = "SELECT target_date, predicted_price, actual_price, error_pct FROM " + table +
                     " WHERE actual_price IS NOT NULL AND predicted_price IS NOT NULL";
        try {
            List<Map<String, Object>> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("date", rs.getString("target_date"));
                row.put("predictedPrice", rs.getDouble("predicted_price"));
                row.put("actualPrice", rs.getDouble("actual_price"));
                row.put("errorPct", rs.getObject("error_pct"));
                return row;
            });
            rows.sort(Comparator.comparingInt(r -> parsePeriodRank((String) r.get("date"))));
            return rows;
        } catch (DataAccessException e) {
            return List.of();  // 백테스트를 아직 돌리지 않았거나 예측 모델이 없는 품목
        }
    }

    /** 평균 절대 오차율(%). 계산할 행이 없으면 null */
    static Double mape(List<Map<String, Object>> rows) {
        double sum = 0;
        int n = 0;
        for (Map<String, Object> r : rows) {
            double actual = ((Number) r.get("actualPrice")).doubleValue();
            if (actual == 0) continue;
            sum += Math.abs(((Number) r.get("predictedPrice")).doubleValue() - actual) / actual * 100;
            n++;
        }
        return n == 0 ? null : Math.round(sum / n * 100) / 100.0;
    }

    // year*10000 + month*10 + 순번(상=1,중=2,하=3)
    private int periodRank(int year, int month, int day) {
        int decade = day <= 10 ? 1 : day <= 20 ? 2 : 3;
        return year * 10000 + month * 10 + decade;
    }

    // "202606상순" → 정수 랭크 (비교용)
    private int parsePeriodRank(String code) {
        if (code == null || code.length() < 7) return 0;
        try {
            int year  = Integer.parseInt(code.substring(0, 4));
            int month = Integer.parseInt(code.substring(4, 6));
            String ds = code.substring(6);
            int decade = "상순".equals(ds) ? 1 : "중순".equals(ds) ? 2 : 3;
            return year * 10000 + month * 10 + decade;
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
