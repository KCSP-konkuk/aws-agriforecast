package com.agriforecast.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

/**
 * 로그인 토큰(JWT) 발급·검증. 토큰에는 회원 번호(SEQ_NO_A010)만 담는다.
 *
 * 서명 키는 application-secret.properties 의 jwt.secret(32자 이상).
 * 없으면 기동할 때마다 임의 키를 만든다 — 동작은 하지만 재시작하면 모두 다시 로그인해야 한다.
 */
@Component
public class JwtProvider {

    private static final Logger logger = LoggerFactory.getLogger(JwtProvider.class);

    private final SecretKey key;
    private final Duration ttl;

    public JwtProvider(@Value("${jwt.secret:}") String secret,
                       @Value("${jwt.expiration-hours:12}") long expirationHours) {
        this.key = Keys.hmacShaKeyFor(resolveSecret(secret));
        this.ttl = Duration.ofHours(expirationHours);
    }

    private static byte[] resolveSecret(String secret) {
        if (secret != null && secret.length() >= 32) {
            return secret.getBytes(StandardCharsets.UTF_8);
        }
        logger.warn("jwt.secret 이 없거나 32자 미만이라 임시 키를 사용합니다. 재시작하면 로그인이 풀립니다.");
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        return random;
    }

    public String issue(Integer userSeq) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userSeq))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** 서명·만료가 유효하면 회원 번호, 아니면 빈 값 */
    public Optional<Integer> verify(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.of(Integer.valueOf(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
