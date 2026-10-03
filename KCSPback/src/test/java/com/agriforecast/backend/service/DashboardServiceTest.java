package com.agriforecast.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 대시보드 인사이트 조회. DB 없이 JdbcTemplate 만 흉내 낸다 */
class DashboardServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final DashboardService service = new DashboardService(jdbc);

    @Test
    @SuppressWarnings("unchecked")
    void 배치_첫_실행_전이라_테이블이_없으면_빈_목록() {
        when(jdbc.query(anyString(), any(RowMapper.class))).thenThrow(new DataAccessResourceFailureException("no table"));

        assertEquals(List.of(), service.listItems());
    }

    @Test
    void 인사이트가_없으면_empty_있으면_원문() {
        when(jdbc.queryForList(anyString(), eq(String.class), eq("오이"))).thenReturn(List.of());
        when(jdbc.queryForList(anyString(), eq(String.class), eq("양파"))).thenReturn(List.of("{\"item\":\"양파\"}"));

        assertEquals(Optional.empty(), service.findPayload("오이"));
        assertEquals(Optional.of("{\"item\":\"양파\"}"), service.findPayload("양파"));
    }

    @Test
    void 조회가_실패해도_empty() {
        when(jdbc.queryForList(anyString(), eq(String.class), eq("양파")))
                .thenThrow(new DataAccessResourceFailureException("down"));

        assertEquals(Optional.empty(), service.findPayload("양파"));
    }

    @Test
    void 품목_행의_갱신_시각은_ISO_문자열() {
        Map<String, Object> row = DashboardService.item("양파", "202610상순",
                Timestamp.from(Instant.parse("2026-10-03T03:40:00Z")));

        assertEquals("양파", row.get("item"));
        assertEquals("202610상순", row.get("target"));
        assertEquals("2026-10-03T03:40:00Z", row.get("updatedAt"));
        assertNull(DashboardService.item("양파", "202610상순", null).get("updatedAt"));
    }
}
