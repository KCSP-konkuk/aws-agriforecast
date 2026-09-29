package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.AccountService;
import com.agriforecast.backend.service.CommunityVoteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 커뮤니티 투표 API 의 인증·입력 검증. DB 없이 컨트롤러와 보안 설정만 띄운다 */
@WebMvcTest(CommunityVoteController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class CommunityVoteControllerTest {

    @Autowired MockMvc mvc;
    @Autowired JwtProvider jwtProvider;
    @MockitoBean CommunityVoteService voteService;
    @MockitoBean AccountService accountService;

    @BeforeEach
    void activeUsers() {
        when(accountService.isActive(any())).thenReturn(true);
    }

    @Test
    void 로그인_없이도_현황은_보이고_내_선택은_없다() throws Exception {
        mvc.perform(get("/api/community/votes/배추")).andExpect(status().isOk());
        verify(voteService).status(eq("배추"), isNull());
    }

    @Test
    void 로그인하면_내_번호로_현황을_묻는다() throws Exception {
        String token = jwtProvider.issue(7);
        mvc.perform(get("/api/community/votes/배추").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        verify(voteService).status(eq("배추"), eq(7));
    }

    @Test
    void 토큰_없이_투표하면_401() throws Exception {
        mvc.perform(post("/api/community/votes/배추").contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\"UP\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(voteService);
    }

    @Test
    void 잘못된_품목이나_선택지는_400() throws Exception {
        when(voteService.vote(eq("자유"), any(), any())).thenThrow(new IllegalArgumentException("투표 품목이 아님: 자유"));
        String token = jwtProvider.issue(7);
        mvc.perform(post("/api/community/votes/자유").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\"UP\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("투표 품목이 아님: 자유"));
    }
}
