package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.AccountResponse;
import com.agriforecast.backend.entity.AuthPassword;
import com.agriforecast.backend.entity.MemberProfile;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.MemberUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** 아이디 찾기·마이페이지(프로필, 비밀번호 변경, 탈퇴) */
@Service
@Transactional
public class AccountService {

    private final MemberUserRepository memberUserRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountService(MemberUserRepository memberUserRepository, PasswordEncoder passwordEncoder) {
        this.memberUserRepository = memberUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 이름·이메일이 맞는 활성 계정의 아이디를 일부 가려 돌려준다.
     * 남의 이름·이메일만 알아도 아이디 전체가 드러나지 않게 한다
     */
    @Transactional(readOnly = true)
    public List<String> findMaskedIds(String name, String email) {
        if (name == null || email == null || name.isBlank() || email.isBlank()) return List.of();
        return memberUserRepository.findActiveByNameAndEmail(name.trim(), email.trim()).stream()
                .map(u -> mask(u.getId()))
                .toList();
    }

    /** 앞 2자·뒤 2자만 보이고 가운데는 * (4자면 앞 1자·뒤 1자) */
    static String mask(String id) {
        int keep = id.length() > 4 ? 2 : 1;
        return id.substring(0, keep) + "*".repeat(id.length() - keep * 2) + id.substring(id.length() - keep);
    }

    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> profile(Integer userSeq) {
        return activeUser(userSeq).map(u -> {
            MemberProfile p = u.getMemberProfile();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("seqNoA010", u.getSeqNoA010());
            m.put("id", u.getId());
            m.put("name", p != null ? p.getName() : "");
            m.put("email", p != null ? p.getEmail() : "");
            return m;
        });
    }

    public AccountResponse updateName(Integer userSeq, String name) {
        Optional<SignupValidator.Violation> v = SignupValidator.nameProblem(name);
        if (v.isPresent()) return AccountResponse.fail(v.get().message(), "name");
        Optional<MemberUser> user = activeUser(userSeq);
        if (user.isEmpty() || user.get().getMemberProfile() == null) {
            return AccountResponse.fail("계정을 찾을 수 없습니다.", null);
        }
        user.get().getMemberProfile().setName(name.trim());
        return AccountResponse.ok("이름을 변경했습니다.");
    }

    public AccountResponse changePassword(Integer userSeq, String currentPassword, String newPassword) {
        Optional<MemberUser> user = activeUser(userSeq);
        if (user.isEmpty()) return AccountResponse.fail("계정을 찾을 수 없습니다.", null);
        if (!matches(user.get(), currentPassword)) {
            return AccountResponse.fail("현재 비밀번호가 올바르지 않습니다.", "currentPassword");
        }
        Optional<SignupValidator.Violation> v = SignupValidator.passwordProblem(newPassword);
        if (v.isPresent()) return AccountResponse.fail(v.get().message(), "newPassword");
        if (currentPassword.equals(newPassword)) {
            return AccountResponse.fail("현재 비밀번호와 다른 비밀번호를 입력해 주세요.", "newPassword");
        }
        setPassword(user.get(), newPassword);
        return AccountResponse.ok("비밀번호를 변경했습니다.");
    }

    /** 탈퇴: 비밀번호 확인 후 비활성화. 쓴 글·댓글은 남긴다. 비활성 계정은 로그인·토큰 인증이 막힌다 */
    public AccountResponse withdraw(Integer userSeq, String password) {
        Optional<MemberUser> user = activeUser(userSeq);
        if (user.isEmpty()) return AccountResponse.fail("계정을 찾을 수 없습니다.", null);
        if (!matches(user.get(), password)) {
            return AccountResponse.fail("비밀번호가 올바르지 않습니다.", "password");
        }
        user.get().setIsActive(false);
        return AccountResponse.ok("탈퇴가 완료되었습니다.");
    }

    /** 토큰 인증 때 쓰는 계정 상태 확인 (탈퇴한 계정의 토큰이 남아 있어도 막는다) */
    @Transactional(readOnly = true)
    public boolean isActive(Integer userSeq) {
        return activeUser(userSeq).isPresent();
    }

    void setPassword(MemberUser user, String newPassword) {
        AuthPassword auth = user.getAuthPassword();
        auth.setPassword(passwordEncoder.encode(newPassword));
    }

    private boolean matches(MemberUser user, String rawPassword) {
        AuthPassword auth = user.getAuthPassword();
        return auth != null && rawPassword != null && passwordEncoder.matches(rawPassword, auth.getPassword());
    }

    private Optional<MemberUser> activeUser(Integer userSeq) {
        if (userSeq == null) return Optional.empty();
        return memberUserRepository.findById(userSeq).filter(u -> Boolean.TRUE.equals(u.getIsActive()));
    }
}
