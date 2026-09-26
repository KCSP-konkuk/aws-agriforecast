package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.SignupRequest;

import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 회원가입 입력 규칙. 프론트(Signup.jsx)도 같은 규칙으로 미리 안내하지만 서버가 최종 판정한다.
 * 길이 상한은 DB 컬럼(MemberUser.ID 20, MemberProfile.NAME 20, EMAIL 50)에 맞춘다.
 */
public final class SignupValidator {

    private static final Pattern USERNAME = Pattern.compile("^[a-z0-9_]{4,20}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    /** 문제가 있는 입력 칸과 안내 문구 */
    public record Violation(String field, String message) {}

    private SignupValidator() {}

    public static Optional<Violation> usernameProblem(String username) {
        if (username == null || !USERNAME.matcher(username).matches()) {
            return Optional.of(new Violation("username", "아이디는 영문 소문자·숫자·밑줄(_)로 4~20자여야 합니다."));
        }
        return Optional.empty();
    }

    public static Optional<Violation> validate(SignupRequest r) {
        Optional<Violation> username = usernameProblem(r.getUsername());
        if (username.isPresent()) return username;

        String name = r.getFullname() == null ? "" : r.getFullname().trim();
        if (name.isEmpty() || name.length() > 20) {
            return Optional.of(new Violation("fullname", "이름은 1~20자로 입력해 주세요."));
        }

        String email = r.getEmail() == null ? "" : r.getEmail().trim();
        if (email.length() > 50 || !EMAIL.matcher(email).matches()) {
            return Optional.of(new Violation("email", "올바른 이메일 주소를 입력해 주세요."));
        }

        String pw = r.getPassword() == null ? "" : r.getPassword();
        if (pw.length() < 8 || pw.length() > 64 || !pw.matches(".*[A-Za-z].*") || !pw.matches(".*[0-9].*")) {
            return Optional.of(new Violation("password", "비밀번호는 영문과 숫자를 섞어 8자 이상이어야 합니다."));
        }
        return Optional.empty();
    }
}
