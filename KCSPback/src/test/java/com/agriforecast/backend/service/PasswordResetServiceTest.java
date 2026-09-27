package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.AccountResponse;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.MemberUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 비밀번호 재설정 코드 규칙. 메일·시계를 가짜로 바꿔 외부 없이 돈다 */
class PasswordResetServiceTest {

    /** 보낸 메일을 모아 두는 가짜 */
    static class FakeMail implements ResetMailSender {
        boolean available = true;
        final List<String[]> sent = new ArrayList<>();

        public boolean available() { return available; }

        public void send(String to, String subject, String body) { sent.add(new String[]{to, subject, body}); }

        String lastCode() {
            Matcher m = Pattern.compile("(\\d{6})").matcher(sent.get(sent.size() - 1)[2]);
            assertTrue(m.find());
            return m.group(1);
        }
    }

    /** 원하는 만큼 앞으로 돌릴 수 있는 시계 */
    static class MovableClock extends Clock {
        Instant now = Instant.parse("2026-09-27T01:00:00Z");
        public ZoneId getZone() { return ZoneId.of("UTC"); }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
        void pass(Duration d) { now = now.plus(d); }
    }

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final FakeMail mail = new FakeMail();
    private final MovableClock clock = new MovableClock();
    private MemberUser user;
    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        MemberUserRepository repo = mock(MemberUserRepository.class);
        user = AccountServiceTest.member(7, "farmer_01", "김농부", "kim@example.com", "abcd1234", encoder);
        when(repo.findByUserId("farmer_01")).thenReturn(Optional.of(user));
        when(repo.findByUserId("nobody")).thenReturn(Optional.empty());
        service = new PasswordResetService(repo, new AccountService(repo, encoder), mail, clock);
    }

    @Test
    void 코드를_확인하면_새_비밀번호로_바뀌고_코드는_한_번만_쓴다() {
        assertTrue(service.request("farmer_01", "KIM@example.com").isSuccess());   // 이메일 대소문자 무시
        assertEquals("kim@example.com", mail.sent.get(0)[0]);
        String code = mail.lastCode();

        assertTrue(service.confirm("farmer_01", code, "newpass123").isSuccess());
        assertTrue(encoder.matches("newpass123", user.getAuthPassword().getPassword()));
        assertFalse(service.confirm("farmer_01", code, "again1234").isSuccess());
    }

    @Test
    void 계정이_없거나_이메일이_틀려도_같은_안내를_하고_메일은_안_보낸다() {
        AccountResponse none = service.request("nobody", "kim@example.com");
        AccountResponse wrongEmail = service.request("farmer_01", "other@example.com");
        assertEquals(PasswordResetService.SENT_MESSAGE, none.getMessage());
        assertEquals(PasswordResetService.SENT_MESSAGE, wrongEmail.getMessage());
        assertTrue(mail.sent.isEmpty());
    }

    @Test
    void 코드는_10분이_지나면_만료된다() {
        service.request("farmer_01", "kim@example.com");
        String code = mail.lastCode();
        clock.pass(Duration.ofMinutes(11));
        assertEquals("code", service.confirm("farmer_01", code, "newpass123").getField());
        assertTrue(encoder.matches("abcd1234", user.getAuthPassword().getPassword()));
    }

    @Test
    void 코드를_5번_틀리면_맞는_코드도_더는_못_쓴다() {
        service.request("farmer_01", "kim@example.com");
        String code = mail.lastCode();
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) {
            assertFalse(service.confirm("farmer_01", wrong, "newpass123").isSuccess());
        }
        assertFalse(service.confirm("farmer_01", code, "newpass123").isSuccess());
    }

    @Test
    void 약한_새_비밀번호면_거절하고_코드는_남긴다() {
        service.request("farmer_01", "kim@example.com");
        String code = mail.lastCode();
        assertEquals("newPassword", service.confirm("farmer_01", code, "short1").getField());
        assertTrue(service.confirm("farmer_01", code, "newpass123").isSuccess());
    }

    @Test
    void 재요청은_1분_뒤부터이고_없는_계정도_똑같다() {
        service.request("farmer_01", "kim@example.com");
        assertFalse(service.request("farmer_01", "kim@example.com").isSuccess());
        service.request("nobody", "a@b.com");
        assertFalse(service.request("nobody", "a@b.com").isSuccess());

        clock.pass(Duration.ofSeconds(61));
        assertTrue(service.request("farmer_01", "kim@example.com").isSuccess());
        assertEquals(2, mail.sent.size());
    }

    @Test
    void 메일_설정이_없으면_준비_중으로_안내한다() {
        mail.available = false;
        assertFalse(service.available());
        assertFalse(service.request("farmer_01", "kim@example.com").isSuccess());
        assertTrue(mail.sent.isEmpty());
    }
}
