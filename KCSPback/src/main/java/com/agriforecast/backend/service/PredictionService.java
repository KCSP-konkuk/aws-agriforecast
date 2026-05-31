package com.agriforecast.backend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

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

        // 가장 최근 예측 기준 최대 60건, 날짜 오름차순으로 반환
        String sql =
            "SELECT target_date, predicted_price, actual_price, error_pct " +
            "FROM (SELECT target_date, predicted_price, actual_price, error_pct " +
            "      FROM " + tableName + " ORDER BY target_date DESC LIMIT 60) sub " +
            "ORDER BY target_date ASC";

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", rs.getString("target_date"));
            row.put("predictedPrice", rs.getObject("predicted_price"));
            row.put("actualPrice",    rs.getObject("actual_price"));
            row.put("errorPct",       rs.getObject("error_pct"));
            return row;
        });
    }
}
