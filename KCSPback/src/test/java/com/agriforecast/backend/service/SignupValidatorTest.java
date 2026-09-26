package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.SignupRequest;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** 회원가입 입력 규칙. 외부 의존 없음 */
class SignupValidatorTest {

    private static SignupRequest req(String username, String password, String name, String email) {
        return new SignupRequest(username, password, name, email);
    }

    private static String problemField(SignupRequest r) {
        return SignupValidator.validate(r).map(SignupValidator.Violation::field).orElse(null);
    }

    @Test
    void 규칙에_맞으면_통과한다() {
        assertNull(problemField(req("farmer_01", "abcd1234", "김농부", "kim@example.com")));
    }

    @Test
    void 아이디는_영문소문자_숫자_밑줄_4에서_20자() {
        assertEquals("username", problemField(req("abc", "abcd1234", "김농부", "kim@example.com")));
        assertEquals("username", problemField(req("Farmer", "abcd1234", "김농부", "kim@example.com")));
        assertEquals("username", problemField(req("농부123", "abcd1234", "김농부", "kim@example.com")));
        assertEquals("username", problemField(req("a".repeat(21), "abcd1234", "김농부", "kim@example.com")));
    }

    @Test
    void 비밀번호는_영문과_숫자를_섞어_8자_이상() {
        assertEquals("password", problemField(req("farmer", "abc123", "김농부", "kim@example.com")));
        assertEquals("password", problemField(req("farmer", "abcdefgh", "김농부", "kim@example.com")));
        assertEquals("password", problemField(req("farmer", "12345678", "김농부", "kim@example.com")));
    }

    @Test
    void 이름과_이메일_형식을_확인한다() {
        assertEquals("fullname", problemField(req("farmer", "abcd1234", "  ", "kim@example.com")));
        assertEquals("fullname", problemField(req("farmer", "abcd1234", "가".repeat(21), "kim@example.com")));
        assertEquals("email", problemField(req("farmer", "abcd1234", "김농부", "kim.example.com")));
        assertEquals("email", problemField(req("farmer", "abcd1234", "김농부", "a".repeat(45) + "@b.com")));
    }
}
