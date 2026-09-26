package com.agriforecast.backend.security;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/** 토큰 발급·검증. 외부 의존 없음 */
class JwtProviderTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-1234";

    @Test
    void 발급한_토큰에서_회원번호를_꺼낸다() {
        JwtProvider p = new JwtProvider(SECRET, 12);
        assertEquals(Optional.of(5), p.verify(p.issue(5)));
    }

    @Test
    void 다른_키로_서명한_토큰과_변조된_토큰은_거절한다() {
        JwtProvider mine = new JwtProvider(SECRET, 12);
        JwtProvider other = new JwtProvider("another-secret-another-secret-12345678", 12);
        String token = mine.issue(5);

        assertTrue(other.verify(token).isEmpty());
        assertTrue(mine.verify(token.substring(0, token.length() - 2) + "xx").isEmpty());
        assertTrue(mine.verify("not-a-token").isEmpty());
    }

    @Test
    void 만료된_토큰은_거절한다() throws InterruptedException {
        JwtProvider expired = new JwtProvider(SECRET, 0);
        String token = expired.issue(5);
        Thread.sleep(1100);  // exp 는 초 단위라 같은 초 안이면 아직 유효할 수 있다
        assertTrue(expired.verify(token).isEmpty());
    }
}
