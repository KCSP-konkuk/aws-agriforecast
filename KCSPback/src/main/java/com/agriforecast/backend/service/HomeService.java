package com.agriforecast.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * 홈 화면 하이라이트 조회.
 *
 * <p>계산은 모델 배치 {@code KCSPmodel/batch/home_highlights.py} 가 통합 시계열(매일 12:50 KST) 뒤에 해서
 * {@code home_highlights}(JSON 1행)에 쓴다 — 질문 · 답 한 문장 · 차트 값과 오늘의 시장 칸. 백엔드는 JSON 원문을 그대로 전달만 한다.
 */
@Service
public class HomeService {

    private static final Logger logger = LoggerFactory.getLogger(HomeService.class);

    static final String TABLE = "home_highlights";
    static final String KEY = "home";

    private final JdbcTemplate jdbcTemplate;

    public HomeService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** 하이라이트 JSON 원문. 배치 첫 실행 전이라 테이블이나 행이 없으면 empty */
    public Optional<String> findPayload() {
        try {
            List<String> rows = jdbcTemplate.queryForList(
                    "SELECT payload FROM " + TABLE + " WHERE id = ?", String.class, KEY);
            return rows.isEmpty() ? Optional.empty() : Optional.ofNullable(rows.get(0));
        } catch (DataAccessException e) {
            logger.warn("홈 하이라이트 조회 실패(배치 첫 실행 전일 수 있음): {}", e.getMessage());
            return Optional.empty();
        }
    }
}
