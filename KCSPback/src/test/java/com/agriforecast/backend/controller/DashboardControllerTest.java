package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.AccountService;
import com.agriforecast.backend.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 대시보드 API — 로그인 없이 열리고, 배치가 쓴 JSON 을 그대로 내려준다. DB 없이 컨트롤러와 보안 설정만 띄운다 */
@WebMvcTest(DashboardController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class DashboardControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean DashboardService dashboardService;
    @MockitoBean AccountService accountService;

    @Test
    void 로그인_없이_품목_목록을_본다() throws Exception {
        when(dashboardService.listItems()).thenReturn(List.of(Map.of("item", "양파", "target", "202610상순")));

        mvc.perform(get("/api/dashboard/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].item").value("양파"))
                .andExpect(jsonPath("$[0].target").value("202610상순"));
    }

    @Test
    void 인사이트_JSON_원문을_그대로_준다() throws Exception {
        when(dashboardService.findPayload("양파"))
                .thenReturn(Optional.of("{\"item\":\"양파\",\"headline\":{\"direction\":\"down\"}}"));

        mvc.perform(get("/api/dashboard").param("item", "양파"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.item").value("양파"))
                .andExpect(jsonPath("$.headline.direction").value("down"));
    }

    @Test
    void 아직_계산_전인_품목은_404() throws Exception {
        when(dashboardService.findPayload("오이")).thenReturn(Optional.empty());

        mvc.perform(get("/api/dashboard").param("item", "오이"))
                .andExpect(status().isNotFound());
    }
}
