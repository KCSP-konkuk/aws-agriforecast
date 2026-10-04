package com.agriforecast.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 분석 작업대 통합 시계열 조회.
 *
 * <p>모델 배치 {@code KCSPmodel/batch/pipeline_series.py} 가 매일 12:50 KST 에 흩어진 지표를
 * {@code series_catalog}(지표 설명) · {@code series_value}(지표 · 날짜 · 값)로 모은다.
 * 백엔드는 원래 주기 그대로 내려주기만 하고, 주기 맞추기·변환·시차는 화면이 계산한다 —
 * 그래서 품목·지표 이름을 코드에 두지 않는다. 설계: docs/superpowers/specs/2026-10-04-analysis-workbench-design.md
 */
@Service
public class SeriesService {

    private static final Logger logger = LoggerFactory.getLogger(SeriesService.class);

    /** 한 번에 받을 수 있는 지표 수 (작업대에서 고를 수 있는 최대 개수와 같다) */
    public static final int MAX_SERIES = 8;

    private final JdbcTemplate jdbcTemplate;

    public SeriesService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** 지표 목록 (분류·품목 순). 배치 첫 실행 전이라 테이블이 없으면 빈 목록 */
    public List<Map<String, Object>> catalog() {
        try {
            return jdbcTemplate.query(
                    "SELECT series_id, name, item, category, source, unit, freq, agg, first_date, last_date, n_points"
                            + " FROM series_catalog ORDER BY sort_order, series_id",
                    (rs, rowNum) -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("id", rs.getString("series_id"));
                        m.put("name", rs.getString("name"));
                        m.put("item", rs.getString("item"));
                        m.put("category", rs.getString("category"));
                        m.put("source", rs.getString("source"));
                        m.put("unit", rs.getString("unit"));
                        m.put("freq", rs.getString("freq"));
                        m.put("agg", rs.getString("agg"));
                        m.put("firstDate", text(rs.getDate("first_date")));
                        m.put("lastDate", text(rs.getDate("last_date")));
                        m.put("points", rs.getInt("n_points"));
                        return m;
                    });
        } catch (DataAccessException e) {
            logger.warn("시계열 목록 조회 실패(배치 첫 실행 전일 수 있음): {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 고른 지표의 값 — 요청한 순서대로, 각 지표는 [날짜, 값] 목록. 없는 지표는 빈 목록.
     * 응답: {@code {series: [{id, points: [["2026-10-01", 1234.0], …]}]}}
     */
    public Map<String, Object> data(List<String> ids, LocalDate from, LocalDate to) {
        Map<String, List<Object[]>> byId = new LinkedHashMap<>();
        ids.forEach(id -> byId.put(id, new ArrayList<>()));
        if (!ids.isEmpty()) {
            String marks = String.join(",", ids.stream().map(id -> "?").toList());
            List<Object> args = new ArrayList<>(ids);
            args.add(Date.valueOf(from));
            args.add(Date.valueOf(to));
            try {
                jdbcTemplate.query(
                        "SELECT series_id, obs_date, value FROM series_value WHERE series_id IN (" + marks + ")"
                                + " AND obs_date BETWEEN ? AND ? ORDER BY series_id, obs_date",
                        (rs, rowNum) -> new Point(rs.getString("series_id"), rs.getDate("obs_date").toLocalDate(),
                                rs.getDouble("value")),
                        args.toArray()
                ).forEach(p -> byId.get(p.id()).add(new Object[]{p.date().toString(), p.value()}));
            } catch (DataAccessException e) {
                logger.warn("시계열 값 조회 실패 {}: {}", ids, e.getMessage());
            }
        }
        List<Map<String, Object>> series = new ArrayList<>();
        byId.forEach((id, points) -> {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("id", id);
            s.put("points", points);
            series.add(s);
        });
        return Map.of("series", series);
    }

    /** "a, b,a,,c" → [a, b, c] — 공백·빈 값·중복 제거, 순서 유지 */
    public static List<String> parseIds(String raw) {
        if (raw == null) return List.of();
        return Arrays.stream(raw.split(",")).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
    }

    private static String text(Date d) {
        return d == null ? null : d.toLocalDate().toString();
    }

    record Point(String id, LocalDate date, double value) {}
}
