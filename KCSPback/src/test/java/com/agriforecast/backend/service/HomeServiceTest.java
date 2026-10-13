package com.agriforecast.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 홈 하이라이트 조회. DB 없이 JdbcTemplate 만 흉내 낸다 */
class HomeServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final HomeService service = new HomeService(jdbc);

    @Test
    void 하이라이트가_있으면_원문_없으면_empty() {
        when(jdbc.queryForList(anyString(), eq(String.class), eq("home"))).thenReturn(List.of("{\"questions\":[]}"));
        assertEquals(Optional.of("{\"questions\":[]}"), service.findPayload());

        when(jdbc.queryForList(anyString(), eq(String.class), eq("home"))).thenReturn(List.of());
        assertEquals(Optional.empty(), service.findPayload());
    }

    @Test
    void 배치_첫_실행_전이라_테이블이_없으면_empty() {
        when(jdbc.queryForList(anyString(), eq(String.class), eq("home")))
                .thenThrow(new DataAccessResourceFailureException("no table"));
        assertEquals(Optional.empty(), service.findPayload());
    }
}
