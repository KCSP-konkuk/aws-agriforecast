package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 수집 트리거는 nginx 를 거친(X-Real-IP 가 붙은) 외부 요청을 막고, 서버 안 직접 요청만 받는다.
 */
@WebMvcTest(DataCollectController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class CollectGuardTest {

    @Autowired MockMvc mvc;
    @MockitoBean NongnetService nongnetService;
    @MockitoBean SupplyCollectService supplyCollectService;
    @MockitoBean OilPriceCollectService oilPriceCollectService;
    @MockitoBean KosisService kosisService;
    @MockitoBean ExchangeRateCollectService exchangeRateCollectService;
    @MockitoBean StationWeatherCollectService stationWeatherCollectService;
    @MockitoBean KamisRetailService kamisRetailService;
    @MockitoBean MarketBriefService marketBriefService;
    @MockitoBean AccountService accountService;

    @Test
    void nginx_를_거친_외부_요청은_403() throws Exception {
        mvc.perform(post("/api/collect/community/brief").header("X-Real-IP", "1.2.3.4"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("수집 요청은 서버 안에서만 할 수 있습니다."));
        verifyNoInteractions(marketBriefService);
    }

    @Test
    void 인코딩한_경로로_돌아가도_막는다() throws Exception {
        // 방화벽(StrictHttpFirewall)이 먼저 400 으로 거절하거나 필터가 403 — 어느 쪽이든 수집까지 가지 않는다
        mvc.perform(post("/api/%63ollect/community/brief").header("X-Real-IP", "1.2.3.4"))
                .andExpect(status().is4xxClientError());
        verifyNoInteractions(marketBriefService);
    }

    @Test
    void 서버_안_직접_요청은_통과() throws Exception {
        when(marketBriefService.publish(any())).thenReturn(3);
        mvc.perform(post("/api/collect/community/brief"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.written").value(3));
    }
}
