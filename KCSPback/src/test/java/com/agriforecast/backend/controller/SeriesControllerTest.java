package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.AccountService;
import com.agriforecast.backend.service.SeriesService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 통합 시계열 API — 로그인 없이 열리고, 지표 개수·기간을 검사한다. DB 없이 컨트롤러와 보안 설정만 띄운다 */
@WebMvcTest(SeriesController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class SeriesControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean SeriesService seriesService;
    @MockitoBean AccountService accountService;

    @Test
    void 로그인_없이_지표_목록을_본다() throws Exception {
        when(seriesService.catalog()).thenReturn(List.of(Map.of("id", "retail:양파", "freq", "daily")));

        mvc.perform(get("/api/series/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("retail:양파"));
    }

    @Test
    void 고른_지표의_값을_기간으로_받는다() throws Exception {
        when(seriesService.data(eq(List.of("retail:양파", "auction:양파")), eq(LocalDate.of(2026, 1, 1)),
                eq(LocalDate.of(2026, 10, 4))))
                .thenReturn(Map.of("series", List.of(Map.of("id", "retail:양파",
                        "points", List.<Object[]>of(new Object[]{"2026-09-01", 1000.0})))));

        mvc.perform(get("/api/series/data").param("ids", "retail:양파,auction:양파")
                        .param("from", "2026-01-01").param("to", "2026-10-04"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series[0].id").value("retail:양파"))
                .andExpect(jsonPath("$.series[0].points[0][0]").value("2026-09-01"))
                .andExpect(jsonPath("$.series[0].points[0][1]").value(1000.0));
    }

    @Test
    void 지표가_없거나_너무_많으면_400() throws Exception {
        mvc.perform(get("/api/series/data")).andExpect(status().isBadRequest());
        String nine = String.join(",", List.of("a", "b", "c", "d", "e", "f", "g", "h", "i"));
        mvc.perform(get("/api/series/data").param("ids", nine))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
        verifyNoInteractions(seriesService);
    }

    @Test
    void 시작일이_종료일보다_늦으면_400() throws Exception {
        mvc.perform(get("/api/series/data").param("ids", "retail:양파")
                        .param("from", "2026-10-04").param("to", "2026-01-01"))
                .andExpect(status().isBadRequest());
    }
}
