package com.agriforecast.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 수집 트리거(/api/collect/**)는 서버 안에서 8080 에 직접 붙은 요청만 받는다.
 * 외부 요청은 전부 nginx 를 거치고, nginx 는 X-Real-IP 를 항상 덮어써서 붙인다 → 이 헤더가 있으면 403.
 * 백엔드 8080 은 보안 그룹에서 닫혀 있다. 수동 실행: 서버에서 curl -X POST localhost:8080/api/collect/...
 */
public class CollectLocalOnlyFilter extends OncePerRequestFilter {

    static final String PROXY_HEADER = "X-Real-IP";
    private static final UrlPathHelper PATHS = new UrlPathHelper();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // getRequestURI 는 퍼센트 인코딩 그대로라(/api/%63ollect) 디코딩·정리된 경로로 본다
        return !PATHS.getPathWithinApplication(request).startsWith("/api/collect");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getHeader(PROXY_HEADER) != null) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("{\"message\":\"수집 요청은 서버 안에서만 할 수 있습니다.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
