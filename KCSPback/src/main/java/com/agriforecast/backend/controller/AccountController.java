package com.agriforecast.backend.controller;

import com.agriforecast.backend.dto.AccountResponse;
import com.agriforecast.backend.service.AccountService;
import com.agriforecast.backend.service.PasswordResetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 계정 기능.
 *  - /api/auth/** : 로그인 전 (아이디 찾기, 비밀번호 재설정)
 *  - /api/me/**   : 로그인 필요 (마이페이지) — SecurityConfig 에서 인증을 요구한다
 */
@RestController
@RequestMapping("/api")
public class AccountController {

    private final AccountService accountService;
    private final PasswordResetService passwordResetService;

    public AccountController(AccountService accountService, PasswordResetService passwordResetService) {
        this.accountService = accountService;
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/auth/find-id")
    public Map<String, Object> findId(@RequestBody Map<String, String> body) {
        List<String> ids = accountService.findMaskedIds(body.get("name"), body.get("email"));
        return Map.of("ids", ids);
    }

    @GetMapping("/auth/password-reset/available")
    public Map<String, Object> resetAvailable() {
        return Map.of("available", passwordResetService.available());
    }

    @PostMapping("/auth/password-reset/request")
    public ResponseEntity<AccountResponse> requestReset(@RequestBody Map<String, String> body) {
        return result(passwordResetService.request(body.get("username"), body.get("email")));
    }

    @PostMapping("/auth/password-reset/confirm")
    public ResponseEntity<AccountResponse> confirmReset(@RequestBody Map<String, String> body) {
        return result(passwordResetService.confirm(body.get("username"), body.get("code"), body.get("newPassword")));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal Integer userId) {
        return accountService.profile(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @PutMapping("/me/profile")
    public ResponseEntity<AccountResponse> updateProfile(@AuthenticationPrincipal Integer userId,
                                                         @RequestBody Map<String, String> body) {
        return result(accountService.updateName(userId, body.get("name")));
    }

    @PutMapping("/me/password")
    public ResponseEntity<AccountResponse> changePassword(@AuthenticationPrincipal Integer userId,
                                                          @RequestBody Map<String, String> body) {
        return result(accountService.changePassword(userId, body.get("currentPassword"), body.get("newPassword")));
    }

    @PostMapping("/me/withdraw")
    public ResponseEntity<AccountResponse> withdraw(@AuthenticationPrincipal Integer userId,
                                                    @RequestBody Map<String, String> body) {
        return result(accountService.withdraw(userId, body.get("password")));
    }

    private static ResponseEntity<AccountResponse> result(AccountResponse r) {
        return r.isSuccess() ? ResponseEntity.ok(r) : ResponseEntity.badRequest().body(r);
    }
}
