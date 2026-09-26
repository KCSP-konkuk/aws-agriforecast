package com.agriforecast.backend.controller;

import com.agriforecast.backend.config.SecurityConfig;
import com.agriforecast.backend.dto.PostResponse;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.CommentService;
import com.agriforecast.backend.service.PostService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 커뮤니티 쓰기 요청의 인증. DB·외부 없이 컨트롤러와 보안 설정만 띄운다.
 */
@WebMvcTest(CommunityController.class)
@Import({SecurityConfig.class, JwtProvider.class})
@TestPropertySource(properties = "jwt.secret=test-secret-test-secret-test-secret-1234")
class CommunityAuthTest {

    private static final String BODY = "{\"title\":\"t\",\"category\":\"자유게시판\",\"content\":\"c\"}";

    @Autowired MockMvc mvc;
    @Autowired JwtProvider jwtProvider;
    @MockitoBean PostService postService;
    @MockitoBean CommentService commentService;

    @Test
    void 토큰_없이_글을_쓰면_401과_안내_문구() throws Exception {
        mvc.perform(post("/api/community/posts").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("로그인이 필요합니다."));
        verifyNoInteractions(postService);
    }

    @Test
    void 예전처럼_X_User_Id_헤더만_보내면_거절한다() throws Exception {
        mvc.perform(post("/api/community/posts").header("X-User-Id", "5")
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(postService);
    }

    @Test
    void 위조한_토큰은_거절한다() throws Exception {
        String forged = new JwtProvider("attacker-secret-attacker-secret-1234567", 12).issue(5);
        mvc.perform(delete("/api/community/posts/1").header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(postService);
    }

    @Test
    void 유효한_토큰이면_토큰의_회원번호로_글을_쓴다() throws Exception {
        when(postService.createPost(any(), eq(7))).thenReturn(new PostResponse());
        mvc.perform(post("/api/community/posts").header("Authorization", "Bearer " + jwtProvider.issue(7))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated());
        verify(postService).createPost(any(), eq(7));
    }

    @Test
    void 글_목록_조회는_로그인_없이_된다() throws Exception {
        when(postService.getAllPosts(any())).thenReturn(org.springframework.data.domain.Page.empty());
        mvc.perform(get("/api/community/posts")).andExpect(status().isOk());
    }
}
