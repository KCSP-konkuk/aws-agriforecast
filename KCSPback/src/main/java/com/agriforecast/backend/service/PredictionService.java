package com.agriforecast.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
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
        "양배추", "head_cabbage_predictions"
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
