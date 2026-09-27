package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.AuthPassword;
import com.agriforecast.backend.entity.MemberProfile;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.MemberUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 아이디 찾기·마이페이지 규칙. 저장소만 가짜로 바꾸고 비밀번호 해시는 실제 BCrypt 를 쓴다 */
class AccountServiceTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);  // 테스트라 비용을 낮춘다
    private MemberUserRepository repo;
    private AccountService service;
    private MemberUser user;

    static MemberUser member(int seq, String id, String name, String email, String rawPassword, PasswordEncoder encoder) {
        MemberUser u = new MemberUser();
        u.setSeqNoA010(seq);
        u.setId(id);
        u.setIsActive(true);
        MemberProfile p = new MemberProfile();
        p.setName(name);
        p.setEmail(email);
        p.setMemberUser(u);
        AuthPassword a = new AuthPassword();
        a.setPassword(encoder.encode(rawPassword));
        a.setMemberUser(u);
        u.setMemberProfile(p);
        u.setAuthPassword(a);
        return u;
    }

    @BeforeEach
    void setUp() {
        repo = mock(MemberUserRepository.class);
        service = new AccountService(repo, encoder);
        user = member(7, "farmer_01", "김농부", "kim@example.com", "abcd1234", encoder);
        when(repo.findById(7)).thenReturn(Optional.of(user));
    }

    @Test
    void 아이디는_앞뒤만_보이게_가린다() {
        assertEquals("fa*****01", AccountService.mask("farmer_01"));
        assertEquals("ab*de", AccountService.mask("abcde"));
        assertEquals("a**d", AccountService.mask("abcd"));
    }

    @Test
    void 아이디_찾기는_가린_아이디만_돌려준다() {
        when(repo.findActiveByNameAndEmail("김농부", "kim@example.com")).thenReturn(List.of(user));
        assertEquals(List.of("fa*****01"), service.findMaskedIds(" 김농부 ", "kim@example.com"));
        assertEquals(List.of(), service.findMaskedIds("", "kim@example.com"));
    }

    @Test
    void 비밀번호_변경은_현재_비밀번호와_규칙을_확인한다() {
        assertEquals("currentPassword", service.changePassword(7, "wrong999", "newpass123").getField());
        assertEquals("newPassword", service.changePassword(7, "abcd1234", "short1").getField());
        assertEquals("newPassword", service.changePassword(7, "abcd1234", "abcd1234").getField());

        assertTrue(service.changePassword(7, "abcd1234", "newpass123").isSuccess());
        assertTrue(encoder.matches("newpass123", user.getAuthPassword().getPassword()));
    }

    @Test
    void 이름_변경은_1에서_20자() {
        assertFalse(service.updateName(7, "   ").isSuccess());
        assertTrue(service.updateName(7, " 이농부 ").isSuccess());
        assertEquals("이농부", user.getMemberProfile().getName());
    }

    @Test
    void 탈퇴는_비밀번호를_확인하고_비활성화한다() {
        assertEquals("password", service.withdraw(7, "wrong999").getField());
        assertTrue(user.getIsActive());

        assertTrue(service.withdraw(7, "abcd1234").isSuccess());
        assertFalse(user.getIsActive());
        assertFalse(service.isActive(7));          // 남은 토큰도 이걸로 막힌다
        assertTrue(service.profile(7).isEmpty());
    }
}
