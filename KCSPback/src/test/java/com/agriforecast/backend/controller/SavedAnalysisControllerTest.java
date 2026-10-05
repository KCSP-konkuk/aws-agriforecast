package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.AccountService;
import com.agriforecast.backend.service.SavedAnalysisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 내 분석 API 의 인증·응답. DB 없이 컨트롤러와 보안 설정만 띄운다 */
@WebMvcTest(SavedAnalysisController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class SavedAnalysisControllerTest {

    @Autowired MockMvc mvc;
    @Autowired JwtProvider jwtProvider;
    @MockitoBean SavedAnalysisService service;
    @MockitoBean AccountService accountService;

    @BeforeEach
    void activeUsers() {
        when(accountService.isActive(any())).thenReturn(true);
    }

    private String bearer() {
        return "Bearer " + jwtProvider.issue(7);
    }

    @Test
    void 토큰이_없으면_401() throws Exception {
        mvc.perform(get("/api/me/analyses")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/analyses").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"a\",\"query\":\"s=a\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void 내_번호로_목록을_묻는다() throws Exception {
        when(service.list(7)).thenReturn(List.of(new SavedAnalysisService.View(1L, "양파", null, "s=a", LocalDateTime.of(2026, 10, 5, 12, 0))));
        mvc.perform(get("/api/me/analyses").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("양파"))
                .andExpect(jsonPath("$[0].query").value("s=a"));
    }

    @Test
    void 저장은_201_잘못된_값은_400() throws Exception {
        when(service.create(eq(7), eq("양파"), any(), eq("s=a"))).thenReturn(new SavedAnalysisService.View(1L, "양파", null, "s=a", null));
        mvc.perform(post("/api/me/analyses").header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"양파\",\"query\":\"s=a\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
        when(service.create(eq(7), eq(""), any(), any())).thenThrow(new IllegalArgumentException("분석 이름을 적어 주세요."));
        mvc.perform(post("/api/me/analyses").header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\",\"query\":\"s=a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("분석 이름을 적어 주세요."));
    }

    @Test
    void 이름_메모_고치기는_PUT() throws Exception {
        when(service.update(eq(7), eq(1L), eq("새 이름"), any())).thenReturn(new SavedAnalysisService.View(1L, "새 이름", null, "s=a", null));
        mvc.perform(put("/api/me/analyses/1").header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"새 이름\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("새 이름"));
    }

    @Test
    void 남의_분석을_지우면_404() throws Exception {
        doThrow(new NoSuchElementException("분석을 찾을 수 없어요.")).when(service).delete(7, 99L);
        mvc.perform(delete("/api/me/analyses/99").header("Authorization", bearer())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/me/analyses/1").header("Authorization", bearer())).andExpect(status().isNoContent());
        verify(service).delete(7, 1L);
    }
}
