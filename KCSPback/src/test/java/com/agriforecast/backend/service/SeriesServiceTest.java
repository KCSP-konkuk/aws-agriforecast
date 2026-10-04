package com.agriforecast.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 통합 시계열 조회. DB 없이 JdbcTemplate 만 흉내 낸다 */
class SeriesServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final SeriesService service = new SeriesService(jdbc);
    private final LocalDate from = LocalDate.of(2026, 1, 1);
    private final LocalDate to = LocalDate.of(2026, 10, 4);

    @Test
    void 지표_목록은_공백_빈값_중복을_걸러_순서대로() {
        assertEquals(List.of("a", "b", "c"), SeriesService.parseIds(" a, b,a,,c "));
        assertEquals(List.of(), SeriesService.parseIds(null));
        assertEquals(List.of(), SeriesService.parseIds(" , "));
    }

    @Test
    @SuppressWarnings("unchecked")
    void 배치_첫_실행_전이면_목록은_빈_목록() {
        when(jdbc.query(anyString(), any(RowMapper.class))).thenThrow(new DataAccessResourceFailureException("no table"));

        assertEquals(List.of(), service.catalog());
    }

    @Test
    @SuppressWarnings("unchecked")
    void 값은_요청한_순서대로_묶고_없는_지표는_빈_목록() {
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of(
                new SeriesService.Point("auction:a", LocalDate.of(2026, 9, 1), 50.0),
                new SeriesService.Point("retail:a", LocalDate.of(2026, 9, 1), 1000.0),
                new SeriesService.Point("retail:a", LocalDate.of(2026, 9, 2), 1100.0)));

        Map<String, Object> out = service.data(List.of("retail:a", "auction:a", "fx:usd"), from, to);
        List<Map<String, Object>> series = (List<Map<String, Object>>) out.get("series");

        assertEquals(List.of("retail:a", "auction:a", "fx:usd"), series.stream().map(s -> s.get("id")).toList());
        List<Object[]> retail = (List<Object[]>) series.get(0).get("points");
        assertArrayEquals(new Object[]{"2026-09-01", 1000.0}, retail.get(0));
        assertEquals(2, retail.size());
        assertEquals(List.of(), series.get(2).get("points"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void 조회가_실패해도_지표마다_빈_목록() {
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenThrow(new DataAccessResourceFailureException("down"));

        List<Map<String, Object>> series = (List<Map<String, Object>>) service.data(List.of("retail:a"), from, to).get("series");
        assertEquals(1, series.size());
        assertEquals(List.of(), series.get(0).get("points"));
    }
}
