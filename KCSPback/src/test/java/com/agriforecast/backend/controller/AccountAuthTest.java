package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.AccountService;
import com.agriforecast.backend.service.PasswordResetService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 마이페이지 API 인증. 탈퇴한 계정은 토큰이 남아 있어도 막혀야 한다 */
@WebMvcTest(AccountController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class AccountAuthTest {

    @Autowired MockMvc mvc;
    @Autowired JwtProvider jwtProvider;
    @MockitoBean AccountService accountService;
    @MockitoBean PasswordResetService passwordResetService;

    @Test
    void 토큰_없이_마이페이지는_401() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        verify(accountService, never()).profile(any());
    }

    @Test
    void 탈퇴한_계정의_토큰은_거절한다() throws Exception {
        when(accountService.isActive(7)).thenReturn(false);
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + jwtProvider.issue(7)))
                .andExpect(status().isUnauthorized());
        verify(accountService, never()).profile(any());
    }

    @Test
    void 활성_계정은_토큰의_회원번호로_조회한다() throws Exception {
        when(accountService.isActive(7)).thenReturn(true);
        when(accountService.profile(7)).thenReturn(Optional.of(Map.of("id", "farmer_01")));
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + jwtProvider.issue(7)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("farmer_01"));
    }

    @Test
    void 아이디_찾기와_재설정은_로그인_없이_된다() throws Exception {
        when(accountService.findMaskedIds("김농부", "kim@example.com")).thenReturn(java.util.List.of("fa*****01"));
        mvc.perform(post("/api/auth/find-id").contentType("application/json")
                        .content("{\"name\":\"김농부\",\"email\":\"kim@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids[0]").value("fa*****01"));
        mvc.perform(get("/api/auth/password-reset/available")).andExpect(status().isOk());
    }
}
