package com.agriforecast.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.function.Predicate;

/**
 * Authorization: Bearer <토큰> 이 유효하면 회원 번호를 인증 정보로 올린다.
 * 컨트롤러는 @AuthenticationPrincipal Integer userId 로 받는다.
 * 토큰이 유효해도 탈퇴(비활성)한 계정이면 인증 정보를 올리지 않는다.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;
    private final Predicate<Integer> isActiveUser;

    public JwtAuthFilter(JwtProvider jwtProvider, Predicate<Integer> isActiveUser) {
        this.jwtProvider = jwtProvider;
        this.isActiveUser = isActiveUser;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            jwtProvider.verify(header.substring(7)).filter(isActiveUser).ifPresent(userId ->
                    SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(userId, null, List.of())));
        }
        chain.doFilter(request, response);
    }
}
