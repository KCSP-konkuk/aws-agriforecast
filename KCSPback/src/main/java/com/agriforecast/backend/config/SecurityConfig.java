package com.agriforecast.backend.config;

import com.agriforecast.backend.security.CollectLocalOnlyFilter;
import com.agriforecast.backend.security.JwtAuthFilter;
import com.agriforecast.backend.security.JwtProvider;
import com.agriforecast.backend.service.AccountService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtProvider jwtProvider,
                                                   AccountService accountService) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // 쿠키 대신 Authorization 헤더로 인증하므로 CSRF 대상이 아니다
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(new JwtAuthFilter(jwtProvider, accountService::isActive), UsernamePasswordAuthenticationFilter.class)
            // 수집 트리거는 서버 안(8080 직접)에서만 — nginx 를 거친 외부 요청은 403
            .addFilterBefore(new CollectLocalOnlyFilter(), UsernamePasswordAuthenticationFilter.class)
            .authorizeHttpRequests(auth -> auth
                // 커뮤니티 글·댓글 작성/수정/삭제는 로그인 필요. 조회는 누구나
                .requestMatchers(HttpMethod.POST, "/api/community/**").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/community/**").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/community/**").authenticated()
                // 마이페이지(프로필·비밀번호 변경·탈퇴)
                .requestMatchers("/api/me", "/api/me/**").authenticated()
                .anyRequest().permitAll()
            )
            .exceptionHandling(e -> e.authenticationEntryPoint((request, response, ex) -> {
                response.setStatus(401);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                response.getWriter().write("{\"message\":\"로그인이 필요합니다.\"}");
            }));

        return http.build();
    }
}
