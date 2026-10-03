package com.agriforecast.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 대시보드 가격 인사이트 조회.
 *
 * <p>계산은 모델 배치 {@code KCSPmodel/batch/pipeline_insight.py} 가 매일 12:40 KST 에 해서
 * {@code item_insight}(품목당 JSON 1행)에 쓴다. 백엔드는 품목 목록과 JSON 원문을 그대로 전달만 한다 —
 * 품목 이름을 코드에 두지 않으므로 배치에 품목이 늘면 화면도 그대로 따라온다.
 */
@Service
public class DashboardService {

    private static final Logger logger = LoggerFactory.getLogger(DashboardService.class);

    static final String TABLE = "item_insight";

    private final JdbcTemplate jdbcTemplate;

    public DashboardService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** 인사이트가 있는 품목 (이름순). 배치 첫 실행 전이라 테이블이 없으면 빈 목록 */
    public List<Map<String, Object>> listItems() {
        try {
            return jdbcTemplate.query(
                    "SELECT item_name, target_date, updated_at FROM " + TABLE + " ORDER BY item_name",
                    (rs, rowNum) -> item(rs.getString("item_name"), rs.getString("target_date"),
                            rs.getTimestamp("updated_at")));
        } catch (DataAccessException e) {
            logger.warn("대시보드 품목 조회 실패(배치 첫 실행 전일 수 있음): {}", e.getMessage());
            return List.of();
        }
    }

    /** 품목 인사이트 JSON 원문. 없으면 empty */
    public Optional<String> findPayload(String item) {
        try {
            List<String> rows = jdbcTemplate.queryForList(
                    "SELECT payload FROM " + TABLE + " WHERE item_name = ?", String.class, item);
            return rows.isEmpty() ? Optional.empty() : Optional.ofNullable(rows.get(0));
        } catch (DataAccessException e) {
            logger.warn("대시보드 인사이트 조회 실패 [{}]: {}", item, e.getMessage());
            return Optional.empty();
        }
    }

    static Map<String, Object> item(String name, String target, Timestamp updatedAt) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("item", name);
        m.put("target", target);
        m.put("updatedAt", updatedAt == null ? null : updatedAt.toInstant().toString());
        return m;
    }
}
