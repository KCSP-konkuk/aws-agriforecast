package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.AccountResponse;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.MemberUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 비밀번호 재설정: 아이디·가입 이메일 확인 → 6자리 코드 메일 → 코드 확인 후 새 비밀번호.
 *  - 코드는 10분 유효, 5번 틀리면 폐기, 한 번 쓰면 폐기. 재요청은 1분 뒤부터
 *  - 요청 결과 문구는 계정이 있든 없든 같다 (아이디·이메일 조합으로 가입 여부를 캐내지 못하게)
 *  - 코드는 해시만 메모리에 둔다. 서버를 재시작하면 진행 중인 코드는 무효 — 10분짜리라 DB 에 두지 않았다
 */
@Service
@Transactional
public class PasswordResetService {

    private static final Logger logger = LoggerFactory.getLogger(PasswordResetService.class);

    static final Duration CODE_TTL = Duration.ofMinutes(10);
    static final Duration RESEND_AFTER = Duration.ofMinutes(1);
    static final int MAX_ATTEMPTS = 5;
    static final String SENT_MESSAGE = "입력한 아이디와 이메일이 맞으면 인증 코드를 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.";

    private record Pending(String codeHash, Instant expiresAt, Instant sentAt, int attempts) {}

    private final Map<String, Pending> pending = new ConcurrentHashMap<>();
    // 계정이 없는 조합에도 재요청 간격을 똑같이 적용해, 응답 차이로 가입 여부가 드러나지 않게 한다
    private final Map<String, Instant> lastRequest = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private final MemberUserRepository memberUserRepository;
    private final AccountService accountService;
    private final ResetMailSender mailSender;
    private final Clock clock;

    @Autowired
    public PasswordResetService(MemberUserRepository memberUserRepository, AccountService accountService,
                                ResetMailSender mailSender) {
        this(memberUserRepository, accountService, mailSender, Clock.systemUTC());
    }

    PasswordResetService(MemberUserRepository memberUserRepository, AccountService accountService,
                         ResetMailSender mailSender, Clock clock) {
        this.memberUserRepository = memberUserRepository;
        this.accountService = accountService;
        this.mailSender = mailSender;
        this.clock = clock;
    }

    /** 재설정 화면이 처음부터 "준비 중"을 보여줄 수 있게 */
    public boolean available() {
        return mailSender.available();
    }

    @Transactional(readOnly = true)
    public AccountResponse request(String username, String email) {
        if (!mailSender.available()) {
            return AccountResponse.fail("지금은 메일 발송을 준비 중이라 비밀번호를 재설정할 수 없습니다. 관리자에게 문의해 주세요.", null);
        }
        if (username == null || email == null || username.isBlank() || email.isBlank()) {
            return AccountResponse.fail("아이디와 이메일을 입력해 주세요.", null);
        }
        Instant now = clock.instant();
        prune(now);
        Instant last = lastRequest.get(username);
        if (last != null && now.isBefore(last.plus(RESEND_AFTER))) {
            return AccountResponse.fail("인증 코드는 1분 뒤에 다시 받을 수 있습니다.", null);
        }
        lastRequest.put(username, now);

        Optional<MemberUser> user = memberUserRepository.findByUserId(username)
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .filter(u -> u.getMemberProfile() != null && email.trim().equalsIgnoreCase(u.getMemberProfile().getEmail()));
        if (user.isPresent()) {
            String code = String.format("%06d", random.nextInt(1_000_000));
            pending.put(username, new Pending(hash(code), now.plus(CODE_TTL), now, 0));
            try {
                mailSender.send(user.get().getMemberProfile().getEmail(), "[AgriForecast] 비밀번호 재설정 인증 코드",
                        "비밀번호 재설정 인증 코드: " + code + "\n\n"
                        + "10분 안에 재설정 화면에 입력해 주세요.\n"
                        + "직접 요청하지 않았다면 이 메일은 무시하셔도 됩니다. 비밀번호는 바뀌지 않습니다.");
            } catch (RuntimeException e) {
                pending.remove(username);
                lastRequest.remove(username);
                logger.error("재설정 메일 발송 실패: {}", e.getMessage());
                return AccountResponse.fail("메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", null);
            }
        }
        return AccountResponse.ok(SENT_MESSAGE);
    }

    public AccountResponse confirm(String username, String code, String newPassword) {
        Instant now = clock.instant();
        Pending p = username == null ? null : pending.get(username);
        if (p == null || now.isAfter(p.expiresAt())) {
            if (p != null) pending.remove(username);
            return AccountResponse.fail("인증 코드가 없거나 만료되었습니다. 코드를 다시 받아 주세요.", "code");
        }
        if (code == null || !MessageDigest.isEqual(hash(code.trim()).getBytes(StandardCharsets.UTF_8),
                                                   p.codeHash().getBytes(StandardCharsets.UTF_8))) {
            int attempts = p.attempts() + 1;
            if (attempts >= MAX_ATTEMPTS) {
                pending.remove(username);
                return AccountResponse.fail("인증 코드를 5번 틀려 코드가 폐기되었습니다. 코드를 다시 받아 주세요.", "code");
            }
            pending.put(username, new Pending(p.codeHash(), p.expiresAt(), p.sentAt(), attempts));
            return AccountResponse.fail("인증 코드가 올바르지 않습니다. (" + (MAX_ATTEMPTS - attempts) + "번 남음)", "code");
        }
        Optional<SignupValidator.Violation> v = SignupValidator.passwordProblem(newPassword);
        if (v.isPresent()) return AccountResponse.fail(v.get().message(), "newPassword");

        Optional<MemberUser> user = memberUserRepository.findByUserId(username)
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()));
        if (user.isEmpty()) {
            pending.remove(username);
            return AccountResponse.fail("계정을 찾을 수 없습니다.", null);
        }
        // 마이페이지 변경과 같은 규칙: 지금 비밀번호와 같으면 거절 (코드는 남겨 다시 입력할 수 있게)
        if (accountService.matches(user.get(), newPassword)) {
            return AccountResponse.fail("지금 쓰는 비밀번호와 다른 비밀번호를 입력해 주세요.", "newPassword");
        }
        accountService.setPassword(user.get(), newPassword);
        pending.remove(username);
        return AccountResponse.ok("비밀번호를 재설정했습니다. 새 비밀번호로 로그인해 주세요.");
    }

    // 없는 아이디를 마구 넣어도 메모리가 쌓이지 않게 지난 기록을 지운다
    private void prune(Instant now) {
        lastRequest.values().removeIf(t -> now.isAfter(t.plus(RESEND_AFTER)));
        pending.values().removeIf(p -> now.isAfter(p.expiresAt()));
    }

    private static String hash(String code) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
