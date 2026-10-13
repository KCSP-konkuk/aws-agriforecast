package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.AccountService;
import com.agriforecast.backend.service.HomeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 홈 API — 로그인 없이 열리고, 배치가 쓴 JSON 을 그대로 내려준다. DB 없이 컨트롤러와 보안 설정만 띄운다 */
@WebMvcTest(HomeController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class HomeControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean HomeService homeService;
    @MockitoBean AccountService accountService;

    @Test
    void 로그인_없이_하이라이트_JSON_원문을_그대로_준다() throws Exception {
        when(homeService.findPayload()).thenReturn(Optional.of(
                "{\"questions\":[{\"key\":\"lag\",\"answer\":\"약 10일 뒤\"}],\"market\":[]}"));

        mvc.perform(get("/api/home"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.questions[0].key").value("lag"))
                .andExpect(jsonPath("$.market").isArray());
    }

    @Test
    void 아직_계산_전이면_404() throws Exception {
        when(homeService.findPayload()).thenReturn(Optional.empty());

        mvc.perform(get("/api/home")).andExpect(status().isNotFound());
    }
}
